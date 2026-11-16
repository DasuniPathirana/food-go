import assert from "node:assert/strict";
import test from "node:test";
import { interpolateMarker, markerTransitionDuration } from "./map-marker-motion";

test("world marker crosses the date line along the short arc", () => {
  const middle = interpolateMarker({ longitude: 179.9, latitude: 1 }, { longitude: -179.9, latitude: 3 }, .5);
  assert.ok(Math.abs(Math.abs(middle.longitude) - 180) < .00001);
  assert.equal(middle.latitude, 2);
  assert.deepEqual(interpolateMarker({ longitude: 10, latitude: 1 }, { longitude: 11, latitude: 3 }, 2), { longitude: 11, latitude: 3 });
});

test("marker smoothing skips relocation and respects reduced motion", () => {
  const from = { longitude: 144.96, latitude: -37.81 }, nearby = { longitude: 144.96002, latitude: -37.81 };
  assert.equal(markerTransitionDuration(from, nearby, 600, false), 600);
  assert.equal(markerTransitionDuration(from, nearby, 600, true), 0);
  assert.equal(markerTransitionDuration(null, nearby, 600, false), 0);
  assert.equal(markerTransitionDuration(from, { longitude: 79.861, latitude: 6.927 }, 600, false), 0);
  assert.equal(markerTransitionDuration(from, nearby, Number.NaN, false), 0);
});
