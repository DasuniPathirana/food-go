"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, Box, ChevronUp, Compass, Eye, Hand, Layers, MapPin, Pause, PersonStanding, Play, Search, Settings2, Sparkles, X, ZoomIn } from "lucide-react";
import { atlasStops, geographicPoint, pointDirections, type AtlasDestination } from "@/lib/atlas-places";
import { ATLAS_ATTRIBUTION } from "@/lib/melbourne-atlas";
import type { CatalogueVenue } from "@/lib/catalogue-contracts";
import type { MapSearchResult } from "@/lib/map-services";
import { searchBrowserMapPlaces } from "@/lib/browser-map-search";
import { useAvatarPreferences } from "@/lib/avatar-preferences";
import type { AtlasCanvasProps, AtlasImagery, AtlasSelection } from "./atlas-canvas";
import { FoodGoHud } from "./explore/foodgo-hud";
import { MapExpandButton, MapFrame } from "./map-frame";
import { MapPlayer } from "./map-player";
import { DemoTreasureEncounter } from "./demo-treasure-encounter";
import { DemoWorldTour, type DemoStop } from "./demo-world-tour";
import { ExplorerControl } from "./explorer-control";
import { AvatarCustomizer, type AvatarAction } from "./avatar-customizer";
import { useExplorerLocation } from "./use-explorer-location";
import { useDeviceCompass } from "./use-device-compass";
import { useGeographicDiscovery } from "./use-geographic-discovery";
import { useEncounterLandmarks } from "./use-encounter-landmarks";
import type { ExplorationFogResult } from "@food-go/domain/exploration";
import { isInsideMelbournePilot } from "@food-go/domain";
import { useStreetWalk } from "./use-street-walk";
import { useJourney } from "./journey-provider";
import { useAdventure } from "./adventure/use-adventure";
import { mapDistance } from "@/lib/map-game";
import { isExplorerPerspective, type ExplorerPerspective } from "@/lib/explorer-camera";
import styles from "./geographic-explore.module.css";

const Canvas = dynamic(() => import("./atlas-canvas").then(module => module.AtlasCanvas), { ssr: false });
const FlatCanvas = dynamic(() => import("./world-map-fallback").then(module => module.WorldMapFallback), { ssr: false });
const EncounterPanel = dynamic(() => import("./encounter-panel").then(module => module.EncounterPanel));
const noVenues: CatalogueVenue[] = [];
// Walkable Collins Street geometry near Town Hall, never a claimed GPS fix.
const initialPosition = { longitude: 144.9670, latitude: -37.8153 };
const initialHeading = 340.0423857123138;

const HERO_LANDMARKS: readonly AtlasDestination[] = [
  {
    id: "the-ovenhouse",
    name: "The Ovenhouse",
    area: "Swanston St · CBD",
    latitude: -37.8149,
    longitude: 144.9673,
    kind: "restaurant",
  },
  {
    id: "riverside-bakery",
    name: "Riverside Bakery",
    area: "Collins St · CBD",
    latitude: -37.8156,
    longitude: 144.9664,
    kind: "cafe",
  },
];

