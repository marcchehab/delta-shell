// popovers inside the bar (tray menus) keep an autohidden bar revealed while open
let holds = 0;
const releaseListeners = new Set<() => void>();

export function barHeld() {
   return holds > 0;
}

export function holdBar(hold: boolean) {
   holds = Math.max(0, holds + (hold ? 1 : -1));
   if (holds === 0) releaseListeners.forEach((cb) => cb());
}

export function onBarRelease(cb: () => void) {
   releaseListeners.add(cb);
   return () => releaseListeners.delete(cb);
}
