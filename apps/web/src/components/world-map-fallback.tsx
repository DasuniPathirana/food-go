"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { ATLAS_AERIAL, ATLAS_CENTER, ATLAS_CORNERS, ATLAS_SATELLITE, ATLAS_ATTRIBUTION } from "@/lib/melbourne-atlas";
import { interpolateMarker, markerTransitionDuration } from "@/lib/map-marker-motion";
import type { MapPoint } from "@/lib/map-game";
import { createMapPlaceMarker } from "./map-place-marker";
import type { AtlasCanvasProps } from "./atlas-canvas";
import styles from "./world-map-fallback.module.css";

const satelliteKey = process.env.NEXT_PUBLIC_MAPTILER_KEY?.trim();
const position = (point: { latitude: number; longitude: number }): Leaflet.LatLngTuple => [point.latitude, point.longitude];

/** Raster world map retains the explorer, street route and place controls without a GPU. */
export function WorldMapFallback(props: AtlasCanvasProps) {
  const latest = useRef(props), host = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null), api = useRef<typeof Leaflet | null>(null);
  const streetTiles = useRef<Leaflet.TileLayer | null>(null);
  const tileDeadline = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const player = useRef<Leaflet.Marker | null>(null), accuracy = useRef<Leaflet.Circle | null>(null);
  const route = useRef<Leaflet.Polyline | null>(null), focus = useRef<number | undefined>(undefined);
  const displayedPlayer = useRef<MapPoint | null>(null);
  const placeMarkers = useRef(new Map<string, Leaflet.Marker>());
  const [ready, setReady] = useState(false), [error, setError] = useState("");
  const [tilesReady, setTilesReady] = useState(false);
  const [satelliteFailed, setSatelliteFailed] = useState(false);
  const [playerElement, setPlayerElement] = useState<HTMLElement | null>(null);
  useEffect(() => { latest.current = props; }, [props]);
  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | undefined;
    const container = host.current;
    const interacting = () => latest.current.onCameraInteraction?.();
    const keyInteracting = (event: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "+", "-", "="].includes(event.key)) interacting();
    };
    container?.addEventListener("pointerdown", interacting, true);
    container?.addEventListener("touchstart", interacting, { passive: true, capture: true });
    container?.addEventListener("keydown", keyInteracting, true);
    async function initialise() {
      const L = await import("leaflet");
      if (disposed || !host.current) return;
      api.current = L;
      const initial = latest.current;
      const active = L.map(host.current, {
        center: initial.player ? position(initial.player) : [ATLAS_CENTER[1], ATLAS_CENTER[0]],
        zoom: 16, minZoom: 1, maxZoom: 20, zoomControl: false, scrollWheelZoom: false,
        worldCopyJump: true, keyboard: true, attributionControl: true,
      });
      map.current = active; latest.current.onBearingChange?.(0);
      L.control.zoom({ position: "topright" }).addTo(active);
      streetTiles.current = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 20, maxNativeZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        keepBuffer: 1,
      }).on("tileload", () => { if (!disposed) { clearTimeout(tileDeadline.current); setTilesReady(true); setError(""); } })
        .on("tileerror", () => { if (!disposed) { clearTimeout(tileDeadline.current); setError("Some street tiles could not load. Places and directions remain available."); } }).addTo(active);
      tileDeadline.current = setTimeout(() => { if (!disposed) setError("Street tiles are taking longer to arrive. Check your connection or try again."); }, 15000);
      active.on("click", event => latest.current.onSelect({ longitude: event.latlng.wrap().lng, latitude: event.latlng.lat }));
      active.on("dragstart", () => latest.current.onCameraInteraction?.());
      observer = new ResizeObserver(() => active.invalidateSize({ animate: false }));
      observer.observe(host.current);
      setReady(true); latest.current.onReady();
    }
    initialise().catch(() => { if (!disposed) { setError("The 2D map could not start. Use place search and directions."); latest.current.onReady(); } });
    return () => {
      disposed = true; clearTimeout(tileDeadline.current); observer?.disconnect();
      container?.removeEventListener("pointerdown", interacting, true);
      container?.removeEventListener("touchstart", interacting, true);
      container?.removeEventListener("keydown", keyInteracting, true);
      map.current?.remove(); map.current = null; api.current = null; streetTiles.current = null;
    };
  }, []);
  useEffect(() => {
    const L = api.current, active = map.current;
    if (!ready || !L || !active || props.imagery === "street" || props.imagery === "game") return;
    let overlay: Leaflet.ImageOverlay | Leaflet.TileLayer | undefined;
    const request = new AbortController();
    function unavailable() {
      if (request.signal.aborted) return;
      setSatelliteFailed(true); latest.current.onSatelliteUnavailable?.();
    }
    if (props.imagery === "satellite" && satelliteKey && !satelliteFailed) {
      // TileJSON carries the imagery contributors as well as the provider credit.
      fetch("https://api.maptiler.com/tiles/satellite-v2/tiles.json?key=" + encodeURIComponent(satelliteKey), {
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(15000)]),
      }).then(async response => {
        if (!response.ok) throw new Error("Satellite unavailable");
        const metadata = await response.json();
        if (request.signal.aborted) return;
        if (typeof metadata.attribution !== "string" || metadata.attribution.length > 10000) throw new Error("Missing imagery credits");
        overlay = L.tileLayer("https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=" + encodeURIComponent(satelliteKey!), {
          tileSize: 512, zoomOffset: -1, maxZoom: 20,
          attribution: metadata.attribution,
        }).on("tileerror", unavailable).addTo(active);
      }).catch(unavailable);
    } else {
      const bounds: Leaflet.LatLngBoundsExpression = [[ATLAS_CORNERS[2][1], ATLAS_CORNERS[0][0]], [ATLAS_CORNERS[0][1], ATLAS_CORNERS[2][0]]];
      overlay = L.imageOverlay(props.imagery === "aerial" ? ATLAS_AERIAL : ATLAS_SATELLITE, bounds, {
        attribution: `<a href="${ATLAS_ATTRIBUTION}">City of Melbourne · Copernicus</a>`, interactive: false,
      }).addTo(active);
    }
    return () => { request.abort(); if (overlay && active.hasLayer(overlay)) active.removeLayer(overlay); };
  }, [ready, props.imagery, satelliteFailed]);
  useEffect(() => {
    const L = api.current, active = map.current;
    if (!ready || !L || !active) return;
    const markers = props.places.map(place => {
      const button = createMapPlaceMarker(place);
      button.style.transform = "translate(-50%, -100%)";
      L.DomEvent.disableClickPropagation(button);
      button.onclick = () => latest.current.onSelect(place);
      const marker = L.marker(position(place), { keyboard: false, icon: L.divIcon({ html: button, className: styles.pinContainer, iconSize: [0, 0], iconAnchor: [0, 0] }) }).addTo(active);
      placeMarkers.current.set(place.id, marker);
      return marker;
    });
    return () => { markers.forEach(marker => marker.remove()); placeMarkers.current.clear(); };
  }, [ready, props.places]);
  useEffect(() => {
    for (const [id, marker] of placeMarkers.current)
      marker.getElement()?.querySelector("button")?.setAttribute("aria-pressed", String(id === props.selected?.id));
  }, [ready, props.places, props.selected?.id]);
  useEffect(() => {
    const L = api.current, active = map.current;
    if (!ready || !L || !active || !props.player) return;
    const node = document.createElement("div");
    node.className = styles.explorer;
    L.DomEvent.disableClickPropagation(node);
    const marker = L.marker(position(props.player), { keyboard: false, icon: L.divIcon({
      html: node, className: styles.playerContainer, iconSize: [100, 126], iconAnchor: [50, 111],
    }), zIndexOffset: 700 }).addTo(active);
    player.current = marker; setPlayerElement(node);
    return () => { marker.remove(); player.current = null; setPlayerElement(null); };
  }, [ready, !!props.player]);
  useEffect(() => {
    const active = map.current;
    if (!ready || !active || !props.player) return;
    const target = { longitude: props.player.longitude, latitude: props.player.latitude };
    const from = displayedPlayer.current ?? target;
    const milliseconds = markerTransitionDuration(displayedPlayer.current, target, props.playerTransitionMs ?? 80,
      window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const refocus = props.followPlayer && focus.current !== props.focusPlayerNonce;
    if (props.followPlayer) focus.current = props.focusPlayerNonce;
    const started = performance.now();
    let animation = 0;
    const render = (now: number) => {
      const progress = milliseconds ? Math.min(1, (now - started) / milliseconds) : 1;
      const point = interpolateMarker(from, target, progress);
      displayedPlayer.current = point;
      player.current?.setLatLng(position(point));
      if (props.followPlayer) {
        if (refocus) active.setView(position(point), Math.max(16, active.getZoom()), { animate: false });
        else active.panTo(position(point), { animate: false });
      }
      if (progress < 1) animation = requestAnimationFrame(render);
    };
    render(started);
    return () => cancelAnimationFrame(animation);
  }, [ready, props.player?.longitude, props.player?.latitude, props.followPlayer, props.focusPlayerNonce, props.playerTransitionMs]);
  useEffect(() => {
    const L = api.current, active = map.current, selected = props.selected;
    if (!ready || !L || !active || !selected) return;
    active.setView(position(selected), Math.max(15, active.getZoom()), { animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches });
    const pin = L.circleMarker(position(selected), { radius: 8, color: "#183d39", fillColor: "#ffd445", fillOpacity: 1, weight: 3 }).addTo(active);
    return () => { pin.remove(); };
  }, [ready, props.selected?.longitude, props.selected?.latitude, props.selected?.id]);
  useEffect(() => {
    const L = api.current, active = map.current;
    if (!ready || !L || !active) return;
    route.current?.remove(); route.current = null;
    if (props.route) route.current = L.polyline(props.route.coordinates.map(pair => [pair[1], pair[0]] as Leaflet.LatLngTuple),
      { color: "#00786f", weight: 6, opacity: 0.9 }).addTo(active);
  }, [ready, props.route]);
  useEffect(() => {
    const L = api.current, active = map.current;
    if (!ready || !L || !active) return;
    accuracy.current?.remove(); accuracy.current = null;
    if (props.location && props.accuracy != null && Number.isFinite(props.accuracy)) accuracy.current = L.circle(position(props.location), {
      radius: Math.max(1, props.accuracy), color: "#246fb1", weight: 1, fillOpacity: 0.12, interactive: false,
    }).addTo(active);
  }, [ready, props.location?.latitude, props.location?.longitude, props.accuracy]);
  return <div className={styles.wrapper}>
    <div className={styles.map} ref={host} aria-label="Interactive world map. Arrow keys pan, plus and minus zoom. Enter selects the centre." tabIndex={0}
      onKeyDown={event => {
        if (event.key === "Enter" && map.current && event.target === host.current) {
          event.preventDefault(); const point = map.current.getCenter().wrap();
          latest.current.onSelect({ longitude: point.lng, latitude: point.lat });
        }
      }}/>
    {playerElement && props.playerContent && createPortal(props.playerContent, playerElement)}
    {props.imagery === "satellite" && satelliteKey && !satelliteFailed && <a className={styles.provider} href="https://www.maptiler.com/" target="_blank" rel="noopener noreferrer"><img src="https://api.maptiler.com/resources/logo.svg" width="88" height="22" alt="MapTiler"/></a>}
    {!tilesReady && !error && <p className={styles.tileStatus} role="status">Loading street tiles…</p>}
    {error && <div className={styles.error} role="status"><p>{error}</p>{streetTiles.current && <button type="button" onClick={() => {
      setError(""); setTilesReady(false); clearTimeout(tileDeadline.current);
      tileDeadline.current = setTimeout(() => setError("Street tiles are taking longer to arrive. Check your connection or try again."), 15000);
      streetTiles.current?.redraw();
    }}>Retry street tiles</button>}</div>}
  </div>;
}
