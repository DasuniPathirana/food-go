"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Map as MapLibreMap, Marker, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

if (typeof window !== "undefined") {
  setWorkerUrl("/atlas/maplibre-gl-worker.mjs");
}
import {
  MELBOURNE_PILOT_BOUNDS,
  MELBOURNE_PILOT_CENTER,
  MELBOURNE_PILOT_COORDINATES,
  isInsideMelbournePilot,
  melbournePilotBoundaryFeature,
  melbournePilotMaskFeature,
} from "@food-go/domain";
import type { LiveMall } from "@/lib/world-data";
import styles from "./pilot-map-picker.module.css";

export type PickerMarker = {
  id: string;
  label: string;
  kind?: "venue" | "loot" | "game_admin";
  latitude: number;
  longitude: number;
};

type PilotMapPickerProps = {
  latitude: number;
  longitude: number;
  onChange: (coords: { latitude: number; longitude: number }) => void;
  malls?: readonly LiveMall[];
  markers?: readonly PickerMarker[];
  pinLabel?: string;
  height?: number;
};

const QUICK_POINTS = [
  { label: "Melbourne CBD", latitude: -37.8136, longitude: 144.9631 },
  { label: "Swanston & Collins", latitude: -37.8152, longitude: 144.9668 },
  { label: "Melbourne Central", latitude: -37.8102, longitude: 144.9628 },
  { label: "Southbank Promenade", latitude: -37.8205, longitude: 144.9648 },
];

