"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, Box, ChevronDown, MapPin, Satellite, ScanLine, Search, X } from "lucide-react";
import { atlasStops, geographicPoint, pointDirections } from "@/lib/atlas-places";
import { ATLAS_AERIAL, ATLAS_SATELLITE, ATLAS_CORNERS, ATLAS_PLACES, ATLAS_ATTRIBUTION, ATLAS_SATELLITE_DATE } from "@/lib/melbourne-atlas";
import type { CatalogueVenue } from "@/lib/catalogue-contracts";
import type { AtlasSelection } from "./atlas-canvas";
import { MapExpandButton, MapFrame } from "./map-frame";
import { MapModeNav } from "./map-mode-nav";
import styles from "./geographic-explore.module.css";

const Canvas = dynamic(() => import("./atlas-canvas").then(module => module.AtlasCanvas), { ssr: false });
const FlatCanvas = dynamic(() => import("./atlas-fallback").then(module => module.AtlasFallback), { ssr: false });
const noVenues: CatalogueVenue[] = [];
const withinImage = (point: AtlasSelection) => point.longitude >= ATLAS_CORNERS[0][0] && point.longitude <= ATLAS_CORNERS[2][0]
  && point.latitude <= ATLAS_CORNERS[0][1] && point.latitude >= ATLAS_CORNERS[2][1];

