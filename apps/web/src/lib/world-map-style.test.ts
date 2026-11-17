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
  assert.ok(result.style.layers.some(layer => layer.id === "food-go-world-buildings"));
  assert.ok(result.style.layers.some(layer => layer.id === MAP_SOURCE_IDS.buildings));
  assert.deepEqual(result.streetLayers.map(layer => layer.id), street.layers.filter(layer => layer.type !== "fill-extrusion").map(layer => layer.id));
  assert.equal(result.style.layers.filter(layer => layer.id === "building-3d").length, 0);
});

function evaluate(value: unknown, zoom: number, properties: Record<string, number | string> = {}, id?: number | string) {
  if (!Array.isArray(value)) return value;
  const parsed = expression.createExpression(value, "test");
  assert.equal(parsed.result, "success");
  if (parsed.result !== "success") throw new Error("Invalid map expression");
  return parsed.value.evaluate({ zoom }, { type: "Polygon", properties, ...(id === undefined ? {} : {id}) });
}

test("Game building materials vary by stable feature identity and restore normal materials", () => {
  const { style, gamePaint } = worldMapStyle(street);
  const local = style.sources[MAP_SOURCE_IDS.buildings];
  assert.ok(local.type === "geojson" && local.generateId === true);
  for (const id of ["food-go-world-buildings", MAP_SOURCE_IDS.buildings]) {
    const colour = gamePaint.find(item => item.id === id && item.property === "fill-extrusion-color")!;
    const colours = new Set(Array.from({length:14},(_,featureId)=>String(evaluate(colour.game,16,{height:12,render_height:12},featureId))));
    assert.equal(colours.size,GAME_BUILDING_PALETTE.length);
    assert.deepEqual(evaluate(colour.game,12,{height:3,render_height:3},42),evaluate(colour.game,20,{height:80,render_height:80},42));
    assert.deepEqual(evaluate(colour.game,16,{height:12,render_height:12}),evaluate(colour.game,16,{height:12,render_height:12}));
    const baseline = style.layers.find(layer => layer.id === id)!;
    assert.deepEqual(colour.normal,(baseline.paint as Record<string,unknown>)["fill-extrusion-color"]);
  }
});

test("Game materials validate and can be restored while preserving geographic sources and label content", () => {
  const input = structuredClone(street);
  const result = worldMapStyle(input);
  assert.deepEqual(input, street);
  const game = structuredClone(result.style);
  for (const entry of result.gamePaint) {
    const layer = game.layers.find(item => item.id === entry.id)!;
    layer.paint = { ...layer.paint, [entry.property]: entry.game };
  }
  assert.deepEqual(validateStyleMin(game), []);
  assert.deepEqual(game.sources, result.style.sources);
  assert.deepEqual(game.layers.map(layer => "filter" in layer ? layer.filter : null), result.style.layers.map(layer => "filter" in layer ? layer.filter : null));
  assert.deepEqual(game.layers.filter(layer => layer.type === "symbol").map(layer => layer.layout), result.style.layers.filter(layer => layer.type === "symbol").map(layer => layer.layout));
  for (const entry of result.gamePaint) {
    const layer = game.layers.find(item => item.id === entry.id)!;
    layer.paint = { ...layer.paint, [entry.property]: entry.normal };
  }
  assert.deepEqual(validateStyleMin(game), []);
  for (const layer of result.style.layers) {
    const restored = game.layers.find(item => item.id === layer.id)!;
    for (const [property, value] of Object.entries(layer.paint ?? {})) assert.deepEqual((restored.paint as Record<string, unknown>)[property], value);
  }
});

test("Game roads widen at actual zoom while compact buildings restore measured heights and POIs stay quiet", () => {
  const { gamePaint } = worldMapStyle(street);
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
  for (const [id, heightProperty] of [["food-go-world-buildings", "render_height"], [MAP_SOURCE_IDS.buildings, "height"]]) {
    const height = override(id, "fill-extrusion-height");
    assert.equal(evaluate(height.normal, 16, { [heightProperty]: 300 }), 300);
    const tall = evaluate(height.game, 16, { [heightProperty]: 300 }) as number;
    assert.ok(tall > 18 && tall < 22);
    assert.ok((evaluate(height.game, 16, { [heightProperty]: 301 }) as number) > tall, "Different roof sections must not collapse onto the same plane");
    assert.ok(evaluate(height.game, 16, { [heightProperty]: 6 }) >= 3);
  }
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
