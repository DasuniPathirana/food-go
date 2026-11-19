/**
 * Decorative street ambience, sampled from public map road centerlines.
 *
 * These lamps are not surveyed installations, safe walking surfaces or
 * navigation instructions; they are optional art details for high-detail 3D.
 */
import type { Map as GeographicMap } from "maplibre-gl";

type Position = readonly number[];
type Line = readonly Position[];
export type GameStreetLamp = {
  id: string; kind: "lamp"; longitude: number; latitude: number;
};

function distanceMetres(a: Position, b: Position): number {
  const cos=Math.cos((a[1]+b[1])/2*Math.PI/180);
  return Math.hypot((b[0]-a[0])*111320*cos,(b[1]-a[1])*111320);
}

/** Never uses or reports an individual physical lamppost coordinate. */
export function sampleStreetLamps(
  lines: readonly Line[],
  centre: {longitude:number;latitude:number},
  limit = 50,
): GameStreetLamp[] {
  if (!Number.isFinite(centre.longitude)||!Number.isFinite(centre.latitude)||
    Math.abs(centre.latitude)>=83) return [];
  const options=new Map<string,{distance:number;lamp:GameStreetLamp}>();
  const radius=440;
  for (const line of lines.slice(0,220)) {
    if (line.length<2||line.length>260) continue;
    for(let i=1;i<line.length;i++) {
      const a=line[i-1],b=line[i];
      if (![a[0],a[1],b[0],b[1]].every(Number.isFinite))continue;
      const length=distanceMetres(a,b);
      if (length<14||length>2000) continue;
      const steps=Math.min(40,Math.floor(length/34));
      if (!steps)continue;
      for(let n=1;n<=steps;n++) {
        const t=n/(steps+1);
        const lng=a[0]+(b[0]-a[0])*t;
        const lat=a[1]+(b[1]-a[1])*t;
        const cos=Math.max(.15,Math.cos(lat*Math.PI/180));
        const vx=(b[0]-a[0])*111320*cos, vy=(b[1]-a[1])*111320;
        const vlen=Math.hypot(vx,vy);if(vlen<1)continue;
        // 3.5 m lateral stylization approximates a street-edge treatment,
        // not a certified pavement or route location.
        const side=(i+n)%2===0?1:-1;
        const longitude=lng+side*(-vy/vlen)*3.5/(111320*cos);
        const latitude=lat+side*(vx/vlen)*3.5/111320;
        const d=Math.hypot((longitude-centre.longitude)*111320*cos,
          (latitude-centre.latitude)*111320);
        if(d>radius)continue;
        const id=`street-light:${Math.round(longitude*2e4)}:${Math.round(latitude*2e4)}`;
        if (!options.has(id))options.set(id,{distance:d,lamp:{id,kind:"lamp",longitude,latitude}});
        if(options.size>=200)break;
      }
      if(options.size>=200)break;
    }
    if(options.size>=200)break;
  }
  return [...options.values()].sort((a,b)=>a.distance-b.distance||a.lamp.id.localeCompare(b.lamp.id))
    .slice(0,Math.max(0,Math.min(limit,80))).map(x=>x.lamp);
}

/** Works worldwide where the normal public map exposes transportation lines. */
export function streetLampsFromMap(map: GeographicMap, limit: number): GameStreetLamp[] {
  if(map.getZoom()<16.7)return [];
  const layers=(map.getStyle()?.layers??[]).filter(layer=>{
    if(layer.type!=="line")return false;
    return /road_(major|minor|residential|primary|secondary|tertiary)|road_minor|road_major/u.test(layer.id) &&
      !/rail|tunnel|casing|footway|path|oneway/u.test(layer.id);
  }).map(x=>x.id);
  if(!layers.length)return [];
  let features:ReturnType<GeographicMap["queryRenderedFeatures"]>;
  try{features=map.queryRenderedFeatures({layers});}catch{return [];}
  const lines:Line[]=[];
  for(const f of features.slice(0,220)){
    const g=f.geometry;
    if(g.type==="LineString")lines.push(g.coordinates);
    else if(g.type==="MultiLineString")lines.push(...g.coordinates);
  }
  const c=map.getCenter();
  return sampleStreetLamps(lines,{longitude:c.lng,latitude:c.lat},limit);
}
