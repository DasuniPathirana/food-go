import assert from "node:assert/strict";
import test from "node:test";
import { validateStyleMin, type StyleSpecification } from "@maplibre/maplibre-gl-style-spec";
import { MAP_SOURCE_IDS, worldMapStyle } from "./world-map-style";

const street: StyleSpecification = {
  version: 8, sources: { openmaptiles: { type: "vector", url: "https://tiles.openfreemap.org/planet" } },
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  layers: [
    { id: "ground", type: "background", paint: { "background-color": "#fff9ee" } },
    { id: "building-3d", type: "fill-extrusion", source: "openmaptiles", "source-layer": "building",
      paint: { "fill-extrusion-height": ["get", "render_height"] } },
    { id: "street-names", type: "symbol", source: "openmaptiles", "source-layer": "transportation_name",
      layout: { "text-field": ["get", "name"] } },
  ],
};

test("world street, local imagery and gameplay sources coexist in one valid map style", () => {
  const result = worldMapStyle(street);
  assert.deepEqual(validateStyleMin(result.style), []);
  assert.ok(result.style.sources.openmaptiles);
  assert.ok(result.style.sources[MAP_SOURCE_IDS.route]);
  assert.ok(result.style.layers.some(layer => layer.id === "food-go-world-buildings"));
  assert.ok(result.style.layers.some(layer => layer.id === MAP_SOURCE_IDS.buildings));
  assert.deepEqual(result.streetLayers.map(layer => layer.id), ["ground", "street-names"]);
  assert.equal(result.style.layers.filter(layer => layer.id === "building-3d").length, 0);
});

test("global satellite requests require an explicit key and retain the street data", () => {
  const without = worldMapStyle(street);
  assert.ok(!JSON.stringify(without.style).includes("api.maptiler.com"));
  const withKey = worldMapStyle(street, "public/key?with=query");
  assert.deepEqual(validateStyleMin(withKey.style), []);
  const source = withKey.style.sources[MAP_SOURCE_IDS.globalSatellite];
  assert.ok(source.type === "raster");
  assert.equal(new URL(source.url!).searchParams.get("key"), "public/key?with=query");
  assert.ok(withKey.style.sources.openmaptiles);
  assert.ok(withKey.style.layers.some(layer => layer.id === "street-names"));
});
