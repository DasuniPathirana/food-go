"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { Crosshair, MapPin, Minus, Plus } from "lucide-react";
import { useMapGesture } from "./use-map-gesture";
import { ATLAS_AERIAL, ATLAS_ATTRIBUTION, ATLAS_BUILDINGS, ATLAS_CENTER, ATLAS_CORNERS, ATLAS_SATELLITE } from "@/lib/melbourne-atlas";
import type { AtlasPlace, AtlasSelection } from "./atlas-canvas";
import styles from "./atlas-fallback.module.css";

type Props = {
  places: readonly AtlasPlace[];
  selected: AtlasSelection | null;
  onSelect: (point: AtlasSelection) => void;
  imagery: "aerial" | "satellite";
  threeD: boolean;
};
type Point = { x: number; y: number };
type Coordinate = { longitude: number; latitude: number };
type Building = {
  geometry: { type: "MultiPolygon"; coordinates: number[][][][] } | { type: "Polygon"; coordinates: number[][][] };
  properties: { height: number; min_height: number };
};

// The bundled images are north-up Web Mercator crops. Convert both imagery and
// footprints into the same pixel plane before applying the orthographic camera.
const width = 2048;
const radians = Math.PI / 180;
const earthRadius = 6378137;
const [northWest, northEast, southEast] = ATLAS_CORNERS;
const mercY = (latitude: number) => Math.log(Math.tan(Math.PI / 4 + latitude * radians / 2));
const northY = mercY(northWest[1]);
const pxPerRadian = width / ((northEast[0] - northWest[0]) * radians);
const height = (northY - mercY(southEast[1])) * pxPerRadian;
const pxPerMetre = pxPerRadian / (earthRadius * Math.cos(ATLAS_CENTER[1] * radians));
const pitch = 42 * radians;
const compressed = Math.cos(pitch);
const risePerMetre = pxPerMetre * Math.sin(pitch);
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

function project({ longitude, latitude }: Coordinate): Point {
  return { x: (longitude - northWest[0]) * radians * pxPerRadian, y: (northY - mercY(latitude)) * pxPerRadian };
}
function unproject({ x, y }: Point): Coordinate {
  return {
    longitude: northWest[0] + x / pxPerRadian / radians,
    latitude: (2 * Math.atan(Math.exp(northY - y / pxPerRadian)) - Math.PI / 2) / radians,
  };
}
const home = project({ longitude: ATLAS_CENTER[0], latitude: ATLAS_CENTER[1] });

function buildingGeometry(features: Building[]) {
  return features.flatMap(({ geometry, properties }) => {
    const polygons = geometry.type === "MultiPolygon" ? geometry.coordinates : [geometry.coordinates];
    return polygons.map(polygon => {
      const rings = polygon.map(ring => ring.map(([longitude, latitude]) => project({ longitude, latitude })));
      const front = rings[0].reduce((max, point) => Math.max(max, point.y), -Infinity);
      return { rings, front, roof: properties.height * risePerMetre, base: properties.min_height * risePerMetre };
    });
  }).sort((a, b) => a.front - b.front || a.base - b.base);
}
type ProjectedBuilding = ReturnType<typeof buildingGeometry>[number];

