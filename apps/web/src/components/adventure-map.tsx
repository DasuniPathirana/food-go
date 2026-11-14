"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Bookmark, Building2, ChevronDown, Compass, Footprints, Hand, LocateFixed, MapPin, Minus, Pause, PersonStanding, Play, Plus, SlidersHorizontal, X } from "lucide-react";
import type { CatalogueVenue } from "@/lib/catalogue-contracts";
import { venueHref } from "@/lib/catalogue-contracts";
import { illustratedMapStops } from "@/lib/explore-stops";
import { useAvatarPreferences } from "@/lib/avatar-preferences";
import { ExplorerAvatar } from "./explorer-avatar";
import { AvatarCustomizer, type AvatarAction } from "./avatar-customizer";
import { VenueDirections } from "./venue-directions";
import styles from "./adventure-map.module.css";

type Point = { x: number; y: number };
type Props = {
  /** Only explicitly fictional demo venues may be placed on this illustrated scene. */
  demoVenues?: CatalogueVenue[];
  selected?: string;
  onSelect?: (id: string) => void;
  overlay?: ReactNode;
  sheet?: ReactNode;
  resultsLabel?: string;
  routeVenueId?: string;
  routeArrived?: boolean;
  venueLink?: (venue: CatalogueVenue) => string;
  /** The demo supplies its own full selected-stop actions below the map. */
  selectionPanel?: boolean;
};
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const startingPlayer = { x: 54, y: 49 };
const ambience = [
  { x: 76, y: 48, icon: "avocado" }, { x: 26, y: 35, icon: "pizza" }, { x: 30, y: 74, icon: "coffee" },
];

