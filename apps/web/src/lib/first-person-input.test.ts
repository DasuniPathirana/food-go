import assert from "node:assert/strict";
import test from "node:test";
import type { Map as GeographicMap } from "maplibre-gl";
import { attachFirstPersonInput } from "../components/first-person-input";
import type { FirstPersonLook } from "./first-person-look";

function fixture() {
  class Canvas extends EventTarget {
    style = { touchAction: "pan-y" }; clientHeight = 650; captured = new Set<number>();
    setPointerCapture(id: number) { this.captured.add(id); }
    hasPointerCapture(id: number) { return this.captured.has(id); }
    releasePointerCapture(id: number) { this.captured.delete(id); }
    getBoundingClientRect() { return { left: 10, top: 20 }; }
  }
  const canvas = new Canvas(), changes: FirstPersonLook[] = [], taps: { longitude: number; latitude: number }[] = [];
  const handlers = Object.fromEntries(["dragPan", "dragRotate", "touchZoomRotate", "touchPitch", "scrollZoom", "doubleClickZoom", "keyboard", "boxZoom"].map(name => {
    let enabled = name !== "touchPitch";
    return [name, { isEnabled: () => enabled, enable: () => { enabled = true; }, disable: () => { enabled = false; } }];
  }));
  let fieldOfView = 40;
  const map = { ...handlers, getCanvas: () => canvas, getVerticalFieldOfView: () => fieldOfView, setVerticalFieldOfView: (value: number) => { fieldOfView = value; },
    unproject: ([x, y]: number[]) => ({ wrap: () => ({ lng: x / 1000, lat: y / 1000 }) }) } as unknown as GeographicMap;
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window"), documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "window", { configurable: true, value: new EventTarget() });
  Object.defineProperty(globalThis, "document", { configurable: true, value: new EventTarget() });
  const input = attachFirstPersonInput(map, { onChange: look => changes.push(look), onTap: point => taps.push(point) });
  return { canvas, map, input, changes, taps,
    send(type: string, values: object = {}) { const event = new Event(type, { cancelable: true }); Object.assign(event, values); canvas.dispatchEvent(event); return event; },
    close() {
      input.dispose();
      if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor); else Reflect.deleteProperty(globalThis, "window");
      if (documentDescriptor) Object.defineProperty(globalThis, "document", documentDescriptor); else Reflect.deleteProperty(globalThis, "document");
    },
  };
}
const pointer = (id: number, x: number, y: number) => ({ pointerId: id, pointerType: "touch", button: 0, clientX: x, clientY: y });

test("eye input separates tap selection from drag look and restores original map handlers", () => {
  const f = fixture();
  try {
    assert.equal(f.map.dragPan.isEnabled(), false);
    f.send("pointerdown", pointer(1, 20, 30)); f.send("pointermove", pointer(1, 80, 50)); f.send("pointerup", pointer(1, 80, 50));
    assert.equal(f.taps.length, 0); assert.ok(f.changes.at(-1)!.yawOffset < 0);
    f.send("pointerdown", pointer(2, 30, 45)); f.send("pointerup", pointer(2, 30, 45));
    assert.deepEqual(f.taps, [{ longitude: .02, latitude: .025 }]);
    assert.equal(f.send("click").defaultPrevented, true);
    f.input.dispose(); assert.equal(f.map.dragPan.isEnabled(), true); assert.equal(f.map.touchPitch.isEnabled(), false);
    assert.equal(f.canvas.style.touchAction, "pan-y");
  } finally { f.close(); }
});
test("two-pointer pinch changes field of view without creating a route tap", () => {
  const f = fixture();
  try {
    f.send("pointerdown", pointer(1, 20, 20)); f.send("pointerdown", pointer(2, 120, 20));
    f.send("pointermove", pointer(2, 180, 20)); f.send("pointerup", pointer(2, 180, 20)); f.send("pointerup", pointer(1, 20, 20));
    assert.ok(f.map.getVerticalFieldOfView() < 40); assert.equal(f.taps.length, 0);
    const before = f.changes.length;
    f.send("pointerdown", pointer(3, 20, 20)); f.send("pointercancel", pointer(3, 20, 20)); f.send("pointermove", pointer(3, 90, 90));
    assert.equal(f.changes.length, before);
  } finally { f.close(); }
});
test("keyboard and wheel look stay bounded, reset heading and stop responding on disposal", () => {
  const f = fixture();
  try {
    f.send("keydown", { key: "ArrowRight", shiftKey: false }); assert.equal(f.changes.at(-1)!.yawOffset, 4);
    f.send("keydown", { key: "Home" }); assert.equal(f.changes.at(-1)!.yawOffset, 0);
    f.send("wheel", { deltaY: -100, deltaMode: 0 }); assert.ok(f.map.getVerticalFieldOfView() < 40);
    f.input.faceNorth(340); assert.equal(f.changes.at(-1)!.yawOffset, -340);
    const before = f.changes.length; f.input.dispose(); f.send("keydown", { key: "ArrowRight" }); assert.equal(f.changes.length, before);
  } finally { f.close(); }
});
