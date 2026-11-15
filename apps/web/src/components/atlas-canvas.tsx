"use client";

import { useEffect, useRef, useState } from "react";
import { Compass, LocateFixed, Minus, Plus } from "lucide-react";
import type { AttributionControl, Coordinates, LngLatBoundsLike, Map as GeographicMap, Marker, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  ATLAS_AERIAL, ATLAS_ATTRIBUTION, ATLAS_BUILDINGS, ATLAS_CENTER, ATLAS_CORNERS, ATLAS_SATELLITE,
} from "@/lib/melbourne-atlas";
import css from "./atlas-canvas.module.css";

export type AtlasSelection = { longitude: number; latitude: number; id?: string };
export type AtlasPlace = AtlasSelection & { id: string; name: string };
export type AtlasImagery = "aerial" | "satellite";
type Props = {
  places: readonly AtlasPlace[];
  selected: AtlasSelection | null;
  threeD: boolean;
  imagery: AtlasImagery;
  onSelect: (point: AtlasSelection) => void;
  onReady: () => void;
  onUnavailable: (reason: string) => void;
  onSatelliteUnavailable?: () => void;
};

const corners: Coordinates = [ATLAS_CORNERS[0], ATLAS_CORNERS[1], ATLAS_CORNERS[2], ATLAS_CORNERS[3]];
const sampleBounds: LngLatBoundsLike = [corners[3], corners[1]];
const satelliteKey = process.env.NEXT_PUBLIC_MAPTILER_KEY?.trim();
const pitch3D = 52;
const bearing3D = -18;
const homeZoom = 15.3;

function style(imagery: AtlasImagery, threeD: boolean): StyleSpecification {
  return {
    version: 8,
    light: { anchor: "map", position: [1.4, 195, 37], color: "#fff3d5", intensity: 0.5 },
    sources: {
      aerial: { type: "image", url: ATLAS_AERIAL, coordinates: corners },
      satellite: { type: "image", url: ATLAS_SATELLITE, coordinates: corners },
      buildings: { type: "geojson", data: ATLAS_BUILDINGS, maxzoom: 17 },
    },
    layers: [
      { id: "outside-survey", type: "background", paint: { "background-color": "#e6e1d5" } },
      ...(["aerial", "satellite"] as const).map((id) => ({
        id, source: id, type: "raster" as const,
        layout: { visibility: id === imagery ? "visible" as const : "none" as const },
        paint: { "raster-fade-duration": 0 },
      })),
      {
        id: "buildings", source: "buildings", type: "fill-extrusion",
        layout: { visibility: threeD ? "visible" : "none" },
        paint: {
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": ["coalesce", ["get", "min_height"], 0],
          "fill-extrusion-color": ["interpolate", ["linear"], ["get", "height"], 0, "#eaddc1", 40, "#dad0b4", 120, "#afbcaf", 250, "#98b1ad"],
          "fill-extrusion-opacity": 0.86,
          "fill-extrusion-vertical-gradient": true,
        },
      },
    ],
  };
}

function duration() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 380;
}

function insideSurvey({ longitude, latitude }: AtlasSelection) {
  return longitude >= corners[3][0] && longitude <= corners[1][0] && latitude >= corners[3][1] && latitude <= corners[1][1];
}

