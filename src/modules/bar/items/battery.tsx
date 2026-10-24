import AstalBattery from "gi://AstalBattery";
import { BatteryIcon } from "@/src/lib/icons";
import BarItem from "@/src/widgets/baritem";
import { createBinding } from "gnim";
import { windows_names } from "@/windows";
import { isVertical } from "../bar";
import { config, theme } from "@/options";

export function Battery() {
   const conf = config.bar.modules.battery;
   const battery = AstalBattery.get_default();
   const percentage = createBinding(battery, "percentage");
   const level = percentage((v) =>
      v > 0.6 ? "level-high" : v >= 0.2 ? "level-mid" : "level-low",
   );

   return (
      <BarItem
         class={"battery"}
         window={windows_names.power}
         onPrimaryClick={conf["on-click"]}
         onSecondaryClick={conf["on-click-right"]}
         onMiddleClick={conf["on-click-middle"]}
         visible={createBinding(battery, "isPresent")}
         data={{
            icon: (
               <image
                  class={level}
                  hexpand={isVertical}
                  pixelSize={theme["icon-size"].normal}
                  iconName={BatteryIcon}
               />
            ),
            percent: (
               <label
                  class={level}
                  label={percentage((v) => Math.floor(v * 100).toString())}
                  hexpand={isVertical}
               />
            ),
         }}
         format={conf.format}
      />
   );
}
