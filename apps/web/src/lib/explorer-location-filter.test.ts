import assert from "node:assert/strict";
import test from "node:test";
import { createLocationFilter, filterExplorerLocation } from "./explorer-location-filter";
import { mapDistance } from "./map-game";
import type { ExplorerLocationFix } from "./explorer-location-motion";
const fix = (metres: number, timestamp: number, accuracy = 5): ExplorerLocationFix => ({ longitude: 0, latitude: metres / 111195.08, timestamp, accuracy });

test("rendered GPS stays fixed during stationary wobble and eases genuine accumulated steps", () => {
  let state = filterExplorerLocation(createLocationFilter(), fix(0, 1000), 1000);
  const origin = state.display!;
  for (let i = 2; i < 12; i++) state = filterExplorerLocation(state, fix(i % 2 ? 2 : -2, i * 1000), i * 1000);
  assert.deepEqual(state.display, origin);
  state = filterExplorerLocation(state, fix(5, 12000), 12000);
  assert.ok(mapDistance(origin, state.display!) > 3);
  assert.ok(mapDistance(origin, state.display!) < 5);
});

test("stale, inaccurate, out-of-order and implausible fixes never teleport the character", () => {
  const state = filterExplorerLocation(createLocationFilter(), fix(0, 1000), 1000);
  for (const [sample, now, quality] of [[fix(500, 2000), 2000, "jump"], [fix(500, 2000, 80), 2000, "inaccurate"], [fix(500, 2000), 20000, "stale"], [fix(500, 10000), 2000, "stale"]] as const) {
    const next = filterExplorerLocation(state, sample, now);
    assert.equal(next.quality, quality); assert.deepEqual(next.display, state.display);
  }
  assert.equal(filterExplorerLocation(state, fix(50, 900), 1000), state);
  assert.equal(filterExplorerLocation(state, { ...fix(1, 2000), latitude: NaN }, 2000), state);
  assert.equal(filterExplorerLocation(createLocationFilter(), fix(5, 1000, 100), 1000).display, null);
});

test("fresh tracking can reacquire after a long interruption without inventing travel distance", () => {
  const before = filterExplorerLocation(createLocationFilter(), fix(0, 1000), 1000);
  const after = filterExplorerLocation(before, fix(400, 40000), 40000);
  assert.equal(after.quality, "ready");
  assert.deepEqual(after.display, { longitude: 0, latitude: fix(400, 40000).latitude });
  assert.equal("distanceMetres" in after, false);
});
