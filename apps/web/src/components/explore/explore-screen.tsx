"use client";

import Link from "next/link";
import {
  useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState,
  type FormEvent, type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ChevronDown, ChevronRight, Compass, Flag, Gift, Layers, MapPin, Minus,
  Pause, Play, Plus, Search, Sparkles, Store, Target, X, ZoomIn,
} from "lucide-react";
import { atlasStops, pointDirections } from "@/lib/atlas-places";
import type { CatalogueVenue } from "@/lib/catalogue-contracts";
import type { MapSearchResult } from "@/lib/map-services";
import { searchBrowserMapPlaces } from "@/lib/browser-map-search";
import { useExplorerLocation } from "../use-explorer-location";
import { useStreetWalk } from "../use-street-walk";
import { useEncounterLandmarks } from "../use-encounter-landmarks";
import { useJourney } from "../journey-provider";
import { mapDistance } from "@/lib/map-game";
import {
  GARDENS, LANDMARK_PLACES, START_POINT, WORLD,
  clampWorld, projectToWorld, unprojectFromWorld, type WorldPoint,
} from "./world-layout";
import { WorldArt } from "./world-art";
import styles from "./explore-screen.module.css";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3.1;
const OVERVIEW_ID = "melbourne-city-royal-gardens";
/** Landmarks that stay labelled when the map is zoomed out. */
const HERO_STOPS = new Set([
  "flinders-street-station", "melbourne-central", "hosier-lane", "queen-victoria-market",
]);
const initialPosition = { longitude: 144.9671462327242, latitude: -37.81681344435442 };
const initialHeading = 340.0423857123138;
const browserMapKey = process.env.NEXT_PUBLIC_MAPTILER_KEY?.trim();

type Camera = { x: number; y: number; zoom: number };
type Viewport = { width: number; height: number };

/** Keep the illustration covering the stage and the centre inside the world. */
function clampCamera(camera: Camera, viewport: Viewport): Camera {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, camera.zoom));
  const halfWidth = viewport.width / 2 / zoom;
  const halfHeight = viewport.height / 2 / zoom;
  const x = halfWidth * 2 >= WORLD.width ? WORLD.width / 2 : Math.min(WORLD.width - halfWidth, Math.max(halfWidth, camera.x));
  const y = halfHeight * 2 >= WORLD.height ? WORLD.height / 2 : Math.min(WORLD.height - halfHeight, Math.max(halfHeight, camera.y));
  return { x, y, zoom };
}

function coverZoom(viewport: Viewport) {
  return Math.max(MIN_ZOOM, Math.max(viewport.width / WORLD.width, viewport.height / WORLD.height));
}

