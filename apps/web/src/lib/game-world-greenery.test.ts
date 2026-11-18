import assert from "node:assert/strict";
import test from "node:test";
import { sampleParkTrees } from "./game-world-greenery";

const centre = { longitude: 144.970, latitude: -37.820 };
const square = [
  [144.967, -37.823], [144.973, -37.823],
  [144.973, -37.817], [144.967, -37.817], [144.967, -37.823],
];
const hole = [
  [144.9695, -37.8205], [144.9705, -37.8205],
  [144.9705, -37.8195], [144.9695, -37.8195], [144.9695, -37.8205],
];

test("park vegetation has stable unique locations within actual polygons and outside holes", () => {
  const first = sampleParkTrees([[square, hole]], centre);
  const second = sampleParkTrees([[square, hole]], centre);
  assert.deepEqual(first, second);
  assert.equal(first.length, 36);
  assert.equal(new Set(first.map(tree => tree.id)).size, first.length);
  for (const tree of first) {
    assert.equal(tree.kind, "tree");
    assert.ok(tree.longitude > 144.967 && tree.longitude < 144.973);
    assert.ok(tree.latitude > -37.823 && tree.latitude < -37.817);
    assert.equal(
      tree.longitude > 144.9695 && tree.longitude < 144.9705 &&
      tree.latitude > -37.8205 && tree.latitude < -37.8195, false,
    );
  }
});

test("park vegetation is bounded, non-authoritative and absent without geometry", () => {
  assert.deepEqual(sampleParkTrees([], centre), []);
  assert.deepEqual(sampleParkTrees([[square]], { longitude: 144.97, latitude: 86 }), []);
  assert.ok(sampleParkTrees([[square]], centre, 4).length <= 4);
  assert.deepEqual(sampleParkTrees([[square]], { longitude: 145.5, latitude: -38.5 }), []);
});
