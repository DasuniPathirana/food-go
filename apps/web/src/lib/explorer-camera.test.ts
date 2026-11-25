import assert from "node:assert/strict";
import test from "node:test";
import type { CameraOptions, LngLatLike } from "maplibre-gl";
import { blendExplorerCamera, EXPLORER_VIEWS, explorerCameraLimits, explorerCameraOptions, explorerCameraPose, FIRST_PERSON_EYE_HEIGHT, interpolateCameraBearing, isExplorerPerspective } from "./explorer-camera";

const point = { longitude: 144.9631, latitude: -37.8102 };
test("first-person camera starts at the actual player eye position with a stable horizon", () => {
  const calls: unknown[][] = [];
  const calculated: CameraOptions = { center: [144.9632, -37.8101], zoom: 22.8, pitch: 84, bearing: 90, roll: 0 };
  const calculator = { calculateCameraOptionsFromCameraLngLatAltRotation: (...args: [LngLatLike, number, number, number, number?]) => { calls.push(args); return calculated; } };
  assert.deepEqual(explorerCameraOptions(calculator, { perspective: "first", point, heading: 450, follow: true, threeD: true, groundElevation: 25 }), calculated);
  assert.deepEqual(calls, [[[point.longitude, point.latitude], 25 + FIRST_PERSON_EYE_HEIGHT, 90, 84, 0]]);
  assert.notDeepEqual(calculated.center, [point.longitude, point.latitude]);
});
test("looking around keeps the physical eye anchored while yaw and pitch change", () => {
  const calls: unknown[][] = [];
  const calculator = { calculateCameraOptionsFromCameraLngLatAltRotation: (...args: [LngLatLike, number, number, number, number?]) => { calls.push(args); return {}; } };
  explorerCameraOptions(calculator, { perspective: "first", point, heading: 350, follow: true, threeD: true, look: { yawOffset: 20, pitch: 60 } });
  assert.deepEqual(calls, [[[point.longitude, point.latitude], 1.7, 10, 60, 0]]);
});
test("paused tracking and invalid positions never move the user's camera", () => {
  let calls = 0;
  const calculator = { calculateCameraOptionsFromCameraLngLatAltRotation: () => { calls++; return {}; } };
  for (const perspective of EXPLORER_VIEWS)
    assert.equal(explorerCameraOptions(calculator, { perspective, point, heading: 0, follow: false, threeD: true, refocus: true }), null);
  assert.equal(explorerCameraOptions(calculator, { perspective: "first", point: { longitude: NaN, latitude: 0 }, heading: 0, follow: true, threeD: true }), null);
  assert.equal(calls, 0);
});
test("overhead returns the readable overview and first-person also works with building extrusions hidden", () => {
  const calculator = { calculateCameraOptionsFromCameraLngLatAltRotation: () => ({}) };
  assert.deepEqual(explorerCameraOptions(calculator, { perspective: "overhead", point, heading: 0, follow: true, threeD: true, refocus: true }),
    { center: [point.longitude, point.latitude], zoom: 16.5, pitch: 44, roll: 0 });
  assert.equal(explorerCameraOptions(calculator, { perspective: "third", point, heading: 0, follow: true, threeD: false, refocus: true })?.pitch, 0);
  assert.deepEqual(explorerCameraLimits("first", false), { maxPitch: 85, maxZoom: 24 });
  assert.deepEqual(explorerCameraLimits("third", false), { maxPitch: 0, maxZoom: 24 });
});

test("follow and close cameras sit behind the real explorer at distinct physical heights", () => {
  const calls: [LngLatLike, number, number, number, number?][] = [];
  const calculator = { calculateCameraOptionsFromCameraLngLatAltRotation: (...args: [LngLatLike, number, number, number, number?]) => { calls.push(args); return {}; } };
  explorerCameraOptions(calculator, { perspective: "third", point, heading: 0, follow: true, threeD: true, groundElevation: 20 });
  explorerCameraOptions(calculator, { perspective: "close", point, heading: 0, follow: true, threeD: true, groundElevation: 20 });
  assert.equal(calls[0][1], 24.8); assert.equal(calls[1][1], 23.2);
  const follow = calls[0][0] as number[], close = calls[1][0] as number[];
  assert.equal(follow[0], point.longitude);
  assert.ok(follow[1] < close[1] && close[1] < point.latitude);
  assert.equal(calls[0][2], 0); assert.equal(calls[0][3], 78); assert.equal(calls[1][3], 78);
});

test("camera transitions retain endpoints and take the short geographic and heading arcs", () => {
  const start = { longitude: 170, latitude: 0, zoom: 16, pitch: 44, bearing: 350 };
  const end = { longitude: -170, latitude: 20, zoom: 24, pitch: 84, bearing: 10 };
  assert.deepEqual(blendExplorerCamera(start, end, 0), { center: [170, 0], zoom: 16, pitch: 44, bearing: 350, roll: 0 });
  assert.deepEqual(blendExplorerCamera(start, end, 1), { center: [-170, 20], zoom: 24, pitch: 84, bearing: 10, roll: 0 });
  assert.deepEqual(blendExplorerCamera(start, end, .5), { center: [-180, 10], zoom: 20, pitch: 64, bearing: 0, roll: 0 });
  for (const centre of [[1, 2], { lng: 1, lat: 2 }, { lon: 1, lat: 2 }] as LngLatLike[]) {
    assert.deepEqual(explorerCameraPose({ center: centre, zoom: 17 }, start), { longitude: 1, latitude: 2, zoom: 17, pitch: 44, bearing: 350 });
  }
  for (const mode of EXPLORER_VIEWS) assert.equal(isExplorerPerspective(mode), true);
  for (const mode of [null, "ar", "", "__proto__", 1]) assert.equal(isExplorerPerspective(mode), false);
});
test("camera heading crosses north along the short rotation and never produces NaN", () => {
  assert.equal(interpolateCameraBearing(359, 1, .5), 0);
  assert.equal(interpolateCameraBearing(1, 359, .5), 0);
  assert.equal(interpolateCameraBearing(20, NaN, 1), 20);
  assert.equal(interpolateCameraBearing(NaN, NaN, .5), 0);
});