export function AtlasCanvas(props: Props) {
  const { places, selected, threeD, imagery } = props;
  const latest = useRef(props);
  useEffect(() => { latest.current = props; }, [props]);
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GeographicMap | null>(null);
  const markerClass = useRef<typeof Marker | null>(null);
  const creditClass = useRef<typeof AttributionControl | null>(null);
  const placeMarkers = useRef(new Map<string, Marker>());
  const remoteFailed = useRef(false);
  const [ready, setReady] = useState(false);
  const [remoteActive, setRemoteActive] = useState(false);
  const [zoom, setZoom] = useState(homeZoom);
  const [bearing, setBearing] = useState(bearing3D);

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let cancelled = false;
    let failed = false;
    let map: GeographicMap | undefined;
    let resize: ResizeObserver | undefined;
    const unavailable = (reason: string) => {
      if (cancelled || failed) return;
      failed = true;
      latest.current.onUnavailable(reason);
    };
    const timer = window.setTimeout(() => unavailable("The interactive map took too long to load."), 20000);
    async function initialise() {
      const gl = await import("maplibre-gl");
      if (cancelled || failed || !container) return;
      gl.setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString());
      const initial = latest.current;
      map = new gl.Map({
        container, style: style(initial.imagery, initial.threeD), center: ATLAS_CENTER,
        zoom: homeZoom, maxZoom: 20, maxPitch: 62, maxBounds: sampleBounds,
        pitch: initial.threeD ? pitch3D : 0, bearing: initial.threeD ? bearing3D : 0,
        cooperativeGestures: false, scrollZoom: false, renderWorldCopies: false, attributionControl: false,
        pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      });
      mapRef.current = map;
      markerClass.current = gl.Marker;
      creditClass.current = gl.AttributionControl;
      const active = map;
      active.getCanvas().setAttribute("aria-label", "Geographic map. Arrow keys pan, plus and minus zoom. Press Enter to pin the centre.");
      active.on("click", (event) => {
        const point = event.lngLat.wrap();
        latest.current.onSelect({ longitude: point.lng, latitude: point.lat });
      });
      active.on("zoomend", () => setZoom(active.getZoom()));
      active.on("rotate", () => setBearing(active.getBearing()));
      active.on("webglcontextlost", () => unavailable("This browser lost its 3D graphics connection."));
      active.on("error", (event) => {
        const source = "sourceId" in event ? event.sourceId : undefined;
        if (source === "global-satellite") {
          if (!remoteFailed.current) {
            remoteFailed.current = true;
            setRemoteActive(false);
            if (active.getLayer("global-satellite")) active.removeLayer("global-satellite");
            if (active.getSource("global-satellite")) active.removeSource("global-satellite");
            active.setMaxBounds(sampleBounds);
            latest.current.onSatelliteUnavailable?.();
          }
        } else {
          unavailable("The geographic layers could not be drawn.");
        }
      });
      active.on("load", () => {
        if (cancelled || failed) return;
        clearTimeout(timer);
        setReady(true);
        latest.current.onReady();
      });
      resize = new ResizeObserver(() => active.resize());
      resize.observe(container);
    }
    initialise().catch(() => unavailable("This browser could not start the 3D map."));
    return () => {
      cancelled = true;
      clearTimeout(timer);
      resize?.disconnect();
      mapRef.current = null;
      map?.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    for (const key of ["aerial", "satellite"]) {
      map.setLayoutProperty(key, "visibility", key === imagery ? "visible" : "none");
    }
    const online = imagery === "satellite" && !!satelliteKey && !remoteFailed.current;
    if (online && !map.getSource("global-satellite")) {
      map.addSource("global-satellite", {
        type: "raster", tileSize: 512,
        url: `https://api.maptiler.com/tiles/satellite-v2/tiles.json?key=${encodeURIComponent(satelliteKey!)}`,
      });
      map.addLayer({ id: "global-satellite", type: "raster", source: "global-satellite" }, "buildings");
    }
    if (map.getLayer("global-satellite")) map.setLayoutProperty("global-satellite", "visibility", online ? "visible" : "none");
    map.setMaxBounds(online ? null : sampleBounds);
    setRemoteActive(online);
  }, [ready, imagery]);

  // Retain the provider's TileJSON attribution, including any imagery contributors it adds.
  useEffect(() => {
    const map = mapRef.current;
    const Credit = creditClass.current;
    if (!remoteActive || !map || !Credit) return;
    const credit = new Credit({ compact: false, customAttribution: [
      `<a href="${ATLAS_ATTRIBUTION}" target="_blank">City of Melbourne · Copernicus</a>`,
      '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a>',
      '<a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap</a>',
    ] });
    map.addControl(credit, "bottom-right");
    return () => { if (map.hasControl(credit)) map.removeControl(credit); };
  }, [remoteActive]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.setLayoutProperty("buildings", "visibility", threeD ? "visible" : "none");
    map.setMaxPitch(threeD ? 62 : 0);
    map.easeTo({ pitch: threeD ? pitch3D : 0, bearing: threeD ? bearing3D : 0, duration: duration() });
  }, [ready, threeD]);

  useEffect(() => {
    const map = mapRef.current;
    const Pin = markerClass.current;
    if (!ready || !map || !Pin) return;
    const pins = placeMarkers.current;
    for (const place of places) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = css.place;
      button.setAttribute("aria-label", `Select ${place.name}`);
      button.title = place.name;
      const label = document.createElement("span");
      label.textContent = place.name;
      button.append(label);
      button.onclick = (event) => {
        event.stopPropagation();
        latest.current.onSelect({ longitude: place.longitude, latitude: place.latitude, id: place.id });
      };
      const marker = new Pin({ element: button, anchor: "bottom", subpixelPositioning: true })
        .setLngLat([place.longitude, place.latitude]).addTo(map);
      pins.set(place.id, marker);
    }
    return () => {
      for (const marker of pins.values()) marker.remove();
      pins.clear();
    };
  }, [ready, places]);

  const lon = selected?.longitude;
  const lat = selected?.latitude;
  const id = selected?.id;
  useEffect(() => {
    for (const [markerId, marker] of placeMarkers.current) {
      marker.getElement().setAttribute("aria-pressed", String(markerId === id));
    }
  }, [ready, places, id]);
  useEffect(() => {
    const map = mapRef.current;
    const Pin = markerClass.current;
    if (!ready || !map || !Pin || lon === undefined || lat === undefined) return;
    if (remoteActive || insideSurvey({ longitude: lon, latitude: lat })) {
      map.easeTo({ center: [lon, lat], duration: duration(), zoom: Math.max(map.getZoom(), 15.5) });
    }
    if (id) return;
    const dot = document.createElement("div");
    dot.className = css.droppedPin;
    dot.setAttribute("aria-hidden", "true");
    const marker = new Pin({ element: dot, anchor: "center" }).setLngLat([lon, lat]).addTo(map);
    return () => { marker.remove(); };
  }, [ready, lon, lat, id, remoteActive]);

  const map = mapRef.current;
  return <div className={css.scene}>
    <div ref={host} className={css.viewport} onKeyDown={(event) => {
      if (event.key === "Enter" && map && event.target === map.getCanvas()) {
        event.preventDefault();
        const center = map.getCenter().wrap();
        latest.current.onSelect({ longitude: center.lng, latitude: center.lat });
      }
    }} />
    {ready && <>
      <div className={css.tools} role="group" aria-label="Geographic map controls">
        <button type="button" title="Face north" aria-label="Face north" onClick={() => map?.easeTo({ bearing: 0, duration: duration() })}><Compass style={{ transform: `rotate(${-bearing}deg)` }} /></button>
        <button type="button" title="Zoom in" aria-label="Zoom in on geographic map" disabled={zoom >= 20} onClick={() => map?.zoomIn({ duration: duration() })}><Plus /></button>
        <button type="button" title="Zoom out" aria-label="Zoom out of geographic map" disabled={zoom <= 0} onClick={() => map?.zoomOut({ duration: duration() })}><Minus /></button>
        <button type="button" title="Back to Melbourne" aria-label="Recenter geographic map on Melbourne" onClick={() => map?.easeTo({ center: ATLAS_CENTER, zoom: homeZoom, pitch: threeD ? pitch3D : 0, bearing: threeD ? bearing3D : 0, duration: duration() })}><LocateFixed /></button>
      </div>
      {!remoteActive && <div className={css.credit}>
        <a href={ATLAS_ATTRIBUTION} target="_blank" rel="noopener noreferrer">{imagery === "aerial" ? "City of Melbourne" : "City of Melbourne · Copernicus"}</a>
      </div>}
      {remoteActive && <a className={css.provider} href="https://www.maptiler.com/" target="_blank" rel="noopener noreferrer"><img src="https://api.maptiler.com/resources/logo.svg" width="88" height="22" alt="MapTiler" /></a>}
    </>}
  </div>;
}
