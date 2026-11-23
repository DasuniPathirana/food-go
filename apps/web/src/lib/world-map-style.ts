import type { AllPaintProperties, Coordinates, ExpressionSpecification, LayerSpecification, StyleSpecification } from "maplibre-gl";
import { melbournePilotBoundaryFeature, melbournePilotMaskFeature } from "@food-go/domain";
import {
  ATLAS_AERIAL, ATLAS_BUILDINGS, ATLAS_CORNERS, ATLAS_SATELLITE,
} from "./melbourne-atlas";

export const WORLD_STREET_STYLE = "https://tiles.openfreemap.org/styles/liberty";
export const MAP_SOURCE_IDS = {
  aerial: "food-go-aerial",
  satellite: "food-go-local-satellite",
  globalSatellite: "food-go-world-satellite",
  buildings: "food-go-city-buildings",
  route: "food-go-route",
  accuracy: "food-go-accuracy",
  pilotBoundary: "food-go-pilot-boundary",
  pilotMask: "food-go-pilot-mask",
} as const;
export const emptyMapFeatures = () => ({ type: "FeatureCollection" as const, features: [] });
export const GAME_BUILDING_PALETTE = ["#9eaFA4", "#d4a789", "#acc8b9", "#c19489", "#dfc7a2", "#859f9b"] as const;

/** A building keeps its material as the camera moves. Prefer the provider's
 * stable feature ID, then numeric source IDs, then measured height as a fallback.
 */
function gameBuildingColour(height: ExpressionSpecification): ExpressionSpecification {
  const fallback: ExpressionSpecification = ["*", height, 131];
  const identity: ExpressionSpecification = ["to-number", ["coalesce", ["id"], ["get", "osm_id"], ["get", "id"], fallback], fallback];
  const bucket: ExpressionSpecification = ["%", ["abs", ["round", identity]], GAME_BUILDING_PALETTE.length];
  return ["match", bucket, 0, GAME_BUILDING_PALETTE[0], 1, GAME_BUILDING_PALETTE[1], 2, GAME_BUILDING_PALETTE[2], 3, GAME_BUILDING_PALETTE[3], 4, GAME_BUILDING_PALETTE[4], 5, GAME_BUILDING_PALETTE[5], GAME_BUILDING_PALETTE[0]];
}

/** Keep roof parts ordered instead of flattening several heights onto one plane. */
function gameBuildingHeight(height: ExpressionSpecification): ExpressionSpecification {
  const positive: ExpressionSpecification = ["max", height, 0];
  // Preserve the skyline and differences between real roof sections. Compress
  // tall structures gently rather than flattening the city into equal blocks.
  return ["+", 2, ["*", .62, positive]];
}

type PaintValue = AllPaintProperties[keyof AllPaintProperties];
export type GameMapPaintOverride = {
  id: string; property: keyof AllPaintProperties; normal: PaintValue; game: PaintValue;
};

/** Preserve camera expressions at the top level, as required by the style spec. */
function widerRoad(value: AllPaintProperties["line-width"], factor: number): AllPaintProperties["line-width"] {
  if (typeof value === "number") return value * factor;
  if (Array.isArray(value)) {
    const result = [...value];
    const firstOutput = value[0] === "interpolate" ? 4 : value[0] === "step" ? 2 : -1;
    if (firstOutput !== -1) {
      for (let index = firstOutput; index < result.length; index += 2) {
        if (typeof result[index] === "number") result[index] = (result[index] as number) * factor;
      }
      return result as ExpressionSpecification;
    }
  }
  if (value && typeof value === "object" && "stops" in value) {
    return { ...value, stops: value.stops.map(([stop, width]) => [stop, width * factor]) } as AllPaintProperties["line-width"];
  }
  return value ?? 1;
}

/** A reversible material pass over real geometry, never a second map style.
 * Compact Game buildings are deliberately stylised. Streets and imagery retain
 * their source heights and bases when the normal values are restored.
 */
