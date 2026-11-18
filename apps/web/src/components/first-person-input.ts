import type { Map as GeographicMap } from "maplibre-gl";
import { createFirstPersonLook, turnFirstPersonLook, zoomFirstPersonLook, type FirstPersonLook } from "../lib/first-person-look";

type Pointer = { x: number; y: number };
const handlerNames = ["dragPan", "dragRotate", "touchZoomRotate", "touchPitch", "scrollZoom", "doubleClickZoom", "keyboard", "boxZoom"] as const;

/** Owns eye-view gestures only. No player movement, browser storage or GPS. */
export function attachFirstPersonInput(map: GeographicMap, options: {
  initial?: FirstPersonLook;
  onChange: (look: FirstPersonLook, reason: "turn" | "zoom" | "reset" | "north" | "sensor") => void;
  onTap: (point: { longitude: number; latitude: number }) => void;
}) {
  const canvas = map.getCanvas();
  const previousTouchAction = canvas.style.touchAction;
  const enabled = handlerNames.map(name => [name, map[name].isEnabled()] as const);
  for (const [name] of enabled) map[name].disable();
  canvas.style.touchAction = "none";
  let look = options.initial ?? createFirstPersonLook(map.getVerticalFieldOfView());
  const pointers = new Map<number, Pointer>();
  let origin: Pointer | null = null, moved = false, multiple = false, disposed = false;
  function change(next: FirstPersonLook, reason: "turn" | "zoom" | "reset" | "north" | "sensor") {
    if (disposed) return;
    look = next;
    if (Math.abs(map.getVerticalFieldOfView() - next.fieldOfView) > .00001) map.setVerticalFieldOfView(next.fieldOfView);
    options.onChange(next, reason);
  }
  const distance = () => { const [a, b] = [...pointers.values()]; return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0; };
  const cancel = () => { pointers.clear(); origin = null; moved = true; multiple = false; };
  const down = (event: PointerEvent) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    if (!pointers.size) { origin = { x: event.clientX, y: event.clientY }; moved = false; multiple = false; }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size > 1) { multiple = true; moved = true; }
    canvas.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent) => {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    event.preventDefault(); event.stopPropagation();
    const before = distance();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (origin && Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 5) moved = true;
    if (pointers.size === 1) {
      // Ignore tiny hand jitter, but retain every later relative movement.
      if (moved) change(turnFirstPersonLook(look, -(event.clientX - previous.x) * .18, (event.clientY - previous.y) * .15), "turn");
    } else if (pointers.size === 2 && before > 5) change(zoomFirstPersonLook(look, distance() / before), "zoom");
  };
  const up = (event: PointerEvent) => {
    if (!pointers.has(event.pointerId)) return;
    event.preventDefault(); event.stopPropagation();
    const tap = !moved && !multiple && pointers.size === 1;
    pointers.delete(event.pointerId);
    if (tap) {
      const bounds = canvas.getBoundingClientRect();
      const point = map.unproject([event.clientX - bounds.left, event.clientY - bounds.top]).wrap();
      if (Number.isFinite(point.lng) && Number.isFinite(point.lat)) options.onTap({ longitude: point.lng, latitude: point.lat });
    }
    if (!pointers.size) { origin = null; multiple = false; }
  };
  const lost = (event: PointerEvent) => { pointers.delete(event.pointerId); if (!pointers.size) origin = null; moved = true; };
  const click = (event: MouseEvent) => { event.preventDefault(); event.stopImmediatePropagation(); };
  const wheel = (event: WheelEvent) => {
    event.preventDefault(); event.stopPropagation();
    const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1);
    change(zoomFirstPersonLook(look, Math.exp(-Math.max(-200, Math.min(200, pixels)) * .002)), "zoom");
  };
  const key = (event: KeyboardEvent) => {
    const step = event.shiftKey ? 10 : 4;
    const turns: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (Object.hasOwn(turns, event.key)) { event.preventDefault(); event.stopPropagation(); change(turnFirstPersonLook(look, ...turns[event.key]), "turn"); }
    else if (["+", "=", "-", "_"].includes(event.key)) { event.preventDefault(); event.stopPropagation(); change(zoomFirstPersonLook(look, event.key === "-" || event.key === "_" ? 1 / 1.2 : 1.2), "zoom"); }
    else if (event.key === "Home") { event.preventDefault(); event.stopPropagation(); change(createFirstPersonLook(look.fieldOfView), "reset"); }
  };
  canvas.addEventListener("pointerdown", down, true); canvas.addEventListener("pointermove", move, true);
  canvas.addEventListener("pointerup", up, true); canvas.addEventListener("pointercancel", cancel, true);
  canvas.addEventListener("lostpointercapture", lost, true); canvas.addEventListener("click", click, true);
  canvas.addEventListener("wheel", wheel, { passive: false, capture: true }); canvas.addEventListener("keydown", key, true);
  window.addEventListener("blur", cancel); document.addEventListener("visibilitychange", cancel);
  return {
    zoom: (scale: number) => change(zoomFirstPersonLook(look, scale), "zoom"),
    faceNorth: (travelHeading: number) => change({ ...look, yawOffset: -travelHeading }, "north"),
    orient: (yawOffset: number) => change({ ...look, yawOffset }, "sensor"),
    synchronise: (next: FirstPersonLook) => { look = next; },
    dispose(restore = true) {
      disposed = true;
      for (const id of pointers.keys()) if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
      cancel(); canvas.style.touchAction = previousTouchAction;
      canvas.removeEventListener("pointerdown", down, true); canvas.removeEventListener("pointermove", move, true);
      canvas.removeEventListener("pointerup", up, true); canvas.removeEventListener("pointercancel", cancel, true);
      canvas.removeEventListener("lostpointercapture", lost, true); canvas.removeEventListener("click", click, true);
      canvas.removeEventListener("wheel", wheel, true); canvas.removeEventListener("keydown", key, true);
      window.removeEventListener("blur", cancel); document.removeEventListener("visibilitychange", cancel);
      if (restore) for (const [name, wasEnabled] of enabled) if (wasEnabled) map[name].enable();
    },
  };
}
