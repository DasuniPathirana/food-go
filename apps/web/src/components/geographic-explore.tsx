"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, Box, Compass, Hand, LocateFixed, MapPin, Pause, PersonStanding, Play, Search, Sparkles, X } from "lucide-react";
import { atlasStops, geographicPoint, pointDirections } from "@/lib/atlas-places";
import { ATLAS_ATTRIBUTION } from "@/lib/melbourne-atlas";
import type { CatalogueVenue } from "@/lib/catalogue-contracts";
import type { MapSearchResult } from "@/lib/map-services";
import { searchBrowserMapPlaces } from "@/lib/browser-map-search";
import { useAvatarPreferences } from "@/lib/avatar-preferences";
import type { AtlasCanvasProps, AtlasImagery, AtlasSelection } from "./atlas-canvas";
import { MapExpandButton, MapFrame } from "./map-frame";
import { MapPlayer } from "./map-player";
import { AvatarCustomizer, type AvatarAction } from "./avatar-customizer";
import { useExplorerLocation } from "./use-explorer-location";
import { useStreetWalk } from "./use-street-walk";
import styles from "./geographic-explore.module.css";

const Canvas = dynamic(() => import("./atlas-canvas").then(module => module.AtlasCanvas), { ssr: false });
const FlatCanvas = dynamic(() => import("./world-map-fallback").then(module => module.WorldMapFallback), { ssr: false });
const noVenues: CatalogueVenue[] = [];
// Federation Square is a public reference point, not a claimed device position.
const initialPosition = { longitude: 144.968964, latitude: -37.817852 };
const browserMapKey = process.env.NEXT_PUBLIC_MAPTILER_KEY?.trim();
const globalSatellite = !!browserMapKey;

