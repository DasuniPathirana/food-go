"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Compass, Minus, Plus, RefreshCw } from "lucide-react";
import type { AttributionControl, CameraOptions, FilterSpecification, GeoJSONSource, Map as GeographicMap, Marker, StyleSpecification } from "maplibre-gl";
import type { LineString, Polygon } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import { ATLAS_ATTRIBUTION, ATLAS_CENTER } from "@/lib/melbourne-atlas";
import { emptyMapFeatures, MAP_SOURCE_IDS, WORLD_STREET_STYLE, worldMapStyle } from "@/lib/world-map-style";
import { createGameWorldObjectLayer, GAME_WORLD_OBJECT_LAYER, type GameWorldObject } from "@/lib/game-world-objects";
import { parkTreesFromMap } from "@/lib/game-world-greenery";
import { rooftopsFromMap } from "@/lib/game-world-architecture";
import { facadesFromMap, type FacadeObject } from "@/lib/game-world-facades";
import { streetLampsFromMap } from "@/lib/game-world-streetscape";
import { demoParkScenery } from "@/lib/demo-park-scenery";
import { interpolateMarker, markerTransitionDuration } from "@/lib/map-marker-motion";
import { blendExplorerCamera, EXPLORER_CAMERA_TRANSITION_MS, explorerCameraLimits, explorerCameraOptions, explorerCameraPosition, explorerCameraPose, interpolateCameraBearing, type ExplorerCameraPose, type ExplorerPerspective } from "@/lib/explorer-camera";
import { mapDistance } from "@/lib/map-game";
import { explorationFogGeometry, EXPLORATION_MAX_LATITUDE, type ExplorationFogResult } from "@food-go/domain/exploration";
import { createFirstPersonLook } from "@/lib/first-person-look";
import { attachFirstPersonInput } from "./first-person-input";
import { buildCameraObstacles, resolveCameraClearance, type CameraObstacle } from "@/lib/camera-clearance";
import { createMapPlaceMarker, updateMapPlaceEncounter } from "./map-place-marker";
import type { EncounterSignal } from "@/lib/encounter-landmarks";
import css from "./atlas-canvas.module.css";

export type AtlasSelection = { longitude: number; latitude: number; id?: string };
export type AtlasPlace = AtlasSelection & {
  id: string;
  name: string;
  image?: string;
  kind?: "cafe" | "restaurant" | "market" | "building";
  shopCount?: number;
  members?: readonly { id: string }[];
  rating?: number;
  distanceMetres?: number;
};
export type AtlasImagery = "game" | "street" | "aerial" | "satellite";
export type AtlasCanvasProps = {
  places: readonly AtlasPlace[]; selected: AtlasSelection | null; threeD: boolean; imagery: AtlasImagery;
  player?: AtlasSelection | null; playerContent?: ReactNode; followPlayer?: boolean; focusPlayerNonce?: number;
  playerTransitionMs?: number; onBearingChange?: (bearing: number) => void;
  perspective?: ExplorerPerspective;
  lowDetail?: boolean;
  deviceHeading?: number | null; onEyeLook?: () => void;
  discoveryEnabled?: boolean; discoveredCells?: readonly string[];
  encounterSignals?: Readonly<Record<string, EncounterSignal>>;
  onDiscoveryView?: (view: Omit<ExplorationFogResult, "data">) => void;
  location?: AtlasSelection | null; accuracy?: number; heading?: number; route?: LineString | null;
  onSelect: (point: AtlasSelection) => void; onReady: () => void; onUnavailable: (reason: string) => void;
  onSatelliteUnavailable?: () => void; onCameraInteraction?: () => void;
  onDemoTreasure?: () => void;
  zoomInTrigger?: number;
  zoomOutTrigger?: number;
  /** Explicit map-only focus for the opt-in, non-redeemable demo tour. */
  demoFocus?: (AtlasSelection & { zoom: number; pitch: number; nonce: number }) | null;
};

