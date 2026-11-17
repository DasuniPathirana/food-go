import assert from "node:assert/strict";
import test from "node:test";
import type { CameraOptions, LngLatLike } from "maplibre-gl";
import { explorerCameraLimits, explorerCameraOptions, FIRST_PERSON_EYE_HEIGHT, interpolateCameraBearing } from "./explorer-camera";

const point = { longitude: 144.9631, latitude: -37.8102 };
test("first-person camera starts at the actual player eye position with a stable horizon", () => {
  const calls: unknown[][] = [];
  const calculated: CameraOptions = { center: [144.9632, -37.8101], zoom: 22.8, pitch: 84, bearing: 90, roll: 0 };
  const calculator = { calculateCameraOptionsFromCameraLngLatAltRotation: (...args: [LngLatLike, number, number, number, number?]) => { calls.push(args); return calculated; } };
  assert.deepEqual(explorerCameraOptions(calculator, { perspective: "first", point, heading: 450, follow: true, threeD: true, groundElevation: 25 }), calculated);
  assert.deepEqual(calls, [[[point.longitude, point.latitude], 25 + FIRST_PERSON_EYE_HEIGHT, 90, 84, 0]]);
  assert.notDeepEqual(calculated.center, [point.longitude, point.latitude]);
});
test("paused tracking and invalid positions never move the user's camera", () => {
  let calls = 0;
  const calculator = { calculateCameraOptionsFromCameraLngLatAltRotation: () => { calls++; return {}; } };
  for (const perspective of ["first", "third"] as const)
    assert.equal(explorerCameraOptions(calculator, { perspective, point, heading: 0, follow: false, threeD: true, refocus: true }), null);
  assert.equal(explorerCameraOptions(calculator, { perspective: "first", point: { longitude: NaN, latitude: 0 }, heading: 0, follow: true, threeD: true }), null);
  assert.equal(calls, 0);
});
test("third-person returns the readable overview and first-person also works with building extrusions hidden", () => {
  const calculator = { calculateCameraOptionsFromCameraLngLatAltRotation: () => ({}) };
  assert.deepEqual(explorerCameraOptions(calculator, { perspective: "third", point, heading: 0, follow: true, threeD: true, refocus: true }),
    { center: [point.longitude, point.latitude], zoom: 16.5, pitch: 44, roll: 0 });
  assert.equal(explorerCameraOptions(calculator, { perspective: "third", point, heading: 0, follow: true, threeD: false, refocus: true })?.pitch, 0);
  assert.deepEqual(explorerCameraLimits("first", false), { maxPitch: 85, maxZoom: 24 });
  assert.deepEqual(explorerCameraLimits("third", false), { maxPitch: 0, maxZoom: 20 });
});
test("camera heading crosses north along the short rotation and never produces NaN", () => {
  assert.equal(interpolateCameraBearing(359, 1, .5), 0);
  assert.equal(interpolateCameraBearing(1, 359, .5), 0);
  assert.equal(interpolateCameraBearing(20, NaN, 1), 20);
  assert.equal(interpolateCameraBearing(NaN, NaN, .5), 0);
});
