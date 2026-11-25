import assert from "node:assert/strict";
import test from "node:test";
import { createFirstPersonLook, turnFirstPersonLook, zoomFirstPersonLook } from "./first-person-look";

test("eye look wraps heading, bounds the horizon and rejects non-finite input", () => {
  const start = createFirstPersonLook();
  assert.equal(turnFirstPersonLook(start, 370, 0).yawOffset, 10);
  assert.equal(turnFirstPersonLook(start, -370, 0).yawOffset, -10);
  assert.equal(turnFirstPersonLook(start, 0, 100).pitch, 85);
  assert.equal(turnFirstPersonLook(start, 0, -100).pitch, 45);
  assert.equal(turnFirstPersonLook(start, NaN, 2), start);
  assert.equal(turnFirstPersonLook(start, 1, Infinity), start);
});
test("pinch changes optical field of view reversibly without carrying any location state", () => {
  const start = createFirstPersonLook(50);
  const closer = zoomFirstPersonLook(start, 1.2);
  assert.ok(closer.fieldOfView < 50);
  assert.ok(Math.abs(zoomFirstPersonLook(closer, 1 / 1.2).fieldOfView - 50) < .000001);
  assert.equal(zoomFirstPersonLook(start, 1000).fieldOfView, 28);
  assert.equal(zoomFirstPersonLook(start, .001).fieldOfView, 68);
  assert.equal(zoomFirstPersonLook(start, 0), start);
  assert.deepEqual(Object.keys(start).sort(), ["fieldOfView", "pitch", "yawOffset"]);
});