function formatDistance(metres: number) {
  if (!Number.isFinite(metres)) return "";
  if (metres < 950) return `${Math.round(metres / 10) * 10} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

export function ExploreScreen({
  venues = [], catalogueUnavailable = false, signedIn = false,
  explorationAvailable = false, encountersAvailable = false, accountKey,
}: {
  venues?: CatalogueVenue[];
  catalogueUnavailable?: boolean;
  signedIn?: boolean;
  explorationAvailable?: boolean;
  encountersAvailable?: boolean;
  accountKey?: string;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<Camera>({ x: START_POINT.x, y: START_POINT.y, zoom: 1 });
  const viewportRef = useRef<Viewport>({ width: 1200, height: 720 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; moved: number } | null>(null);
  const pinch = useRef<number | null>(null);
  const searchRequest = useRef<AbortController | null>(null);
  const resultsId = useId();

  const [follow, setFollow] = useState(true);
  const [cameraProfile, setCameraProfile] = useState<"overview" | "close">("overview");
  const [layersOpen, setLayersOpen] = useState(false);
  const [questsOpen, setQuestsOpen] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");
  const [worldResults, setWorldResults] = useState<MapSearchResult[]>([]);
  const [venueResults, setVenueResults] = useState<CatalogueVenue[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [discovered, setDiscovered] = useState<string[]>([]);

  const location = useExplorerLocation(initialPosition);
  const walk = useStreetWalk({
    start: location.position, enabled: location.mode === "manual",
    motionPaused: false, initialHeading,
  });
  const player = location.mode === "live" ? location.position : walk.position;
  const journey = useJourney();

  const stops = useMemo(() => atlasStops(LANDMARK_PLACES, venues), [venues]);
  const markers = useMemo(() => stops.flatMap(stop => {
    const spot = projectToWorld(stop);
    if (spot.x < -260 || spot.x > WORLD.width + 260 || spot.y < -260 || spot.y > WORLD.height + 260) return [];
    return [{ stop, spot: clampWorld(spot) }];
  }), [stops]);

  const selectedStop = markers.find(item => item.stop.id === selectedId) ?? null;
  const selected = selectedStop?.stop ?? null;
  const directions = selected ? pointDirections(selected) : null;
  const encounterLandmarks = useEncounterLandmarks({
    enabled: encountersAvailable, mode: location.mode, fix: location.fix, venues,
  });
  const chests = useMemo(() => Object.keys(encounterLandmarks.signals).flatMap(venueId => {
    const venue = venues.find(item => item.id === venueId);
    if (!venue?.coordinates) return [];
    const spot = projectToWorld(venue.coordinates);
    if (spot.x < 0 || spot.x > WORLD.width || spot.y < 0 || spot.y > WORLD.height) return [];
    return [{ id: venueId, name: venue.name, spot }];
  }).slice(0, 4), [encounterLandmarks.signals, venues]);

  const playerSpot = useMemo(() => clampWorld(projectToWorld(player)), [player.latitude, player.longitude]);
  const routePoints = useMemo(() => walk.route?.coordinates.map(([longitude, latitude]) =>
    projectToWorld({ longitude, latitude })) ?? [], [walk.route]);

  const walking = walk.phase === "walking";
  const live = location.mode === "live" && location.status === "live";
  const sessionMetres = location.mode === "live" ? location.distanceMetres : walk.sessionMetres;
  const progress = journey?.data?.progress;
  const level = progress?.level ?? 1;
  const xp = progress?.xp ?? 0;
  const xpTarget = progress?.nextLevelXp ?? Math.max(1000, level * 500);
  const xpPercent = Math.min(100, Math.round((xp / Math.max(1, xpTarget)) * 100));

  const quests = useMemo(() => [
    {
      id: "restaurants", icon: Flag, label: "Discover 3 new restaurants",
      value: Math.min(3, discovered.length), target: 3,
    },
    {
      id: "walk", icon: Target, label: "Walk 500 m this visit",
      value: Math.min(500, Math.round(sessionMetres)), target: 500,
    },
    {
      id: "chests", icon: Gift, label: encountersAvailable ? "Find a discovery chest" : "Save a place to your collections",
      value: encountersAvailable ? Math.min(1, chests.length) : Math.min(1, discovered.length), target: 1,
    },
  ], [discovered.length, sessionMetres, encountersAvailable, chests.length]);

  const applyCamera = useCallback((animate: boolean) => {
    const node = world.current;
    const frame = stage.current;
    if (!node || !frame) return;
    const camera = cameraRef.current;
    const width = frame.clientWidth, height = frame.clientHeight;
    node.style.transition = animate ? "transform 520ms cubic-bezier(.22,.61,.36,1)" : "none";
    node.style.transform = `translate3d(${width / 2 - camera.x * camera.zoom}px, ${height / 2 - camera.y * camera.zoom}px, 0) scale(${camera.zoom})`;
    node.style.setProperty("--marker-inverse", String(1 / camera.zoom));
    // Declutter: the wide view keeps only the hero landmarks labelled.
    node.dataset.band = camera.zoom >= 1.4 ? "close" : "far";
  }, []);

  const moveCamera = useCallback((next: Camera, animate: boolean) => {
    cameraRef.current = clampCamera(next, viewportRef.current);
    applyCamera(animate);
  }, [applyCamera]);

  const focusOn = useCallback((point: WorldPoint, zoom?: number, animate = true) => {
    moveCamera({ x: point.x, y: point.y, zoom: zoom ?? cameraRef.current.zoom }, animate);
  }, [moveCamera]);

  const overview = useCallback(() => {
    const frame = stage.current;
    if (!frame) return;
    const fit = Math.min(frame.clientWidth / WORLD.width, frame.clientHeight / WORLD.height);
    setCameraProfile("overview");
    moveCamera({ x: WORLD.width / 2, y: WORLD.height / 2, zoom: Math.max(MIN_ZOOM, fit * 0.99) }, true);
  }, [moveCamera]);

  // Establish the first view once the stage has a size.
  useLayoutEffect(() => {
    const frame = stage.current;
    if (!frame) return;
    const measure = () => {
      const next = { width: frame.clientWidth, height: frame.clientHeight };
      const fresh = viewportRef.current.width === 0;
      viewportRef.current = next;
      if (next.width < 2 || next.height < 2) return;
      if (fresh) {
        const narrow = next.width < 760;
        const zoom = narrow ? Math.max(coverZoom(next) * 1.45, 1.05) : coverZoom(next);
        cameraRef.current = clampCamera({ x: START_POINT.x, y: START_POINT.y, zoom }, next);
      } else {
        cameraRef.current = clampCamera(cameraRef.current, next);
      }
      applyCamera(false);
    };
    viewportRef.current = { width: 0, height: 0 };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [applyCamera]);

  // Keep the explorer in view while following, and always reveal a new route.
  useEffect(() => {
    if (!follow) return;
    moveCamera({ ...cameraRef.current, x: playerSpot.x, y: playerSpot.y }, true);
  }, [follow, moveCamera, playerSpot.x, playerSpot.y]);

  const zoomAt = useCallback((factor: number, anchorX?: number, anchorY?: number) => {
    const frame = stage.current;
    if (!frame) return;
    const camera = cameraRef.current;
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, camera.zoom * factor));
    const width = frame.clientWidth, height = frame.clientHeight;
    const ax = anchorX ?? width / 2, ay = anchorY ?? height / 2;
    const worldX = camera.x + (ax - width / 2) / camera.zoom;
    const worldY = camera.y + (ay - height / 2) / camera.zoom;
    setCameraProfile("overview");
    moveCamera({ x: worldX - (ax - width / 2) / zoom, y: worldY - (ay - height / 2) / zoom, zoom }, true);
  }, [moveCamera]);

  const screenToWorld = useCallback((clientX: number, clientY: number): WorldPoint | null => {
    const frame = stage.current;
    if (!frame) return null;
    const rect = frame.getBoundingClientRect();
    const camera = cameraRef.current;
    return {
      x: camera.x + (clientX - rect.left - rect.width / 2) / camera.zoom,
      y: camera.y + (clientY - rect.top - rect.height / 2) / camera.zoom,
    };
  }, []);

  const walkToSpot = useCallback((spot: WorldPoint) => {
    const target = unprojectFromWorld(spot);
    setFollow(true);
    setCameraProfile("overview");
    if (location.mode === "live" && location.status === "live") void walk.planTo(target);
    else if (location.mode === "live") walk.cancel();
    else void walk.walkTo(target);
  }, [location.mode, location.status, walk]);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const marker = (event.target as HTMLElement).closest("[data-map-control]");
    if (marker) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 1) {
      drag.current = { x: event.clientX, y: event.clientY, moved: 0 };
      event.currentTarget.setPointerCapture(event.pointerId);
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = Math.hypot(a.x - b.x, a.y - b.y);
      drag.current = null;
    }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const tracked = pointers.current.get(event.pointerId);
    if (!tracked) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2 && pinch.current != null) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current > 0 && distance > 0) {
        const rect = event.currentTarget.getBoundingClientRect();
        zoomAt(distance / pinch.current, (a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top);
      }
      pinch.current = distance;
      return;
    }
    const current = drag.current;
    if (!current) return;
    const dx = event.clientX - tracked.x, dy = event.clientY - tracked.y;
    current.moved += Math.abs(dx) + Math.abs(dy);
    if (current.moved > 4) setFollow(false);
    moveCamera({
      x: cameraRef.current.x - dx / cameraRef.current.zoom,
      y: cameraRef.current.y - dy / cameraRef.current.zoom,
      zoom: cameraRef.current.zoom,
    }, false);
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const current = drag.current;
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (current && current.moved <= 4 && !(event.target as HTMLElement).closest("[data-map-control]")) {
      const spot = screenToWorld(event.clientX, event.clientY);
      if (spot && spot.x > 0 && spot.x < WORLD.width && spot.y > 0 && spot.y < WORLD.height) walkToSpot(spot);
    }
    drag.current = null;
  }

  useEffect(() => {
    const frame = stage.current;
    if (!frame) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = frame.getBoundingClientRect();
      zoomAt(event.deltaY < 0 ? 1.12 : 1 / 1.12, event.clientX - rect.left, event.clientY - rect.top);
    };
    frame.addEventListener("wheel", wheel, { passive: false });
    return () => frame.removeEventListener("wheel", wheel);
  }, [zoomAt]);

  useEffect(() => {
    const frame = stage.current;
    if (!frame) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      const step = 90 / cameraRef.current.zoom;
      if (event.key === "ArrowLeft") moveCamera({ ...cameraRef.current, x: cameraRef.current.x - step }, true);
      else if (event.key === "ArrowRight") moveCamera({ ...cameraRef.current, x: cameraRef.current.x + step }, true);
      else if (event.key === "ArrowUp") moveCamera({ ...cameraRef.current, y: cameraRef.current.y - step }, true);
      else if (event.key === "ArrowDown") moveCamera({ ...cameraRef.current, y: cameraRef.current.y + step }, true);
      else if (event.key === "+" || event.key === "=") zoomAt(1.2);
      else if (event.key === "-") zoomAt(1 / 1.2);
      else if (event.key === "Home") overview();
      else return;
      event.preventDefault();
      setFollow(false);
    };
    frame.addEventListener("keydown", keydown);
    return () => frame.removeEventListener("keydown", keydown);
  }, [moveCamera, overview, zoomAt]);

  useEffect(() => () => searchRequest.current?.abort(), []);

  function chooseStop(stop: (typeof markers)[number], name?: string) {
    setSelectedId(stop.stop.id);
    setDiscovered(items => items.includes(stop.stop.id) ? items : [...items, stop.stop.id]);
    setSearchOpen(false);
    if (name) setQuery(name);
    focusOn(stop.spot, Math.max(cameraRef.current.zoom, 1.25));
    setFollow(false);
  }

  function editQuery(value: string) {
    searchRequest.current?.abort();
    setSearching(false);
    setQuery(value);
    setWorldResults([]);
    setVenueResults([]);
    setSearchMessage("");
  }

  async function submitSearch(event: FormEvent) {
    event.preventDefault();
    const text = query.trim();
    if (text.length < 2) {
      setSearchOpen(true);
      setSearchMessage("Type at least two letters, or a place name.");
      return;
    }
    searchRequest.current?.abort();
    const request = new AbortController();
    searchRequest.current = request;
    setSearching(true);
    setSearchOpen(true);
    setSearchMessage("");
    setWorldResults([]);
    setVenueResults([]);
    const local = markers.filter(item => item.stop.name.toLocaleLowerCase("en-AU").includes(text.toLocaleLowerCase("en-AU")));
    if (local.length) {
      setSearching(false);
      chooseStop(local[0], local[0].stop.name);
      return;
    }
    const [places, restaurants] = await Promise.allSettled([
      browserMapKey
        ? searchBrowserMapPlaces(text, browserMapKey, request.signal)
        : fetch("/api/map/search?" + new URLSearchParams({ q: text }), { signal: request.signal, cache: "no-store" })
          .then(async response => {
            const body = await response.json();
            if (!response.ok) throw new Error(response.status === 429 ? "Search is busy. Wait a moment and try again." : "World search is unavailable. You can search a restaurant instead.");
            if (!Array.isArray(body.results)) throw new Error("Place search is unavailable.");
            return {
              results: body.results.filter((result: MapSearchResult) => typeof result.latitude === "number"
                && typeof result.longitude === "number").slice(0, 6) as MapSearchResult[],
              attribution: typeof body.attribution === "string" ? body.attribution.slice(0, 300) : "",
            };
          }),
      fetch("/api/venues?" + new URLSearchParams({ q: text.slice(0, 100), limit: "8" }), { signal: request.signal, cache: "no-store" })
        .then(async response => {
          const body = await response.json();
          return response.ok && body.mode === "supabase" && Array.isArray(body.data) ? body.data as CatalogueVenue[] : [];
        }),
    ]);
    if (request.signal.aborted) return;
    if (places.status === "fulfilled") {
      setWorldResults(places.value.results);
      setSearchMessage(places.value.results.length ? "" : "No matching places. Try a nearby suburb or restaurant.");
    } else setSearchMessage(places.reason instanceof Error ? places.reason.message : "Place search is unavailable.");
    if (restaurants.status === "fulfilled") setVenueResults(restaurants.value);
    setSearching(false);
  }

  const artwork = useMemo(() => <WorldArt className={styles.art} />, []);
  const localMatches = markers.filter(item => item.stop.name.toLocaleLowerCase("en-AU").includes(query.trim().toLocaleLowerCase("en-AU"))).slice(0, 4);

  return (
    <section className={styles.explore} aria-label="Explore map">
      <div
        ref={stage}
        className={styles.stage}
        tabIndex={0}
        role="group"
        aria-label="Illustrated Melbourne map. Drag to pan, scroll to zoom, or press an arrow key."
        data-profile={cameraProfile}
        data-explore-stage="1"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div ref={world} className={styles.world} data-explore-world="1" style={{ width: WORLD.width, height: WORLD.height }}>
          {artwork}

          <svg className={styles.routes} viewBox={`0 0 ${WORLD.width} ${WORLD.height}`} aria-hidden="true">
            {routePoints.length > 1 && <>
              <polyline className={styles.routeCasing} points={routePoints.map(point => `${point.x},${point.y}`).join(" ")} />
              <polyline className={styles.routeLine} points={routePoints.map(point => `${point.x},${point.y}`).join(" ")} />
            </>}
          </svg>

          {chests.filter(chest => chest.id !== selectedId).map(chest => (
            <div key={`chest-${chest.id}`} className={styles.pinAnchor} style={{ left: chest.spot.x, top: chest.spot.y }}>
              <button type="button" data-map-control className={styles.chest}
                aria-label={`Discovery chest near ${chest.name}`}
                onClick={() => {
                  const marker = markers.find(item => item.stop.id === chest.id);
                  if (marker) chooseStop(marker);
                }}>
                <span className={styles.chestGlow} aria-hidden="true" />
                <Gift size={19} aria-hidden="true" />
              </button>
            </div>
          ))}

          {markers.map(({ stop, spot }) => (
            <div key={stop.id} className={styles.pinAnchor} style={{ left: spot.x, top: spot.y }}>
              <button
                type="button"
                data-map-control
                className={styles.pin}
                data-selected={selectedId === stop.id}
                data-kind={stop.href ? "venue" : "landmark"}
                data-tier={stop.href || HERO_STOPS.has(stop.id) ? "hero" : "minor"}
                aria-pressed={selectedId === stop.id}
                aria-label={`${stop.name}, ${stop.area}`}
                onClick={() => chooseStop({ stop, spot })}
              >
                <span className={styles.pinScale}>
                  <span className={styles.pinHead}>
                    <span className={styles.pinPhoto}>
                      {stop.image
                        ? <img src={stop.image} alt="" draggable={false} />
                        : <span className={styles.pinGlyph} aria-hidden="true">{stop.href ? <Store size={20} /> : <Compass size={22} />}</span>}
                    </span>
                    <span className={styles.pinBadge} aria-hidden="true"><MapPin size={12} /></span>
                    <span className={styles.pinTip} aria-hidden="true" />
                  </span>
                  <span className={styles.pinLabel}>{stop.name}</span>
                </span>
              </button>
            </div>
          ))}

          <div className={styles.playerAnchor} style={{ left: playerSpot.x, top: playerSpot.y }}>
            <div className={styles.playerScale}>
              <span className={styles.radar} aria-hidden="true" />
              <img
                className={styles.playerSprite}
                src={walking ? "/avatars/pathfinder-walk-cutout.webp" : "/avatars/pathfinder-idle-cutout.webp"}
                alt=""
                draggable={false}
                data-walking={walking}
              />
              <span className={styles.playerTag}>You are here</span>
            </div>
          </div>

          {(["royal-gardens", "carlton-gardens", "yarra-park"] as const).map(id => {
            const garden = GARDENS.find(item => item.id === id);
            if (!garden) return null;
            return (
              <span key={id} className={styles.gardenLabel} style={{
                left: garden.x + garden.width / 2, top: garden.y + garden.height / 2,
              }}>{garden.name}</span>
            );
          })}
        </div>

        {/* Search */}
        <form
          className={styles.search}
          role="search"
          onSubmit={submitSearch}
          data-map-control
          onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setSearchOpen(false); }}
          onKeyDown={event => { if (event.key === "Escape" && searchOpen) { event.preventDefault(); setSearchOpen(false); } }}
        >
          <div className={styles.searchField}>
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              aria-label="Search restaurants, places or suburbs"
              placeholder="Search restaurants, places or suburbs"
              maxLength={120}
              autoComplete="off"
              value={query}
              onFocus={() => setSearchOpen(true)}
              onChange={event => editQuery(event.target.value)}
            />
            {query && <button type="button" aria-label="Clear search" onClick={() => editQuery("")}><X size={16} /></button>}
            <button type="submit" className={styles.searchGo} aria-label="Search" aria-controls={resultsId} aria-expanded={searchOpen} aria-busy={searching}>
              <Search size={18} aria-hidden="true" />
            </button>
          </div>
          {searchOpen && (
            <div id={resultsId} className={styles.results}>
              {localMatches.map(({ stop, spot }) => (
                <button key={`local-${stop.id}`} type="button" onClick={() => chooseStop({ stop, spot })}>
                  <MapPin size={17} aria-hidden="true" />
                  <span><strong>{stop.name}</strong><small>Food Go · {stop.area}</small></span>
                </button>
              ))}
              {venueResults.map(venue => (
                <button key={`venue-${venue.id}`} type="button" onClick={() => {
                  const marker = markers.find(item => item.stop.id === venue.id);
                  if (marker) chooseStop(marker);
                  else if (venue.coordinates) focusOn(projectToWorld(venue.coordinates), 1.4);
                }}>
                  <Store size={17} aria-hidden="true" />
                  <span><strong>{venue.name}</strong><small>{venue.cuisine} · {venue.suburb}</small></span>
                </button>
              ))}
              {worldResults.map(result => (
                <button key={`world-${result.id}`} type="button" onClick={() => {
                  const spot = projectToWorld(result);
                  setSearchOpen(false);
                  setQuery(result.name);
                  setSelectedId(null);
                  focusOn(clampWorld(spot), Math.max(cameraRef.current.zoom, 1.1));
                  setFollow(false);
                }}>
                  <Compass size={17} aria-hidden="true" />
                  <span><strong>{result.name}</strong><small>Place on the map</small></span>
                </button>
              ))}
              <span role="status" className={styles.resultNote}>
                {searching ? "Searching places…" : searchMessage || (query.length < 2 ? "Type two letters or more." : "")}
              </span>
            </div>
          )}
        </form>

        {/* Player card */}
        <div className={styles.playerCard}>
          <Link href={signedIn ? "/profile" : "/auth/sign-in"} className={styles.portrait} aria-label={signedIn ? "Open your Passport" : "Sign in"}>
            <img src="/avatars/pathfinder-portrait.webp" alt="" draggable={false} />
            <span className={styles.levelBadge}>Lv. {level}</span>
          </Link>
          <div className={styles.playerMeta}>
            <strong>{signedIn ? "Urban Pathfinder" : "Explorer"}</strong>
            <span className={styles.xpTrack} aria-hidden="true"><span style={{ width: `${xpPercent}%` }} /></span>
            <small>{xp.toLocaleString("en-AU")} / {Math.max(xpTarget, xp).toLocaleString("en-AU")} XP</small>
          </div>
        </div>

        {/* Quests */}
        <Link className={styles.questHero} href="/quests">
          <span className={styles.questHeroIcon} aria-hidden="true"><Compass size={20} /></span>
          <span className={styles.questHeroBody}>
            <strong>Urban Pathfinder</strong>
            <span>{quests[0].label}</span>
            <span className={styles.questHeroTrack} aria-hidden="true">
              <span style={{ width: `${Math.min(100, Math.round((quests[0].value / quests[0].target) * 100))}%` }} />
            </span>
          </span>
          <span className={styles.questHeroValue}>{quests[0].value}/{quests[0].target}</span>
          <ChevronRight size={16} aria-hidden="true" />
        </Link>

        <div className={styles.quests} data-open={questsOpen}>
          <button type="button" className={styles.questHead} data-map-control aria-expanded={questsOpen} onClick={() => setQuestsOpen(value => !value)}>
            <Flag size={16} aria-hidden="true" />
            <span>Active quests ({quests.length})</span>
            <ChevronDown size={15} aria-hidden="true" />
          </button>
          {questsOpen && (
            <ul className={styles.questList}>
              {quests.map(quest => {
                const Icon = quest.icon;
                const done = quest.value >= quest.target;
                return (
                  <li key={quest.id} data-done={done}>
                    <span className={styles.questIcon} aria-hidden="true"><Icon size={14} /></span>
                    <span className={styles.questBody}>
                      <span className={styles.questLabel}>{quest.label}</span>
                      <span className={styles.questTrack} aria-hidden="true">
                        <span style={{ width: `${Math.min(100, Math.round((quest.value / quest.target) * 100))}%` }} />
                      </span>
                    </span>
                    <span className={styles.questValue}>{quest.value}/{quest.target}</span>
                  </li>
                );
              })}
            </ul>
          )}
          <Link className={styles.questLink} href="/quests">All quests <ChevronRight size={14} aria-hidden="true" /></Link>
        </div>

        {/* Map rail */}
        <div className={styles.rail}>
          <div className={styles.railGroup}>
            <button type="button" data-map-control className={styles.railButton} aria-label="Map layers" aria-expanded={layersOpen} onClick={() => setLayersOpen(value => !value)}>
              <Layers size={19} aria-hidden="true" />
            </button>
            <button type="button" data-map-control className={styles.railButton} aria-label="Recentre on your explorer"
              onClick={() => { setFollow(true); setCameraProfile("overview"); focusOn(playerSpot, Math.max(cameraRef.current.zoom, 1.2)); }}>
              <Target size={19} aria-hidden="true" />
            </button>
            <button type="button" data-map-control className={styles.railButton} aria-label="Zoom in" onClick={() => zoomAt(1.25)}><Plus size={19} aria-hidden="true" /></button>
            <button type="button" data-map-control className={styles.railButton} aria-label="Zoom out" onClick={() => zoomAt(1 / 1.25)}><Minus size={19} aria-hidden="true" /></button>
          </div>
          <div className={styles.railGroup}>
            <button type="button" data-map-control className={styles.railButton} aria-label="About this map" aria-expanded={helpOpen} onClick={() => setHelpOpen(value => !value)}>?</button>
            <button type="button" data-map-control className={styles.railButton} aria-label="Show the whole city" onClick={overview}><Compass size={19} aria-hidden="true" /></button>
          </div>
        </div>

        {layersOpen && (
          <div className={styles.layerPanel} data-map-control>
            <strong>Map layers</strong>
            <ul>
              <li data-on="true"><span>Illustrated city</span><small>Stylised, not a survey map</small></li>
              <li data-on={encountersAvailable ? "true" : "false"}><span>Discovery chests</span><small>{encountersAvailable ? `${chests.length} nearby` : "Off for this account"}</small></li>
              <li data-on={explorationAvailable ? "true" : "false"}><span>Saved exploration</span><small>{explorationAvailable ? "Optional, from live location" : "Off for this account"}</small></li>
              <li data-on="true"><span>Quests and progress</span><small>Session and account data</small></li>
            </ul>
            <Link href="/?map=geographic">Open the surveyed map <ChevronRight size={14} aria-hidden="true" /></Link>
            <button type="button" onClick={() => setLayersOpen(false)}>Close</button>
          </div>
        )}

        {helpOpen && (
          <div className={styles.helpPanel} data-map-control>
            <strong>About this map</strong>
            <p>
              The city is a stylised illustration of inner Melbourne. Blocks, gardens and the Yarra follow
              real street coordinates, but shapes and colours are decorative. Restaurant pins come from the
              Food Go catalogue and are placed from their recorded coordinates.
            </p>
            <p>
              Walking routes use OpenRouteService pedestrian paths. Live location is optional and stays in
              this browser unless you turn on saved exploration. Walking never confirms a visit or awards XP.
            </p>
            <button type="button" onClick={() => setHelpOpen(false)}>Close</button>
          </div>
        )}

        {/* Location and view controls */}
        <div className={styles.footerBar}>
          <button type="button" data-map-control className={styles.locationPill} onClick={overview}>
            <MapPin size={16} aria-hidden="true" />
            <span>{OVERVIEW_ID === "melbourne-city-royal-gardens" ? "Melbourne City & Royal Gardens" : "Melbourne"}</span>
            <ChevronDown size={15} aria-hidden="true" />
          </button>
          <div className={styles.viewToggle} role="group" aria-label="Map view">
            <button type="button" data-map-control aria-pressed={cameraProfile === "overview"} onClick={overview}>
              <Compass size={16} aria-hidden="true" /> Overview
            </button>
            <button type="button" data-map-control aria-pressed={cameraProfile === "close"} onClick={() => {
              setCameraProfile("close");
              setFollow(true);
              focusOn(playerSpot, Math.min(MAX_ZOOM, 2.1));
            }}>
              <ZoomIn size={16} aria-hidden="true" /> Camera
            </button>
          </div>
        </div>

        {/* Walk controls */}
        {walk.route && (
          <div className={styles.walkBar} data-map-control>
            {walking && <button type="button" onClick={walk.pause}><Pause size={14} aria-hidden="true" /> Pause</button>}
            {(walk.phase === "paused" || walk.phase === "unavailable") && location.mode === "manual" && (
              <button type="button" onClick={() => walk.resume()}><Play size={14} aria-hidden="true" /> Resume</button>
            )}
            <button type="button" onClick={walk.cancel}><X size={14} aria-hidden="true" /> End route</button>
            <span>{location.mode === "live" ? "Route guide follows your live position" : `${Math.round(walk.travelled)} / ${Math.round(walk.totalDistance)} m`}</span>
          </div>
        )}

        <div className={styles.statusLine} role="status">
          {live ? "Live location" : location.status === "manual" ? "Manual exploration" : location.status === "requesting" ? "Finding your location" : "Location unavailable"}
          <span aria-hidden="true"> · </span>
          {walk.message || "Tap a street to walk there."}
        </div>

        {walk.phase === "unavailable" && walk.message && (
          <p className={styles.toast} role="alert">{walk.message}</p>
        )}

        {selected && (
          <div className={styles.discovery} data-map-control>
            <button type="button" className={styles.discoveryClose} aria-label="Close place details" onClick={() => setSelectedId(null)}><X size={16} /></button>
            <span className={styles.discoveryEyebrow}><Sparkles size={13} aria-hidden="true" /> {selected.href ? "New discovery" : "City landmark"}</span>
            <div className={styles.discoveryRow}>
              <span className={styles.discoveryArt}>
                {markers.find(item => item.stop.id === selected.id)?.stop.image
                  ? <img src={markers.find(item => item.stop.id === selected.id)?.stop.image} alt="" draggable={false} />
                  : selected.href
                    ? <img src={encountersAvailable ? "/avatars/pathfinder-discover.webp" : "/avatars/pathfinder-idle.webp"} alt="" draggable={false} />
                    : <Compass size={30} aria-hidden="true" />}
              </span>
              <div className={styles.discoveryBody}>
                <strong>{selected.name}</strong>
                <small>
                  {selected.kind && selected.kind !== "building" ? `${selected.kind} · ` : ""}
                  {selected.area || "Melbourne"}
                  {` · ${formatDistance(mapDistance(player, selected))}`}
                </small>
                {selected.href && <span className={styles.discoveryTags}>{selected.members.length > 1 ? `${selected.members.length} shops in this building` : "Open now"}</span>}
              </div>
            </div>
            <div className={styles.discoveryActions}>
              {selected.href
                ? <Link className={styles.discoveryPrimary} href={selected.href}>
                  <Gift size={16} aria-hidden="true" />
                  {encountersAvailable ? "Open discovery chest" : "View this place"}
                </Link>
                : <button type="button" className={styles.discoveryPrimary} onClick={() => {
                  const marker = markers.find(item => item.stop.id === selected.id);
                  if (!marker) return;
                  setSelectedId(null);
                  walkToSpot(marker.spot);
                }}>
                  <Compass size={16} aria-hidden="true" /> Walk here
                </button>}
              <button type="button" className={styles.discoverySecondary}
                onClick={() => { setFollow(true); focusOn(markers.find(item => item.stop.id === selected.id)?.spot ?? playerSpot, 1.8); }}>
                <Target size={16} aria-hidden="true" /> Locate
              </button>
              {directions && (
                <a className={styles.discoveryLink} href={directions.google} target="_blank" rel="noopener noreferrer">
                  Directions
                </a>
              )}
            </div>
          </div>
        )}

        {catalogueUnavailable && <p className={styles.notice}>Restaurant listings are temporarily unavailable. The map still works.</p>}
        {walk.attribution && <p className={styles.attribution}>{walk.attribution}</p>}
      </div>
    </section>
  );
}
