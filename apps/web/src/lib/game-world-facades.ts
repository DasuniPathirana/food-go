/**
 * Food Go close-range building facade dressing.
 *
 * Geometry is sampled only from visible, real map-provider building footprints.
 * Decorative windows and trims are fictional; they do not claim surveyed
 * architecture, doors, accessibility or venue eligibility.
 */
import type { Map as GeographicMap } from "maplibre-gl";

export type GeoPoint = readonly number[];
export type FacadeFootprint = {
  id: string;
  ring: readonly GeoPoint[];
  height: number;
  base?: number;
};
export type FacadeObject = {
  id: string;
  kind: "facade";
  longitude: number;
  latitude: number;
  /** Simplified exterior ring, absolute geographic coordinates. */
  ring: readonly GeoPoint[];
  height: number;
  base: number;
};

function dist(a: { longitude: number; latitude: number }, b: { longitude: number; latitude: number }): number {
  const cos = Math.cos(a.latitude * Math.PI / 180);
  return Math.hypot((a.longitude - b.longitude) * 111320 * cos, (a.latitude - b.latitude) * 111320);
}

/** Pure sampler to keep the GPU and tile-query cost bounded. */
export function sampleFacades(
  input: readonly FacadeFootprint[],
  center: { longitude: number; latitude: number },
  limit = 55,
): FacadeObject[] {
  if (!Number.isFinite(center.longitude) || !Number.isFinite(center.latitude) ||
    Math.abs(center.latitude) >= 83) return [];
  const unique = new Set<string>();
  const result: {distance:number; item:FacadeObject}[] = [];
  for (const inputItem of input.slice(0, 750)) {
    if (inputItem.ring.length < 4 || inputItem.ring.length > 140 ||
      !Number.isFinite(inputItem.height) || inputItem.height < 4) continue;
    if (inputItem.ring.some(v => !Number.isFinite(v[0]) || !Number.isFinite(v[1]))) continue;
    const xs = inputItem.ring.map(p=>p[0]), ys = inputItem.ring.map(p=>p[1]);
    const west = Math.min(...xs), east = Math.max(...xs);
    const south = Math.min(...ys), north = Math.max(...ys);
    const cos = Math.max(.15, Math.cos(center.latitude * Math.PI / 180));
    const width = (east - west)*111320*cos;
    const depth = (north - south)*111320;
    if (width < 5 || depth < 5 || width > 160 || depth > 160) continue;
    const longitude = (west + east)/2, latitude = (north + south)/2;
    const distance = dist({longitude,latitude}, center);
    if (distance > 520) continue;
    const stableId = `facade:${inputItem.id}:${Math.round(longitude*1e5)}:${Math.round(latitude*1e5)}`;
    if (unique.has(stableId)) continue;
    unique.add(stableId);
    const height = Math.min(195, Math.max(5, 2 + 0.62*inputItem.height));
    const base = Math.max(0, Math.min(height-3, inputItem.base ? 2+0.62*inputItem.base : 0));
    result.push({distance,item:{
      id:stableId,kind:"facade",longitude,latitude,
      ring:(inputItem.ring.at(-1)?.[0]===inputItem.ring[0][0] &&
        inputItem.ring.at(-1)?.[1]===inputItem.ring[0][1]
        ? inputItem.ring.slice(0,-1) : inputItem.ring)
        .filter((point,i,arr)=>i===0||Math.hypot(point[0]-arr[i-1][0],point[1]-arr[i-1][1])>1e-7),
      height,base,
    }});
  }
  return result.sort((a,b)=>a.distance-b.distance||a.item.id.localeCompare(b.item.id))
    .slice(0,Math.max(0,Math.min(limit,80))).map(x=>x.item);
}

export function facadesFromMap(map: GeographicMap, limit: number): FacadeObject[] {
  if (map.getZoom() < 15.8) return [];
  const preferred = ["food-go-world-buildings","food-go-city-buildings"]
    .filter(id=>map.getLayer(id));
  const layers = preferred.length ? preferred :
    (map.getStyle()?.layers ?? []).filter(x=>x.type==="fill-extrusion").map(x=>x.id);
  if (!layers.length) return [];
  let features: ReturnType<GeographicMap["queryRenderedFeatures"]>;
  try { features=map.queryRenderedFeatures({layers}); } catch { return []; }
  const inputs: FacadeFootprint[] = [];
  for (const feature of features.slice(0,750)) {
    const geometry=feature.geometry;
    const polygons=geometry.type==="Polygon" ? [geometry.coordinates]
      : geometry.type==="MultiPolygon" ? geometry.coordinates : [];
    const height=Number(feature.properties?.render_height ?? feature.properties?.height ?? 0);
    const base=Number(feature.properties?.render_min_height ?? feature.properties?.min_height ?? 0);
    if (!Number.isFinite(height) || height < 4) continue;
    for (const polygon of polygons) {
      const ring=polygon[0];
      if (!ring || ring.length<4) continue;
      const id=String(feature.properties?.osm_id??feature.id??`${ring[0][0]}:${ring[0][1]}`);
      inputs.push({id,ring,height,base});
    }
  }
  const c=map.getCenter();
  return sampleFacades(inputs,{longitude:c.lng,latitude:c.lat},limit);
}
