/**
 * Deterministic visual-only tree placement inside *mapped park polygons*.
 * These represent stylised park vegetation, NOT surveyed individual trees,
 * safe pedestrian navigation, restaurant visits or verified exploration.
 */
import type { Map as GeographicMap } from "maplibre-gl";
import type { GameWorldObject } from "./game-world-objects";

type Position = readonly [number, number];
type Ring = readonly Position[];

function inRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    const crosses = (a[1] > lat) !== (b[1] > lat);
    if (crosses && lng < (b[0] - a[0]) * (lat - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function inPolygon(lng: number, lat: number, rings: readonly Ring[]): boolean {
  if (!rings[0] || !inRing(lng, lat, rings[0])) return false;
  return !rings.slice(1).some(hole => inRing(lng, lat, hole));
}

const placements = [
  [0.24, 0.28], [0.54, 0.63], [0.78, 0.37], [0.34, 0.76], [0.72, 0.82],
] as const;

export function parkTreesFromMap(map: GeographicMap): GameWorldObject[] {
  if (map.getZoom() < 15.2) return [];
  const layers = map.getStyle()?.layers ?? [];
  const ids = layers.filter(layer => layer.type === "fill" && (
    ("source-layer" in layer && layer["source-layer"] === "park") ||
    /^(park|wood|garden|grass)|_park$|cemetery/u.test(layer.id)
  )).map(layer => layer.id);
  if (!ids.length) return [];
  let features: ReturnType<GeographicMap["queryRenderedFeatures"]>;
  try { features = map.queryRenderedFeatures({ layers: ids }); } catch { return []; }
  const centre = map.getCenter();
  const candidates = new Map<string, GameWorldObject>();
  for (const feature of features.slice(0, 140)) {
    const geometry = feature.geometry;
    const polygons = geometry.type === "Polygon" ? [geometry.coordinates]
      : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
    for (const rings of polygons) {
      const shell = rings[0];
      if (!shell || shell.length < 4) continue;
      const lngs = shell.map(point => point[0]), lats = shell.map(point => point[1]);
      const west = Math.min(...lngs), east = Math.max(...lngs);
      const south = Math.min(...lats), north = Math.max(...lats);
      if (!Number.isFinite(west + east + south + north) ||
        east - west > 0.02 || north - south > 0.02) continue;
      const width = (east - west) * 111320 * Math.cos(centre.lat * Math.PI / 180);
      const height = (north - south) * 111320;
      if (width < 22 || height < 22) continue;
      for (const [fx, fy] of placements) {
        const longitude = west + (east - west) * fx;
        const latitude = south + (north - south) * fy;
        if (!inPolygon(longitude, latitude, rings)) continue;
        const distance = Math.hypot(
          (longitude - centre.lng) * 111320 * Math.cos(centre.lat * Math.PI / 180),
          (latitude - centre.lat) * 111320
        );
        if (distance > 1000) continue;
        const id = `park-tree:${longitude.toFixed(5)}:${latitude.toFixed(5)}`;
        candidates.set(id, { id, longitude, latitude, kind: "tree" });
        if (candidates.size >= 36) break;
      }
      if (candidates.size >= 36) break;
    }
    if (candidates.size >= 36) break;
  }
  // Map viewport/rendered feature traversal is not always stable.
  return Array.from(candidates.values()).sort((a, b) => a.id.localeCompare(b.id));
}