export function GeographicExplore({ basePath, venues = noVenues, catalogueUnavailable = false }: {
  basePath: string; venues?: CatalogueVenue[]; catalogueUnavailable?: boolean;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const controls = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const resultsId = useId();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [results, setResults] = useState<CatalogueVenue[]>(noVenues);
  const [searchError, setSearchError] = useState(false);
  const [pending, setPending] = useState(false);
  const [chosen, setChosen] = useState<CatalogueVenue[]>(noVenues);
  const [selected, setSelected] = useState<AtlasSelection | null>(null);
  const [imagery, setImagery] = useState<"aerial" | "satellite">("satellite");
  const [threeD, setThreeD] = useState(true);
  const [renderer, setRenderer] = useState<"loading" | "ready" | "local">("loading");
  const [providerFailed, setProviderFailed] = useState(false);
  const needle = query.trim().toLocaleLowerCase("en-AU");
  const allVenues = useMemo(() => Array.from(new Map([...venues, ...chosen, ...results].map(venue => [venue.id, venue])).values()), [venues, chosen, results]);
  const stops = useMemo(() => atlasStops(ATLAS_PLACES, allVenues), [allVenues]);
  const active = stops.find(stop => stop.id === selected?.id);
  const remote = !!process.env.NEXT_PUBLIC_MAPTILER_KEY?.trim() && imagery === "satellite" && renderer !== "local" && !providerFailed;
  const shown = useMemo(() => remote ? stops : stops.filter(withinImage), [stops, remote]);
  const matched = stops.filter(stop => stop.members.some(member => (member.name + " " + member.area).toLocaleLowerCase("en-AU").includes(needle)
    || results.some(venue => venue.id === member.id)));
  const onSelect = useCallback((point: AtlasSelection) => { if (geographicPoint(point)) { setSelected(point); setSearchOpen(false); } }, []);
  const ready = useCallback(() => setRenderer("ready"), []);
  const unavailable = useCallback(() => setRenderer("local"), []);
  const satelliteUnavailable = useCallback(() => setProviderFailed(true), []);
  const directions = selected && pointDirections(selected);

  useEffect(() => {
    setResults(noVenues);
    setSearchError(false);
    if (basePath !== "/" || !searchOpen || needle.length < 2) { setPending(false); return; }
    const controller = new AbortController();
    setPending(true);
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: needle, limit: "50" });
        const response = await fetch(`/api/venues?${params}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]), cache: "no-store" });
        if (!response.ok) throw new Error("Search unavailable");
        const data = await response.json();
        if (!controller.signal.aborted && data.mode === "supabase" && Array.isArray(data.data)) setResults(data.data);
      } catch {
        if (!controller.signal.aborted) setSearchError(true);
      } finally {
        if (!controller.signal.aborted) setPending(false);
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [basePath, needle, searchOpen]);

  function choose(stop: (typeof stops)[number]) {
    const ids = new Set(stop.members.map(member => member.id));
    setChosen(allVenues.filter(venue => ids.has(venue.id)));
    setQuery(stop.name);
    onSelect(stop);
    field.current?.focus({ preventScroll: true });
    setSearchOpen(false);
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (needle && matched[0]) choose(matched[0]);
    else setSearchOpen(true);
  }

  useLayoutEffect(() => {
    const node = frame.current;
    if (!node) return;
    const measure = () => {
      if (!node.closest("dialog:modal")) node.style.setProperty("--atlas-top", `${Math.ceil(node.getBoundingClientRect().top + window.scrollY)}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    if (controls.current) observer.observe(controls.current);
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, []);

  return <section className={styles.atlas} aria-label="Geographic exploration">
    <MapFrame label="Explore Melbourne map">
      <div ref={controls} className={styles.controls}>
        <div className={styles.placeBar}>
          <h1>Melbourne</h1>
          <form className={styles.search} role="search" onSubmit={search}
            onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setSearchOpen(false); }}
            onKeyDown={event => {
              if (event.key === "Escape" && searchOpen) {
                event.preventDefault(); event.stopPropagation(); field.current?.focus(); setSearchOpen(false);
              }
            }}>
            <div className={styles.field}><Search size={17} aria-hidden="true" />
              <input ref={field} aria-label="Search map places" type="search" maxLength={100} autoComplete="off" placeholder="Search restaurants and places"
                value={query} onFocus={() => setSearchOpen(true)} onClick={() => setSearchOpen(true)}
                onChange={event => { setQuery(event.target.value); setResults(noVenues); setSearchOpen(true); }} />
              <button type="button" title={query ? "Clear search" : "Browse map places"} aria-label={query ? "Clear search" : "Browse map places"}
                aria-controls={resultsId} aria-expanded={searchOpen} onClick={() => {
                  if (query) { setQuery(""); field.current?.focus(); setSearchOpen(true); }
                  else setSearchOpen(value => !value);
                }}>{query ? <X size={16} /> : <ChevronDown size={16} />}</button>
            </div>
            {searchOpen && <div id={resultsId} className={styles.results}>
              {matched.slice(0, 8).map(stop => <button key={stop.id} type="button" onClick={() => choose(stop)}>
                <MapPin size={16} /><span><strong>{stop.name}</strong><small>{stop.members.length > 1 ? stop.members.map(member => member.name).join(", ") : stop.area}</small></span><ArrowUpRight size={15} />
              </button>)}
              <span role="status">{pending ? "Searching venues…" : searchError ? "Venue search unavailable." : matched.length > 8 ? "Refine your search for more places." : !matched.length ? "No mapped places found." : ""}</span>
            </div>}
          </form>
        </div>
        <div className={styles.bar}>
          <MapModeNav geographic basePath={basePath} />
          <div className={styles.layers} role="group" aria-label="Imagery and perspective">
            <button type="button" aria-pressed={imagery === "satellite"} onClick={() => setImagery("satellite")}><Satellite size={16} />Satellite</button>
            <button type="button" aria-pressed={imagery === "aerial"} onClick={() => setImagery("aerial")}><ScanLine size={16} />Aerial</button>
            <button type="button" className={styles.depth} aria-label="3D buildings" aria-pressed={threeD} onClick={() => setThreeD(value => !value)}><Box size={16} />3D</button>
          </div>
        </div>
      </div>
      <div ref={frame} className={styles.stage}>
        <div className={styles.scene} style={{ backgroundImage: `url("${imagery === "aerial" ? ATLAS_AERIAL : ATLAS_SATELLITE}")` }}>
          <MapExpandButton />
          {renderer === "local"
            ? <FlatCanvas places={shown} selected={selected && withinImage(selected) ? selected : null} imagery={imagery} threeD={threeD} onSelect={onSelect} />
            : <Canvas places={shown} selected={selected && (remote || withinImage(selected)) ? selected : null} imagery={imagery} threeD={threeD} onSelect={onSelect} onReady={ready} onUnavailable={unavailable} onSatelliteUnavailable={satelliteUnavailable} />}
          {renderer === "loading" && <span className={styles.loading} role="status">Opening map…</span>}
        </div>
        <div className={styles.readout} aria-live="polite">
          <div className={styles.readoutName}><MapPin size={17} /><div><strong>{active?.name || (directions ? "Dropped pin" : "Melbourne city centre")}</strong>
            <small>{directions ? `${directions.coordinate}${!remote && selected && !withinImage(selected) ? " · Outside local imagery" : ""}` : imagery === "satellite" ? (remote ? "Satellite imagery" : `Satellite · ${ATLAS_SATELLITE_DATE}`) : "Aerial survey · May 2020"}</small></div></div>
          {directions && <div className={styles.directions}><a href={directions.google} target="_blank" rel="noopener noreferrer">Google Maps<ArrowUpRight size={14} /></a><a href={directions.apple} target="_blank" rel="noopener noreferrer">Apple Maps<ArrowUpRight size={14} /></a></div>}
        </div>
      </div>
    </MapFrame>
    {active && (active.members.length > 1 || active.href) && <div className={styles.members}>{active.members.map(member => <div key={member.id}>
      {member.href ? <Link href={member.href}>{member.name}<ArrowUpRight size={14} /></Link> : <strong>{member.name}</strong>}<span>{member.area}</span>
    </div>)}</div>}
    <div className={styles.credits}>
      <p>Swipe to move. Tap for directions.</p>
      <a href={ATLAS_ATTRIBUTION} target="_blank" rel="noopener noreferrer">Map sources<ArrowUpRight size={13} /></a>
      {basePath === "/" && <Link href="/?view=catalogue">Venue catalogue<ArrowUpRight size={13} /></Link>}
      {providerFailed && imagery === "satellite" && <p>Local Melbourne imagery</p>}
      {catalogueUnavailable && <p>Venue listings are temporarily unavailable.</p>}
    </div>
  </section>;
}