export function GeographicExplore({ venues = noVenues, catalogueUnavailable = false }: {
  basePath: string; venues?: CatalogueVenue[]; catalogueUnavailable?: boolean;
}) {
  const frame = useRef<HTMLDivElement>(null), controls = useRef<HTMLDivElement>(null), field = useRef<HTMLInputElement>(null);
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
  const [imagery, setImagery] = useState<AtlasImagery>("game");
  const [mapBearing, setMapBearing] = useState(-18);
  const [threeD, setThreeD] = useState(true), [loaded, setLoaded] = useState(false);
  const [renderer, setRenderer] = useState<"webgl" | "fallback">("webgl"), [providerFailed, setProviderFailed] = useState(false);
  const [follow, setFollow] = useState(true), [focus, setFocus] = useState(0);
  const [avatarOpen, setAvatarOpen] = useState(false), [action, setAction] = useState<AvatarAction>("idle");
  const [actionToken, setActionToken] = useState(0), [paused, setPaused] = useState(false);
  const preferences = useAvatarPreferences();
  const location = useExplorerLocation(initialPosition);
  const walk = useStreetWalk({ start: location.position, enabled: location.mode === "manual" });
  const player = walk.position;
  const allVenues = useMemo(() => [...new Map([...venues, ...chosenVenues, ...venueResults].map(v => [v.id, v])).values()], [venues, chosenVenues, venueResults]);
  const stops = useMemo(() => atlasStops([], allVenues), [allVenues]);
  const active = stops.find(stop => stop.id === selected?.id);
  const localMatches = stops.filter(stop => stop.name.toLocaleLowerCase("en-AU").includes(query.trim().toLocaleLowerCase("en-AU")));
  const directions = selected && pointDirections(selected);
  const walking = walk.phase === "walking";
  const avatarWalking = location.mode === "live" ? location.walking : walking;
  const avatarHeading = location.mode === "live" ? location.heading ?? undefined : walk.totalDistance > 0 ? walk.heading : undefined;
  const ready = useCallback(() => setLoaded(true), []);
  const unavailable = useCallback(() => { setRenderer("fallback"); setLoaded(false); }, []);
  const satelliteUnavailable = useCallback(() => setProviderFailed(true), []);
  const cameraMoved = useCallback(() => setFollow(false), []);
  const selectPoint = useCallback((point: AtlasSelection) => {
    if (!geographicPoint(point)) return;
    setSelected(point); setSelectedName(""); setFollow(false); setSearchOpen(false);
  }, []);
  function choose(point: AtlasSelection, name: string) {
    field.current?.focus({ preventScroll: true });
    selectPoint(point); setSelectedName(name); setQuery(name);
    if (point.id) {
      const stop = stops.find(item => item.id === point.id);
      const ids = new Set([point.id, ...(stop?.members.map(member => member.id) ?? [])]);
      setChosenVenues(allVenues.filter(v => ids.has(v.id)));
    }
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
    places: stops, selected, imagery, threeD, player, followPlayer: follow, focusPlayerNonce: focus,
    playerTransitionMs: location.mode === "live" ? 600 : 80, onBearingChange: setMapBearing,
    location: location.mode === "live" ? location.position : null, accuracy: location.accuracy ?? undefined,
    heading: location.mode === "live" ? location.heading ?? undefined : walk.heading, route: walk.route,
    playerContent: <MapPlayer avatarId={preferences.preferences.avatarId} walking={avatarWalking} action={action} actionToken={actionToken}
      heading={avatarHeading} mapBearing={mapBearing} distanceMetres={location.mode === "live" ? location.distanceMetres : walk.sessionMetres}
      distanceTransitionMs={location.mode === "live" ? 600 : 80}
      animate={!paused && (preferences.preferences.idleMotion || avatarWalking || action !== "idle")} onActivate={() => perform("wave")}/>,
    onSelect: selectPoint, onReady: ready, onUnavailable: unavailable, onCameraInteraction: cameraMoved, onSatelliteUnavailable: satelliteUnavailable,
  };
  return <section className={styles.atlas} aria-label="Geographic exploration">
    <MapFrame label="Explore the world">
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
        <div className={styles.bar}><div className={styles.layers} role="group" aria-label="Imagery and perspective">
          {([["game","Game","Game"],["street","Streets","Streets"],["satellite", globalSatellite && !providerFailed ? "Satellite" : "Melbourne satellite","Satellite"],["aerial","Melbourne aerial","Aerial"]] as const).map(([mode,label,short]) =>
            <button key={mode} type="button" aria-label={label} title={label} aria-pressed={imagery === mode} onClick={() => setImagery(mode)}>{short}</button>)}
          <button type="button" className={styles.depth} aria-label="3D buildings" aria-pressed={renderer === "webgl" && threeD} disabled={renderer === "fallback"} onClick={() => setThreeD(v => !v)}><Box size={16}/>3D</button>
        </div></div>
      </div>
      <div ref={frame} className={styles.stage} data-selected={Boolean(selected)}><div className={styles.scene}><MapExpandButton/>
        {renderer === "webgl" ? <Canvas {...canvasProps}/> : <FlatCanvas {...canvasProps}/>}
        {!loaded && <span className={styles.loading} role="status">Opening world map…</span>}
        <div className={styles.locationTools}>
          <button type="button" title={location.mode === "live" ? "Turn off live location" : "Enable live location"} aria-label={location.mode === "live" ? "Turn off live location" : "Enable live location"}
            aria-pressed={location.mode === "live"} onClick={() => { walk.cancel(); if (location.mode === "live") location.stop(); else { location.enable(); setFollow(true); setFocus(n => n + 1); } }}><LocateFixed size={19}/></button>
          <button type="button" title="Follow my explorer" aria-label="Follow my explorer" aria-pressed={follow} onClick={() => { setFollow(true); setFocus(n => n + 1); }}><Compass size={19}/></button>
          <button type="button" title="Avatar options" aria-label="Avatar options" aria-expanded={avatarOpen} onClick={() => setAvatarOpen(v => !v)}><PersonStanding size={19}/></button>
        </div>
        <span className={styles.modeStatus}>{renderer === "fallback" ? "2D map · " : imagery === "game" ? "Game world · " : ""}{location.mode === "live" ? location.status === "live" ? "Live location" : "Waiting for location" : "Manual explorer"}{location.accuracy != null ? ` · ±${Math.round(location.accuracy)} m` : ""}</span>
      </div>
        <div className={styles.readout}><div className={styles.readoutName}><MapPin size={17}/><div><strong>{active?.name || selectedName || (directions ? "Selected point" : "Choose your next stop")}</strong>
          <small>{directions ? directions.coordinate : "Search a place or select a point on the map."}</small></div></div>
          {directions && <div className={styles.directions}><a href={directions.google} target="_blank" rel="noopener noreferrer">Google Maps<ArrowUpRight size={14}/></a><a href={directions.apple} target="_blank" rel="noopener noreferrer">Apple Maps<ArrowUpRight size={14}/></a></div>}
        </div>
        {(selected || walk.route) && <div className={styles.gameBar} aria-label="Explorer controls">
          {selected && <><button type="button" onClick={() => { location.place(selected); walk.place(selected); setFollow(true); setFocus(n => n + 1); }}>Place explorer here</button>
            <button type="button" className={styles.walkButton} disabled={walk.phase === "routing" || (location.mode === "live" && location.status !== "live")} onClick={() => {
              if (location.mode === "live") void walk.planTo(selected); else void walk.walkTo(selected);
              setFollow(true);
            }}><Play size={15}/>{walk.phase === "routing" ? "Finding streets…" : location.mode === "live" ? "Plan walking route" : "Walk here"}</button></>}
          {walking && <button type="button" onClick={walk.pause}><Pause size={15}/>Pause walk</button>}
          {walk.phase === "paused" && location.mode === "manual" && <button type="button" onClick={walk.resume}><Play size={15}/>Resume walk</button>}
          {walk.route && <button type="button" onClick={walk.cancel}><X size={15}/>End route</button>}
          <span className={styles.walkDistance}>{walk.totalDistance > 0 ? `${Math.round(walk.travelled)} / ${Math.round(walk.totalDistance)} m` : "Tap your explorer to wave"}</span>
        </div>}
      </div>
      {avatarOpen && <div className={styles.avatarPanel}><AvatarCustomizer onClose={() => setAvatarOpen(false)} onAction={perform} motionPaused={paused}/></div>}
    </MapFrame>
    <div className={styles.explorerStatus} role="status"><p>{walk.message || location.message}</p>{walk.route && location.mode === "manual" && <label>Walk speed<select value={walk.speed} onChange={e => walk.setSpeed(Number(e.target.value) as 1 | 4)}><option value="1">1×</option><option value="4">4×</option></select></label>}</div>
    <details className={styles.playHelp}><summary>Explorer actions and location</summary>
      <div className={styles.actionRow}><button type="button" disabled={paused} onClick={() => perform("wave")}><Hand size={16}/>Wave</button>
        <button type="button" disabled={paused} onClick={() => perform("cheer")}><Sparkles size={16}/>Celebrate</button>
        <button type="button" disabled={paused} onClick={() => perform("look")}><Compass size={16}/>Look around</button></div>
      <button type="button" className={styles.motionButton} aria-pressed={paused} onClick={() => { setPaused(v => !v); if (walking) walk.pause(); }}><Pause size={15}/>{paused ? "Enable avatar motion" : "Pause avatar motion"}</button>
      <p>Allow live location to move with your device, or place your explorer manually and follow a real pedestrian route. Virtual walks track this session's movement. Collect verified XP using a restaurant's code.</p>
      <p>GPS fixes stay in this page. Map tiles reveal the viewed area to the map provider. Searches and requested route endpoints go to their providers. Location turns off when you leave or hide Explore.</p>
      <p>{Math.round(location.mode === "live" ? location.distanceMetres : walk.sessionMetres)} metres explored this session.</p><Link href="/collect">Collect a verified discovery</Link>
    </details>
    {active && active.members.length > 0 && <div className={styles.members}>{active.members.map(member => <div key={member.id}>
      {member.href ? <Link href={member.href}>{member.name}<ArrowUpRight size={14}/></Link> : <strong>{member.name}</strong>}<span>{member.area}</span></div>)}</div>}
    <div className={styles.credits}>
      <span>Streets by OpenFreeMap and OpenStreetMap.</span><a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener noreferrer">Fix the map</a>
      {imagery === "game" && renderer === "webgl" && <span>Game view uses real streets and stylised building heights.</span>}
      {searchAttribution && <span>{searchAttribution.includes("MapTiler")
        ? <>Place search by <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener noreferrer">MapTiler</a> | <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a></>
        : searchAttribution}</span>}
      {walk.attribution && <span>{walk.attribution}</span>}
      <a href={ATLAS_ATTRIBUTION} target="_blank" rel="noopener noreferrer">Melbourne imagery sources</a>
      {imagery === "satellite" && (!globalSatellite || providerFailed) && <span>Satellite image covers Melbourne CBD. Worldwide satellite requires a configured map provider.</span>}
      {imagery === "aerial" && <span>Aerial survey covers Melbourne CBD.</span>}
      {renderer === "fallback" && <span>Interactive 2D map</span>}
      {catalogueUnavailable && <span>Food Go venue listings are temporarily unavailable.</span>}
    </div>
  </section>;
}