function drawBuilding(ctx: CanvasRenderingContext2D, building: ProjectedBuilding) {
  const { rings, roof, base } = building;
  for (const ring of rings) {
    // Draw north-facing edges first, then the southern faces visible to this camera.
    // GeoJSON ring winding can differ between source polygons.
    let area = 0;
    for (let i = 1; i < ring.length; i++) area += ring[i-1].x * ring[i].y - ring[i].x * ring[i-1].y;
    const winding = Math.sign(area) * (ring === rings[0] ? 1 : -1);
    for (let i = 1; i < ring.length; i++) {
      const a = ring[i-1], b = ring[i];
      if ((b.x - a.x) * winding >= 0) continue;
      ctx.fillStyle = (b.y - a.y) * winding > 0 ? "#427673" : "#7a9691";
      ctx.beginPath();
      ctx.moveTo(a.x, a.y * compressed - base);
      ctx.lineTo(b.x, b.y * compressed - base);
      ctx.lineTo(b.x, b.y * compressed - roof);
      ctx.lineTo(a.x, a.y * compressed - roof);
      ctx.fill();
    }
  }
  ctx.beginPath();
  for (const ring of rings) {
    ctx.moveTo(ring[0].x, ring[0].y * compressed - roof);
    for (let i = 1; i < ring.length; i++) ctx.lineTo(ring[i].x, ring[i].y * compressed - roof);
    ctx.closePath();
  }
  ctx.fillStyle = "#c7d6cc";
  ctx.fill("evenodd");
  if (roof > 6) {
    ctx.strokeStyle = "#769590";
    ctx.lineWidth = .65;
    ctx.stroke();
  }
}

