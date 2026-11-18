/**
 * Deterministic rooftop dressing over already-mapped building footprints.
 *
 * These lightweight objects suggest occupied city rooftops (planters, solar
 * canopies and HVAC). They are stylised scenery, NOT surveyed roof equipment,
 * public access routes, navigation obstacles or actual businesses.
 */
import type { Map as GeographicMap } from "maplibre-gl";
import type { GameWorldObject } from "./game-world-objects";

type Centre = { latitude: number; longitude: number };
export type RoofFootprint = {
  id: string;
  polygon: readonly (readonly number[])[];
  rawHeight: number;
  rawBase?: number;
};

function hash(text: string): number {
  let n = 2166136261;
  for (const char of text) n = Math.imul(n ^ char.charCodeAt(0), 16777619) >>> 0;
  return n >>> 0;
}

/** Pure geographic check, used by both runtime and test inputs. */
export function sampleRooftops(
  footprints: readonly RoofFootprint[], centre: Centre, limit = 32,
): GameWorldObject[] {
  if (!Number.isFinite(centre.longitude) || !Number.isFinite(centre.latitude) ||
    Math.abs(centre.latitude) >= 83) return [];
  const cos = Math.max(0.13, Math.cos(centre.latitude * Math.PI / 180));
  const seen = new Set<string>();
  const output: { distance: number; item: GameWorldObject }[] = [];
  for (const footprint of footprints.slice(0, 260)) {
    const ring = footprint.polygon;
    if (ring.length < 4 || ring.length > 1024 || !Number.isFinite(footprint.rawHeight)) continue;
    if (ring.some(point => !Number.isFinite(point[0]) || !Number.isFinite(point[1]))) continue;
    const minLng = Math.min(...ring.map(p => p[0])), maxLng = Math.max(...ring.map(p => p[0]));
    const minLat = Math.min(...ring.map(p => p[1])), maxLat = Math.max(...ring.map(p => p[1]));
    const width = (maxLng - minLng) * 111320 * cos, depth = (maxLat - minLat) * 111320;
    if (width < 11 || depth < 11 || width > 135 || depth > 135) continue;
    const longitude = (minLng + maxLng) / 2, latitude = (minLat + maxLat) / 2;
    const distance = Math.hypot((longitude - centre.longitude) * 111320 * cos,
      (latitude - centre.latitude) * 111320);
    if (distance > 450) continue;
    const rawHeight = Math.min(220, Math.max(4, footprint.rawHeight));
    const height = 2 + .62 * rawHeight;
    const id = `roof:${footprint.id}:${Math.round(longitude * 100000)}:${Math.round(latitude * 100000)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const seed = hash(id);
    // Never fill a full roof with unsurveyed geometry. A small object sits near
    // the footprint's centre, so it does not invent new road/building geometry.
    output.push({ distance, item: {
      id, kind: "roof", latitude, longitude, height,
      width: Math.min(7, width * .34), depth: Math.min(7, depth * .34),
      variant: seed % 4,
    } });
  }
  return output.sort((a,b) => a.distance - b.distance || a.item.id.localeCompare(b.item.id))
    .slice(0, Math.max(0, Math.min(limit, 48))).map(value => value.item);
}

export function rooftopsFromMap(map: GeographicMap): GameWorldObject[] {
  if (map.getZoom() < 16.5) return [];
  const layers = ["food-go-world-buildings", "food-go-buildings", "food-go-atlas-buildings"]
    .filter(id => map.getLayer(id));
  // Source IDs vary across world tiles and the Melbourne survey.
  const actual = layers.length ? layers : (map.getStyle()?.layers ?? [])
    .filter(layer => layer.type === "fill-extrusion").map(layer => layer.id);
  if (!actual.length) return [];
  let features: ReturnType<GeographicMap["queryRenderedFeatures"]>;
  try { features = map.queryRenderedFeatures({ layers: actual }); } catch { return []; }
  const footprints: RoofFootprint[] = [];
  const unique = new Set<string>();
  for (const feature of features.slice(0, 260)) {
    const geometry = feature.geometry;
    const polygons = geometry.type === "Polygon" ? [geometry.coordinates]
      : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
    const raw = Number(feature.properties?.render_height ?? feature.properties?.height ?? 0);
    if (!Number.isFinite(raw) || raw < 4) continue;
    for (const polygon of polygons) {
      const ring = polygon[0];
      if (!ring || ring.length < 4) continue;
      const first = ring[0];
      const id = String(feature.properties?.osm_id ?? feature.id ?? `${first[0]}:${first[1]}`);
      const key = `${id}:${first[0]}:${first[1]}`;
      if (unique.has(key)) continue;
      unique.add(key);
      footprints.push({ id, polygon: ring, rawHeight: raw });
    }
  }
  const centre = map.getCenter();
  return sampleRooftops(footprints, { longitude: centre.lng, latitude: centre.lat });
}
