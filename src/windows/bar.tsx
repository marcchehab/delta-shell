import { windows_names } from "@/windows";
import { Astal, Gdk, Gtk } from "ags/gtk4";
import { BarModule, isVertical } from "../modules/bar/bar";
import { config, theme } from "@/options";
import { createState, onCleanup } from "gnim";
import app from "ags/gtk4/app";
import giCairo from "cairo";
import { timeout } from "ags/time";
import { Workspaces } from "../modules/bar/items/workspaces";
const { position, modules, autohide } = config.bar;
const { spacing } = theme.bar;
const { BOTTOM, TOP, LEFT, RIGHT } = Astal.WindowAnchor;
const [windowsVisible, windowsVisible_set] = createState<string[]>([]);

// autohide: the trigger window on each monitor's edge reveals that monitor's bar
const autohideBars = new Map<
   Gdk.Monitor,
   { reveal: () => void; scheduleHide: (delay?: number) => void }
>();
const ghosts = new Map<Gdk.Monitor, Astal.Window>();
const [barRevealed, barRevealed_set] = createState(false);
// the revealed pill keeps the bars up while hovered, like the bar itself
let pillHovered = false;

// hold-to-show: `peek start` reveals every bar after peek-delay, `peek stop` hides
let peekTimer: ReturnType<typeof timeout> | null = null;

export function peek(start: boolean) {
   peekTimer?.cancel();
   peekTimer = null;
   if (start) {
      peekTimer = timeout(config.bar["peek-delay"], () => {
         peekTimer = null;
         autohideBars.forEach((b) => b.reveal());
      });
   } else {
      autohideBars.forEach((b) => b.scheduleHide(0));
   }
}

function anchor() {
   switch (position) {
      case "top":
         return TOP | LEFT | RIGHT;
      case "bottom":
         return BOTTOM | LEFT | RIGHT;
      case "right":
         return RIGHT | BOTTOM | TOP;
      case "left":
         return LEFT | BOTTOM | TOP;
   }
}

export function BarWindow({
   gdkmonitor,
   $,
}: JSX.IntrinsicElements["window"] & { gdkmonitor: Gdk.Monitor }) {
   const windows = [
      windows_names.powermenu,
      windows_names.verification,
      windows_names.calendar,
      windows_names.quicksettings,
      windows_names.applauncher,
      windows_names.weather,
      windows_names.notificationslist,
      windows_names.volume,
      windows_names.network,
      windows_names.bluetooth,
      windows_names.power,
      windows_names.clipboard,
   ];
   let bar: Astal.Window;

   const appconnect = app.connect("window-toggled", (_, win) => {
      const winName = win.name;
      if (!windows.includes(winName)) return;
      const newVisible = windowsVisible.get();

      if (win.visible) {
         if (!newVisible.includes(winName)) {
            newVisible.push(winName);
         }
      } else {
         const index = newVisible.indexOf(winName);
         if (index > -1) {
            newVisible.splice(index, 1);
         }
      }

      windowsVisible_set(newVisible);

      bar.set_layer(
         newVisible.length > 0 ? Astal.Layer.OVERLAY : Astal.Layer.TOP,
      );
      if (autohide && newVisible.length === 0) scheduleHide();
   });

   onCleanup(() => app.disconnect(appconnect));

   let hovered = false;
   let hideTimer: ReturnType<typeof timeout> | null = null;

   function reveal() {
      hideTimer?.cancel();
      hideTimer = null;
      bar.show();
      barRevealed_set(true);
      ghosts.get(gdkmonitor)?.hide();
   }

   function scheduleHide(delay = 400) {
      hideTimer?.cancel();
      hideTimer = timeout(delay, () => {
         hideTimer = null;
         if (hovered || pillHovered || windowsVisible.get().length > 0)
            return;
         bar.hide();
         barRevealed_set(false);
         ghosts.get(gdkmonitor)?.show();
      });
   }

   if (autohide) {
      autohideBars.set(gdkmonitor, { reveal, scheduleHide });
      onCleanup(() => {
         hideTimer?.cancel();
         autohideBars.delete(gdkmonitor);
      });
   }

   return (
      <window
         visible={!autohide}
         name={windows_names.bar}
         namespace={windows_names.bar}
         class={windows_names.bar}
         gdkmonitor={gdkmonitor}
         exclusivity={
            autohide ? Astal.Exclusivity.IGNORE : Astal.Exclusivity.EXCLUSIVE
         }
         layer={Astal.Layer.TOP}
         anchor={anchor()}
         application={app}
         $={(self) => {
            bar = self;
            if ($) $(self);
         }}
      >
         {autohide && (
            <Gtk.EventControllerMotion
               onEnter={() => {
                  hovered = true;
                  reveal();
               }}
               onLeave={() => {
                  hovered = false;
                  scheduleHide();
               }}
            />
         )}
         <BarModule gdkmonitor={gdkmonitor} />
      </window>
   );
}

