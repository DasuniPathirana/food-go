"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Box, ChevronDown, MapPin, Navigation2, Satellite, ScanLine } from "lucide-react";
import { atlasStops, geographicPoint, pointDirections } from "@/lib/atlas-places";
import { ATLAS_AERIAL, ATLAS_SATELLITE, ATLAS_CORNERS, ATLAS_PLACES, ATLAS_ATTRIBUTION, ATLAS_SATELLITE_DATE } from "@/lib/melbourne-atlas";
import type { CatalogueVenue } from "@/lib/catalogue-contracts";
import type { AtlasSelection } from "./atlas-canvas";
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
  const stops = useMemo(() => atlasStops(ATLAS_PLACES, venues), [venues]);
  const [selected, setSelected] = useState<AtlasSelection | null>(null);
  const [imagery, setImagery] = useState<"aerial" | "satellite">("aerial");
  const [threeD, setThreeD] = useState(true);
  const [renderer, setRenderer] = useState<"loading" | "ready" | "local">("loading");
  const [providerFailed, setProviderFailed] = useState(false);
  const active = stops.find(stop => stop.id === selected?.id);
  const remote = !!process.env.NEXT_PUBLIC_MAPTILER_KEY && imagery === "satellite" && renderer !== "local" && !providerFailed;
  const shown = useMemo(() => remote ? stops : stops.filter(withinImage), [stops, remote]);
  const onSelect = useCallback((point: AtlasSelection) => { if (geographicPoint(point)) setSelected(point); }, []);
  const ready = useCallback(() => setRenderer("ready"), []);
  const unavailable = useCallback(() => setRenderer("local"), []);
  const satelliteUnavailable = useCallback(() => setProviderFailed(true), []);
  const directions = selected && pointDirections(selected);

  useLayoutEffect(() => {
    if (!frame.current) return;
    const node = frame.current;
    const measure = () => node.style.setProperty("--atlas-top", `${Math.ceil(node.getBoundingClientRect().top + window.scrollY)}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, []);

  return <section className={styles.atlas} aria-label="Geographic exploration">
    <div className={styles.bar}>
      <MapModeNav geographic basePath={basePath} />
      <div className={styles.layers} role="group" aria-label="Imagery and perspective">
        <button type="button" aria-pressed={imagery === "aerial"} onClick={() => setImagery("aerial")}><ScanLine size={16} />Aerial</button>
        <button type="button" aria-pressed={imagery === "satellite"} onClick={() => setImagery("satellite")}><Satellite size={16} />Satellite</button>
        <button type="button" className={styles.depth} aria-label="3D buildings" aria-pressed={threeD} onClick={() => setThreeD(value => !value)}><Box size={16} />3D</button>
      </div>
    </div>
    <div ref={frame} className={styles.stage}>
      <aside className={styles.guide}>
        <h1>Melbourne</h1>
        <p className={styles.coverage}>Central city</p>
        <div className={styles.list}>
          <h2>Places</h2>
          {stops.map(stop => <button key={stop.id} type="button" onClick={() => onSelect(stop)} aria-pressed={active?.id === stop.id}>
            <MapPin size={17} /><span><strong>{stop.name}</strong><small>{stop.href ? `Published · ${stop.area}` : "City landmark"}</small></span><ArrowUpRight size={14} />
          </button>)}
        </div>
        <label className={styles.placeSelect}><MapPin size={16} />
          <select aria-label="Choose a real place" value={active?.id ?? ""} onChange={event => {
            const stop = stops.find(item => item.id === event.target.value);
            if (stop) onSelect(stop);
          }}><option value="" disabled>Choose a place</option>{stops.map(stop => <option key={stop.id} value={stop.id}>{stop.name}</option>)}</select>
          <ChevronDown size={14} />
        </label>
        <div className={styles.guideFoot}><Navigation2 size={22} /><p>Select a place or tap the map to drop a pin.</p></div>
      </aside>
      <div className={styles.mapColumn}>
        <div className={styles.scene} style={{ backgroundImage: `url("${imagery === "aerial" ? ATLAS_AERIAL : ATLAS_SATELLITE}")` }}>
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
    </div>
    {active && (active.members.length > 1 || active.href) && <div className={styles.members}>{active.members.map(member => <div key={member.id}>
      {member.href ? <Link href={member.href}>{member.name}<ArrowUpRight size={14} /></Link> : <strong>{member.name}</strong>}<span>{member.area}</span>
    </div>)}</div>}
    <div className={styles.credits}>
      <p>{providerFailed && imagery === "satellite" ? "Showing the local Melbourne satellite image. " : ""}City of Melbourne aerial survey and building heights, 2020. {imagery === "satellite" && !remote && `Copernicus satellite imagery, ${ATLAS_SATELLITE_DATE}. `}<a href={ATLAS_ATTRIBUTION} target="_blank" rel="noopener noreferrer">Map sources and coverage<ArrowUpRight size={13} /></a></p>
      {catalogueUnavailable && <p>Published Food Go venues are temporarily unavailable. City landmarks are available.</p>}
      {basePath === "/" && <Link href="/?view=catalogue">Search the venue catalogue <ArrowUpRight size={14} /></Link>}
    </div>
  </section>;
}
