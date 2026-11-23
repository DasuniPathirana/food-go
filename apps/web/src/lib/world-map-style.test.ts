import assert from "node:assert/strict";
import test from "node:test";
import { expression, validateStyleMin, type StyleSpecification } from "@maplibre/maplibre-gl-style-spec";
import { GAME_BUILDING_PALETTE, MAP_SOURCE_IDS, worldMapStyle } from "./world-map-style";

const street: StyleSpecification = {
  version: 8, sources: { openmaptiles: { type: "vector", url: "https://tiles.openfreemap.org/planet" } },
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  layers: [
    { id: "ground", type: "background", paint: { "background-color": "#fff9ee" } },
    { id: "water", type: "fill", source: "openmaptiles", "source-layer": "water", paint: { "fill-color": "#abcdef" } },
    { id: "park", type: "fill", source: "openmaptiles", "source-layer": "park", paint: { "fill-color": "#aabbcc", "fill-opacity": 0.4 } },
    { id: "road_minor_casing", type: "line", source: "openmaptiles", "source-layer": "transportation",
      paint: { "line-color": "#888888", "line-width": ["interpolate", ["linear"], ["zoom"], 12, 1, 20, 20] } },
    { id: "road_minor", type: "line", source: "openmaptiles", "source-layer": "transportation",
      paint: { "line-color": "#ffffff", "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.5, 20, 18] } },
    { id: "building-3d", type: "fill-extrusion", source: "openmaptiles", "source-layer": "building",
      paint: { "fill-extrusion-height": ["get", "render_height"] } },
    { id: "street-names", type: "symbol", source: "openmaptiles", "source-layer": "transportation_name",
      layout: { "text-field": ["get", "name"] } },
    { id: "poi_r1", type: "symbol", source: "openmaptiles", "source-layer": "poi", layout: { "text-field": ["get", "name"] } },
  ],
};

test("world street, local imagery and gameplay sources coexist in one valid map style", () => {
  const result = worldMapStyle(street);
  assert.deepEqual(validateStyleMin(result.style), []);
  assert.ok(result.style.sources.openmaptiles);
  assert.ok(result.style.sources[MAP_SOURCE_IDS.route]);
  assert.ok(result.style.sources[MAP_SOURCE_IDS.buildings], "Raw building geometry source is preserved for queries");
  assert.equal(result.style.layers.some(layer => layer.id === "food-go-world-buildings"), false, "Generic world buildings must be rejected from presentation");
  assert.equal(result.style.layers.some(layer => layer.id === MAP_SOURCE_IDS.buildings), false, "Generic city buildings extrusion layer must be rejected from presentation");
  assert.equal(result.style.layers.filter(layer => layer.type === "fill-extrusion").length, 0, "No generic fill-extrusion layers in game style");
  assert.equal(result.style.layers.filter(layer => layer.id === "building-3d").length, 0);
});

test("ordinary building polygons and generic extrusions are hidden from the game style", () => {
  const result = worldMapStyle(street);
  // Verify all building layers are hidden or transparent in game presentation
  const buildingLayers = result.style.layers.filter(layer =>
    ("source-layer" in layer && layer["source-layer"] === "building") || layer.id.includes("building")
  );
  for (const layer of buildingLayers) {
    const isHidden = layer.layout?.visibility === "none" || (layer.paint as Record<string, unknown> | undefined)?.["fill-opacity"] === 0;
    assert.ok(isHidden, `Building layer ${layer.id} must be hidden in presentation`);
  }
  // Source is preserved internally for coordinate and proximity queries
  assert.ok(result.style.sources[MAP_SOURCE_IDS.buildings]);
});

function evaluate(value: unknown, zoom: number, properties: Record<string, number | string> = {}, id?: number | string) {
  if (!Array.isArray(value)) return value;
  const parsed = expression.createExpression(value, "test");
  assert.equal(parsed.result, "success");
  if (parsed.result !== "success") throw new Error("Invalid map expression");
  return parsed.value.evaluate({ zoom }, { type: "Polygon", properties, ...(id === undefined ? {} : {id}) });
}

test("Game roads widen at actual zoom while generic buildings are hidden and parks stay prominent", () => {
  const { gamePaint, style } = worldMapStyle(street);
  const override = (id: string, property: string) => {
    const entry = gamePaint.find(item => item.id === id && item.property === property);
    assert.ok(entry, `${id} ${property} override missing`);
    return entry;
  };
  const road = override("road_minor", "line-width");
  assert.ok(evaluate(road.game, 15) > evaluate(road.normal, 15));
  const park = override("park", "fill-opacity");
  assert.ok(typeof park.game === "number" && park.game > 0.9);
  assert.equal(park.normal, 0.4);

  // Verify generic city building layers are rejected from layers
  assert.equal(style.layers.some(layer => layer.id === "food-go-world-buildings"), false);
  assert.equal(style.layers.some(layer => layer.id === MAP_SOURCE_IDS.buildings), false);

  const poi = override("poi_r1", "text-opacity");
  assert.equal(evaluate(poi.game, 16), 0);
  assert.ok(evaluate(poi.game, 18) > 0);
  assert.equal(poi.normal, 1);
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

test("style includes approved Melbourne pilot boundary and visual exploration mask", () => {
  const result = worldMapStyle(street);
  assert.ok(result.style.sources[MAP_SOURCE_IDS.pilotBoundary]);
  assert.ok(result.style.sources[MAP_SOURCE_IDS.pilotMask]);
  assert.ok(result.style.layers.some(layer => layer.id === "food-go-pilot-boundary-line"));
  assert.ok(result.style.layers.some(layer => layer.id === "food-go-pilot-boundary-glow"));
  assert.ok(result.style.layers.some(layer => layer.id === "food-go-pilot-mask"));
});
