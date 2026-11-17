import assert from "node:assert/strict";
import test from "node:test";
import { advanceExplorerLocationMotion, createExplorerLocationMotion, EXPLORER_WALK_IDLE_MS, type ExplorerLocationFix } from "./explorer-location-motion";

const point = (metres: number, timestamp: number, extra: Partial<ExplorerLocationFix> = {}): ExplorerLocationFix => ({
  longitude: 0, latitude: metres / 111195.08, accuracy: 5, timestamp, ...extra,
});

test("GPS walking accumulates genuine small steps and derives heading when the device has none", () => {
  let motion = createExplorerLocationMotion();
  motion = advanceExplorerLocationMotion(motion, point(0, 1000), 10000);
  motion = advanceExplorerLocationMotion(motion, point(1.4, 2000), 11000);
  assert.equal(motion.distanceMetres, 0);
  motion = advanceExplorerLocationMotion(motion, point(2.8, 3000), 12000);
  assert.ok(Math.abs(motion.distanceMetres - 2.8) < 0.01);
  assert.ok(Math.abs(motion.heading!) < 0.01);
  assert.equal(motion.walkingUntil, 12000 + EXPLORER_WALK_IDLE_MS);
  const stationary = advanceExplorerLocationMotion(motion, point(2.8, 4000), 13000);
  assert.equal(stationary.walkingUntil, motion.walkingUntil);
  assert.equal(stationary.distanceMetres, motion.distanceMetres);
});

test("stationary noise, coarse fixes, impossible jumps and driving do not add walking distance", () => {
  let motion = createExplorerLocationMotion();
  for (let second = 1; second < 20; second++) motion = advanceExplorerLocationMotion(motion, point(second % 2 ? 0 : 2, second * 1000), second * 1000);
  assert.equal(motion.distanceMetres, 0);
  motion = advanceExplorerLocationMotion(motion, point(1000, 20000), 20000);
  assert.equal(motion.distanceMetres, 0);
  assert.equal(motion.walkingUntil, 0);
  motion = advanceExplorerLocationMotion(motion, point(1002, 21000, { speed: 15 }), 21000);
  assert.equal(motion.distanceMetres, 0);
  motion = advanceExplorerLocationMotion(motion, point(1008, 24000, { accuracy: 100 }), 24000);
  assert.equal(motion.anchor, null);
  assert.equal(motion.distanceMetres, 0);
});

test("tracking gaps and out-of-order fixes never bridge distance, and valid device heading is preferred", () => {
  let motion = createExplorerLocationMotion();
  motion = advanceExplorerLocationMotion(motion, point(0, 1000), 1000);
  const stale = advanceExplorerLocationMotion(motion, point(50, 1000), 2000);
  assert.equal(stale, motion);
  motion = advanceExplorerLocationMotion(motion, point(20, 15000), 15000);
  assert.equal(motion.distanceMetres, 0);
  motion = advanceExplorerLocationMotion(motion, point(23, 17000, { heading: 450 }), 17000);
  assert.ok(Math.abs(motion.distanceMetres - 3) < 0.01);
  assert.equal(motion.heading, 90);
  const invalid = advanceExplorerLocationMotion(motion, point(24, 18000, { latitude: Number.NaN }), 18000);
  assert.equal(invalid, motion);
});