/** The approved prototype scene. It makes no map, GPS, visit, or reward claim. */
export function AdventureMap({ demoVenues = [], selected, onSelect, overlay, sheet, resultsLabel = "Places to explore", routeVenueId, routeArrived = false, venueLink = venueHref, selectionPanel = true }: Props) {
  const id = useId();
  const frame = useRef<HTMLElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const floatingContent = useRef<HTMLDivElement>(null);
  const detailPanel = useRef<HTMLDivElement>(null);
  const panelOpener = useRef<HTMLButtonElement | null>(null);
  const toolsToggle = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ pointerId: number; origin: Point; pan: Point } | null>(null);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [player, setPlayer] = useState<Point>(startingPlayer);
  const { preferences } = useAvatarPreferences();
  const [avatarAction, setAvatarAction] = useState<AvatarAction>("idle");
  const [avatarToken, setAvatarToken] = useState(0);
  const [walking, setWalking] = useState(false);
  const actionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const walkTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [dragging, setDragging] = useState(false);
  const [paused, setPaused] = useState(false);
  const [touchDrag, setTouchDrag] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [visible, setVisible] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  const [overlayBottom, setOverlayBottom] = useState(180);
  const [sceneTop, setSceneTop] = useState(142);
  const [expanded, setExpanded] = useState<"places" | "building" | "venue" | "avatar" | null>(null);
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const immersive = Boolean(overlay);
  // Fail closed: unknown IDs and connected UUIDs never receive a fictional marker.
  const stops = illustratedMapStops(demoVenues);
  const building = stops.find((stop) => stop.isBuilding && stop.id === buildingId);
  const targetStop = building || stops.find((stop) => stop.venues.some((venue) => venue.id === selected));
  const target = !building ? targetStop?.venues.find((venue) => venue.id === selected) : undefined;
  const routeStop = routeVenueId ? stops.find((stop) => stop.venues.some((venue) => venue.id === routeVenueId)) : undefined;
  const destination = routeStop?.position || targetStop?.position;
  const panelOpen = expanded !== null && (expanded !== "building" || Boolean(building)) && (expanded !== "venue" || (selectionPanel && Boolean(target)));
  const animate = !paused && visible && pageVisible;

  useEffect(() => () => { clearTimeout(actionTimer.current); clearTimeout(walkTimer.current); }, []);
  function playAvatar(action: AvatarAction) {
    if (paused || !pageVisible) return;
    setAvatarAction(action); setAvatarToken((value) => value + 1);
    clearTimeout(actionTimer.current);
    actionTimer.current = setTimeout(() => setAvatarAction("idle"), 2800);
  }

  useEffect(() => {
    if (routeArrived && routeStop) setPlayer({ x: clamp(routeStop.position.x + 3, 8, 90), y: clamp(routeStop.position.y + 7, 8, 76) });
  }, [routeArrived, routeStop?.position.x, routeStop?.position.y]);

  useLayoutEffect(() => {
    const content = floatingContent.current;
    if (!immersive || !content) return;
    const measure = () => {
      if (viewport.current) setOverlayBottom(Math.ceil(content.getBoundingClientRect().bottom - viewport.current.getBoundingClientRect().top));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, [immersive]);

  // Fit the complete scene below the actual page chrome, including wrapped tablet navigation.
  // Document position keeps its height stable while the user scrolls to optional place details.
  useLayoutEffect(() => {
    const measure = () => {
      if (viewport.current) setSceneTop(Math.ceil(viewport.current.getBoundingClientRect().top + window.scrollY));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(Boolean(entry?.isIntersecting)));
    if (viewport.current) observer.observe(viewport.current);
    const visibility = () => setPageVisible(document.visibilityState !== "hidden");
    visibility();
    document.addEventListener("visibilitychange", visibility);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", visibility); };
  }, []);

  // Disclosure lives below the canvas: expanding content never resizes or captures the map.
  useEffect(() => {
    if (panelOpen) detailPanel.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [panelOpen, expanded, buildingId]);

  function walk(dx: number, dy: number) {
    setWalking(true); clearTimeout(walkTimer.current);
    walkTimer.current = setTimeout(() => setWalking(false), 650);
    setPlayer((position) => ({ x: clamp(position.x + dx, 8, 90), y: clamp(position.y + dy, 8, 76) }));
  }
  function closePanel() {
    setExpanded(null);
    panelOpener.current?.focus({ preventScroll: true });
  }
  function recenter() { setPan({ x: 0, y: 0 }); setZoom(1); }
  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey) return;
    const directions: Record<string, Point> = { ArrowUp: { x: 0, y: -3 }, ArrowDown: { x: 0, y: 3 }, ArrowLeft: { x: -3, y: 0 }, ArrowRight: { x: 3, y: 0 } };
    if (directions[event.key]) { event.preventDefault(); walk(directions[event.key].x, directions[event.key].y); }
    else if (["+", "=", "-", "Home"].includes(event.key)) {
      event.preventDefault();
      if (event.key === "Home") recenter();
      else setZoom((value) => clamp(value + (event.key === "-" ? -.15 : .15), .85, 1.75));
    }
  }
  function beginDrag(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0 || (event.pointerType === "touch" && !touchDrag) ||
      (event.target as Element).closest("button, a, input, select, textarea, label, form, [data-map-overlay]")) return;
    event.currentTarget.focus({ preventScroll: true });
    drag.current = { pointerId: event.pointerId, origin: { x: event.clientX, y: event.clientY }, pan };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }
  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    setPan({ x: clamp(current.pan.x + event.clientX - current.origin.x, -450, 450), y: clamp(current.pan.y + event.clientY - current.origin.y, -280, 280) });
  }
  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null; setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return <section ref={frame} style={{ "--adventure-overlay-bottom": `${overlayBottom}px`, "--adventure-scene-top": `${sceneTop}px` } as CSSProperties} className={`${styles.frame} ${overlay ? styles.immersive : ""} ${touchDrag ? styles.touchDrag : ""} ${!animate ? styles.paused : ""} ${dragging ? styles.dragging : ""}`} aria-label="Illustrated exploration playground">
    {!overlay && <div className={styles.sceneHeading}><div><strong>Take the neighbourhood for a walk.</strong><span>Interactive prototype preview</span></div>
      <button type="button" className={styles.motionButton} onClick={() => setPaused((value) => !value)} aria-pressed={paused}>
        {paused ? <Play size={15} /> : <Pause size={15} />}<span>{paused ? "Play ambient motion" : "Pause ambient motion"}</span>
      </button>
    </div>}
    <div ref={viewport} className={styles.viewport} tabIndex={0} role="region" aria-label="Illustrated Melbourne playground. Drag to explore or use the walking controls."
      aria-describedby={`${id}-instructions ${id}-boundary`} onKeyDown={keyboard} onPointerDown={beginDrag} onPointerMove={moveDrag}
      onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={() => { drag.current = null; setDragging(false); }}>
      <div className={styles["map-world"]} style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
        <Image className={styles["map-base"]} src="/images/adventure/neighbourhood.svg" alt="" fill sizes="100vw" loading="eager" draggable={false} unoptimized />
        <div className={styles.mapPlane}>
        {destination && <svg className={styles["map-route"]} viewBox="0 0 1500 1000" preserveAspectRatio="none" aria-hidden="true">
          {["#fffdf4", "#46775c"].map((stroke, index) => <path key={stroke} d={`M${player.x * 15} ${player.y * 10} L${player.x * 15} ${(player.y + destination.y) * 5} L${destination.x * 15} ${(player.y + destination.y) * 5} L${destination.x * 15} ${destination.y * 10}`}
            fill="none" stroke={stroke} strokeWidth={index ? 5 : 10} strokeDasharray={index ? "3 13" : undefined} strokeLinecap="round" strokeLinejoin="round" />)}
        </svg>}
        {stops.map((stop) => <button type="button" key={stop.id} className={`${styles["map-pin"]} ${targetStop?.id === stop.id ? styles.selected : ""}`}
          style={{ left: `${stop.position.x}%`, top: `${stop.position.y}%` }} onClick={(event) => {
            if (stop.isBuilding) { panelOpener.current = event.currentTarget; setBuildingId(stop.id); setExpanded("building"); }
            else { panelOpener.current = event.currentTarget; setBuildingId(null); setExpanded("venue"); onSelect?.(stop.venues[0].id); }
          }}
          aria-label={stop.isBuilding ? `Browse ${stop.venues.length} example ${stop.venues.length === 1 ? "shop" : "shops"} in ${stop.name}` : `Select example venue ${stop.name}`}
          aria-pressed={targetStop?.id === stop.id} aria-expanded={stop.isBuilding ? expanded === "building" && buildingId === stop.id : undefined}
          aria-controls={stop.isBuilding ? `${id}-building` : undefined}>
          <span className={styles["pin-xp"]}>{stop.isBuilding ? `${stop.venues.length} ${stop.venues.length === 1 ? "SHOP" : "SHOPS"}` : "EXAMPLE"}</span>
          <span className={`${styles["pin-photo"]} ${stop.isBuilding ? styles.buildingPhoto : ""}`}>{stop.isBuilding ? <Building2 size={29} aria-hidden="true" /> : <Image src={stop.venues[0].image} alt="" width={80} height={80} draggable={false} />}</span>
          <span className={styles["pin-label"]}>{stop.name}</span>
        </button>)}
        {ambience.map((item, index) => <span key={item.icon} className={styles["wild-token"]} style={{ left: `${item.x}%`, top: `${item.y}%`, animationDelay: `${index * -.8}s` }} aria-hidden="true">
          <Image src={`/images/adventure/${item.icon}.svg`} alt="" width={28} height={28} unoptimized draggable={false} /><span className={styles["wild-spark"]}>+</span>
        </span>)}
        <div className={`${styles.explorer} ${preferences.avatarId !== "explorer" ? styles.threeExplorer : ""}`} style={{ left: `${player.x}%`, top: `${player.y}%` }}>
          <span className={styles.radar} aria-hidden="true" /><div className={styles.avatarFigure}><ExplorerAvatar avatarId={preferences.avatarId} action={avatarAction} actionToken={avatarToken} walking={walking} animate={animate && (preferences.idleMotion || avatarAction !== "idle" || walking)} onActivate={() => playAvatar("wave")} /></div>
          <span className={styles["explorer-name"]}>PREVIEW EXPLORER</span>
        </div>
        </div>
      </div>
      {overlay && <div ref={floatingContent} className={styles.floatingContent} data-map-overlay>{overlay}</div>}
      {!overlay && <span className={styles.previewBadge}>Melbourne illustration · Interactive preview</span>}
      <div className={`${styles.utilityControls} ${toolsOpen ? styles.toolsOpen : ""}`} data-map-overlay onKeyDown={(event) => {
        if (event.key === "Escape" && toolsOpen) { event.preventDefault(); event.stopPropagation(); setToolsOpen(false); toolsToggle.current?.focus({ preventScroll: true }); }
      }}>
      <button ref={toolsToggle} type="button" className={styles.viewToolsToggle} aria-label="Map view tools" title="Map view tools" aria-expanded={toolsOpen} aria-controls={`${id}-view-tools`} onClick={() => setToolsOpen((value) => !value)}><SlidersHorizontal size={19} /></button>
      <div id={`${id}-view-tools`} className={styles.tools} aria-label="Map view controls">
        <button type="button" onClick={recenter} aria-label="Reset map view"><span className={styles.north}>N</span><Compass size={23} /></button>
        <div className={styles.zoomTools}><button type="button" onClick={() => setZoom((value) => clamp(value + .15, .85, 1.75))} disabled={zoom >= 1.75} aria-label="Zoom in"><Plus size={20} /></button>
          <button type="button" onClick={() => setZoom((value) => clamp(value - .15, .85, 1.75))} disabled={zoom <= .85} aria-label="Zoom out"><Minus size={20} /></button></div>
        <button type="button" onClick={recenter} aria-label="Recenter illustrated map"><LocateFixed size={22} /></button>
        <button type="button" className={styles.touchToggle} onClick={() => setTouchDrag((value) => !value)} aria-pressed={touchDrag} aria-label={touchDrag ? "Restore page scrolling over the map" : "Enable touch dragging of the map"}><Hand size={19} /><span>{touchDrag ? "Scroll page" : "Move map"}</span></button>
        {overlay && <button type="button" onClick={() => setPaused((value) => !value)} aria-pressed={paused} aria-label={paused ? "Play ambient motion" : "Pause ambient motion"}>{paused ? <Play size={18} /> : <Pause size={18} />}</button>}
      </div>
      <div className={styles.mapDock} data-map-overlay aria-label="Optional map panels">
        {sheet && <button type="button" id={`${id}-places-toggle`} aria-label={resultsLabel} title={resultsLabel} aria-expanded={expanded === "places"} aria-controls={`${id}-places`} onClick={(event) => { setToolsOpen(false); panelOpener.current = event.currentTarget; setExpanded(expanded === "places" ? null : "places"); }}><MapPin size={17} /><span>{resultsLabel}</span><ChevronDown size={16} /></button>}
        <button type="button" className={styles.avatarToggle} id={`${id}-avatar-toggle`} aria-label="Customise avatar" aria-expanded={expanded === "avatar"} aria-controls={`${id}-avatar`} onClick={(event) => { setToolsOpen(false); panelOpener.current = event.currentTarget; setExpanded(expanded === "avatar" ? null : "avatar"); }}><PersonStanding size={18} /><span>Avatar</span><ChevronDown size={16} /></button>
      </div>
      </div>
      <WalkingControls onWalk={walk} />
    </div>
    <div ref={detailPanel} className={styles.disclosureArea} hidden={!panelOpen} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); closePanel(); } }}>
      <div id={`${id}-avatar`} className={styles.expandedPanel} role="region" aria-labelledby={`${id}-avatar-toggle`} hidden={expanded !== "avatar"}>
        {expanded === "avatar" && <AvatarCustomizer onClose={closePanel} onAction={playAvatar} motionPaused={paused || !pageVisible} />}
      </div>
      <div id={`${id}-places`} className={styles.expandedPanel} role="region" aria-labelledby={`${id}-places-toggle`} hidden={expanded !== "places"}>
        <PanelClose onClose={closePanel} label="Collapse places" />{sheet}
      </div>
      <div className={styles.expandedPanel} role="region" aria-label="Selected example venue" hidden={!selectionPanel || expanded !== "venue" || !target}>
        {target && <><PanelClose onClose={closePanel} label="Collapse selected place" /><div className={styles.venueSelection}><Image src={target.image} alt="" width={88} height={88} /><div><h2>{target.name}</h2><p>{target.cuisine} · {target.suburb}</p><Link href={venueLink(target)}>View example <ArrowRight size={16} /></Link></div></div><VenueDirections venue={target} /></>}
      </div>
      <div id={`${id}-building`} className={styles.expandedPanel} role="region" aria-label={building ? `Shops in ${building.name}` : "Shops in this building"} hidden={expanded !== "building" || !building}>
        {building && <><PanelClose onClose={closePanel} label="Collapse shop list" /><div className={styles.buildingHeading}><Building2 size={24} /><div><h2>{building.name}</h2><p>{building.venues.length} {building.venues.length === 1 ? "example shop" : "example shops"} in one building</p></div></div>
          <div className={styles.buildingDirectory}>{Array.from(new Set(building.venues.map((venue) => venue.building?.level || "Level not supplied"))).map((level) => <section key={level}><h3>{level}</h3><ul>{building.venues.filter((venue) => (venue.building?.level || "Level not supplied") === level).map((venue) => <li key={venue.id}><Link href={venueLink(venue)}><Image src={venue.image} alt="" width={64} height={64} /><span><strong>{venue.name}</strong><span>{venue.cuisine}{venue.building?.unit ? ` · ${venue.building.unit}` : ""}</span></span><ArrowRight size={18} /></Link></li>)}</ul></section>)}</div>
          <button type="button" className={styles.allPlaces} onClick={() => { panelOpener.current = document.getElementById(`${id}-places-toggle`) as HTMLButtonElement | null; setExpanded("places"); }}>See all example places <ArrowRight size={15} /></button>
        </>}
      </div>
    </div>
    <div className={styles.caption}><p id={`${id}-instructions`}>Drag to look around. Use the arrow pad to walk. On touch screens, choose Move map to drag and Scroll page when finished. Focus the map and use arrow keys to walk, + or - to zoom, and Home to reset the view.</p>
      <p id={`${id}-boundary`}>Illustrated playground only. The explorer is not your GPS location. This scene does not show live venue positions, verify visits or award real XP.</p></div>
  </section>;
}

