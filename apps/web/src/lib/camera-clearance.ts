import { interpolateMarker } from "./map-marker-motion";
import { validMapPoint, type MapPoint } from "./map-game";

export type CameraPosition = MapPoint & { altitude: number };
type Pair = [number, number];
export type CameraObstacle = { rings: Pair[][]; minimum: number; maximum: number };
const longDelta = (a: number, b: number) => ((b - a + 540) % 360) - 180;
const cross = (a: Pair, b: Pair) => a[0] * b[1] - a[1] * b[0];
const subtract = (a: Pair, b: Pair): Pair => [a[0] - b[0], a[1] - b[1]];
const clamp = (value: number) => Math.min(1, Math.max(0, value));
function local(point: Pair, centre: MapPoint): Pair {
  return [longDelta(centre.longitude, point[0]) * 111320 * Math.max(.01, Math.cos(centre.latitude * Math.PI / 180)), (point[1] - centre.latitude) * 111320];
}

/** Admit bounded loaded-source geometry only. Heights share the supplied ground
 * datum; this is an approximate camera guard, never navigation or GPS proof.
 */
export function buildCameraObstacles(features: readonly unknown[], options: { centre: MapPoint; groundElevation?: number; gameHeights?: boolean; radiusMetres?: number }) {
  const obstacles: CameraObstacle[] = [];
  let vertices = 0, truncated = features.length > 2500;
  const radius = Math.min(150, Math.max(20, options.radiusMetres ?? 75));
  const ground = Number.isFinite(options.groundElevation) ? options.groundElevation! : 0;
  for (const raw of features.slice(0, 2500)) {
    if (!raw || typeof raw !== "object") continue;
    const feature = raw as { geometry?: { type?: string; coordinates?: unknown }; properties?: Record<string, unknown> };
    const geometry = feature.geometry, properties = feature.properties ?? {};
    if (!geometry || !Array.isArray(geometry.coordinates)) continue;
    const height = Number(properties.height ?? properties.render_height), base = Number(properties.min_height ?? properties.render_min_height ?? 0);
    if (!Number.isFinite(height) || !Number.isFinite(base) || height <= base || height > 1500 || base < 0) continue;
    const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
    for (const polygon of polygons) {
      if (!Array.isArray(polygon) || !polygon.length || polygon.length > 32) { truncated = true; continue; }
      const rings: Pair[][] = [];
      let malformed = false;
      for (const ring of polygon) {
        if (!Array.isArray(ring) || ring.length < 4 || ring.length > 2048 || vertices + ring.length > 50000) { malformed = true; truncated = true; break; }
        const points: Pair[] = [];
        for (const pair of ring) {
          if (!Array.isArray(pair) || !validMapPoint({ longitude: pair[0], latitude: pair[1] })) { malformed = true; break; }
          points.push([pair[0], pair[1]]);
        }
        if (malformed) break;
        vertices += points.length; rings.push(points);
      }
      if (malformed || !rings.length) continue;
      const points = rings[0].map(point => local(point, options.centre));
      if (Math.min(...points.map(p => p[0])) > radius || Math.max(...points.map(p => p[0])) < -radius
        || Math.min(...points.map(p => p[1])) > radius || Math.max(...points.map(p => p[1])) < -radius) continue;
      obstacles.push({ rings, minimum: ground + (options.gameHeights && base > 0 ? 2 + .62 * base : base), maximum: ground + (options.gameHeights ? 2 + .62 * height : height) });
    }
    if (vertices >= 50000) { truncated = true; break; }
  }
  return { obstacles, truncated };
}

function inRing(point: Pair, ring: Pair[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j], b = ring[i], edge = subtract(b, a), offset = subtract(point, a);
    const length = Math.hypot(...edge);
    if (length > 0 && Math.abs(cross(edge, offset)) / length < .001
      && point[0] >= Math.min(a[0], b[0]) - .001 && point[0] <= Math.max(a[0], b[0]) + .001
      && point[1] >= Math.min(a[1], b[1]) - .001 && point[1] <= Math.max(a[1], b[1]) + .001) return true;
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
function inPolygon(point: Pair, rings: Pair[][]) { return inRing(point, rings[0]) && !rings.slice(1).some(ring => inRing(point, ring)); }

/** Exact footprint-edge intervals avoid stepping through thin walls. */
export function resolveCameraClearance(input: { target: CameraPosition; desired: CameraPosition; obstacles: readonly CameraObstacle[]; clearanceMetres?: number }) {
  const { target, desired } = input;
  if (!validMapPoint(target) || !validMapPoint(desired) || !Number.isFinite(target.altitude) || !Number.isFinite(desired.altitude))
    return { camera: target, fraction: 0, obstructed: true, targetBlocked: true };
  const end = local([desired.longitude, desired.latitude], target), lengthSquared = end[0] ** 2 + end[1] ** 2;
  const dz = desired.altitude - target.altitude;
  const margin = Math.max(.05, Math.min(1, input.clearanceMetres ?? .3));
  let firstHit = Infinity, targetBlocked = false;
  for (const obstacle of input.obstacles) {
    const rings = obstacle.rings.map(ring => ring.map(point => local(point, target)));
    const low = obstacle.minimum - margin, high = obstacle.maximum + margin;
    if (target.altitude >= low && target.altitude <= high && inPolygon([0, 0], rings)) { firstHit = 0; targetBlocked = true; break; }
    if (desired.altitude >= low && desired.altitude <= high && inPolygon(end, rings)) firstHit = Math.min(firstHit, 1);
    const cuts = [0, 1];
    if (lengthSquared > .000001) for (const ring of rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[j], edge = subtract(ring[i], a), denominator = cross(end, edge);
      if (Math.abs(denominator) > .0000001) {
        const t = cross(a, edge) / denominator, u = cross(a, end) / denominator;
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) cuts.push(t);
      } else if (Math.abs(cross(a, end)) < .000001) {
        cuts.push(clamp((a[0] * end[0] + a[1] * end[1]) / lengthSquared));
        const b = ring[i]; cuts.push(clamp((b[0] * end[0] + b[1] * end[1]) / lengthSquared));
      }
    }
    cuts.sort((a, b) => a - b);
    for (let i = 1; i < cuts.length; i++) {
      const from = cuts[i - 1], to = cuts[i], mid = (from + to) / 2;
      if (to - from < 1e-9 || !inPolygon([end[0] * mid, end[1] * mid], rings)) continue;
      let verticalFrom = 0, verticalTo = 1;
      if (Math.abs(dz) < 1e-8) { if (target.altitude < low || target.altitude > high) continue; }
      else { verticalFrom = Math.min((low - target.altitude) / dz, (high - target.altitude) / dz); verticalTo = Math.max((low - target.altitude) / dz, (high - target.altitude) / dz); }
      const entry = Math.max(from, verticalFrom, 0), exit = Math.min(to, verticalTo, 1);
      if (entry < exit) firstHit = Math.min(firstHit, entry);
    }
  }
  const obstructed = Number.isFinite(firstHit);
  const distance = Math.hypot(Math.sqrt(lengthSquared), dz);
  const fraction = obstructed ? Math.max(0, firstHit - margin / Math.max(.001, distance)) : 1;
  return { camera: { ...interpolateMarker(target, desired, fraction), altitude: target.altitude + dz * fraction }, fraction, obstructed, targetBlocked };
}
