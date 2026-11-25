import test from "node:test";
import assert from "node:assert/strict";
import {
  MELBOURNE_PILOT_COORDINATES,
  MELBOURNE_PILOT_BOUNDS,
  isInsideMelbournePilot,
  melbournePilotBoundaryFeature,
  melbournePilotMaskFeature,
  melbournePilotGeoJson,
} from "./melbourne-pilot";

test("Melbourne pilot boundary coordinates are valid and form a closed ring", () => {
  assert.ok(MELBOURNE_PILOT_COORDINATES.length >= 4);
  const first = MELBOURNE_PILOT_COORDINATES[0];
  const last = MELBOURNE_PILOT_COORDINATES[MELBOURNE_PILOT_COORDINATES.length - 1];
  assert.equal(first[0], last[0]);
  assert.equal(first[1], last[1]);

  for (const [lon, lat] of MELBOURNE_PILOT_COORDINATES) {
    assert.ok(lon >= MELBOURNE_PILOT_BOUNDS.minLon && lon <= MELBOURNE_PILOT_BOUNDS.maxLon);
    assert.ok(lat >= MELBOURNE_PILOT_BOUNDS.minLat && lat <= MELBOURNE_PILOT_BOUNDS.maxLat);
  }
});

test("isInsideMelbournePilot correctly identifies interior and exterior points", () => {
  // Federation Square
  assert.equal(isInsideMelbournePilot({ longitude: 144.968964, latitude: -37.817852 }), true);
  // Melbourne Central
  assert.equal(isInsideMelbournePilot({ longitude: 144.962750, latitude: -37.810537 }), true);
  // Bourke Street Mall
  assert.equal(isInsideMelbournePilot({ longitude: 144.9650, latitude: -37.8130 }), true);
  // Outside: Sydney
  assert.equal(isInsideMelbournePilot({ longitude: 151.2093, latitude: -33.8688 }), false);
  // Outside: Geelong
  assert.equal(isInsideMelbournePilot({ longitude: 144.3607, latitude: -38.1499 }), false);
  // Far outside Melbourne bounds
  assert.equal(isInsideMelbournePilot({ longitude: 144.80, latitude: -37.81 }), false);
});

test("melbournePilotGeoJson produces valid boundary and mask features", () => {
  const collection = melbournePilotGeoJson();
  assert.equal(collection.type, "FeatureCollection");
  assert.equal(collection.features.length, 2);

  const boundary = melbournePilotBoundaryFeature();
  assert.equal(boundary.geometry.type, "Polygon");
  assert.equal(boundary.geometry.coordinates[0].length, MELBOURNE_PILOT_COORDINATES.length);

  const mask = melbournePilotMaskFeature();
  assert.equal(mask.geometry.type, "Polygon");
  assert.equal(mask.geometry.coordinates.length, 2); // World ring + hole
});
