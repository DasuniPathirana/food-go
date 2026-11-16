export type MapPoint = { longitude: number; latitude: number };
export type StreetRoute = {
  geometry: LineString;
  distance: number;
  duration: number;
  attribution: string;
};
export type PreparedWalk = {
  geometry: LineString;
  cumulative: number[];
  distance: number;
};

const radians = Math.PI / 180;
const earthMetres = 6371008.8;
const longitudeDelta = (from: number, to: number) => ((to - from + 540) % 360) - 180;

export function validMapPoint(point: unknown): point is MapPoint {
  if (!point || typeof point !== "object") return false;
  const value = point as Partial<MapPoint>;
  return typeof value.longitude === "number" && Number.isFinite(value.longitude) && Math.abs(value.longitude) <= 180
    && typeof value.latitude === "number" && Number.isFinite(value.latitude) && Math.abs(value.latitude) <= 90;
}

export function mapDistance(from: MapPoint, to: MapPoint) {
  const latitude = (to.latitude - from.latitude) * radians;
  const longitude = longitudeDelta(from.longitude, to.longitude) * radians;
  const haversine = Math.sin(latitude / 2) ** 2
    + Math.cos(from.latitude * radians) * Math.cos(to.latitude * radians) * Math.sin(longitude / 2) ** 2;
  return 2 * earthMetres * Math.asin(Math.sqrt(Math.min(1, Math.max(0, haversine))));
}

export function mapBearing(from: MapPoint, to: MapPoint) {
  const longitude = longitudeDelta(from.longitude, to.longitude) * radians;
  const first = from.latitude * radians, second = to.latitude * radians;
  const angle = Math.atan2(Math.sin(longitude) * Math.cos(second),
    Math.cos(first) * Math.sin(second) - Math.sin(first) * Math.cos(second) * Math.cos(longitude));
  return (angle / radians + 360) % 360;
}

export function parseStreetRoute(value: unknown): StreetRoute | null {
  if (!value || typeof value !== "object") return null;
  const route = value as Partial<StreetRoute>;
  if (!route.geometry || route.geometry.type !== "LineString" || !Array.isArray(route.geometry.coordinates)
    || route.geometry.coordinates.length < 2 || route.geometry.coordinates.length > 10000
    || typeof route.distance !== "number" || !Number.isFinite(route.distance) || route.distance <= 0 || route.distance > 200000
    || typeof route.duration !== "number" || !Number.isFinite(route.duration) || route.duration <= 0
    || typeof route.attribution !== "string" || route.attribution.length > 500) return null;
  const coordinates: number[][] = [];
  for (const pair of route.geometry.coordinates) {
    if (!Array.isArray(pair) || pair.length < 2 || !validMapPoint({ longitude: pair[0], latitude: pair[1] })) return null;
    coordinates.push([pair[0], pair[1]]);
  }
  return { geometry: { type: "LineString", coordinates }, distance: route.distance, duration: route.duration, attribution: route.attribution };
}

export function prepareWalk(geometry: LineString): PreparedWalk | null {
  const cumulative = [0];
  for (let index = 1; index < geometry.coordinates.length; index++) {
    const from = geometry.coordinates[index - 1], to = geometry.coordinates[index];
    cumulative.push(cumulative[index - 1] + mapDistance(
      { longitude: from[0], latitude: from[1] }, { longitude: to[0], latitude: to[1] }));
  }
  const distance = cumulative.at(-1) ?? 0;
  return distance > 0 ? { geometry, cumulative, distance } : null;
}

/** Interpolate only along the routed street polyline, including antimeridian crossings. */
export function walkPosition(walk: PreparedWalk, metres: number) {
  const travelled = Math.min(walk.distance, Math.max(0, metres));
  let low = 1, high = walk.cumulative.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (walk.cumulative[middle] < travelled) low = middle + 1;
    else high = middle;
  }
  const from = walk.geometry.coordinates[low - 1], to = walk.geometry.coordinates[low];
  const span = walk.cumulative[low] - walk.cumulative[low - 1];
  const progress = span > 0 ? (travelled - walk.cumulative[low - 1]) / span : 1;
  const longitude = from[0] + longitudeDelta(from[0], to[0]) * progress;
  const point = {
    longitude: ((longitude + 540) % 360) - 180,
    latitude: from[1] + (to[1] - from[1]) * progress,
  };
  return { point, heading: mapBearing({ longitude: from[0], latitude: from[1] }, { longitude: to[0], latitude: to[1] }) };
}
import type { LineString } from "geojson";