function gameMapPaint(layers: LayerSpecification[]): GameMapPaintOverride[] {
  const overrides: GameMapPaintOverride[] = [];
  const add = (layer: LayerSpecification, property: keyof AllPaintProperties, game: PaintValue, fallback: PaintValue) => {
    const paint = layer.paint as Partial<AllPaintProperties> | undefined;
    overrides.push({ id: layer.id, property, normal: paint?.[property] ?? fallback, game });
  };
  for (const layer of layers) {
    const sourceLayer = "source-layer" in layer ? layer["source-layer"] : undefined;
    if (layer.type === "background") add(layer, "background-color", "#c9ded2", "#000000");
    if (layer.type === "raster" && layer.id === "natural_earth") add(layer, "raster-opacity", 0, 1);
    if (layer.type === "fill") {
      const landColour = sourceLayer === "water" || layer.id === "water" ? "#5aaec4"
        : sourceLayer === "park" || layer.id === "park" ? "#88b58d"
          : layer.id.includes("wood") ? "#669b7c"
            : /grass|cemetery|pitch/u.test(layer.id) ? "#a4c797"
              : layer.id.includes("wetland") ? "#c6e5d9"
                : layer.id.includes("sand") ? "#f5ecd2"
                  : /ice|glacier/u.test(layer.id) ? "#f6fbff"
                    : layer.id.includes("hospital") ? "#f1e3e8"
                      : /school|track/u.test(layer.id) ? "#eee8d7"
                        : sourceLayer === "landuse" || sourceLayer === "aeroway" ? "#d2ddcd"
                          : null;
      if (landColour) add(layer, "fill-color", landColour, "#000000");
      if (sourceLayer === "building") add(layer, "fill-color", gameBuildingColour(["coalesce", ["get", "render_height"], ["get", "height"], 4]), "#000000");
      if (sourceLayer === "park" || /wood|grass|cemetery|pitch/u.test(layer.id)) add(layer, "fill-opacity", 0.95, 1);
      if (sourceLayer === "building") add(layer, "fill-outline-color", "#aeb9a7", layer.paint?.["fill-color"] ?? "#000000");
      if (sourceLayer === "transportation") add(layer, "fill-opacity", 0.22, 1);
    }
    if (layer.type === "line") {
      if (sourceLayer === "waterway") add(layer, "line-color", "#5aaec4", "#000000");
      if (sourceLayer === "park") add(layer, "line-color", "#6c9c72", "#000000");
      if (sourceLayer === "boundary") {
        add(layer, "line-color", "#a3b3c1", "#000000"); add(layer, "line-opacity", 0.35, 1);
      }
      if (sourceLayer === "transportation" && /^(road|bridge|tunnel)_/u.test(layer.id)) {
        const rail = layer.id.includes("rail"), casing = layer.id.endsWith("casing");
        const walking = /path|footway|pedestrian|steps|cycleway/u.test(layer.id);
        // Pedestrian networks remain real, but should not become stark white
        // dashed decorations that overpower the park scene.
        add(layer, "line-color", rail ? "#9aada4" : walking
          ? casing ? "#a7bfa0" : "#d6dfcd"
          : casing ? "#a5bcb2" : "#f3ebe0", "#000000");
        if (rail) add(layer, "line-opacity", 0.28, 1);
        else {
          add(layer, "line-width", widerRoad(layer.paint?.["line-width"], walking ? 0.88 : casing ? 1.1 : 1.06), 1);
          if (walking) add(layer, "line-opacity", 0.67, 1);
          if (casing) add(layer, "line-blur", 0.35, 0);
        }
      }
    }
    if (layer.type === "symbol") {
      if (sourceLayer === "transportation_name" || sourceLayer === "place") {
        add(layer, "text-color", sourceLayer === "place" ? "#3e5e51" : "#435a50", "#000000");
        add(layer, "text-halo-color", "#fff7ec", "rgba(0,0,0,0)");
        add(layer, "text-halo-width", 1.5, 0);
      }
      if (sourceLayer === "water_name" || sourceLayer === "waterway") add(layer, "text-color", "#5687ae", "#000000");
      if (sourceLayer === "poi") {
        // Published Food Go markers stay distinct. Provider POIs reappear softly
        // at close zoom while real street and suburb names stay available.
        const opacity: ExpressionSpecification = ["interpolate", ["linear"], ["zoom"], 16.5, 0, 18, 0.22];
        add(layer, "text-opacity", opacity, 1); add(layer, "icon-opacity", opacity, 1);
      }
      if (/one_way_arrow|shield/u.test(layer.id)) {
        add(layer, "text-opacity", 0, 1); add(layer, "icon-opacity", 0, 1);
      }
    }
    if (layer.type === "fill-extrusion") {
      const local = layer.id === MAP_SOURCE_IDS.buildings;
      const height: ExpressionSpecification = ["coalesce", ["get", local ? "height" : "render_height"], 4];
      const base: ExpressionSpecification = ["coalesce", ["get", local ? "min_height" : "render_min_height"], 0];
      add(layer, "fill-extrusion-height", gameBuildingHeight(height), 0);
      add(layer, "fill-extrusion-base", ["case", [">", base, 0], gameBuildingHeight(base), 0], 0);
      add(layer, "fill-extrusion-color", gameBuildingColour(height), "#000000");
      add(layer, "fill-extrusion-opacity", 1, 1);
      add(layer, "fill-extrusion-vertical-gradient", true, true);
    }
  }
  return overrides;
}