// Search credentials remain independent of the removed satellite style choice.
const browserMapKey = process.env.NEXT_PUBLIC_MAPTILER_KEY?.trim();
export function GeographicExplore({ venues = noVenues, catalogueUnavailable = false, signedIn = false, explorationAvailable = false, encountersAvailable = false, accountKey }: {
  basePath: string; venues?: CatalogueVenue[]; catalogueUnavailable?: boolean;
  signedIn?: boolean; explorationAvailable?: boolean; encountersAvailable?: boolean; accountKey?: string;
}) {
  const frame = useRef<HTMLDivElement>(null), controls = useRef<HTMLDivElement>(null), field = useRef<HTMLInputElement>(null);
  const avatarPanel = useRef<HTMLDivElement>(null);
  const avatarScroll = useRef(0);
  const cameraMenu = useRef<HTMLDetailsElement>(null);
  const worldSheet = useRef<HTMLDetailsElement>(null);
  const searchRequest = useRef<AbortController | null>(null);
  const resultsId = useId();
  const [query, setQuery] = useState(""), [searchOpen, setSearchOpen] = useState(false);
  const [worldResults, setWorldResults] = useState<MapSearchResult[]>([]);
  const [searchAttribution, setSearchAttribution] = useState("");
  const [venueResults, setVenueResults] = useState<CatalogueVenue[]>([]);
  const [chosenVenues, setChosenVenues] = useState<CatalogueVenue[]>([]);
  const [searchMessage, setSearchMessage] = useState(""), [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<AtlasSelection | null>(null);
  const [selectedName, setSelectedName] = useState("");
  const [chosenShop, setChosenShop] = useState<{ selectionId: string; venueId: string } | null>(null);
  // One player-facing Food Go world. Keep renderer fallback for devices without WebGL.
  const imagery: AtlasImagery = "game";
  const [lowDetail, setLowDetail] = useState(false);
  const [mapBearing, setMapBearing] = useState(-42);
  const [threeD, setThreeD] = useState(true), [loaded, setLoaded] = useState(false);
  const [perspective, setPerspective] = useState<ExplorerPerspective>("overhead");
  const [renderer, setRenderer] = useState<"webgl" | "fallback">("webgl");
  const [graphicsAttempt, setGraphicsAttempt] = useState(0);
  const [demoTreasureToken, setDemoTreasureToken] = useState(0);
  const [demoFocus, setDemoFocus] = useState<(AtlasSelection & { zoom: number; pitch: number; nonce: number }) | null>(null);
  const [follow, setFollow] = useState(true), [focus, setFocus] = useState(0);
  const [zoomInNonce, setZoomInNonce] = useState(0);
  const [zoomOutNonce, setZoomOutNonce] = useState(0);
  const [pilotOverviewNonce, setPilotOverviewNonce] = useState(0);
  const [demoMode, setDemoMode] = useState(false);
  useEffect(() => { setDemoMode(process.env.NODE_ENV === "development" && (new URLSearchParams(window.location.search).get("world-demo") === "1" || /^\/(demo|explore-preview)(\/|$)/.test(window.location.pathname))); }, []);
  const [avatarOpen, setAvatarOpen] = useState(false), [action, setAction] = useState<AvatarAction>("idle");
  const [actionToken, setActionToken] = useState(0), [paused, setPaused] = useState(false);
  const compass = useDeviceCompass(perspective === "first" && renderer === "webgl");
  const preferences = useAvatarPreferences();
  const journey = useJourney();
  const adventure = useAdventure(signedIn);
  const realLevel = signedIn && journey?.data ? journey.data.progress.level : undefined;
  const realXp = signedIn && journey?.data ? journey.data.progress.xp : undefined;
  const realCoins = signedIn && adventure?.data?.village?.resources ? adventure.data.village.resources.coins : undefined;
  const realActiveQuest = adventure?.data?.quests?.find(q => q.participation && !q.participation.completedAt);
  const activeQuestProp = realActiveQuest ? {
    title: "Active Quest",
    description: realActiveQuest.title,
    current: realActiveQuest.participation?.awardedXp ? 1 : 0,
    total: 1,
  } : null;
  const location = useExplorerLocation(initialPosition);
  const walk = useStreetWalk({ start: location.position, enabled: location.mode === "manual", motionPaused: paused, initialHeading });
  const player = walk.position;
  const discovery = useGeographicDiscovery({ signedIn, available: explorationAvailable, accountKey,
    mode: location.mode, fix: location.fix, liveReady: location.status === "live",
    previewPoint: location.mode === "manual" ? player : null });
  const [discoveryView, setDiscoveryView] = useState<Omit<ExplorationFogResult, "data"> | null>(null);
  const allVenues = useMemo(() => [...new Map([...venues, ...chosenVenues, ...venueResults].map(v => [v.id, v])).values()], [venues, chosenVenues, venueResults]);
  const encounterLandmarks = useEncounterLandmarks({ enabled: encountersAvailable, mode: location.mode, fix: location.fix, venues: allVenues });
  const stops = useMemo(() => atlasStops(demoMode ? HERO_LANDMARKS : [], allVenues).filter(isInsideMelbournePilot), [allVenues, demoMode]);
  const active = stops.find(stop => stop.id === selected?.id);
  const encounterVenueId = active?.members.length === 1 ? active.members[0].id
    : active && chosenShop?.selectionId === active.id && active.members.some(member => member.id === chosenShop.venueId) ? chosenShop.venueId : null;
  // Contextual restaurant actions should surface when an actual venue is selected.
  useEffect(() => { if (encounterVenueId && worldSheet.current) worldSheet.current.open = true; }, [encounterVenueId]);
  const localMatches = stops.filter(stop => stop.name.toLocaleLowerCase("en-AU").includes(query.trim().toLocaleLowerCase("en-AU")));
  const directions = selected && pointDirections(selected);
  const walking = walk.phase === "walking";
  const avatarWalking = location.mode === "live" ? location.walking : walking;
  const avatarHeading = location.mode === "live" ? location.heading ?? undefined : walk.heading;
  const ready = useCallback(() => setLoaded(true), []);
  const unavailable = useCallback(() => { setRenderer("fallback"); setLoaded(false); }, []);
  const retryGraphics = useCallback(() => {
    setLoaded(false); setThreeD(true); setGraphicsAttempt(n => n + 1); setRenderer("webgl");
  }, []);
  const cameraMoved = useCallback(() => setFollow(false), []);
  const recenter = useCallback(() => { setFollow(true); setFocus(n => n + 1); }, []);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("food-go-explorer-view-v2");
      if (isExplorerPerspective(saved)) setPerspective(saved);
      else if (localStorage.getItem("food-go-explorer-view-v1") === "first") setPerspective("first");
    } catch { /* Optional browser preference. */ }
  }, []);
  useLayoutEffect(() => {
    if (!avatarOpen || !avatarPanel.current) return;
    avatarPanel.current.scrollIntoView({ block: "nearest", behavior: "instant" });
    avatarPanel.current.querySelector<HTMLButtonElement>("button[aria-label='Close avatar options']")?.focus({ preventScroll: true });
  }, [avatarOpen]);
  function customise() { if (!avatarOpen) avatarScroll.current = window.scrollY; setAvatarOpen(true); }
  function closeAvatar() {
    setAvatarOpen(false); window.scrollTo({ top: avatarScroll.current, behavior: "instant" });
    frame.current?.querySelector<HTMLButtonElement>("[data-explorer-control]")?.focus({ preventScroll: true });
  }
  function locate() {
    if (location.mode !== "live") { walk.cancel(); location.enable(); }
    recenter();
  }
  function changePerspective(next: ExplorerPerspective) {
    setPerspective(next); recenter();
    if (cameraMenu.current) cameraMenu.current.open = false;
    try { localStorage.setItem("food-go-explorer-view-v2", next); } catch { /* View remains usable without storage. */ }
  }
  const selectPoint = useCallback((point: AtlasSelection) => {
    if (!geographicPoint(point)) return;
    if (!isInsideMelbournePilot(point)) { setSearchMessage("This area is coming soon. Explore the Melbourne pilot area first."); setSearchOpen(true); return; }
    setSelected(point); setSelectedName(""); setSearchOpen(false);
    setChosenShop(null);
    if (location.mode === "live" && location.status === "live") void walk.planTo(point);
    else if (location.mode === "live") walk.cancel();
    else void walk.walkTo(point);
    setFollow(true);
  }, [location.mode, location.status, walk.planTo, walk.walkTo, walk.cancel]);
  function choose(point: AtlasSelection, name: string) {
    if (!isInsideMelbournePilot(point)) { setSearchMessage("This area is coming soon. Explore the Melbourne pilot area first."); setSearchOpen(true); return; }
    setChosenShop(null);
    field.current?.focus({ preventScroll: true });
    if (mapDistance(player, point) > 2000) {
      // A world search chooses a manual area or a detached view, never a GPS fix.
      if (location.mode === "manual") { location.place(point); walk.place(point); recenter(); }
      else { walk.cancel(); setFollow(false); }
      setSelected(point); setSearchOpen(false);
    } else selectPoint(point);
    setSelectedName(name); setQuery(name);
    if (point.id) {
      const stop = stops.find(item => item.id === point.id);
      const ids = new Set([point.id, ...(stop?.members.map(member => member.id) ?? [])]);
      setChosenVenues(allVenues.filter(v => ids.has(v.id)));
    }
  }
  function previewDemo(stop: DemoStop) {
    // The guided map tour is visual-only. Never alter or impersonate live GPS.
    const point = stop === "park"
      ? { longitude: 144.9794, latitude: -37.8134 }
      : stop === "treasure"
        ? { longitude: 144.96915, latitude: -37.81790 }
        : initialPosition;
    // The player's already-tested follow camera keeps nearby geographic
    // provider tiles visible. The experimental free-camera tour produced empty
    // mint terrain on the captured park view and is deliberately disabled.
    setDemoFocus(null);
    if (location.mode === "manual") {
      walk.cancel(); location.place(point); walk.place(point);
      setSelected(null); setFollow(true); setFocus(n => n + 1);
      setPerspective("overhead");
    } else {
      // Live GPS remains unchanged: the tour only browses a destination.
      setFollow(false); setPerspective("overhead"); setSelected(point);
    }
    setSelectedName("");
    if (stop === "treasure") setDemoTreasureToken(token => token + 1);
  }
  function perform(next: AvatarAction) { setAction(next); setActionToken(n => n + 1); }
  function editQuery(value: string) {
    searchRequest.current?.abort(); setSearching(false); setQuery(value);
    setWorldResults([]); setVenueResults([]); setSearchMessage(""); setSearchAttribution("");
  }
  useEffect(() => {
    if (action === "idle") return;
    const timer = setTimeout(() => setAction("idle"), 2800);
    return () => clearTimeout(timer);
  }, [action, actionToken]);
  useEffect(() => () => searchRequest.current?.abort(), []);
  async function search(event: FormEvent) {
    event.preventDefault();
    const text = query.trim();
    if (text.length < 2) { setSearchOpen(true); setSearchMessage("Enter a town, address or latitude, longitude."); return; }
    searchRequest.current?.abort();
    const request = new AbortController();
    searchRequest.current = request;
    setSearching(true); setSearchOpen(true); setSearchMessage(""); setWorldResults([]); setVenueResults([]); setSearchAttribution("");
    const coordinates = /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/u.exec(text);
    if (coordinates && geographicPoint({ latitude: Number(coordinates[1]), longitude: Number(coordinates[2]) })) {
      choose({ latitude: Number(coordinates[1]), longitude: Number(coordinates[2]) }, text); setSearching(false); return;
    }
    const [places, restaurants] = await Promise.allSettled([
      browserMapKey ? searchBrowserMapPlaces(text, browserMapKey, request.signal) : fetch("/api/map/search?" + new URLSearchParams({ q: text }), { signal: request.signal, cache: "no-store" }).then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(response.status === 429 ? "Search is busy. Wait a moment and submit again." : "World search is temporarily unavailable. You can enter latitude, longitude.");
        if (!Array.isArray(body.results)) throw new Error("Place search is unavailable.");
        return {
          results: body.results.filter((result: MapSearchResult) => geographicPoint(result) && typeof result.name === "string").slice(0, 8) as MapSearchResult[],
          attribution: typeof body.attribution === "string" ? body.attribution.slice(0, 500) : "",
        };
      }),
      fetch("/api/venues?" + new URLSearchParams({ q: text.slice(0, 100), limit: "20" }), { signal: request.signal, cache: "no-store" })
        .then(async response => { const body = await response.json(); return response.ok && body.mode === "supabase" && Array.isArray(body.data) ? body.data as CatalogueVenue[] : []; }),
    ]);
    if (request.signal.aborted) return;
    if (places.status === "fulfilled") { setWorldResults(places.value.results); setSearchAttribution(places.value.attribution); setSearchMessage(places.value.results.length ? "" : "No matching places. Try a nearby town or address."); }
    else setSearchMessage(places.reason instanceof Error ? places.reason.message : "Place search is unavailable.");
    if (restaurants.status === "fulfilled") setVenueResults(restaurants.value);
    setSearching(false);
  }
  useLayoutEffect(() => {
    const node = frame.current;
    if (!node) return;
    const measure = () => { if (!node.closest("dialog:modal")) node.style.setProperty("--atlas-top", `${Math.ceil(node.getBoundingClientRect().top + window.scrollY)}px`); };
    measure();
    const observer = new ResizeObserver(measure); observer.observe(document.body);
    if (controls.current) observer.observe(controls.current);
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  const canvasProps: AtlasCanvasProps = {
    places: stops, selected, imagery, threeD: threeD && !lowDetail, lowDetail, perspective, player, followPlayer: follow, focusPlayerNonce: focus, demoFocus,
    playerTransitionMs: location.mode === "live" ? 600 : 80, onBearingChange: setMapBearing,
    deviceHeading: compass.heading, onEyeLook: compass.stop,
    discoveryEnabled: discovery.enabled, discoveredCells: discovery.visibleCells, onDiscoveryView: setDiscoveryView,
    encounterSignals: encounterLandmarks.signals,
    location: location.mode === "live" ? location.rawPosition : null, accuracy: location.accuracy ?? undefined,
    heading: location.mode === "live" ? location.heading ?? undefined : walk.heading,
    route: walk.route,
    zoomInTrigger: zoomInNonce,
    zoomOutTrigger: zoomOutNonce,
    pilotOverviewNonce,
    playerContent: <MapPlayer avatarId={preferences.preferences.avatarId} walking={avatarWalking} action={action} actionToken={actionToken}
      close={perspective === "close"}
      heading={avatarHeading} mapBearing={mapBearing} distanceMetres={location.mode === "live" ? location.distanceMetres : walk.sessionMetres}
      distanceTransitionMs={location.mode === "live" ? 600 : 80}
      animate={!paused && (preferences.preferences.idleMotion || avatarWalking || action !== "idle")} onActivate={() => perform("wave")}/>,
    onSelect: selectPoint, onReady: ready, onUnavailable: unavailable, onCameraInteraction: cameraMoved,
    onDemoTreasure: () => setDemoTreasureToken(token => token + 1),
  };
  return <section className={styles.atlas} aria-label="Geographic exploration">
    <MapFrame label="Explore the world" className={styles.fullFrame}>
      <div ref={controls} className={styles.controls}><div className={styles.placeBar}>
        <h1>Explore</h1><form className={styles.search} role="search" onSubmit={search}
          onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setSearchOpen(false); }}
          onKeyDown={event => { if (event.key === "Escape" && searchOpen) { event.preventDefault(); event.stopPropagation(); setSearchOpen(false); } }}>
          <div className={styles.field}><Search size={17}/><input ref={field} type="search" aria-label="Search map places" maxLength={120} autoComplete="off"
            placeholder="Search anywhere in the world" value={query} onFocus={() => setSearchOpen(true)} onChange={e => editQuery(e.target.value)}/>
            {query && <button type="button" aria-label="Clear place search" onClick={() => { editQuery(""); field.current?.focus(); }}><X size={17}/></button>}
            <button type="submit" aria-label="Search worldwide" aria-controls={resultsId} aria-expanded={searchOpen} aria-busy={searching}><Search size={18}/></button></div>
          {searchOpen && <div id={resultsId} className={styles.results}>
            {localMatches.slice(0, 4).map(stop => <button key={stop.id} type="button" onClick={() => choose(stop, stop.name)}><MapPin size={17}/><span><strong>{stop.name}</strong><small>Food Go · {stop.area}</small></span></button>)}
            {worldResults.map(result => <button key={result.id} type="button" onClick={() => choose(result, result.name)}><Compass size={17}/><span><strong>{result.name}</strong><small>Map place</small></span></button>)}
            {worldResults.length > 0 && searchAttribution && <span>{searchAttribution.includes("MapTiler")
              ? <>Place search by <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener noreferrer">MapTiler</a> | <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a></>
              : searchAttribution}</span>}
            <span role="status">{searching ? "Searching places…" : searchMessage || (!query ? "Type a place or address, then search." : !worldResults.length && !localMatches.length ? "Press Search to look worldwide." : "")}</span>
          </div>}
        </form></div>
        <details className={styles.layerMenu}
          onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }}
          onKeyDown={event => { if (event.key === "Escape" && event.currentTarget.open) { event.preventDefault(); event.stopPropagation(); event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); } }}>
          <summary aria-label="Game graphics settings"><Settings2 size={19}/><span>Graphics</span></summary>
          <div className={styles.layerPanel}><strong>Game world graphics</strong><div className={styles.layers} role="group" aria-label="Game graphics">
          <button type="button" aria-label="3D world" title={renderer === "fallback" ? "Retry 3D game world" : "Show or hide 3D scenery"} aria-pressed={renderer === "webgl" && threeD && !lowDetail}
            onClick={() => { if (renderer === "fallback") { setLowDetail(false); retryGraphics(); return; } if (lowDetail) { setLowDetail(false); setThreeD(true); } else setThreeD(v => !v); }}><Box size={16}/>3D world</button>
          <button type="button" aria-pressed={lowDetail} onClick={() => setLowDetail(v => !v)}>Low detail</button>
          <button type="button" aria-pressed={discovery.enabled} onClick={discovery.toggle}>Discovery fog</button>
          </div><small>One Food Go world. Low detail reduces effects on slower devices. Streets remain geographically accurate.</small></div>
        </details>
      </div>
      {renderer === "fallback" && <div className={styles.graphicsRecovery}>
        <span role="status">3D graphics paused. Your place and route are kept in the 2D map.</span>
        <button type="button" onClick={retryGraphics}>Retry 3D</button>
      </div>}
      <div ref={frame} className={styles.stage} data-selected={Boolean(selected)} data-camera={renderer === "fallback" ? "2d" : perspective}><div className={styles.scene}><MapExpandButton/>{demoMode && <><DemoWorldTour onSelect={previewDemo}/><DemoTreasureEncounter activationToken={demoTreasureToken}/></>}
        {renderer === "webgl" ? <Canvas key={graphicsAttempt} {...canvasProps}/> : <FlatCanvas {...canvasProps}/>}
        {!loaded && <span className={styles.loading} role="status">Opening world map…</span>}
        <ExplorerControl avatarId={preferences.preferences.avatarId} live={location.mode === "live" && location.status === "live"}
          requesting={location.status === "requesting"} following={follow} expanded={avatarOpen} onLocate={locate} onCustomise={customise}/>
        <FoodGoHud
          signedIn={signedIn}
          level={realLevel}
          xp={realXp}
          coins={realCoins}
          activeQuest={activeQuestProp}
          locationName="Melbourne"
          onSearch={text => {
            setQuery(text);
            if (field.current) {
              field.current.value = text;
              field.current.form?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
            }
          }}
          onFilterClick={() => {
            if (worldSheet.current) worldSheet.current.open = !worldSheet.current.open;
          }}
          onRecenter={recenter}
          onZoomIn={() => setZoomInNonce(n => n + 1)}
          onZoomOut={() => setZoomOutNonce(n => n + 1)}
          onLayersToggle={() => setThreeD(v => !v)}
          onLocationClick={() => { setFollow(false); setPerspective("overhead"); setPilotOverviewNonce(n => n + 1); }}
          onQuestClick={() => { window.location.assign("/quests"); }}
          currentSection="explore"
        />
        <div className={styles.perspectives} role="group" aria-label="Explorer view">
          <button type="button" title="Overhead view" aria-label="Overhead view" aria-pressed={perspective === "overhead" || renderer === "fallback"} onClick={() => changePerspective("overhead")}><Compass size={16}/><span>Overview</span></button>
          <details ref={cameraMenu} className={styles.cameraMenu}
            onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }}
            onKeyDown={event => { if (event.key === "Escape" && event.currentTarget.open) { event.preventDefault(); event.stopPropagation(); event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); } }}>
            <summary aria-label="Choose camera view" data-active={perspective !== "overhead" && renderer === "webgl"}>
              {perspective === "first" ? compass.status === "active" ? <Compass size={16}/> : <Eye size={16}/> : <PersonStanding size={16}/>}<span>{renderer === "fallback" || perspective === "overhead" ? "Camera" : perspective === "third" ? "Follow" : perspective === "close" ? "Close" : compass.status === "active" ? "Compass" : "Street"}</span><ChevronUp size={12}/>
            </summary>
            <div className={styles.cameraOptions} role="group" aria-label="Explorer camera profiles">
              {([["third", "Third person view", "Follow", PersonStanding], ["close", "Close third person view", "Close", ZoomIn], ["first", "First person view", "Street", Eye]] as const).map(([view, label, name, Icon]) =>
                <button key={view} type="button" aria-label={label} aria-pressed={perspective === view && renderer === "webgl"} onClick={() => { if (renderer === "fallback") retryGraphics(); changePerspective(view); }}><Icon size={17}/>{name}</button>)}
              {perspective === "first" && renderer === "webgl" && <button type="button" aria-label="Device compass" aria-pressed={compass.status === "active"} aria-busy={compass.status === "requesting"} aria-disabled={compass.status === "requesting"}
                onClick={() => { if (compass.status === "requesting") return; if (compass.status === "active") compass.stop(); else compass.start(); }}><Compass size={17}/>{compass.status === "active" ? "Stop compass" : "Use compass"}</button>}
            </div>
          </details>
        </div>
        <span className={styles.modeStatus} data-location-status={location.status}><span className={styles.statusDot} aria-hidden="true"/>{renderer === "fallback" ? "2D map · " : ""}{!follow ? "Browsing" : location.mode === "live" ? location.status === "live" ? "Live location" : location.status === "weak" ? "Weak GPS signal" : "Finding your location" : "Manual exploration"}{location.accuracy != null ? ` · ±${Math.round(location.accuracy)} m` : ""}</span>
      </div>
      </div>
        {selected && <div className={styles.readout}><div className={styles.readoutName}><div><strong>{active?.name || selectedName || "Selected point"}</strong>
          <small>{directions?.coordinate}</small></div></div>
          {directions && <div className={styles.directions}><a href={directions.google} target="_blank" rel="noopener noreferrer">Google Maps<ArrowUpRight size={14}/></a><a href={directions.apple} target="_blank" rel="noopener noreferrer">Apple Maps<ArrowUpRight size={14}/></a></div>}
          <button type="button" className={styles.clearSelection} aria-label="Clear selected place" onClick={() => { setSelected(null); setSelectedName(""); walk.cancel(); }}><X size={17}/></button>
        </div>}
        {walk.route && <div className={styles.gameBar} aria-label="Explorer controls">
          {walking && <button type="button" onClick={walk.pause}><Pause size={15}/>Pause walk</button>}
          {walk.phase === "paused" && location.mode === "manual" && <button type="button" onClick={() => { setPaused(false); walk.resume(); }}><Play size={15}/>Resume walk</button>}
          {walk.route && <button type="button" onClick={walk.cancel}><X size={15}/>End route</button>}
          <span className={styles.walkDistance}>{location.mode === "live" ? "Route guide · follows your live position" : `${Math.round(walk.travelled)} / ${Math.round(walk.totalDistance)} m`}</span>
        </div>}
      {avatarOpen && <div ref={avatarPanel} className={styles.avatarPanel} onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeAvatar(); } }}><AvatarCustomizer compact onClose={closeAvatar} onAction={perform} motionPaused={paused}/></div>}
    <details ref={worldSheet} className={styles.worldSheet}>
      <summary aria-label="Open game details and discovery settings"><Layers size={17}/><span>Game details</span></summary>
      <div className={styles.worldSheetBody}>
        <nav className={styles.worldSheetLinks} aria-label="Food Go discoveries"><Link href="/?view=catalogue">Restaurants and deals</Link><Link href="/inventory">Inventory</Link><Link href="/quests">Quests</Link></nav>
    <div className={styles.explorerStatus} role="status"><div><p>{walk.message || (location.status === "manual" ? perspective === "first" && renderer === "webgl" ? "Drag to look around. Pinch to change the view angle. Tap a street to walk." : "Tap a street to explore. Tap your explorer for live location, or hold to change your look." : location.message)}</p>{compass.message && <p>{compass.message}</p>}</div>{walk.route && location.mode === "manual" && <label>Walk speed<select value={walk.speed} onChange={e => walk.setSpeed(Number(e.target.value) as 1 | 4)}><option value="1">1×</option><option value="4">4×</option></select></label>}</div>
    {encounterLandmarks.nearby.length > 0 && <div className={styles.gameBar} aria-label="Nearby restaurant encounters"><span>Nearby restaurant encounters</span>{encounterLandmarks.nearby.map(venue => <button key={venue.venueId} type="button" onClick={() => {
      const stop = stops.find(place => place.members.some(member => member.id === venue.venueId));
      if (stop) { choose(stop, stop.name); setChosenShop({ selectionId: stop.id, venueId: venue.venueId }); }
    }}><Sparkles size={15}/>{venue.name}</button>)}</div>}
    <details className={styles.discovery}>
      <summary>Area discovery{discovery.enabled ? ` · ${discovery.recordedCount} saved areas` : ""}</summary>
      <div className={styles.discoveryControls}>
        <button type="button" aria-pressed={discovery.enabled} onClick={discovery.toggle}>{discovery.enabled ? "Hide discovery fog" : "Show discovery fog"}</button>
        <button type="button" onClick={discovery.clearPreview} disabled={!discovery.sessionCount}>Clear session preview</button>
      </div>
      <p>Fog marks areas you have not explored. Manual walks and unsaved device observations stay in this page and never earn rewards.</p>
      {discovery.enabled && <p role="status">{discoveryView?.status === "ready"
        ? `${discoveryView.exploredPercent ?? 0}% of the visible grid explored. ${discovery.sessionCount} session areas and ${discovery.recordedCount} saved areas may overlap.`
        : "Zoom in or use Overview to see discovery fog. It is limited to nearby areas."}</p>}
      {signedIn && explorationAvailable ? <>
        <label className={styles.discoveryConsent}><input type="checkbox" checked={discovery.requested} onChange={event => void discovery.setRecording(event.target.checked)}/><span>Save this session's exploration</span></label>
        <p>With this on, fresh live GPS fixes go to Food Go to derive private coarse areas, about 120 metres wide in Melbourne. Food Go stores areas and observation times, not precise coordinates or a GPS track. Turn it on each time you return. These device observations are unverified and do not earn XP or offers.</p>
        <button type="button" className={styles.motionButton} onClick={() => void discovery.clearSaved()} disabled={discovery.saving || !discovery.recordedCount}>Delete saved areas</button>
      </> : <p>{explorationAvailable ? <>Sign in through <Link href="/profile">Passport</Link> to save your live exploration.</> : "Account saving is not enabled yet. You can explore with a session preview."}</p>}
      {discovery.message && <p role="status">{discovery.message}</p>}
      {discovery.error && <p role="alert">{discovery.error} <button type="button" onClick={() => void discovery.retry()}>Retry discovery</button></p>}
    </details>
    <details className={styles.playHelp}><summary>Explorer actions and location</summary>
      <div className={styles.actionRow}><button type="button" disabled={paused} onClick={() => perform("wave")}><Hand size={16}/>Wave</button>
        <button type="button" disabled={paused} onClick={() => perform("cheer")}><Sparkles size={16}/>Celebrate</button>
        <button type="button" disabled={paused} onClick={() => perform("look")}><Compass size={16}/>Look around</button></div>
      <button type="button" className={styles.motionButton} aria-pressed={paused} onClick={() => { setPaused(v => !v); if (walking) walk.pause(); }}><Pause size={15}/>{paused ? "Enable avatar motion" : "Pause avatar motion"}</button>
      <button type="button" className={styles.motionButton} aria-expanded={avatarOpen} onClick={customise}>Customise explorer</button>
      {location.mode === "live" && <button type="button" className={styles.motionButton} onClick={() => { walk.cancel(); location.stop(); }}>Turn off live location</button>}
      <p>Tap a street to walk. Search a distant place to move your manual explorer there. Live location follows your device. Virtual walking never earns verified XP.</p>
      <p>GPS fixes stay in this page unless you turn on exploration saving above. Map tiles reveal the viewed area to the map provider. Searches and requested route endpoints go to their providers. Location turns off when you leave or hide Explore.</p>
      {encountersAvailable && <p>Nearby encounter hints request at most three public venue IDs at a time. Your GPS coordinates are not sent for these hints, and proximity never confirms a claim.</p>}
      <p>{Math.round(location.mode === "live" ? location.distanceMetres : walk.sessionMetres)} metres explored this session.</p><Link href="/collect">Collect a verified discovery</Link>
    </details>
    {active && active.members.length > 1 && <p>Food outlets in {active.name}. Choose a listed shop by its floor and unit below.</p>}
    {active && active.members.length > 0 && <div className={styles.members}>{active.members.length > 1 && encountersAvailable && <p>Choose a shop for its restaurant encounter. Shops in this building have separate pools and staff confirmations.</p>}{active.members.map(member => <div key={member.id}>
      {member.href ? <Link href={member.href}>{member.name}<ArrowUpRight size={14}/></Link> : <strong>{member.name}</strong>}<span>{member.area}</span>
      {encountersAvailable && active.members.length > 1 && <button type="button" className={styles.motionButton} aria-pressed={encounterVenueId === member.id}
        onClick={() => setChosenShop({ selectionId: active.id, venueId: member.id })}>Encounters at {member.name}</button>}
    </div>)}</div>}
    {encountersAvailable && encounterVenueId && <EncounterPanel key={`${accountKey ?? "visitor"}:${encounterVenueId}`} venueId={encounterVenueId} signedIn={signedIn}
      enabled={encountersAvailable} accountKey={accountKey} proximity={{ mode: location.mode, fix: location.fix }}/>}
    <div className={styles.credits}>
      <span>Streets by OpenFreeMap and OpenStreetMap.</span><a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener noreferrer">Fix the map</a>
      {renderer === "webgl" && <span>Game world follows real street geography.</span>}
      {searchAttribution && <span>{searchAttribution.includes("MapTiler")
        ? <>Place search by <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener noreferrer">MapTiler</a> | <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a></>
        : searchAttribution}</span>}
      {walk.attribution && <span>{walk.attribution}</span>}
      <a href={ATLAS_ATTRIBUTION} target="_blank" rel="noopener noreferrer">Melbourne imagery sources</a>
      {renderer === "fallback" && <span>Interactive 2D map</span>}
      {catalogueUnavailable && <span>Food Go venue listings are temporarily unavailable.</span>}
    </div>
      </div>
    </details>
    </MapFrame>
  </section>;
}