const satelliteKey = process.env.NEXT_PUBLIC_MAPTILER_KEY?.trim();
const homeZoom = 16.8;
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
  const { places, selected, threeD, imagery, player, playerContent, followPlayer, focusPlayerNonce, location, accuracy, route, perspective = "overhead" } = props;
  const latest = useRef(props);
  useEffect(() => { latest.current = props; }, [props]);
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GeographicMap | null>(null);
  const pinClass = useRef<typeof Marker | null>(null);
  const creditClass = useRef<typeof AttributionControl | null>(null);
  const streetLayers = useRef<ReturnType<typeof worldMapStyle>["streetLayers"]>([]);
  const gamePaint = useRef<ReturnType<typeof worldMapStyle>["gamePaint"]>([]);
  const placeMarkers = useRef(new Map<string, Marker>());
  const playerMarker = useRef<Marker | null>(null);
  const satelliteFailed = useRef(false);
  const focusRevision = useRef<number | undefined>(undefined);
  const displayedPlayer = useRef<AtlasSelection | null>(null);
  const displayedHeading = useRef(0);
  const cameraInterrupted = useRef(false);
  const cameraPerspective = useRef<ExplorerPerspective | null>(null);
  const wasFollowing = useRef(false);
  const cameraBlend = useRef<{ from: ExplorerCameraPose; started: number; duration: number } | null>(null);
  const firstPersonLook = useRef(createFirstPersonLook());
  const ignoreDeviceHeading = useRef(false);
  const eyeInput = useRef<ReturnType<typeof attachFirstPersonInput> | null>(null);
  const [playerElement, setPlayerElement] = useState<HTMLElement | null>(null);
  const [ready, setReady] = useState(false);
  const [parkTrees, setParkTrees] = useState<GameWorldObject[]>([]);
  const [roofDetails, setRoofDetails] = useState<GameWorldObject[]>([]);
  const [facadeDetails, setFacadeDetails] = useState<FacadeObject[]>([]);
  const facadeSignature = useRef("");
  const [streetLights,setStreetLights] = useState<GameWorldObject[]>([]);
  const streetLightSignature=useRef("");
  const roofSignature = useRef("");
  const parkSignature = useRef("");
  const [worldEpoch, setWorldEpoch] = useState(0);
  const worldRegion = useRef<AtlasSelection | null>(null);
  const [zoom, setZoom] = useState(homeZoom);
  const [bearing, setBearing] = useState(-18);
  const [tileIssue, setTileIssue] = useState(false);
  const [remoteUnavailable, setRemoteUnavailable] = useState(false);
  const [geometryEpoch, setGeometryEpoch] = useState(0);
  const [clearance, setClearance] = useState<"clear" | "closer" | "raised">("clear");
  const clearanceRef = useRef(clearance);
  const obstacleCache = useRef<{ point: AtlasSelection; at: number; epoch: number; game: boolean; obstacles: CameraObstacle[]; truncated: boolean } | null>(null);
  const sceneCamera = useRef<(map: GeographicMap, input: Parameters<typeof explorerCameraOptions>[1]) => CameraOptions | null>(() => null);
  sceneCamera.current = (map, input) => {
    let status: typeof clearance = "clear", override: typeof input.cameraPosition;
    if (input.follow && input.threeD && (input.perspective === "third" || input.perspective === "close")) {
      const now = performance.now(), game = latest.current.imagery === "game", ground = input.groundElevation ?? 0;
      let cached = obstacleCache.current;
      if (!cached || now - cached.at > 500 || cached.epoch !== geometryEpoch || cached.game !== game || mapDistance(cached.point, input.point) > 15) {
        const features: unknown[] = [];
        try {
          // Filter geographically before the feature cap. A large survey can
          // otherwise fill the result with distant roofs and omit this wall.
          const nearby = ["<=", ["distance", { type: "Point", coordinates: [input.point.longitude, input.point.latitude] }], 75] as FilterSpecification;
          if (map.getSource(MAP_SOURCE_IDS.buildings)) {
            const found = map.querySourceFeatures(MAP_SOURCE_IDS.buildings, { filter: nearby });
            features.push(...found.slice(0, 2501));
          }
        } catch { /* Missing source data remains a documented limit, not a wall. */ }
        const admitted = buildCameraObstacles(features, { centre: input.point, groundElevation: ground, gameHeights: game });
        cached = { ...admitted, point: input.point, at: now, epoch: geometryEpoch, game }; obstacleCache.current = cached;
      }
      const result = resolveCameraClearance({ target: { ...input.point, altitude: ground + 1.5 },
        desired: explorerCameraPosition(input.point, input.heading, input.perspective, ground), obstacles: cached.obstacles });
      if (result.obstructed) {
        status = result.targetBlocked || result.fraction < .15 ? "raised" : "closer";
        if (status === "closer") override = result.camera;
      }
    }
    if (status !== clearanceRef.current) { clearanceRef.current = status; setClearance(status); }
    const look = input.perspective === "first" && !ignoreDeviceHeading.current && Number.isFinite(latest.current.deviceHeading) && latest.current.deviceHeading != null
      ? { ...(input.look ?? firstPersonLook.current), yawOffset: latest.current.deviceHeading - input.heading } : input.look;
    return explorerCameraOptions(map, status === "raised" ? { ...input, perspective: "overhead", refocus: true } : { ...input, look, cameraPosition: override });
  };

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
      gamePaint.current = composed.gamePaint;
      gl.setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString());
      const initial = latest.current;
      const initialPerspective = initial.perspective ?? "overhead";
      const initialLimits = explorerCameraLimits(initialPerspective, initial.threeD);
      active = new gl.Map({
        container, style: composed.style, center: valid(initial.player) ? [initial.player.longitude, initial.player.latitude] : ATLAS_CENTER,
        zoom: homeZoom, minZoom: 1, ...initialLimits,
        pitch: initial.threeD ? 58 : 0, bearing: initial.threeD ? -42 : 0,
        cooperativeGestures: false, scrollZoom: true, renderWorldCopies: true, attributionControl: false,
        pixelRatio: initial.lowDetail ? 1 : Math.min(window.devicePixelRatio || 1, 2),
      });
      const map = active;
      mapRef.current = map; pinClass.current = gl.Marker; creditClass.current = gl.AttributionControl;
      if (valid(initial.player) && initial.followPlayer) {
        const camera = sceneCamera.current(map, { perspective: initialPerspective, point: initial.player,
          heading: initial.heading ?? map.getBearing(), follow: true, threeD: initial.threeD, refocus: true });
        if (camera) map.jumpTo({ ...camera, pitch: initial.threeD ? 58 : camera.pitch, bearing: initial.threeD ? -42 : 0, zoom: homeZoom });
      }
      map.getCanvas().setAttribute("aria-label", "World map. Drag or swipe to explore, pinch or use plus and minus to zoom. Arrow keys pan. Enter selects the centre.");
      map.on("click", event => {
        if (new URLSearchParams(window.location.search).get("world-demo") === "1") {
          const chest = map.project([144.96915, -37.81790]);
          if (Math.hypot(event.point.x - chest.x, event.point.y - chest.y) <= 42) {
            latest.current.onDemoTreasure?.();
            return;
          }
        }
        const point = event.lngLat.wrap();
        latest.current.onSelect({ longitude: point.lng, latitude: point.lat });
      });
      map.on("zoomend", () => setZoom(map.getZoom()));
      map.on("rotate", () => { setBearing(map.getBearing()); latest.current.onBearingChange?.(map.getBearing()); });
      for (const event of ["movestart", "dragstart", "rotatestart", "zoomstart", "pitchstart"] as const) map.on(event, movement => {
        if (movement.originalEvent) { cameraInterrupted.current = true; latest.current.onCameraInteraction?.(); }
      });
      map.on("resize", () => {
        const current = latest.current;
        if (!current.followPlayer || cameraInterrupted.current) return;
        const point = displayedPlayer.current ?? current.player;
        if (!valid(point)) return;
        const ground = map.getTerrain() ? map.queryTerrainElevation([point.longitude, point.latitude]) ?? 0 : 0;
        if (Math.abs(map.getCenterElevation() - ground) > .01) map.setCenterElevation(ground);
        const camera = sceneCamera.current(map, { perspective: current.perspective ?? "overhead", point,
          heading: displayedPlayer.current ? displayedHeading.current : current.heading ?? map.getBearing(),
          follow: true, threeD: current.threeD, groundElevation: ground, look: firstPersonLook.current });
        if (camera) map.jumpTo(camera);
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
      const buildingSources = new Set(composed.style.layers.filter(layer => layer.id === MAP_SOURCE_IDS.buildings || layer.id === "food-go-world-buildings")
        .map(layer => "source" in layer ? layer.source : undefined));
      let geometryChanged = false;
      map.on("sourcedata", event => { if (event.sourceDataType === "content" && buildingSources.has(event.sourceId)) geometryChanged = true; });
      map.on("idle", () => {
        setTileIssue(false);
        if (geometryChanged) { geometryChanged = false; setGeometryEpoch(n => n + 1); }
      });
      map.on("load", () => {
        if (disposed || failed) return;
        clearTimeout(timeout);
        const element = document.createElement("div");
        element.className = css.player;
        element.addEventListener("click", event => event.stopPropagation());
        element.addEventListener("pointerdown", event => event.stopPropagation());
        setPlayerElement(element); setReady(true); latest.current.onReady(); latest.current.onBearingChange?.(map.getBearing());
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
    const target = props.demoFocus;
    if (!ready || !map || !target || !valid(target)) return;
    // Public map movement only; changes neither the device GPS nor rewards.
    map.easeTo({
      center: [target.longitude, target.latitude],
      zoom: target.zoom, pitch: target.pitch,
      duration: duration(),
    });
  }, [ready, props.demoFocus?.nonce]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.setPixelRatio(props.lowDetail ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  }, [ready, props.lowDetail]);

  // Park meshes are placed only inside visible mapped green polygons.
  // They are aesthetic vegetation, not individual surveyed tree positions.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const update = () => {
      const decorate = threeD && imagery === "game" && !props.lowDetail;
      const trees = decorate ? parkTreesFromMap(map) : [];
      const signature = trees.map(tree => tree.id).join("|");
      if (signature !== parkSignature.current) {
        parkSignature.current = signature;
        setParkTrees(trees);
      }
      // Client preference: Keep generic buildings simple and flat; 3D models are reserved for food venues.
      const roofs: ReturnType<typeof rooftopsFromMap> = [];
      if (roofSignature.current !== "simplified") {
        roofSignature.current = "simplified";
        setRoofDetails(roofs);
      }
      const facades: ReturnType<typeof facadesFromMap> = [];
      if (facadeSignature.current !== "simplified") {
        facadeSignature.current = "simplified";
        setFacadeDetails(facades);
      }
      const lights=decorate ? streetLampsFromMap(map,window.innerWidth<640?34:62):[];
      const lightsKey=lights.map(l=>l.id).join("|");
      if(lightsKey!==streetLightSignature.current){
        streetLightSignature.current=lightsKey;
        setStreetLights(lights);
      }
    };
    const moved = () => {
      const centre = map.getCenter();
      const here = { longitude: centre.lng, latitude: centre.lat };
      if (!worldRegion.current || mapDistance(worldRegion.current, here) > 160) {
        worldRegion.current = here;
        setWorldEpoch(value => value + 1);
      }
      update();
    };
    update();
    map.on("idle", update);
    map.on("moveend", moved);
    return () => { map.off("idle", update); map.off("moveend", moved); };
  }, [ready, threeD, imagery, props.lowDetail]);

  // Real geographic 3D objects share MapLibre's camera and depth buffer.
  // ONLY explicitly approved food venues receive 3D models. Generic buildings are never rendered.
  // The optional ?world-demo=1 fixture is visual-only and kept exclusively in explicit demo mode.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    if (map.getLayer(GAME_WORLD_OBJECT_LAYER)) map.removeLayer(GAME_WORLD_OBJECT_LAYER);
    if (!threeD || imagery !== "game" || props.lowDetail) return;
    const centre = map.getCenter();
    const reference = { latitude: centre.lat, longitude: centre.lng };
    const isDemo = typeof window !== "undefined" && (
      new URLSearchParams(window.location.search).get("world-demo") === "1" ||
      window.location.pathname.startsWith("/demo") ||
      window.location.pathname.startsWith("/explore-preview")
    );

    const fixture: GameWorldObject[] = isDemo ? [
      { id: "the-ovenhouse-model", name: "The Ovenhouse", longitude: 144.9673, latitude: -37.8149, kind: "restaurant" as const, variant: 0 },
      { id: "riverside-bakery-model", name: "Riverside Bakery", longitude: 144.9664, latitude: -37.8156, kind: "restaurant" as const, variant: 1 },
      { id: "melbourne-treasure-crystal", longitude: 144.9676, latitude: -37.8163, kind: "treasure" as const },
      { id: "melbourne-mystery-zone", longitude: 144.9677, latitude: -37.8154, kind: "mystery" as const },
    ].filter(point => mapDistance(point, reference) < 1250) : [];

    // Food-venue pipeline: map approved food venues to reusable 3D restaurant/cafe/bakery models
    const approvedFoodVenues: GameWorldObject[] = places
      .filter(valid)
      .filter(place => mapDistance(place, reference) < 1250)
      .filter(place => {
        const k = (place.kind || "").toLowerCase();
        return k === "restaurant" || k === "cafe" || k === "bakery" || k === "market" || k === "food stall" || k === "food court";
      })
      .slice(0, 16)
      .map(place => {
        const k = (place.kind || "").toLowerCase();
        const n = (place.name || "").toLowerCase();
        let variant = 3; // Modern Bistro default
        let objectKind: GameWorldObject["kind"] = "restaurant";
        if (k === "bakery" || n.includes("bakery") || n.includes("bread") || n.includes("pastry")) {
          variant = 1;
          objectKind = "restaurant";
        } else if (k === "cafe" || n.includes("cafe") || n.includes("coffee") || n.includes("espresso")) {
          variant = 2;
          objectKind = "cafe";
        } else if (n.includes("oven") || n.includes("house") || n.includes("pizza") || n.includes("grill")) {
          variant = 0;
          objectKind = "restaurant";
        }
        return {
          id: place.id,
          longitude: place.longitude,
          latitude: place.latitude,
          kind: objectKind,
          variant,
          name: place.name,
        };
      });

    const localDemoPark = isDemo && mapDistance(reference,
      { longitude: 144.9794, latitude: -37.8134 }) < 850 ? demoParkScenery() : [];
    const nearby: GameWorldObject[] = [
      ...fixture,
      ...approvedFoodVenues,
      ...localDemoPark,
      ...parkTrees,
      ...facadeDetails,
      ...roofDetails,
      ...streetLights,
    ];
    if (valid(selected) && mapDistance(selected, reference) < 1250) nearby.unshift({
      id: "selected-waypoint", longitude: selected.longitude,
      latitude: selected.latitude, kind: "waypoint",
    });
    if (nearby.length === 0) return;
    const layer = createGameWorldObjectLayer(nearby);
    const label = map.getStyle().layers.find(item => item.type === "symbol")?.id;
    map.addLayer(layer, label);
    return () => { if (map.getLayer(GAME_WORLD_OBJECT_LAYER)) map.removeLayer(GAME_WORLD_OBJECT_LAYER); };
  }, [ready, threeD, imagery, places, selected?.longitude, selected?.latitude, props.lowDetail, parkTrees, roofDetails, facadeDetails, streetLights, worldEpoch]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const sourceId = "food-go-discovery-fog", layerId = "food-go-discovery-fog-fill";
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, { type: "geojson", data: emptyMapFeatures(), maxzoom: 18 });
      // Labels, restaurant markers, attribution and route guidance stay legible.
      const before = map.getStyle().layers.find(layer => layer.type === "symbol")?.id;
      map.addLayer({ id: layerId, type: "fill", source: sourceId,
        paint: { "fill-color": "#698f84", "fill-opacity": .46, "fill-antialias": true } }, before);
      // Diffused borders make the geographic reveal legible without faking
      // discovered cells or applying a costly screen-space blur to the world.
      map.addLayer({ id: "food-go-discovery-fog-glow", type: "line", source: sourceId,
        paint: { "line-color": "#c2e5cc", "line-width": 5, "line-blur": 2.4, "line-opacity": .45 } }, before);
      map.addLayer({ id: "food-go-discovery-fog-rim", type: "line", source: sourceId,
        paint: { "line-color": "#dfefcb", "line-width": 1.2, "line-opacity": .48 } }, before);
    }
    const refresh = () => {
      const bounds = map.getBounds();
      const result = explorationFogGeometry({ viewport: { west: bounds.getWest(), east: bounds.getEast(),
        south: Math.max(-EXPLORATION_MAX_LATITUDE, bounds.getSouth()), north: Math.min(EXPLORATION_MAX_LATITUDE, bounds.getNorth()) },
        exploredCellIds: props.discoveredCells ?? [], maxCells: props.lowDetail ? 1024 : 4096 });
      (map.getSource(sourceId) as GeoJSONSource).setData(props.discoveryEnabled ? result.data : emptyMapFeatures());
      const { data: _data, ...view } = result;
      props.onDiscoveryView?.(view);
    };
    const schedule = () => { clearTimeout(timer); timer = setTimeout(refresh, 120); };
    refresh(); map.on("moveend", schedule); map.on("resize", schedule);
    return () => { clearTimeout(timer); map.off("moveend", schedule); map.off("resize", schedule); };
  }, [ready, props.discoveryEnabled, props.discoveredCells, props.lowDetail, props.onDiscoveryView]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const globalSatellite = imagery === "satellite" && !!satelliteKey && !satelliteFailed.current;
    // Without a global imagery account, the labelled Melbourne snapshot remains
    // an overlay on the worldwide street map. The camera is never constrained.
    for (const layer of streetLayers.current) map.setLayoutProperty(layer.id, "visibility",
      imagery === "street" || imagery === "game" || !globalSatellite || layer.symbol ? layer.visibility : "none");
    for (const paint of gamePaint.current) if (map.getLayer(paint.id))
      map.setPaintProperty(paint.id, paint.property, imagery === "game" ? paint.game : paint.normal);
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
    // Client requirement: Ensure generic city buildings are strictly hidden in 3D and game mode
    for (const layer of map.getStyle()?.layers ?? []) {
      if (("source-layer" in layer && layer["source-layer"] === "building") || layer.id.includes("building")) {
        map.setLayoutProperty(layer.id, "visibility", "none");
      }
    }
    const limits = explorerCameraLimits(perspective, threeD);
    map.setMaxPitch(limits.maxPitch);
    map.setMaxZoom(limits.maxZoom);
  }, [ready, threeD, perspective]);

  useEffect(() => {
    const map = mapRef.current, Pin = pinClass.current;
    if (!ready || !map || !Pin) return;
    const pins = placeMarkers.current;
    const validPlaces = places.filter(valid);
    const centre = player && valid(player) ? { longitude: player.longitude, latitude: player.latitude } : map.getCenter() ? { longitude: map.getCenter().lng, latitude: map.getCenter().lat } : { longitude: ATLAS_CENTER[0], latitude: ATLAS_CENTER[1] };
    const sorted = [...validPlaces].sort((a, b) => mapDistance(centre, a) - mapDistance(centre, b));
    const closestId = sorted[0]?.id;

    for (const place of validPlaces) {
      const distance = player && valid(player) ? mapDistance(player, place) : undefined;
      // Clutter control: Only show full label card for selected venue, or if none selected, the single closest venue
      const isSelected = selected && place.id === selected.id;
      const showLabel = Boolean(isSelected || (!selected && place.id === closestId));
      const button = createMapPlaceMarker(place, place.distanceMetres ?? distance, place.rating, showLabel);
      button.style.position = "absolute";
      button.onclick = event => { event.stopPropagation(); latest.current.onSelect({ longitude: place.longitude, latitude: place.latitude, id: place.id }); };
      pins.set(place.id, new Pin({ element: button, anchor: "bottom", subpixelPositioning: true })
        .setLngLat([place.longitude, place.latitude]).addTo(map));
    }
    return () => { for (const marker of pins.values()) marker.remove(); pins.clear(); };
  }, [ready, places, player, selected?.id]);

  useEffect(() => {
    if (!props.zoomInTrigger || !ready || !mapRef.current) return;
    mapRef.current.zoomIn({ duration: duration() });
  }, [props.zoomInTrigger]);

  useEffect(() => {
    if (!props.zoomOutTrigger || !ready || !mapRef.current) return;
    mapRef.current.zoomOut({ duration: duration() });
  }, [props.zoomOutTrigger]);

  useEffect(() => {
    for (const place of places) {
      const button = placeMarkers.current.get(place.id)?.getElement() as HTMLButtonElement | undefined;
      if (button) updateMapPlaceEncounter(button, place, props.encounterSignals ?? {});
    }
  }, [ready, places, props.encounterSignals]);

  const longitude = selected?.longitude, latitude = selected?.latitude, selectedId = selected?.id;
  useEffect(() => {
    for (const [id, marker] of placeMarkers.current) marker.getElement().setAttribute("aria-pressed", String(id === selectedId));
  }, [ready, places, selectedId]);
  useEffect(() => {
    const map = mapRef.current, Pin = pinClass.current;
    if (!ready || !map || !Pin || !valid(selected)) return;
    if (perspective === "overhead" || !latest.current.followPlayer)
      map.easeTo({ center: [selected.longitude, selected.latitude], duration: duration(), zoom: Math.max(map.getZoom(), 15.5) });
    if (selected.id && placeMarkers.current.has(selected.id)) return;
    const dot = document.createElement("div"); dot.className = css.droppedPin; dot.setAttribute("aria-hidden", "true");
    const marker = new Pin({ element: dot, anchor: "center" }).setLngLat([selected.longitude, selected.latitude]).addTo(map);
    return () => { marker.remove(); };
  }, [ready, longitude, latitude, selectedId, perspective]);

  const playerLongitude = player?.longitude, playerLatitude = player?.latitude;
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const eye = perspective === "first" && followPlayer;
    map.getCanvas().setAttribute("aria-label", eye
      ? "Street view. Drag to look around. Pinch, scroll or plus and minus change the view angle. Arrow keys look. Home faces forward. Enter selects the centre."
      : "World map. Drag or swipe to explore, pinch or use plus and minus to zoom. Arrow keys pan. Enter selects the centre.");
    if (!eye) return;
    firstPersonLook.current = createFirstPersonLook(map.getVerticalFieldOfView());
    const input = attachFirstPersonInput(map, {
      initial: firstPersonLook.current,
      onChange(look, reason) {
        if (reason !== "sensor" && reason !== "zoom") {
          if (reason === "turn" && !ignoreDeviceHeading.current && latest.current.deviceHeading != null && Number.isFinite(latest.current.deviceHeading)) {
            const delta = ((look.yawOffset - firstPersonLook.current.yawOffset + 540) % 360) - 180;
            look = { ...look, yawOffset: latest.current.deviceHeading - displayedHeading.current + delta };
            eyeInput.current?.synchronise(look);
          }
          ignoreDeviceHeading.current = true; latest.current.onEyeLook?.();
        }
        firstPersonLook.current = look; cameraBlend.current = null; map.stop();
        const point = displayedPlayer.current ?? latest.current.player;
        if (!valid(point) || !latest.current.followPlayer) return;
        const ground = map.getTerrain() ? map.queryTerrainElevation([point.longitude, point.latitude]) ?? 0 : 0;
        if (Math.abs(map.getCenterElevation() - ground) > .01) map.setCenterElevation(ground);
        const camera = sceneCamera.current(map, { perspective: "first", point, heading: displayedHeading.current,
          follow: true, threeD: latest.current.threeD, groundElevation: ground, look });
        if (camera) map.jumpTo(camera);
      },
      onTap: point => latest.current.onSelect(point),
    });
    eyeInput.current = input;
    return () => { eyeInput.current = null; input.dispose(mapRef.current === map); };
  }, [ready, perspective, followPlayer, focusPlayerNonce]);
  useEffect(() => {
    if (props.deviceHeading == null || !Number.isFinite(props.deviceHeading) || !eyeInput.current) return;
    ignoreDeviceHeading.current = false;
    eyeInput.current.orient(props.deviceHeading - displayedHeading.current);
  }, [props.deviceHeading, props.heading, ready, perspective, focusPlayerNonce]);
  useEffect(() => {
    if (followPlayer) cameraInterrupted.current = false;
  }, [followPlayer, focusPlayerNonce, perspective]);
  useEffect(() => {
    const map = mapRef.current, Pin = pinClass.current;
    if (!ready || !map || !Pin || !playerElement) return;
    if (!valid(player)) { playerMarker.current?.remove(); playerMarker.current = null; displayedPlayer.current = null; return; }
    const target = { longitude: player.longitude, latitude: player.latitude };
    const from = displayedPlayer.current ?? target;
    const milliseconds = markerTransitionDuration(displayedPlayer.current, target, props.playerTransitionMs ?? 80,
      window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (perspective === "first") { playerMarker.current?.remove(); playerMarker.current = null; }
    else if (!playerMarker.current) playerMarker.current = new Pin({ element: playerElement, anchor: "bottom", subpixelPositioning: true })
      .setLngLat([from.longitude, from.latitude]).addTo(map);
    const refocus = !!followPlayer && (focusRevision.current !== focusPlayerNonce || cameraPerspective.current !== perspective || !wasFollowing.current);
    cameraPerspective.current = perspective; wasFollowing.current = !!followPlayer;
    if (followPlayer) focusRevision.current = focusPlayerNonce;
    const heading = Number.isFinite(props.heading) ? props.heading! : displayedPlayer.current ? displayedHeading.current : map.getBearing();
    const fromHeading = displayedPlayer.current ? displayedHeading.current : heading;
    const started = performance.now();
    if (refocus) {
      const centre = map.getCenter();
      cameraBlend.current = { from: { longitude: centre.lng, latitude: centre.lat, zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() }, started,
        duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches || mapDistance({ longitude: centre.lng, latitude: centre.lat }, target) > 10000 ? 0 : EXPLORER_CAMERA_TRANSITION_MS };
    }
    let animation = 0;
    const render = (now: number) => {
      const progress = milliseconds ? Math.min(1, (now - started) / milliseconds) : 1;
      const point = interpolateMarker(from, target, progress);
      displayedPlayer.current = point;
      playerMarker.current?.setLngLat([point.longitude, point.latitude]);
      const cameraHeading = interpolateCameraBearing(fromHeading, heading, progress);
      displayedHeading.current = cameraHeading;
      if (followPlayer && latest.current.followPlayer && !cameraInterrupted.current) {
        const ground = map.getTerrain() ? map.queryTerrainElevation([point.longitude, point.latitude]) ?? 0 : 0;
        if (perspective === "first" && Math.abs(map.getCenterElevation() - ground) > .01) map.setCenterElevation(ground);
        const camera = sceneCamera.current(map, { perspective, point, heading: cameraHeading,
          follow: true, threeD, refocus, groundElevation: ground, look: firstPersonLook.current });
        if (camera) {
          const targetPose = perspective === "overhead" && threeD
            ? { ...camera, pitch: 58, bearing: -42, zoom: camera.zoom ?? homeZoom }
            : camera;
          const blend = cameraBlend.current;
          if (blend && blend.duration && now - blend.started < blend.duration) {
            map.jumpTo(blendExplorerCamera(blend.from, explorerCameraPose(targetPose, { ...point, zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() }),
            (now - blend.started) / blend.duration));
          } else { map.jumpTo(targetPose); cameraBlend.current = null; }
        }
      }
      if (progress < 1 || (cameraBlend.current && now - cameraBlend.current.started < cameraBlend.current.duration && !cameraInterrupted.current)) animation = requestAnimationFrame(render);
    };
    render(started);
    return () => cancelAnimationFrame(animation);
  }, [ready, playerElement, playerLongitude, playerLatitude, followPlayer, focusPlayerNonce, props.playerTransitionMs, props.heading, perspective, threeD, geometryEpoch, imagery]);

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
  function pauseCameraTracking() { cameraInterrupted.current = true; latest.current.onCameraInteraction?.(); }
  return <div className={css.scene} data-game-tree-count={parkTrees.length} data-game-roof-count={roofDetails.length} data-game-facade-count={facadeDetails.length} data-game-street-light-count={streetLights.length} data-world-objects-enabled={threeD && imagery === "game" && !props.lowDetail}>
    <div ref={host} className={css.viewport} onKeyDown={event => {
      if (event.key === "Enter" && map && event.target === map.getCanvas()) {
        event.preventDefault(); const centre = map.getCenter().wrap();
        latest.current.onSelect({ longitude: centre.lng, latitude: centre.lat });
      }
    }}/>
    {perspective !== "first" && playerElement && playerContent && createPortal(playerContent, playerElement)}
    {ready && <>
      <div className={css.tools} role="group" aria-label="Geographic map controls">
        <button type="button" title="Face north" aria-label="Face north" onClick={() => { if (eyeInput.current) eyeInput.current.faceNorth(displayedHeading.current); else { pauseCameraTracking(); map?.easeTo({ bearing: 0, duration: duration() }); } }}><Compass style={{ transform: `rotate(${-bearing}deg)` }}/></button>
        <button type="button" title="Zoom in" aria-label="Zoom in on geographic map" disabled={eyeInput.current ? firstPersonLook.current.fieldOfView <= 28.01 : zoom >= explorerCameraLimits(perspective, threeD).maxZoom} onClick={() => { if (eyeInput.current) eyeInput.current.zoom(1.2); else { pauseCameraTracking(); map?.zoomIn({ duration: duration() }); } }}><Plus/></button>
        <button type="button" title="Zoom out" aria-label="Zoom out of geographic map" disabled={eyeInput.current ? firstPersonLook.current.fieldOfView >= 67.99 : zoom <= 1} onClick={() => { if (eyeInput.current) eyeInput.current.zoom(1 / 1.2); else { pauseCameraTracking(); map?.zoomOut({ duration: duration() }); } }}><Minus/></button>
      </div>
      {tileIssue && <p className={css.tileIssue} role="status"><RefreshCw size={13}/>Some map tiles could not load. Keep exploring or try again shortly.</p>}
      {clearance !== "clear" && <p className={css.clearance} role="status">{clearance === "raised" ? "Camera raised for building clearance." : "Camera moved closer for building clearance."}</p>}
      {imagery === "satellite" && satelliteKey && !satelliteFailed.current && <a className={css.provider} href="https://www.maptiler.com/" target="_blank" rel="noopener noreferrer"><img src="https://api.maptiler.com/resources/logo.svg" width="88" height="22" alt="MapTiler"/></a>}
    </>}
  </div>;
}