export function PilotMapPicker({
  latitude,
  longitude,
  onChange,
  malls = [],
  markers = [],
  pinLabel = "Click anywhere inside the green Melbourne Pilot zone to place pin",
  height = 290,
}: PilotMapPickerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const pinMarkerRef = useRef<Marker | null>(null);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [outsideWarn, setOutsideWarn] = useState("");
  const latestOnChange = useRef(onChange);
  latestOnChange.current = onChange;

  function applyCoords(nextLat: number, nextLng: number) {
    if (!isInsideMelbournePilot({ latitude: nextLat, longitude: nextLng })) {
      setOutsideWarn("Outside Stage 1 Melbourne CBD Pilot area. Pick inside the teal boundary.");
      return;
    }
    setOutsideWarn("");
    latestOnChange.current({
      latitude: Number(nextLat.toFixed(6)),
      longitude: Number(nextLng.toFixed(6)),
    });
  }

  useEffect(() => {
    if (!hostRef.current) return;
    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: hostRef.current,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: [longitude || MELBOURNE_PILOT_CENTER[0], latitude || MELBOURNE_PILOT_CENTER[1]],
        zoom: 14.3,
        maxBounds: [
          [MELBOURNE_PILOT_BOUNDS.minLon - 0.012, MELBOURNE_PILOT_BOUNDS.minLat - 0.012],
          [MELBOURNE_PILOT_BOUNDS.maxLon + 0.012, MELBOURNE_PILOT_BOUNDS.maxLat + 0.012],
        ],
      });
    } catch {
      setFallbackMode(true);
      return;
    }
    mapRef.current = map;

    map.on("error", () => {
      if (!map.loaded()) setFallbackMode(true);
    });

    map.on("load", () => {
      try {
        map.addSource("pilot-picker-mask", {
          type: "geojson",
          data: melbournePilotMaskFeature(),
        });
        map.addSource("pilot-picker-outline", {
          type: "geojson",
          data: melbournePilotBoundaryFeature(),
        });
        map.addLayer({
          id: "pilot-picker-mask-fill",
          type: "fill",
          source: "pilot-picker-mask",
          paint: { "fill-color": "#d5e4e2", "fill-opacity": 0.65 },
        });
        map.addLayer({
          id: "pilot-picker-outline-line",
          type: "line",
          source: "pilot-picker-outline",
          paint: { "line-color": "#08786e", "line-width": 2.5 },
        });
      } catch {
        // Ignore duplicate source race on fast remounts
      }

      const pinEl = document.createElement("div");
      pinEl.className = styles.pinDot;
      const pinMarker = new Marker({ element: pinEl, draggable: true })
        .setLngLat([longitude, latitude])
        .addTo(map);
      pinMarker.on("dragend", () => {
        const pos = pinMarker.getLngLat();
        if (!isInsideMelbournePilot({ latitude: pos.lat, longitude: pos.lng })) {
          pinMarker.setLngLat([longitude, latitude]);
          setOutsideWarn("Pin must stay inside the Stage 1 Melbourne Pilot boundary.");
          return;
        }
        setOutsideWarn("");
        latestOnChange.current({
          latitude: Number(pos.lat.toFixed(6)),
          longitude: Number(pos.lng.toFixed(6)),
        });
      });
      pinMarkerRef.current = pinMarker;

      for (const mall of malls) {
        const el = document.createElement("button");
        el.type = "button";
        el.className = styles.mallDot;
        el.title = `Snap to mall: ${mall.name}`;
        el.addEventListener("click", ev => {
          ev.stopPropagation();
          applyCoords(mall.coordinates.latitude, mall.coordinates.longitude);
        });
        new Marker({ element: el }).setLngLat([mall.coordinates.longitude, mall.coordinates.latitude]).addTo(map);
      }

      for (const item of markers) {
        const el = document.createElement("div");
        el.className = styles.extraDot;
        el.title = item.label;
        new Marker({ element: el }).setLngLat([item.longitude, item.latitude]).addTo(map);
      }
    });

    map.on("click", ev => {
      applyCoords(ev.lngLat.lat, ev.lngLat.lng);
    });

    return () => {
      pinMarkerRef.current?.remove();
      pinMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // Intentionally recreate only when malls list length changes
  }, [malls.length]);

  useEffect(() => {
    if (pinMarkerRef.current) {
      pinMarkerRef.current.setLngLat([longitude, latitude]);
    }
    if (mapRef.current && mapRef.current.loaded()) {
      mapRef.current.easeTo({ center: [longitude, latitude], duration: 350 });
    }
  }, [latitude, longitude]);

  const svgPolyPoints = useMemo(() => {
    const minLon = MELBOURNE_PILOT_BOUNDS.minLon;
    const maxLon = MELBOURNE_PILOT_BOUNDS.maxLon;
    const minLat = MELBOURNE_PILOT_BOUNDS.minLat;
    const maxLat = MELBOURNE_PILOT_BOUNDS.maxLat;
    return MELBOURNE_PILOT_COORDINATES.map(([lng, lat]) => {
      const x = ((lng - minLon) / (maxLon - minLon)) * 400;
      const y = ((maxLat - lat) / (maxLat - minLat)) * 220;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  }, []);

  function projectSvg(lat: number, lng: number) {
    const x = ((lng - MELBOURNE_PILOT_BOUNDS.minLon) / (MELBOURNE_PILOT_BOUNDS.maxLon - MELBOURNE_PILOT_BOUNDS.minLon)) * 400;
    const y = ((MELBOURNE_PILOT_BOUNDS.maxLat - lat) / (MELBOURNE_PILOT_BOUNDS.maxLat - MELBOURNE_PILOT_BOUNDS.minLat)) * 220;
    return { x, y };
  }

  return (
    <div className={styles.picker}>
      <div className={styles.toolbar}>
        <div className={styles.chips}>
          {QUICK_POINTS.map(pt => (
            <button
              key={pt.label}
              type="button"
              className={styles.chip}
              onClick={() => applyCoords(pt.latitude, pt.longitude)}
            >
              {pt.label}
            </button>
          ))}
        </div>
        <span className={styles.coordsReadout}>
          {latitude.toFixed(5)}, {longitude.toFixed(5)}
        </span>
      </div>

      <div className={styles.mapStage} style={{ height }}>
        <span className={styles.hintBadge}>{pinLabel}</span>
        {outsideWarn && <span className={styles.warningToast}>{outsideWarn}</span>}
        {fallbackMode ? (
          <svg
            viewBox="0 0 400 220"
            className={styles.fallbackSvg}
            onClick={e => {
              const rect = e.currentTarget.getBoundingClientRect();
              const rx = (e.clientX - rect.left) / rect.width;
              const ry = (e.clientY - rect.top) / rect.height;
              const lng =
                MELBOURNE_PILOT_BOUNDS.minLon +
                rx * (MELBOURNE_PILOT_BOUNDS.maxLon - MELBOURNE_PILOT_BOUNDS.minLon);
              const lat =
                MELBOURNE_PILOT_BOUNDS.maxLat -
                ry * (MELBOURNE_PILOT_BOUNDS.maxLat - MELBOURNE_PILOT_BOUNDS.minLat);
              applyCoords(lat, lng);
            }}
          >
            <polygon points={svgPolyPoints} fill="#d7f3ec" stroke="#08786e" strokeWidth="2" />
            {malls.map(m => {
              const p = projectSvg(m.coordinates.latitude, m.coordinates.longitude);
              return (
                <circle key={m.id} cx={p.x} cy={p.y} r="5" fill="#ffb72b" stroke="#0f2936" strokeWidth="1.5">
                  <title>{m.name}</title>
                </circle>
              );
            })}
            {(() => {
              const active = projectSvg(latitude, longitude);
              return <circle cx={active.x} cy={active.y} r="7" fill="#00c49a" stroke="#ffffff" strokeWidth="2.5" />;
            })()}
          </svg>
        ) : (
          <div ref={hostRef} className={styles.mapCanvas} />
        )}
      </div>

      <div className={styles.manualInputs}>
        <label>
          Latitude
          <input
            type="number"
            step="0.00001"
            value={latitude}
            onChange={e => {
              const val = Number(e.target.value);
              if (Number.isFinite(val)) applyCoords(val, longitude);
            }}
          />
        </label>
        <label>
          Longitude
          <input
            type="number"
            step="0.00001"
            value={longitude}
            onChange={e => {
              const val = Number(e.target.value);
              if (Number.isFinite(val)) applyCoords(latitude, val);
            }}
          />
        </label>
      </div>
    </div>
  );
}
