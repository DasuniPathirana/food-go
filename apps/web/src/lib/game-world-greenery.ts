/**
 * Small, deterministic, decorative tree groups sampled inside provider-mapped
 * greenery. These are NOT measured tree positions, accessible routes, GPS fixes
 * or reward eligibility. Never use them to authorize a verified claim.
 */
import type { Map as GeographicMap } from "maplibre-gl";
import type { GameWorldObject } from "./game-world-objects";

type Position = readonly number[];
type Ring = readonly Position[];
export type ParkPolygon = readonly Ring[];
type Centre = { longitude: number; latitude: number };

function inRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > lat) !== (b[1] > lat) &&
      lng < (b[0] - a[0]) * (lat - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function inPolygon(lng: number, lat: number, polygon: ParkPolygon): boolean {
  return !!polygon[0] && inRing(lng, lat, polygon[0]) &&
    !polygon.slice(1).some(hole => inRing(lng, lat, hole));
}

function jitter(x: number, y: number): number {
  let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** Pure sampler: bounded area and stable world grid keep positions repeatable. */
export function sampleParkTrees(polygons: readonly ParkPolygon[], centre: Centre, limit = 68): GameWorldObject[] {
  if (!Number.isFinite(centre.longitude) || !Number.isFinite(centre.latitude) || Math.abs(centre.latitude) > 83) return [];
  const cos = Math.max(0.15, Math.cos(centre.latitude * Math.PI / 180));
  // Global Web Mercator metres anchor the planting grid. Using a grid based
  // on centre.latitude made all the trees shift when the user walked north.
  const earth = 6378137, radians = Math.PI / 180;
  const mercatorX = (longitude: number) => earth * longitude * radians;
  const mercatorY = (latitude: number) => earth * Math.log(Math.tan(Math.PI / 4 + latitude * radians / 2));
  const fromX = (x: number) => x / earth / radians;
  const fromY = (y: number) => (2 * Math.atan(Math.exp(y / earth)) - Math.PI / 2) / radians;
  const step = 27, radius = 650;
  const centreX = mercatorX(centre.longitude), centreY = mercatorY(centre.latitude);
  const projectedRadius = radius / cos;
  const bounds = {
    west: centreX - projectedRadius, east: centreX + projectedRadius,
    south: centreY - projectedRadius, north: centreY + projectedRadius,
  };
  const trees = new Map<string, { value: GameWorldObject; distance: number }>();
  for (const polygon of polygons.slice(0, 120)) {
    const shell = polygon[0];
    if (!shell || shell.length < 4 || shell.length > 2500) continue;
    if (shell.some(point => !Number.isFinite(point[0]) || !Number.isFinite(point[1]) ||
      Math.abs(point[1]) > 83)) continue;
    const xs = shell.map(point => mercatorX(point[0])), ys = shell.map(point => mercatorY(point[1]));
    const west = Math.max(bounds.west, Math.min(...xs)), east = Math.min(bounds.east, Math.max(...xs));
    const south = Math.max(bounds.south, Math.min(...ys)), north = Math.min(bounds.north, Math.max(...ys));
    if (west >= east || south >= north) continue;
    for (let x = Math.floor(west / step); x <= Math.ceil(east / step); x++) {
      for (let y = Math.floor(south / step); y <= Math.ceil(north / step); y++) {
        if ((x + y * 3) % 5 === 0) continue; // Keep park lawns visible.
        // Broad clusters leave inviting open lawns rather than a uniform tree grid.
        if (jitter(Math.floor(x / 4), Math.floor(y / 4)) < 0.22) continue;
        const worldX = (x + 0.3 + jitter(x, y) * 0.4) * step;
        const worldY = (y + 0.3 + jitter(y, x) * 0.4) * step;
        if (worldX < west || worldX > east || worldY < south || worldY > north) continue;
        const longitude = fromX(worldX), latitude = fromY(worldY);
        if (!inPolygon(longitude, latitude, polygon)) continue;
        const distance = Math.hypot((longitude - centre.longitude) * 111320 * cos,
          (latitude - centre.latitude) * 111320);
        if (distance > radius) continue;
        const id = `park-tree:${x}:${y}`;
        trees.set(id, { value: { id, longitude, latitude, kind: "tree" }, distance });
        if (trees.size >= 300) break;
      }
      if (trees.size >= 300) break;
    }
    if (trees.size >= 300) break;
  }
  return [...trees.values()]
    .sort((a, b) => a.distance - b.distance || a.value.id.localeCompare(b.value.id))
    .slice(0, Math.max(0, Math.min(limit, 96)))
    .map(item => item.value);
}

/** Include Liberty's landcover_wood / landcover_grass layers, not only park. */
export function parkTreesFromMap(map: GeographicMap): GameWorldObject[] {
  if (map.getZoom() < 15.1) return [];
  const layers = map.getStyle()?.layers ?? [];
  const layerIds = layers.filter(layer => layer.type === "fill" && (
    ("source-layer" in layer && layer["source-layer"] === "park") ||
    /park|garden|cemetery|landcover_(wood|grass|scrub)|landuse_(grass|forest|recreation)|wood|meadow/iu.test(layer.id)
  )).map(layer => layer.id);
  if (!layerIds.length) return [];
  let features: ReturnType<GeographicMap["queryRenderedFeatures"]>;
  try { features = map.queryRenderedFeatures({ layers: layerIds }); } catch { return []; }
  const polygons: ParkPolygon[] = [];
  for (const feature of features.slice(0, 160)) {
    const geometry = feature.geometry;
    if (geometry.type === "Polygon") polygons.push(geometry.coordinates);
    else if (geometry.type === "MultiPolygon") polygons.push(...geometry.coordinates);
  }
  const center = map.getCenter();
  return sampleParkTrees(polygons, { longitude: center.lng, latitude: center.lat }, 92);
}