// translucent, click-through workspaces where the hidden bar would show them
export function BarGhostWindow({
   gdkmonitor,
   $,
}: JSX.IntrinsicElements["window"] & { gdkmonitor: Gdk.Monitor }) {
   return (
      <window
         visible
         name={windows_names.bar_ghost}
         namespace={windows_names.bar_ghost}
         class={windows_names.bar_ghost}
         gdkmonitor={gdkmonitor}
         exclusivity={Astal.Exclusivity.IGNORE}
         layer={Astal.Layer.TOP}
         anchor={anchor()}
         application={app}
         $={(self) => {
            ghosts.set(gdkmonitor, self);
            onCleanup(() => ghosts.delete(gdkmonitor));
            if ($) $(self);
            self
               .get_native()
               ?.get_surface()
               ?.set_input_region(new giCairo.Region());
         }}
      >
         <BarModule gdkmonitor={gdkmonitor} ghost />
      </window>
   );
}

// floating workspaces pill: translucent and click-through, solid and
// clickable while the bar is revealed
export function WorkspacesPillWindow({
   gdkmonitor,
   $,
}: JSX.IntrinsicElements["window"] & { gdkmonitor: Gdk.Monitor }) {
   const pos = config.bar["workspaces-pill"];
   const pillAnchor = {
      top: TOP,
      "top-left": TOP | LEFT,
      "top-right": TOP | RIGHT,
      bottom: BOTTOM,
   }[pos as "top"];

   return (
      <window
         visible
         name={windows_names.workspaces_pill}
         namespace={windows_names.workspaces_pill}
         class={barRevealed((r) =>
            [windows_names.workspaces_pill, pos, r ? "revealed" : ""].join(" "),
         )}
         gdkmonitor={gdkmonitor}
         exclusivity={Astal.Exclusivity.IGNORE}
         layer={Astal.Layer.OVERLAY}
         anchor={pillAnchor}
         application={app}
         $={(self) => {
            if ($) $(self);
            const setInput = (revealed: boolean) =>
               self
                  .get_native()
                  ?.get_surface()
                  ?.set_input_region(revealed ? null : new giCairo.Region());
            setInput(barRevealed.get());
            const unsub = barRevealed.subscribe(() => setInput(barRevealed.get()));
            onCleanup(unsub);
         }}
      >
         <Gtk.EventControllerMotion
            onEnter={() => (pillHovered = true)}
            onLeave={() => {
               pillHovered = false;
               autohideBars.forEach((b) => b.scheduleHide());
            }}
         />
         <box class={"pill"}>
            <Workspaces gdkmonitor={gdkmonitor} vertical={false} />
         </box>
      </window>
   );
}

export function BarTriggerWindow({
   gdkmonitor,
   $,
}: JSX.IntrinsicElements["window"] & { gdkmonitor: Gdk.Monitor }) {
   const edge = { top: TOP, bottom: BOTTOM, left: LEFT, right: RIGHT }[
      position
   ];
   const span =
      position === "top" || position === "bottom" ? LEFT | RIGHT : TOP | BOTTOM;

   return (
      <window
         visible
         name={windows_names.bar_trigger}
         namespace={windows_names.bar_trigger}
         class={windows_names.bar_trigger}
         gdkmonitor={gdkmonitor}
         exclusivity={Astal.Exclusivity.IGNORE}
         layer={Astal.Layer.TOP}
         anchor={edge | span}
         application={app}
         $={(self) => {
            if ($) $(self);
         }}
      >
         <box>
            <Gtk.EventControllerMotion
               onEnter={() => autohideBars.get(gdkmonitor)?.reveal()}
            />
         </box>
      </window>
   );
}

export function BarShadowWindow({
   gdkmonitor,
   $,
}: JSX.IntrinsicElements["window"] & { gdkmonitor: Gdk.Monitor }) {
   const windows = [
      windows_names.powermenu,
      windows_names.verification,
      windows_names.calendar,
      windows_names.quicksettings,
      windows_names.applauncher,
      windows_names.weather,
      windows_names.notificationslist,
      windows_names.volume,
      windows_names.network,
      windows_names.bluetooth,
      windows_names.power,
      windows_names.clipboard,
   ];
   let shadow: Astal.Window;

   const appconnect = app.connect("window-toggled", (_, win) => {
      const winName = win.name;
      if (!windows.includes(winName)) return;
      const newVisible = windowsVisible.get();

      if (win.visible) {
         if (!newVisible.includes(winName)) {
            newVisible.push(winName);
         }
      } else {
         const index = newVisible.indexOf(winName);
         if (index > -1) {
            newVisible.splice(index, 1);
         }
      }

      windowsVisible_set(newVisible);

      shadow.set_layer(
         newVisible.length > 0 ? Astal.Layer.OVERLAY : Astal.Layer.TOP,
      );
   });

   onCleanup(() => app.disconnect(appconnect));

   return (
      <window
         visible
         name={windows_names.bar_shadow}
         namespace={windows_names.bar_shadow}
         class={"shadows"}
         gdkmonitor={gdkmonitor}
         layer={Astal.Layer.TOP}
         anchor={TOP | BOTTOM | RIGHT | LEFT}
         application={app}
         $={(self) => {
            shadow = self;
            if ($) $(self);
            self
               .get_native()
               ?.get_surface()
               ?.set_input_region(new giCairo.Region());
         }}
      >
         <box class={"shadow"}>
            <box class={"border"} vexpand hexpand>
               <box class={"corner"} vexpand hexpand />
            </box>
         </box>
      </window>
   );
}
