"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Compass, LocateFixed, Minus, Plus, RefreshCw } from "lucide-react";
import type { AttributionControl, GeoJSONSource, Map as GeographicMap, Marker, StyleSpecification } from "maplibre-gl";
import type { LineString, Polygon } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import { ATLAS_ATTRIBUTION, ATLAS_CENTER } from "@/lib/melbourne-atlas";
import { emptyMapFeatures, MAP_SOURCE_IDS, WORLD_STREET_STYLE, worldMapStyle } from "@/lib/world-map-style";
import css from "./atlas-canvas.module.css";

export type AtlasSelection = { longitude: number; latitude: number; id?: string };
export type AtlasPlace = AtlasSelection & { id: string; name: string };
export type AtlasImagery = "street" | "aerial" | "satellite";
export type AtlasCanvasProps = {
  places: readonly AtlasPlace[]; selected: AtlasSelection | null; threeD: boolean; imagery: AtlasImagery;
  player?: AtlasSelection | null; playerContent?: ReactNode; followPlayer?: boolean; focusPlayerNonce?: number;
  location?: AtlasSelection | null; accuracy?: number; heading?: number; route?: LineString | null;
  onSelect: (point: AtlasSelection) => void; onReady: () => void; onUnavailable: (reason: string) => void;
  onSatelliteUnavailable?: () => void; onCameraInteraction?: () => void;
};

const satelliteKey = process.env.NEXT_PUBLIC_MAPTILER_KEY?.trim();
const homeZoom = 15.3;
function duration() { return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 380; }
function valid(point: AtlasSelection | null | undefined): point is AtlasSelection {
  return !!point && Number.isFinite(point.longitude) && Number.isFinite(point.latitude)
    && Math.abs(point.longitude) <= 180 && Math.abs(point.latitude) <= 90;
}
function accuracyCircle(point: AtlasSelection, metres: number): Polygon {
  const coordinates = Array.from({ length: 49 }, (_, index) => {
    const angle = index / 48 * 2 * Math.PI;
    return [
      point.longitude + Math.sin(angle) * metres / (111320 * Math.max(0.01, Math.cos(point.latitude * Math.PI / 180))),
      point.latitude + Math.cos(angle) * metres / 111320,
    ];
  });
  return { type: "Polygon", coordinates: [coordinates] };
}