export function AtlasFallback({ places, selected, onSelect, imagery, threeD }: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const buildings = useRef<HTMLCanvasElement>(null);
  const drawn = useRef(false);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [camera, setCamera] = useState({ ...home, zoom: 1 });
  const [buildingError, setBuildingError] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [topPad, setTopPad] = useState(0);
  const locallySelected = useRef<AtlasSelection | null>(null);
  const squash = threeD && !buildingError ? compressed : 1;
  const scale = Math.max(size.width / width, size.height / (height * squash)) * camera.zoom;
  const xExtent = size.width / (2 * scale);
  const yExtent = size.height / (2 * scale * squash);
  const centre = { x: clamp(camera.x, xExtent, width - xExtent), y: clamp(camera.y, yExtent, height - yExtent) };
  const left = size.width / 2 - centre.x * scale;
  const top = size.height / 2 - centre.y * squash * scale;

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!selected || selected === locallySelected.current) return;
    const p = project(selected);
    if (p.x >= 0 && p.x <= width && p.y >= 0 && p.y <= height) setCamera(c => ({ ...c, ...p }));
  }, [selected]);
  useEffect(() => { setImageError(false); }, [imagery]);
  useEffect(() => {
    if (!threeD || drawn.current) return;
    const controller = new AbortController();
    let frame = 0;
    async function prepare() {
      const response = await fetch(ATLAS_BUILDINGS, { signal: controller.signal });
      if (!response.ok) throw new Error("Local city model unavailable");
      const data = await response.json() as { features: Building[] };
      if (controller.signal.aborted) return;
      const shapes = buildingGeometry(data.features);
      const pad = Math.ceil(shapes.reduce((max, b) => Math.max(max, b.roof), 0));
      const canvas = buildings.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) throw new Error("Canvas unavailable");
      canvas.width = width;
      canvas.height = Math.ceil(height * compressed + pad);
      ctx.translate(0, pad);
      setTopPad(pad);
      setBuildingError(false);
      let index = 0;
      const batch = () => {
        const deadline = performance.now() + 9;
        while (index < shapes.length && performance.now() < deadline) drawBuilding(ctx, shapes[index++]);
        if (index < shapes.length) frame = requestAnimationFrame(batch);
        else drawn.current = true;
      };
      frame = requestAnimationFrame(batch);
    }
    prepare().catch(() => { if (!controller.signal.aborted) setBuildingError(true); });
    return () => { controller.abort(); cancelAnimationFrame(frame); };
  }, [threeD]);

  function select(point: AtlasSelection) { locallySelected.current = point; onSelect(point); }
  function zoom(delta: number) { setCamera(c => ({ ...centre, zoom: clamp(c.zoom * delta, 1, 8) })); }
  function keyControl(event: KeyboardEvent<HTMLDivElement>) {
    if (event.currentTarget !== event.target || event.altKey || event.ctrlKey || event.metaKey) return;
    const steps: Record<string, Point> = { ArrowLeft: { x: -60, y: 0 }, ArrowRight: { x: 60, y: 0 }, ArrowUp: { x: 0, y: -60 }, ArrowDown: { x: 0, y: 60 } };
    const step = steps[event.key];
    if (step) setCamera(c => ({ ...c, x: centre.x + step.x / scale, y: centre.y + step.y / scale / squash }));
    else if (event.key === "+" || event.key === "=") zoom(1.5);
    else if (event.key === "-") zoom(1/1.5);
    else if (event.key === "Home") setCamera({ ...home, zoom: 1 });
    else if (event.key === "Enter") select(unproject(centre));
    else return;
    event.preventDefault();
  }
  const gestures = useMapGesture((dx, dy) => setCamera(c => ({
    ...c, x: clamp(c.x - dx / scale, xExtent, width - xExtent),
    y: clamp(c.y - dy / scale / squash, yExtent, height - yExtent),
  })), zoom, point => {
    const box = viewport.current?.getBoundingClientRect();
    if (box) select(unproject({ x: clamp((point.x - box.left - left) / scale, 0, width), y: clamp((point.y - box.top - top) / scale / squash, 0, height) }));
  });
  function markerPosition(point: Coordinate): CSSProperties {
    const p = project(point);
    return { left: left + p.x * scale, top: top + p.y * scale * squash };
  }

  return <div className={styles.map} ref={viewport} role="region" tabIndex={0}
    aria-label="Melbourne local map. Arrow keys pan, plus and minus zoom, Enter selects the centre, Home resets."
    onKeyDown={keyControl} {...gestures}>
    <div className={styles.plane} style={{ width, left, top, transform: `scale(${scale})` }} aria-hidden="true">
      {/* Both local images use this exact georeferenced frame at their native resolutions. */}
      <img alt="" src={imagery === "aerial" ? ATLAS_AERIAL : ATLAS_SATELLITE} draggable={false}
        style={{ width, height: height * squash }} onLoad={() => setImageError(false)} onError={() => setImageError(true)} />
      <canvas ref={buildings} hidden={!threeD || buildingError} style={{ top: -topPad }} />
    </div>
    {places.map(place => {
      const position = markerPosition(place);
      if (Number(position.left) < 0 || Number(position.left) > size.width || Number(position.top) < 0 || Number(position.top) > size.height) return null;
      return <button key={place.id} type="button" data-map-marker className={styles.marker} style={position}
        aria-pressed={place.id === selected?.id} aria-label={place.name} onClick={() => select({ id: place.id, longitude: place.longitude, latitude: place.latitude })}>
        <MapPin size={18} aria-hidden="true" /><span>{place.name}</span>
      </button>;
    })}
    {selected && !selected.id && <span className={styles.dropped} style={markerPosition(selected)} aria-hidden="true"><MapPin size={28} fill="currentColor" /></span>}
    <div className={styles.tools} aria-label="Local map controls">
      <button type="button" aria-label="Zoom in" title="Zoom in" disabled={camera.zoom >= 8} onClick={() => zoom(1.5)}><Plus size={18} /></button>
      <button type="button" aria-label="Zoom out" title="Zoom out" disabled={camera.zoom <= 1} onClick={() => zoom(1/1.5)}><Minus size={18} /></button>
      <button type="button" aria-label="Reset map view" title="Reset map view" onClick={() => setCamera({ ...home, zoom: 1 })}><Crosshair size={18} /></button>
    </div>
    {imageError || buildingError && threeD ? <p role="status" className={styles.error}>{imageError ? "Image unavailable. Search above for directions." : "Building shapes unavailable. Showing the flat map."}</p> : null}
    <a className={styles.credit} href={ATLAS_ATTRIBUTION} target="_blank" rel="noopener noreferrer">{imagery === "satellite" ? "Copernicus · City of Melbourne" : "City of Melbourne"} · Sources</a>
  </div>;
}
