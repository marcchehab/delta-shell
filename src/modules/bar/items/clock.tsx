import GLib from "gi://GLib";
import { createPoll } from "ags/time";
import { With, onCleanup } from "ags";
import { Gtk } from "ags/gtk4";
import { windows_names } from "@/windows";
import { config } from "@/options";
import BarItem from "@/src/widgets/baritem";
import { isVertical, orientation } from "../bar";
import { RotatedLabel } from "@/src/widgets/rotatedlabel";

export function Clock() {
   const conf = config.bar.modules.clock;

   const time = createPoll(
      "",
      1000,
      () => GLib.DateTime.new_now_local().format(conf.format)!,
   );

   return (
      <BarItem
         window={windows_names.calendar}
         onPrimaryClick={conf["on-click"]}
         onSecondaryClick={conf["on-click-right"]}
         onMiddleClick={conf["on-click-middle"]}
      >
         {isVertical && conf.rotate ? (
            <box
               halign={Gtk.Align.CENTER}
               $={(self) => {
                  const rotated = new RotatedLabel();
                  rotated.label.label = time.get();
                  const unsub = time.subscribe(
                     () => (rotated.label.label = time.get()),
                  );
                  onCleanup(unsub);
                  self.append(rotated);
               }}
            />
         ) : isVertical ? (
            <With value={time}>
               {(time) => (
                  <box orientation={orientation}>
                     {time.split(" ").map((part) => (
                        <label hexpand label={part} />
                     ))}
                  </box>
               )}
            </With>
         ) : (
            <label label={time} />
         )}
      </BarItem>
   );
}
