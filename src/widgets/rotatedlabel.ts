import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import Gsk from "gi://Gsk?version=4.0";
import Graphene from "gi://Graphene";

// GTK4 labels have no angle property: lay the label out sideways and rotate it 90° clockwise
export const RotatedLabel = GObject.registerClass(
   class RotatedLabel extends Gtk.Widget {
      label = new Gtk.Label();

      constructor() {
         super();
         this.label.set_parent(this);
      }

      vfunc_measure(orientation: Gtk.Orientation, forSize: number) {
         const swapped =
            orientation === Gtk.Orientation.HORIZONTAL
               ? Gtk.Orientation.VERTICAL
               : Gtk.Orientation.HORIZONTAL;
         const [min, nat] = this.label.measure(swapped, forSize);
         return [min, nat, -1, -1] as [number, number, number, number];
      }

      vfunc_size_allocate(width: number, height: number) {
         const transform = new Gsk.Transform()
            .translate(new Graphene.Point({ x: width, y: 0 }))
            .rotate(90);
         this.label.allocate(height, width, -1, transform);
      }

      vfunc_dispose() {
         this.label.unparent();
         super.vfunc_dispose();
      }
   },
);
