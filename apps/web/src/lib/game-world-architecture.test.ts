import assert from "node:assert/strict";
import test from "node:test";
import { sampleRooftops } from "./game-world-architecture";

const center = { longitude: 144.97, latitude: -37.815 };
const square = [
  [144.9697, -37.8152], [144.9701, -37.8152],
  [144.9701, -37.8149], [144.9697, -37.8149], [144.9697, -37.8152],
];

test("mapped rooftop embellishments stay within tight geometric and height budgets", () => {
  const footprints = [{ id: "building-1", polygon: square, rawHeight: 30 }];
  const result = sampleRooftops(footprints, center);
  assert.equal(result.length, 1);
  assert.equal(result[0].kind, "roof");
  assert.equal(result[0].height, 20.6);
  assert.ok(result[0].width! <= 7);
  assert.ok(result[0].depth! <= 7);
  assert.deepEqual(result, sampleRooftops(footprints, center));
});

test("roof sampling deduplicates, ignores distant and invalid geometry, and respects limits", () => {
  const example = { id: "building-1", polygon: square, rawHeight: 30 };
  assert.equal(sampleRooftops([example, example], center).length, 1);
  assert.equal(sampleRooftops([{ ...example, rawHeight: Number.NaN }], center).length, 0);
  assert.equal(sampleRooftops([example], { latitude: 87, longitude: 144.97 }).length, 0);
  assert.equal(sampleRooftops([example], { latitude: -38.1, longitude: 145.8 }).length, 0);
  assert.equal(sampleRooftops([example], center, 0).length, 0);
});