export function AtlasCanvas(props: AtlasCanvasProps) {
  const { places, selected, threeD, imagery, player, playerContent, followPlayer, focusPlayerNonce, location, accuracy, route } = props;
  const latest = useRef(props);
  useEffect(() => { latest.current = props; }, [props]);
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GeographicMap | null>(null);
  const pinClass = useRef<typeof Marker | null>(null);
  const creditClass = useRef<typeof AttributionControl | null>(null);
  const streetLayers = useRef<ReturnType<typeof worldMapStyle>["streetLayers"]>([]);
  const placeMarkers = useRef(new Map<string, Marker>());
  const playerMarker = useRef<Marker | null>(null);
  const satelliteFailed = useRef(false);
  const focusRevision = useRef<number | undefined>(undefined);
  const [playerElement, setPlayerElement] = useState<HTMLElement | null>(null);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(homeZoom);
  const [bearing, setBearing] = useState(-18);
  const [tileIssue, setTileIssue] = useState(false);
  const [remoteUnavailable, setRemoteUnavailable] = useState(false);

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    const controller = new AbortController();
    let active: GeographicMap | undefined;
    let observer: ResizeObserver | undefined;
    let disposed = false, failed = false;
    const unavailable = (reason: string) => {
      if (disposed || failed) return;
      failed = true;
      latest.current.onUnavailable(reason);
    };
    const timeout = window.setTimeout(() => unavailable("The world map took too long to load."), 20000);
    async function initialise() {
      const [gl, response] = await Promise.all([
        import("maplibre-gl"),
        fetch(WORLD_STREET_STYLE, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) }),
      ]);
      if (!response.ok) throw new Error("World map unavailable");
      const base = await response.json() as StyleSpecification;
      if (base.version !== 8 || !base.sources || !Array.isArray(base.layers)) throw new Error("Invalid world map style");
      if (disposed || failed || !container) return;
      const composed = worldMapStyle(base, satelliteKey);
      streetLayers.current = composed.streetLayers;
      gl.setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString());
      const initial = latest.current;
      active = new gl.Map({
        container, style: composed.style, center: valid(initial.player) ? [initial.player.longitude, initial.player.latitude] : ATLAS_CENTER,
        zoom: homeZoom, minZoom: 1, maxZoom: 20, maxPitch: 65,
        pitch: initial.threeD ? 44 : 0, bearing: initial.threeD ? -18 : 0,
        cooperativeGestures: false, scrollZoom: true, renderWorldCopies: true, attributionControl: false,
        pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      });
      const map = active;
      mapRef.current = map; pinClass.current = gl.Marker; creditClass.current = gl.AttributionControl;
      map.getCanvas().setAttribute("aria-label", "World map. Drag or swipe to explore, pinch or use plus and minus to zoom. Arrow keys pan. Enter selects the centre.");
      map.on("click", event => {
        const point = event.lngLat.wrap();
        latest.current.onSelect({ longitude: point.lng, latitude: point.lat });
      });
      map.on("zoomend", () => setZoom(map.getZoom()));
      map.on("rotate", () => setBearing(map.getBearing()));
      for (const event of ["dragstart", "rotatestart", "zoomstart"] as const) map.on(event, movement => {
        if (movement.originalEvent) latest.current.onCameraInteraction?.();
      });
      map.on("webglcontextlost", () => unavailable("The browser lost its 3D graphics connection."));
      map.on("error", event => {
        const source = "sourceId" in event ? event.sourceId : undefined;
        if (source === MAP_SOURCE_IDS.globalSatellite) {
          if (!satelliteFailed.current) {
            satelliteFailed.current = true;
            setRemoteUnavailable(true);
            if (map.getLayer(MAP_SOURCE_IDS.globalSatellite)) map.setLayoutProperty(MAP_SOURCE_IDS.globalSatellite, "visibility", "none");
            latest.current.onSatelliteUnavailable?.();
          }
        } else setTileIssue(true);
      });
      map.on("idle", () => setTileIssue(false));
      map.on("load", () => {
        if (disposed || failed) return;
        clearTimeout(timeout);
        const element = document.createElement("div");
        element.className = css.player;
        element.addEventListener("click", event => event.stopPropagation());
        element.addEventListener("pointerdown", event => event.stopPropagation());
        setPlayerElement(element); setReady(true); latest.current.onReady();
      });
      observer = new ResizeObserver(() => map.resize());
      observer.observe(container);
    }
    initialise().catch(() => { if (!controller.signal.aborted) unavailable("The world map could not start. Check your connection or browser graphics."); });
    return () => {
      disposed = true; controller.abort(); clearTimeout(timeout); observer?.disconnect();
      mapRef.current = null; active?.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const globalSatellite = imagery === "satellite" && !!satelliteKey && !satelliteFailed.current;
    // Without a global imagery account, the labelled Melbourne snapshot remains
    // an overlay on the worldwide street map. The camera is never constrained.
    for (const layer of streetLayers.current) map.setLayoutProperty(layer.id, "visibility",
      imagery === "street" || !globalSatellite || layer.symbol ? layer.visibility : "none");
    map.setLayoutProperty(MAP_SOURCE_IDS.aerial, "visibility", imagery === "aerial" ? "visible" : "none");
    map.setLayoutProperty(MAP_SOURCE_IDS.satellite, "visibility", imagery === "satellite" && !globalSatellite ? "visible" : "none");
    if (map.getLayer(MAP_SOURCE_IDS.globalSatellite)) map.setLayoutProperty(MAP_SOURCE_IDS.globalSatellite, "visibility", globalSatellite ? "visible" : "none");
  }, [ready, imagery, remoteUnavailable]);

  useEffect(() => {
    const map = mapRef.current, Credit = creditClass.current;
    if (!ready || !map || !Credit) return;
    const credit = new Credit({ compact: true, customAttribution: [
      `<a href="${ATLAS_ATTRIBUTION}" target="_blank">City of Melbourne · Copernicus</a>`,
      ...(imagery === "satellite" && satelliteKey && !satelliteFailed.current ? ['<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a>'] : []),
    ] });
    map.addControl(credit, "bottom-right");
    return () => { if (map.hasControl(credit)) map.removeControl(credit); };
  }, [ready, imagery, remoteUnavailable]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    for (const layer of ["food-go-world-buildings", MAP_SOURCE_IDS.buildings])
      if (map.getLayer(layer)) map.setLayoutProperty(layer, "visibility", threeD ? "visible" : "none");
    map.setMaxPitch(threeD ? 65 : 0);
    map.easeTo({ pitch: threeD ? 44 : 0, duration: duration() });
  }, [ready, threeD]);

  useEffect(() => {
    const map = mapRef.current, Pin = pinClass.current;
    if (!ready || !map || !Pin) return;
    const pins = placeMarkers.current;
    for (const place of places.filter(valid)) {
      const button = document.createElement("button");
      button.type = "button"; button.className = css.place; button.title = place.name;
      button.setAttribute("aria-label", `Select ${place.name}`);
      const label = document.createElement("span"); label.textContent = place.name; button.append(label);
      button.onclick = event => { event.stopPropagation(); latest.current.onSelect({ longitude: place.longitude, latitude: place.latitude, id: place.id }); };
      pins.set(place.id, new Pin({ element: button, anchor: "bottom", subpixelPositioning: true })
        .setLngLat([place.longitude, place.latitude]).addTo(map));
    }
    return () => { for (const marker of pins.values()) marker.remove(); pins.clear(); };
  }, [ready, places]);

  const longitude = selected?.longitude, latitude = selected?.latitude, selectedId = selected?.id;
  useEffect(() => {
    for (const [id, marker] of placeMarkers.current) marker.getElement().setAttribute("aria-pressed", String(id === selectedId));
  }, [ready, places, selectedId]);
  useEffect(() => {
    const map = mapRef.current, Pin = pinClass.current;
    if (!ready || !map || !Pin || !valid(selected)) return;
    map.easeTo({ center: [selected.longitude, selected.latitude], duration: duration(), zoom: Math.max(map.getZoom(), 15.5) });
    if (selected.id && placeMarkers.current.has(selected.id)) return;
    const dot = document.createElement("div"); dot.className = css.droppedPin; dot.setAttribute("aria-hidden", "true");
    const marker = new Pin({ element: dot, anchor: "center" }).setLngLat([selected.longitude, selected.latitude]).addTo(map);
    return () => { marker.remove(); };
  }, [ready, longitude, latitude, selectedId]);

  const playerLongitude = player?.longitude, playerLatitude = player?.latitude;
  useEffect(() => {
    const map = mapRef.current, Pin = pinClass.current;
    if (!ready || !map || !Pin || !playerElement) return;
    if (!valid(player)) { playerMarker.current?.remove(); playerMarker.current = null; return; }
    if (!playerMarker.current) playerMarker.current = new Pin({ element: playerElement, anchor: "bottom", subpixelPositioning: true })
      .setLngLat([player.longitude, player.latitude]).addTo(map);
    else playerMarker.current.setLngLat([player.longitude, player.latitude]);
    if (followPlayer) {
      const refocus = focusRevision.current !== focusPlayerNonce;
      focusRevision.current = focusPlayerNonce;
      map.jumpTo({ center: [player.longitude, player.latitude], ...(refocus ? { zoom: Math.max(map.getZoom(), 15.8) } : {}) });
    }
  }, [ready, playerElement, playerLongitude, playerLatitude, followPlayer, focusPlayerNonce]);

  useEffect(() => {
    const source = mapRef.current?.getSource(MAP_SOURCE_IDS.route) as GeoJSONSource | undefined;
    if (!ready || !source) return;
    source.setData(route && route.coordinates.length >= 2 ? { type: "Feature", properties: {}, geometry: route } : emptyMapFeatures());
  }, [ready, route]);
  const locationLongitude = location?.longitude, locationLatitude = location?.latitude;
  useEffect(() => {
    const source = mapRef.current?.getSource(MAP_SOURCE_IDS.accuracy) as GeoJSONSource | undefined;
    if (!ready || !source) return;
    source.setData(valid(location) && Number.isFinite(accuracy) && accuracy! > 0
      ? { type: "Feature", properties: {}, geometry: accuracyCircle(location, Math.min(accuracy!, 100000)) } : emptyMapFeatures());
  }, [ready, locationLongitude, locationLatitude, accuracy]);

  const map = mapRef.current;
  return <div className={css.scene}>
    <div ref={host} className={css.viewport} onKeyDown={event => {
      if (event.key === "Enter" && map && event.target === map.getCanvas()) {
        event.preventDefault(); const centre = map.getCenter().wrap();
        latest.current.onSelect({ longitude: centre.lng, latitude: centre.lat });
      }
    }}/>
    {playerElement && playerContent && createPortal(playerContent, playerElement)}
    {ready && <>
      <div className={css.tools} role="group" aria-label="Geographic map controls">
        <button type="button" title="Face north" aria-label="Face north" onClick={() => map?.easeTo({ bearing: 0, duration: duration() })}><Compass style={{ transform: `rotate(${-bearing}deg)` }}/></button>
        <button type="button" title="Zoom in" aria-label="Zoom in on geographic map" disabled={zoom >= 20} onClick={() => map?.zoomIn({ duration: duration() })}><Plus/></button>
        <button type="button" title="Zoom out" aria-label="Zoom out of geographic map" disabled={zoom <= 1} onClick={() => map?.zoomOut({ duration: duration() })}><Minus/></button>
        <button type="button" title={valid(player) ? "Find my explorer" : "Back to Melbourne"} aria-label={valid(player) ? "Recenter map on explorer" : "Recenter geographic map on Melbourne"}
          onClick={() => map?.easeTo({ center: valid(player) ? [player.longitude, player.latitude] : ATLAS_CENTER, zoom: 16.5, duration: duration() })}><LocateFixed/></button>
      </div>
      {tileIssue && <p className={css.tileIssue} role="status"><RefreshCw size={13}/>Some map tiles could not load. Keep exploring or try again shortly.</p>}
      {imagery === "satellite" && satelliteKey && !satelliteFailed.current && <a className={css.provider} href="https://www.maptiler.com/" target="_blank" rel="noopener noreferrer"><img src="https://api.maptiler.com/resources/logo.svg" width="88" height="22" alt="MapTiler"/></a>}
    </>}
  </div>;
}
