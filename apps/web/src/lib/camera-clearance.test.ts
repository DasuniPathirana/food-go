import assert from "node:assert/strict";
import test from "node:test";
import { buildCameraObstacles, resolveCameraClearance, type CameraObstacle } from "./camera-clearance";

const target = { longitude: 0, latitude: 0, altitude: 1.5 };
const desired = { longitude: 0, latitude: 14 / 111320, altitude: 4.8 };
const ring = (left: number, bottom: number, right: number, top: number): [number, number][] => [[left, bottom], [right, bottom], [right, top], [left, top], [left, bottom]].map(([x, y]) => [x / 111320, y / 111320]);
const wall = (bottom: number, top: number, maximum = 10): CameraObstacle => ({ rings: [ring(-3, bottom, 3, top)], minimum: 0, maximum });
test("thin building walls shorten the camera boom before intersection and never move the target", () => {
  const before = { ...target };
  const result = resolveCameraClearance({ target, desired, obstacles: [wall(6, 6.05)] });
  assert.equal(result.obstructed, true); assert.equal(result.targetBlocked, false);
  assert.ok(result.camera.latitude * 111320 < 6); assert.ok(result.fraction > .3 && result.fraction < .45);
  assert.deepEqual(target, before);
});
test("roof/base clearance, holes and multiple polygons respect solid geometry", () => {
  assert.equal(resolveCameraClearance({ target, desired, obstacles: [wall(6, 8, 1)] }).obstructed, false);
  const overhang = { ...wall(6, 8, 12), minimum: 9 };
  assert.equal(resolveCameraClearance({ target, desired, obstacles: [overhang] }).obstructed, false);
  const courtyard = { ...wall(-20, 20), rings: [ring(-20, -20, 20, 20), ring(-4, -18, 4, 18)] };
  assert.equal(resolveCameraClearance({ target, desired, obstacles: [courtyard] }).obstructed, false);
  const blocked = resolveCameraClearance({ target, desired, obstacles: [wall(-1, 1)] });
  assert.equal(blocked.targetBlocked, true); assert.equal(blocked.fraction, 0);
});
test("vertical rays and dateline-crossing booms remain bounded", () => {
  const roof = { ...wall(-1, 1), minimum: 3, maximum: 4 };
  const vertical = resolveCameraClearance({ target, desired: { ...target, altitude: 8 }, obstacles: [roof] });
  assert.ok(vertical.camera.altitude < 3 && vertical.camera.altitude > 2);
  const dateline = resolveCameraClearance({ target: { longitude: 179.99999, latitude: 0, altitude: 2 }, desired: { longitude: -179.99999, latitude: 0, altitude: 4 }, obstacles: [] });
  assert.equal(dateline.fraction, 1); assert.ok(Math.abs(dateline.camera.longitude + 179.99999) < 1e-7);
});
test("source admission rejects malformed geometry and bounds work while preserving game height/base", () => {
  const feature = { geometry: { type: "MultiPolygon", coordinates: [[ring(-2, 5, 2, 8)], [ring(200, 200, 210, 210)]] }, properties: { height: 20, min_height: 5 } };
  const result = buildCameraObstacles([null, {}, feature], { centre: target, groundElevation: 30, gameHeights: true });
  assert.equal(result.obstacles.length, 1); assert.equal(result.obstacles[0].minimum, 35.1); assert.equal(result.obstacles[0].maximum, 44.4);
  assert.equal(buildCameraObstacles(new Array(2600).fill({}), { centre: target }).truncated, true);
  assert.equal(buildCameraObstacles([{ ...feature, properties: { height: "bad" } }], { centre: target }).obstacles.length, 0);
});
