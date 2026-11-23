import type { Feature, FeatureCollection, Polygon } from "geojson";

/**
 * Approved Food Go Melbourne Pilot boundary coordinates (WGS84 [longitude, latitude]).
 * Preserves the exact 27-point client polygon.
 */
export const MELBOURNE_PILOT_COORDINATES: [number, number][] = [
  [144.98342693030145, -37.81053383051667],
  [144.97831086126604, -37.809895631280774],
  [144.9784903724622, -37.80854830366739],
  [144.95595397131007, -37.80591119887847],
  [144.95544561764086, -37.808357547950294],
  [144.94333755751376, -37.81266584627821],
  [144.93474921556486, -37.80916855740059],
  [144.931312654973, -37.81978128325924],
  [144.92959437467596, -37.82693784159508],
  [144.94224716594823, -37.82545723128929],
  [144.95786789591648, -37.82866518273864],
  [144.9615919849253, -37.82768490268694],
  [144.9657512422188, -37.83184607141973],
  [144.97083477891385, -37.830240034102964],
  [144.97185049537853, -37.83318392603867],
  [144.97353128745868, -37.833946522403096],
  [144.97492598726876, -37.834765598606815],
  [144.97868094829482, -37.835273986159066],
  [144.97896704056302, -37.833791179338476],
  [144.98359815916467, -37.834356061641856],
  [144.98500289000458, -37.82835399589476],
  [144.98797921884267, -37.829073642831354],
  [144.9889507458539, -37.82504167767713],
  [144.98986487493642, -37.81758659259785],
  [144.987871122888, -37.816720338604746],
  [144.98261912992695, -37.81617101753192],
  [144.98342693030145, -37.81053383051667],
];

export const MELBOURNE_PILOT_CENTER: [number, number] = [144.9631, -37.8136];

export const MELBOURNE_PILOT_BOUNDS = {
  minLon: 144.92959437467596,
  minLat: -37.835273986159066,
  maxLon: 144.98986487493642,
  maxLat: -37.80591119887847,
};

/**
 * Checks whether a given geographic coordinate falls within the approved Melbourne pilot boundary
 * using a standard ray casting algorithm.
 */
export function isInsideMelbournePilot(point: { longitude: number; latitude: number }): boolean {
  const { longitude: x, latitude: y } = point;
  const poly = MELBOURNE_PILOT_COORDINATES;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const pi = poly[i];
    const pj = poly[j];
    if (!pi || !pj) continue;
    const [xi, yi] = pi;
    const [xj, yj] = pj;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Produces GeoJSON for the pilot boundary polygon feature.
 */
export function melbournePilotBoundaryFeature(): Feature<Polygon> {
  return {
    type: "Feature",
    properties: {
      id: "melbourne-pilot-boundary",
      name: "FoodGo Melbourne Pilot Area",
    },
    geometry: {
      type: "Polygon",
      coordinates: [MELBOURNE_PILOT_COORDINATES],
    },
  };
}

/**
 * Produces an inverted GeoJSON polygon covering the world with a hole for the Melbourne pilot,
 * allowing map renderers to visually mask/shade unexplored or out-of-bounds areas while keeping
 * map controls fully functional.
 */
export function melbournePilotMaskFeature(): Feature<Polygon> {
  const worldOuterRing: [number, number][] = [
    [-180, 85],
    [180, 85],
    [180, -85],
    [-180, -85],
    [-180, 85],
  ];
  return {
    type: "Feature",
    properties: {
      id: "melbourne-pilot-mask",
      name: "Melbourne Pilot Boundary Mask",
    },
    geometry: {
      type: "Polygon",
      coordinates: [worldOuterRing, MELBOURNE_PILOT_COORDINATES],
    },
  };
}

export function melbournePilotGeoJson(): FeatureCollection<Polygon> {
  return {
    type: "FeatureCollection",
    features: [melbournePilotBoundaryFeature(), melbournePilotMaskFeature()],
  };
}
