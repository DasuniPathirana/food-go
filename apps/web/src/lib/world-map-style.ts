import type { Coordinates, StyleSpecification } from "maplibre-gl";
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
} as const;
export const emptyMapFeatures = () => ({ type: "FeatureCollection" as const, features: [] });

/** Keep one style and renderer so imagery changes retain the camera and player. */
export function worldMapStyle(base: StyleSpecification, satelliteKey?: string): {
  style: StyleSpecification; streetLayers: { id: string; visibility: "visible" | "none"; symbol: boolean }[];
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
    filter: ["all", ["!", ["has", "hide_3d"]], ["!", ["within", survey]]],
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
  });

  // A fixed world raster placeholder keeps the layer IDs stable without making
  // a provider request when the deployment has no satellite account.
  const globalSource: StyleSpecification["sources"][string] = satelliteKey ? {
    type: "raster", tileSize: 512,
    url: `https://api.maptiler.com/tiles/satellite-v2/tiles.json?key=${encodeURIComponent(satelliteKey)}`,
  } : { type: "geojson", data: emptyMapFeatures() };
  const availableAdditions = satelliteKey ? additions : additions.filter(layer => layer.id !== MAP_SOURCE_IDS.globalSatellite);
  return {
    streetLayers: streets.map(layer => ({ id: layer.id, visibility: layer.layout?.visibility === "none" ? "none" : "visible", symbol: layer.type === "symbol" })),
    style: {
      ...base,
      light: { anchor: "map", position: [1.4, 195, 45], color: "#fffaf0", intensity: 0.42 },
      sources: {
        ...base.sources,
        [MAP_SOURCE_IDS.aerial]: { type: "image", url: ATLAS_AERIAL, coordinates: corners },
        [MAP_SOURCE_IDS.satellite]: { type: "image", url: ATLAS_SATELLITE, coordinates: corners },
        [MAP_SOURCE_IDS.globalSatellite]: globalSource,
        [MAP_SOURCE_IDS.buildings]: { type: "geojson", data: ATLAS_BUILDINGS, maxzoom: 17 },
        [MAP_SOURCE_IDS.route]: { type: "geojson", data: emptyMapFeatures() },
        [MAP_SOURCE_IDS.accuracy]: { type: "geojson", data: emptyMapFeatures() },
      },
      layers: [...streets.slice(0, before), ...availableAdditions, ...streets.slice(before)],
    },
  };
}
