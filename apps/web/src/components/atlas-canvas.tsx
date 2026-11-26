"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { LineString } from "geojson";
import { Map as MapLibreMap, Marker, setWorkerUrl, type GeoJSONSource, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { CatalogueVenue } from "@/lib/catalogue-contracts";
import type { AvatarId } from "@/lib/avatar-preferences";
import { explorerCameraLimits, explorerCameraOptions, type ExplorerPerspective } from "@/lib/explorer-camera";
import { createFirstPersonLook, type FirstPersonLook } from "@/lib/first-person-look";
import { attachFirstPersonInput } from "./first-person-input";
import { createGameWorldObjectLayer, type GameWorldObject } from "@/lib/game-world-objects";
import { MAP_SOURCE_IDS, worldMapStyle } from "@/lib/world-map-style";
import { mapDistance, type MapPoint } from "@/lib/map-game";
import { attachPilotFog } from "./pilot-fog";
import { createMapPlaceMarker } from "./map-place-marker";
import type { LiveMall, VenueAppearance, WorldLoot } from "@/lib/world-data";
import styles from "./atlas-canvas.module.css";

export type AtlasImagery = "streets" | "satellite" | "aerial" | "street" | "game";

export type AtlasPlace = CatalogueVenue & {
  longitude: number;
  latitude: number;
  coordinates: { longitude: number; latitude: number };
};

export type AtlasSelection = {
  kind?: "venue" | "building";
  id?: string;
  name?: string;
  longitude: number;
  latitude: number;
  buildingName?: string;
  buildingVenues?: AtlasPlace[];
};

export type AtlasCanvasProps = {
  places: readonly AtlasPlace[];
  selected: AtlasSelection | null;
  player?: {
    longitude: number;
    latitude: number;
    accuracy: number | null;
    heading: number | null;
    walking: boolean;
    gaitMetres: number;
    live: boolean;
    avatar: AvatarId;
  };
  imagery: AtlasImagery;
  threeD: boolean;
  perspective: ExplorerPerspective;
  follow: boolean;
  refocus: number;
  zoomDelta: number;
  route: LineString | null;
  routeStopId?: string | null;
  revealedCells?: readonly string[];
  loots?: readonly WorldLoot[];
  malls?: readonly LiveMall[];
  appearances?: Readonly<Record<string, VenueAppearance>>;
  trailCoords?: readonly [number, number][];
  celebrating?: boolean;
  selectedLootId?: string | null;
  onSelect: (selection: AtlasSelection) => void;
  onSelectMall?: (mall: LiveMall) => void;
  onSelectLoot?: (loot: WorldLoot) => void;
  onPickRouteDestination: (point: MapPoint) => void;
  onFollowChange: (following: boolean) => void;
  onImageryFailed?: (message: string) => void;
  onSatelliteUnavailable?: () => void;
  onStatus?: (message: string) => void;
  onOpenAvatar?: () => void;
  onPerspectiveChange?: (next: ExplorerPerspective) => void;
  onWebglFallback?: () => void;
  // Compatibility fields kept optional for fallback renderers
  onCameraInteraction?: () => void;
  onBearingChange?: (bearing: number) => void;
  onReady?: () => void;
  pilotOverviewNonce?: number;
  followPlayer?: boolean;
  focusPlayerNonce?: number;
  playerTransitionMs?: number;
  discoveryEnabled?: boolean;
  discoveredCells?: readonly string[];
  lowDetail?: boolean;
  onDiscoveryView?: (view: unknown) => void;
  encounterSignals?: Record<string, never>;
  location?: { longitude: number; latitude: number } | null;
  accuracy?: number | null;
  playerContent?: ReactNode;
};

const STREET_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
if (typeof window !== "undefined") {
  setWorkerUrl("/atlas/maplibre-gl-worker.mjs");
}
const PILOT_DEFAULT_CENTER: [number, number] = [144.9665, -37.8152];
const PILOT_MAX_BOUNDS: [[number, number], [number, number]] = [
  [144.938, -37.834],
  [144.989, -37.796],
];

function createLootDomMarker(loot: WorldLoot, distanceMetres: number, selected: boolean, onClick: () => void) {
  const btn = document.createElement("button");
  btn.type = "button";
  const isAr = loot.grabMode === "ar_grab";
  btn.setAttribute("aria-label", `${loot.title} (${isAr ? "AR Grab" : "Map Grab"})`);
  btn.style.cssText = `
    position: absolute; top: 0; left: 0;
    display: inline-flex; align-items: center; gap: 3px; padding: 3px 7px;
    border-radius: 9999px; cursor: pointer; font-family: inherit;
    font-size: 9.5px; font-weight: 800; letter-spacing: 0.03em;
    color: #ffffff;
    background: ${isAr ? "rgba(194, 65, 12, 0.9)" : "rgba(6, 55, 48, 0.88)"};
    backdrop-filter: blur(6px);
    border: 1.5px solid ${selected ? "#ffd445" : isAr ? "#fb923c" : "#2dd4bf"};
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.25);
    transform: translateY(24px);
    white-space: nowrap;
  `;
  const tag = isAr ? "AR" : loot.source === "game_admin" ? "BONUS" : "LOOT";
  btn.innerHTML = `<span style="color:${isAr ? "#ffd445" : "#5eead4"}">${tag}</span><span>${Math.round(distanceMetres)}m</span>`;
  btn.addEventListener("click", e => {
    e.stopPropagation();
    onClick();
  });
  return btn;
}

export function AtlasCanvas(props: AtlasCanvasProps) {
  const {
    places,
    selected,
    player = {
      longitude: PILOT_DEFAULT_CENTER[0],
      latitude: PILOT_DEFAULT_CENTER[1],
      accuracy: null,
      heading: 0,
      walking: false,
      gaitMetres: 0,
      live: false,
      avatar: "foodie" as AvatarId,
    },
    imagery,
    threeD,
    perspective,
    follow,
    refocus,
    zoomDelta,
    route,
    loots = [],
    malls = [],
    appearances = {},
    trailCoords = [],
    celebrating = false,
    selectedLootId = null,
    onSelect,
    onSelectMall,
    onSelectLoot,
    onPickRouteDestination,
    onFollowChange,
    onImageryFailed,
    onPerspectiveChange,
    onWebglFallback,
  } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const worldLayerRef = useRef<(ReturnType<typeof createGameWorldObjectLayer> & { updateScene?: (d: unknown) => void }) | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const lookRef = useRef<FirstPersonLook>(createFirstPersonLook(56));
  const [ready, setReady] = useState(false);

  const worldObjects: GameWorldObject[] = useMemo(() => {
    const out: GameWorldObject[] = places
      .filter(p => p.source !== "demo" && !appearances[p.id]?.mallId)
      .map(place => ({
        id: place.id,
        name: place.name,
        longitude: place.coordinates.longitude,
        latitude: place.coordinates.latitude,
        kind: (place.type as GameWorldObject["kind"]) ?? "restaurant",
        preset: appearances[place.id]?.buildingPreset,
        accentColour: appearances[place.id]?.buildingAccentColour,
      }));
    for (const mall of malls) {
      out.push({
        id: mall.id,
        name: mall.name,
        longitude: mall.coordinates.longitude,
        latitude: mall.coordinates.latitude,
        kind: "mall",
        shopCount: mall.shopCount,
      });
    }
    return out;
  }, [places, malls, appearances]);

  // Initialise MapLibre WebGL 3D canvas
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let detachFog: (() => void) | undefined;
    const maptilerKey = process.env.NEXT_PUBLIC_MAPTILER_KEY;
    const controller = new AbortController();

    async function initMap() {
      let baseStyle: StyleSpecification;
      try {
        const res = await fetch(STREET_STYLE_URL, { signal: controller.signal });
        if (!res.ok) throw new Error("Style fetch failed");
        baseStyle = (await res.json()) as StyleSpecification;
      } catch {
        if (!cancelled) onWebglFallback?.();
        return;
      }
      if (cancelled || !container) return;

      const { style, gamePaint } = worldMapStyle(baseStyle, maptilerKey);
      const isCompactScreen = typeof window !== "undefined" && window.innerWidth <= 640;
      const defaultThirdZoom = isCompactScreen ? 18.65 : 19.05;
      const defaultThirdPitch = isCompactScreen ? 61 : 63;
      const defaultThirdBearing = isCompactScreen ? -10 : -16;

      let map: MapLibreMap;
      try {
        map = new MapLibreMap({
          container,
          style,
          center: [player.longitude || PILOT_DEFAULT_CENTER[0], player.latitude || PILOT_DEFAULT_CENTER[1]],
          zoom: defaultThirdZoom,
          pitch: defaultThirdPitch,
          bearing: player.heading ?? defaultThirdBearing,
          maxPitch: 85,
          minZoom: 14.8,
          maxZoom: 23,
          maxBounds: PILOT_MAX_BOUNDS,
          attributionControl: { compact: true },
        });
      } catch {
        onWebglFallback?.();
        return;
      }

      map.setPadding({ top: 40, bottom: 110, left: 0, right: 0 });
      mapRef.current = map;

      let worldMounted = false;
      function mountWorldOnce() {
        if (cancelled || worldMounted) return;
        worldMounted = true;

        // Apply bright stylized game ground, parks, river, and street paints
        for (const item of gamePaint) {
          try {
            if (map.getLayer(item.id)) {
              map.setPaintProperty(item.id, item.property, item.game);
            }
          } catch {}
        }
        // Sharpen road networks and brighten terrain to match Food Go's illustrated 3D style
        for (const layer of map.getStyle()?.layers ?? []) {
          try {
            const sourceLayer = "source-layer" in layer ? layer["source-layer"] : undefined;
            if (layer.type === "background") {
              map.setPaintProperty(layer.id, "background-color", "#a2cf81");
            } else if (layer.type === "fill") {
              if (sourceLayer === "water" || layer.id.includes("water")) {
                map.setPaintProperty(layer.id, "fill-color", "#48afd9");
                map.setPaintProperty(layer.id, "fill-opacity", 0.96);
              } else if (sourceLayer === "park" || /park|grass|wood|pitch|garden|green/u.test(layer.id)) {
                map.setPaintProperty(layer.id, "fill-color", "#7ebb61");
                map.setPaintProperty(layer.id, "fill-opacity", 0.96);
              } else if (sourceLayer === "landuse" || sourceLayer === "landcover") {
                map.setPaintProperty(layer.id, "fill-color", "#9ac979");
                map.setPaintProperty(layer.id, "fill-opacity", 0.92);
              }
            } else if (layer.type === "line" && sourceLayer === "transportation") {
              const rail = layer.id.includes("rail");
              const casing = layer.id.endsWith("casing");
              const walking = /path|footway|pedestrian|steps|cycleway/u.test(layer.id);
              if (!rail) {
                map.setPaintProperty(
                  layer.id,
                  "line-color",
                  walking ? (casing ? "#e4dac5" : "#efe6d3") : casing ? "#f4efe2" : "#89989f"
                );
                map.setPaintProperty(layer.id, "line-opacity", walking ? 0.92 : 1);
              }
            } else if (layer.type === "symbol" && sourceLayer === "transportation_name") {
              map.setPaintProperty(layer.id, "text-color", "#1f3730");
              map.setPaintProperty(layer.id, "text-halo-color", "#fffef8");
              map.setPaintProperty(layer.id, "text-halo-width", 2.2);
            }
          } catch {}
        }

        for (const layer of map.getStyle()?.layers ?? []) {
          if (("source-layer" in layer && layer["source-layer"] === "building") || layer.id.includes("building")) {
            try {
              map.setLayoutProperty(layer.id, "visibility", "none");
            } catch {}
          }
        }
        const layer = createGameWorldObjectLayer(worldObjects, {
          player: {
            longitude: player.longitude,
            latitude: player.latitude,
            heading: player.heading ?? 0,
            walking: player.walking,
            celebrating,
            avatarId: player.avatar,
            hiddenInFirstPerson: perspective === "first",
          },
          loots,
          malls,
          appearances,
          trailCoords,
          reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        });
        worldLayerRef.current = layer as typeof worldLayerRef.current;
        const firstSymbol = map.getStyle().layers.find(l => l.type === "symbol")?.id;
        map.addLayer(layer, firstSymbol);
        const fogCamera = {
          project: (lng: number, lat: number) => map.project([lng, lat]),
          unproject: (x: number, y: number) => {
            const p = map.unproject([x, y]);
            return { longitude: p.lng, latitude: p.lat };
          },
          subscribe: (cb: () => void) => {
            map.on("move", cb);
            map.on("resize", cb);
            return () => {
              map.off("move", cb);
              map.off("resize", cb);
            };
          },
        };
        detachFog = attachPilotFog(container!, fogCamera, map.getCanvas());
        setReady(true);
      }

      let worldFallbackTimer: ReturnType<typeof setTimeout> | undefined;
      function tryMountWorld() {
        if (!cancelled && !worldMounted && map.getStyle()?.layers?.length) {
          mountWorldOnce();
        }
      }

      map.once("style.load", mountWorldOnce);
      map.once("load", mountWorldOnce);
      map.on("styledata", tryMountWorld);
      if (map.isStyleLoaded()) mountWorldOnce();
      else worldFallbackTimer = setTimeout(tryMountWorld, 1200);

      map.on("dragstart", () => onFollowChange?.(false));
      map.on("click", e => {
        if (perspective !== "first" && onPickRouteDestination) {
          onPickRouteDestination({ longitude: e.lngLat.lng, latitude: e.lngLat.lat });
        }
      });
      map.on("error", () => {
        onImageryFailed?.("Map imagery temporarily limited.");
      });

      const prevCancelCleanup = () => {
        if (worldFallbackTimer) clearTimeout(worldFallbackTimer);
      };
      controller.signal.addEventListener("abort", prevCancelCleanup, { once: true });
    }

    void initMap();

    return () => {
      cancelled = true;
      controller.abort();
      detachFog?.();
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      worldLayerRef.current = null;
      setReady(false);
    };
  }, []);

  // Sync static 3D venues and malls only when venue/mall definitions change
  useEffect(() => {
    const layer = worldLayerRef.current;
    if (!ready || !layer?.updateScene) return;
    layer.updateScene({ objects: worldObjects, malls, appearances });
  }, [ready, worldObjects, malls, appearances]);

  // Sync collectible loots independently of player movement
  useEffect(() => {
    const layer = worldLayerRef.current;
    if (!ready || !layer?.updateScene) return;
    layer.updateScene({ loots });
  }, [ready, loots]);

  // Sync breadcrumb / route trail independently of buildings
  useEffect(() => {
    const layer = worldLayerRef.current;
    if (!ready || !layer?.updateScene) return;
    layer.updateScene({
      trailCoords: route?.coordinates?.length ? (route.coordinates as [number, number][]) : trailCoords,
    });
  }, [ready, route, trailCoords]);

  // Sync player position, facing, animation & perspective without touching 3D buildings
  useEffect(() => {
    const layer = worldLayerRef.current;
    if (!ready || !layer?.updateScene) return;
    layer.updateScene({
      player: {
        longitude: player.longitude,
        latitude: player.latitude,
        heading: player.heading ?? 0,
        walking: player.walking,
        speedMode: player.walking ? "walk" : undefined,
        celebrating,
        avatarId: player.avatar,
        hiddenInFirstPerson: perspective === "first",
      },
    });
  }, [ready, player, celebrating, perspective]);

  // Toggle satellite raster visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const satLayer = map.getLayer("food-go-global-satellite");
    if (satLayer) {
      map.setLayoutProperty("food-go-global-satellite", "visibility", imagery === "satellite" ? "visible" : "none");
    }
    const limits = explorerCameraLimits(perspective, threeD);
    map.setMaxPitch(limits.maxPitch);
    map.setMaxZoom(limits.maxZoom);
  }, [ready, imagery, perspective, threeD]);

  // Sync camera pose for 1st-person, 3rd-person follow & overhead modes
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !follow) return;

    if (perspective === "first") {
      const opts = explorerCameraOptions(map, {
        perspective: "first",
        point: { longitude: player.longitude, latitude: player.latitude },
        heading: player.heading ?? 0,
        follow: true,
        threeD,
        look: lookRef.current,
        refocus: refocus > 0,
      });
      if (opts) {
        map.easeTo({ ...opts, duration: refocus > 0 ? 450 : 200 });
      }
      return;
    }

    if (perspective === "overhead") {
      map.easeTo({
        center: [player.longitude, player.latitude],
        zoom: 15.8,
        pitch: threeD ? 36 : 0,
        bearing: 0,
        roll: 0,
        duration: 420,
      });
      return;
    }

    const compactViewport = typeof window !== "undefined" && window.innerWidth <= 640;
    map.easeTo({
      center: [player.longitude, player.latitude],
      zoom: compactViewport ? 18.65 : 19.05,
      pitch: threeD ? (compactViewport ? 61 : 63) : 0,
      bearing: player.heading ?? (compactViewport ? -10 : -16),
      padding: threeD ? { top: 40, bottom: 110, left: 0, right: 0 } : { top: 0, bottom: 0, left: 0, right: 0 },
      roll: 0,
      duration: refocus > 0 ? 450 : 220,
    });
  }, [ready, perspective, player.longitude, player.latitude, player.heading, follow, threeD, refocus]);

  // Attach 1st-person look-around drag & pinch FOV when in 1st person view
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || perspective !== "first") return;
    const handle = attachFirstPersonInput(map, {
      initial: lookRef.current,
      onChange(next) {
        lookRef.current = next;
        const opts = explorerCameraOptions(map, {
          perspective: "first",
          point: { longitude: player.longitude, latitude: player.latitude },
          heading: player.heading ?? 0,
          follow: true,
          threeD: true,
          look: next,
        });
        if (opts) map.jumpTo(opts);
      },
      onTap(pt) {
        onPickRouteDestination?.(pt);
      },
    });
    return () => handle.dispose(true);
  }, [ready, perspective, player.longitude, player.latitude, player.heading, onPickRouteDestination]);

  // Zoom button pulses
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || zoomDelta === 0) return;
    map.easeTo({ zoom: Math.max(15, Math.min(22, map.getZoom() + (zoomDelta > 0 ? 1.1 : -1.1))), duration: 280 });
  }, [ready, zoomDelta]);

  // Route polyline source update
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const src = map.getSource(MAP_SOURCE_IDS.route) as GeoJSONSource | undefined;
    if (src) {
      src.setData({
        type: "FeatureCollection",
        features: route ? [{ type: "Feature", properties: {}, geometry: route }] : [],
      });
    }
  }, [ready, route]);

  // Sync crisp clickable floating beacons & distance cards for Venues, Malls & Loots
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const playerPt = { longitude: player.longitude, latitude: player.latitude };

    // 1. Food venues
    const standalone = places.filter(p => p.source !== "demo" && !appearances[p.id]?.mallId);
    for (const place of standalone) {
      const dist = Math.round(mapDistance(playerPt, place.coordinates));
      const el = createMapPlaceMarker(place, dist, 4.8, true);
      el.setAttribute("aria-pressed", String(selected?.id === place.id));
      el.addEventListener("click", e => {
        e.stopPropagation();
        onSelect({
          kind: "venue",
          id: place.id,
          name: place.name,
          longitude: place.coordinates.longitude,
          latitude: place.coordinates.latitude,
        });
      });
      const marker = new Marker({ element: el, anchor: "top" })
        .setLngLat([place.coordinates.longitude, place.coordinates.latitude])
        .setOffset([0, 8])
        .addTo(map);
      markersRef.current.push(marker);
    }

    // 2. Malls (multi-restaurant buildings)
    for (const mall of malls) {
      const dist = Math.round(mapDistance(playerPt, mall.coordinates));
      const el = createMapPlaceMarker(
        {
          id: mall.id,
          name: mall.name,
          cuisine: `${mall.shopCount} Food Venues`,
          type: "market",
          coordinates: mall.coordinates,
          building: { id: mall.id, name: mall.name, level: "G", unit: `${mall.shopCount} Venues` },
          shops: [],
        } as unknown as Parameters<typeof createMapPlaceMarker>[0],
        dist,
        4.9,
        true
      );
      el.setAttribute("aria-pressed", String(selected?.kind === "building" && selected.id === mall.id));
      el.addEventListener("click", e => {
        e.stopPropagation();
        onSelectMall?.(mall);
      });
      const marker = new Marker({ element: el, anchor: "top" })
        .setLngLat([mall.coordinates.longitude, mall.coordinates.latitude])
        .setOffset([0, 8])
        .addTo(map);
      markersRef.current.push(marker);
    }

    // 3. World Loots & Admin Game Rewards
    for (const loot of loots) {
      const dist = mapDistance(playerPt, loot.coordinates);
      const el = createLootDomMarker(loot, dist, selectedLootId === loot.id, () => onSelectLoot?.(loot));
      const marker = new Marker({ element: el, anchor: "center" })
        .setLngLat([loot.coordinates.longitude, loot.coordinates.latitude])
        .addTo(map);
      markersRef.current.push(marker);
    }
  }, [ready, places, malls, loots, appearances, player.longitude, player.latitude, selected, selectedLootId, onSelect, onSelectMall, onSelectLoot]);

  return (
    <div className={styles.scene}>
      <div ref={containerRef} className={styles.viewport} aria-label="Food Go 3D Melbourne Pilot World" />
    </div>
  );
}