/** Keep one style and renderer so imagery changes retain the camera and player. */
export function worldMapStyle(base: StyleSpecification, satelliteKey?: string): {
  style: StyleSpecification; streetLayers: { id: string; visibility: "visible" | "none"; symbol: boolean }[];
  gamePaint: GameMapPaintOverride[];
} {
  const corners: Coordinates = [ATLAS_CORNERS[0], ATLAS_CORNERS[1], ATLAS_CORNERS[2], ATLAS_CORNERS[3]];
  const survey = { type: "Polygon" as const, coordinates: [[...ATLAS_CORNERS, ATLAS_CORNERS[0]]] };
  const building = base.layers.find(layer => layer.id === "building-3d");
  const streets = base.layers.filter(layer => layer.type !== "fill-extrusion").map(layer => {
    if (layer.type === "fill" && layer.id === "water") return { ...layer, paint: { ...layer.paint, "fill-color": "#9fd9e6" } };
    if (layer.type === "fill" && layer.id === "park") return { ...layer, paint: { ...layer.paint, "fill-color": "#c3e5bb" } };
    if (layer.type === "symbol" && layer.id === "poi_transit") return { ...layer, minzoom: Math.max(layer.minzoom ?? 0, 17) };
    if (layer.type === "symbol" && layer.id === "poi_r1") return { ...layer, minzoom: Math.max(layer.minzoom ?? 0, 16.2) };
    if (layer.type === "symbol" && layer["source-layer"] === "transportation_name") return { ...layer, paint: {
      ...layer.paint, "text-color": "#3d574d", "text-halo-color": "#fffaf4", "text-halo-width": 1.5,
    } };
    return layer;
  });
  const firstLabel = streets.findIndex(layer => layer.type === "symbol");
  const before = firstLabel < 0 ? streets.length : firstLabel;
  const additions: StyleSpecification["layers"] = [
    {
      id: MAP_SOURCE_IDS.globalSatellite, type: "raster", source: MAP_SOURCE_IDS.globalSatellite,
      layout: { visibility: "none" }, paint: { "raster-fade-duration": 0 },
    },
    {
      id: MAP_SOURCE_IDS.satellite, type: "raster", source: MAP_SOURCE_IDS.satellite,
      layout: { visibility: "none" }, paint: { "raster-fade-duration": 0 },
    },
    {
      id: MAP_SOURCE_IDS.aerial, type: "raster", source: MAP_SOURCE_IDS.aerial,
      layout: { visibility: "none" }, paint: { "raster-fade-duration": 0 },
    },
  ];
  if (building?.type === "fill-extrusion") additions.push({
    ...building, id: "food-go-world-buildings", minzoom: 14,
    // `within` only evaluates point/line features in the installed style
    // engine. Polygon distance handles intersecting building footprints too,
    // so the world source cannot draw duplicate roofs over the local survey.
    filter: ["all", ["!", ["has", "hide_3d"]], [">", ["distance", survey], 0]],
    paint: {
      ...building.paint,
      "fill-extrusion-color": "#e9e7da",
      "fill-extrusion-opacity": 0.9,
      "fill-extrusion-vertical-gradient": true,
    },
  });
  additions.push({
    id: MAP_SOURCE_IDS.buildings, source: MAP_SOURCE_IDS.buildings, type: "fill-extrusion", minzoom: 14,
    paint: {
      "fill-extrusion-height": ["get", "height"], "fill-extrusion-base": ["coalesce", ["get", "min_height"], 0],
      "fill-extrusion-color": ["interpolate", ["linear"], ["get", "height"], 0, "#f4ead6", 40, "#ebe9dc", 120, "#c9d7cb", 250, "#b5cec5"],
      "fill-extrusion-opacity": 0.9, "fill-extrusion-vertical-gradient": true,
    },
  }, {
    id: "food-go-accuracy-fill", source: MAP_SOURCE_IDS.accuracy, type: "fill",
    paint: { "fill-color": "#217fc3", "fill-opacity": 0.12 },
  }, {
    id: "food-go-accuracy-outline", source: MAP_SOURCE_IDS.accuracy, type: "line",
    paint: { "line-color": "#217fc3", "line-opacity": 0.5, "line-width": 1.5 },
  }, {
    id: "food-go-route-casing", source: MAP_SOURCE_IDS.route, type: "line",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#153a38", "line-width": 9, "line-opacity": 0.8 },
  }, {
    id: "food-go-route-line", source: MAP_SOURCE_IDS.route, type: "line",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#ffd445", "line-width": 5 },
  }, {
    id: "food-go-pilot-mask", source: MAP_SOURCE_IDS.pilotMask, type: "fill",
    paint: { "fill-color": "#183d32", "fill-opacity": 0.16 },
  }, {
    id: "food-go-pilot-boundary-glow", source: MAP_SOURCE_IDS.pilotBoundary, type: "line",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#ffd445", "line-width": 7, "line-blur": 2.5, "line-opacity": 0.45 },
  }, {
    id: "food-go-pilot-boundary-line", source: MAP_SOURCE_IDS.pilotBoundary, type: "line",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#2f6941", "line-width": 2.2, "line-opacity": 0.8 },
  });

  // A fixed world raster placeholder keeps the layer IDs stable without making
  // a provider request when the deployment has no satellite account.
  const globalSource: StyleSpecification["sources"][string] = satelliteKey ? {
    type: "raster", tileSize: 512,
    url: `https://api.maptiler.com/tiles/satellite-v2/tiles.json?key=${encodeURIComponent(satelliteKey)}`,
  } : { type: "geojson", data: emptyMapFeatures() };
  const availableAdditions = satelliteKey ? additions : additions.filter(layer => layer.id !== MAP_SOURCE_IDS.globalSatellite);
  const layers = [...streets.slice(0, before), ...availableAdditions, ...streets.slice(before)];
  return {
    gamePaint: gameMapPaint(layers),
    streetLayers: streets.map(layer => ({ id: layer.id, visibility: layer.layout?.visibility === "none" ? "none" : "visible", symbol: layer.type === "symbol" })),
    style: {
      ...base,
      light: { anchor: "map", position: [1.4, 195, 45], color: "#fffaf0", intensity: 0.42 },
      sky: { "sky-color": "#82bcca", "horizon-color": "#e4f4db", "sky-horizon-blend": 0.7 },
      sources: {
        ...base.sources,
        [MAP_SOURCE_IDS.aerial]: { type: "image", url: ATLAS_AERIAL, coordinates: corners },
        [MAP_SOURCE_IDS.satellite]: { type: "image", url: ATLAS_SATELLITE, coordinates: corners },
        [MAP_SOURCE_IDS.globalSatellite]: globalSource,
        // The survey has no feature IDs. Stable array-index IDs let the Game
        // material vary across its real footprints without altering the file.
        [MAP_SOURCE_IDS.buildings]: { type: "geojson", data: ATLAS_BUILDINGS, generateId: true, maxzoom: 17 },
        [MAP_SOURCE_IDS.route]: { type: "geojson", data: emptyMapFeatures() },
        [MAP_SOURCE_IDS.accuracy]: { type: "geojson", data: emptyMapFeatures() },
        [MAP_SOURCE_IDS.pilotBoundary]: { type: "geojson", data: melbournePilotBoundaryFeature() },
        [MAP_SOURCE_IDS.pilotMask]: { type: "geojson", data: melbournePilotMaskFeature() },
      },
      layers,
    },
  };
}