function PanelClose({ onClose, label }: { onClose: () => void; label: string }) {
  return <button type="button" className={styles.panelClose} onClick={onClose} aria-label={label}><X size={18} /></button>;
}

function WalkingControls({ onWalk }: { onWalk: (dx: number, dy: number) => void }) {
  return <div className={styles.walkControls} role="group" aria-label="Move the preview explorer" data-map-overlay>
    <span className={styles.walkLabel}><Footprints size={15} /><span>Walk</span></span>
    <button type="button" onClick={() => onWalk(0, -4)} aria-label="Walk north"><ArrowUp size={18} /></button>
    <button type="button" onClick={() => onWalk(-4, 0)} aria-label="Walk west"><ArrowLeft size={18} /></button>
    <button type="button" onClick={() => onWalk(0, 4)} aria-label="Walk south"><ArrowDown size={18} /></button>
    <button type="button" onClick={() => onWalk(4, 0)} aria-label="Walk east"><ArrowRight size={18} /></button>
  </div>;
}

export function AdventureVenueSheet({ venues, saved, onSave, title, example = false }: {
  venues: CatalogueVenue[]; saved: string[]; onSave: (id: string) => void; title: string; example?: boolean;
}) {
  return <><div className={styles.sheetHeading}><h2>{title}</h2><span>{venues.length} {example ? "example" : "published"} {venues.length === 1 ? "place" : "places"}</span></div>
    <div className={styles.sheetCards} aria-label={title}>{venues.map((venue) => <article key={venue.id} className={styles.sheetCard}>
      <Link href={venueHref(venue)} className={styles.sheetPhoto} tabIndex={-1} aria-hidden="true"><Image src={venue.image} alt="" width={350} height={180} sizes="(max-width:700px) 260px, 33vw" /></Link>
      <button type="button" className={styles.sheetSave} onClick={() => onSave(venue.id)} aria-label={`${saved.includes(venue.id) ? "Unsave" : "Save"} ${venue.name}`} aria-pressed={saved.includes(venue.id)}>
        <Bookmark size={16} fill={saved.includes(venue.id) ? "currentColor" : "none"} />
      </button>
      <div className={styles.sheetCopy}><span>{venue.cuisine}</span><h3><Link href={venueHref(venue)}>{venue.name}<ArrowRight size={14} /></Link></h3><p>{venue.suburb}, {venue.state}</p></div>
    </article>)}</div>
  </>;
}
