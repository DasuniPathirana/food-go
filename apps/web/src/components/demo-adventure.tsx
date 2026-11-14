"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Award, Bell, BookOpen, Bookmark, Building2, Check, ChevronDown, ChevronRight, Compass, Flag, Gift, LockKeyhole, MapPin, MessagesSquare, Navigation, QrCode, RotateCcw, Search, Settings2, Sparkles, Star, Store, UserRound, X, Zap } from "lucide-react";
import { AdventureMap } from "./adventure-map";
import { DemoCollection, DemoRewards, DemoTrails } from "./market-collections";
import { DemoDeals } from "./deals";
import { CommunityFeed } from "./community-feed";
import type { CatalogueVenue } from "@/lib/catalogue-contracts";
import { DEMO_DISH_XP, DEMO_QUESTS, demoBadges, demoDay, demoQuestProgress, useDemoGame, type DemoGameAction, type DemoGameState } from "@/lib/demo-game";
import { PREVIEW_FEED_KEY } from "@/lib/feed-preview";
import { useAvatarPreferences } from "@/lib/avatar-preferences";
import { AvatarWardrobe } from "./avatar-customizer";
import { Brand } from "./brand";
import { FoodNavigation } from "./food-navigation";
import { AvatarIllustration } from "./explorer-avatar";
import { VenueDirections } from "./venue-directions";
import { venueAreaMaps } from "@/lib/directions";
import styles from "./demo-adventure.module.css";
import passportStyles from "./passport-wall.module.css";

const href = (id: string) => `/demo/${id}`;
const venueHref = (venue: CatalogueVenue) => href(`venue/${venue.id}`);
type Dispatch = (action: DemoGameAction) => DemoGameState;

function DemoDialog({ titleId, onClose, children }: { titleId: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; if (dialog && !dialog.open) dialog.showModal(); }, []);
  return <dialog ref={ref} className={styles.modal} aria-labelledby={titleId} onCancel={onClose} onClose={onClose}>{children}</dialog>;
}

function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  return <div className={styles.meter} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}><span style={{ width: `${Math.min(100, value / max * 100)}%` }} /></div>;
}
function StopActions({ venue, state, dispatch, compact = false }: { venue: CatalogueVenue; state: DemoGameState; dispatch: Dispatch; compact?: boolean }) {
  const [confirmation, setConfirmation] = useState<"visit" | "dish" | null>(null);
  const visited = state.visited.some((id) => id === venue.id), collected = state.collected.some((id) => id === venue.id);
  const routing = state.route?.venueId === venue.id;
  const nextQuest = DEMO_QUESTS.find((quest) => state.activeQuests.includes(quest.id));
  const nextStop = nextQuest?.stops.find((id) => !state.visited.includes(id));
  return <section className={`${styles.stopPanel} ${compact ? styles.compactStop : ""}`} aria-label={`Adventure at ${venue.name}`}>
    <div className={styles.stopIdentity}><Image src={venue.image} alt={venue.imageAlt} width={150} height={120} /><div><h2>{venue.name}</h2>{venue.building && <span className={styles.cuisine}>{venue.building.name} · {venue.building.level} · {venue.building.unit}</span>}<p>{venue.cuisine} · {venue.suburb}</p></div><Link className={styles.roundButton} href={venueHref(venue)} aria-label={`Open ${venue.name}`}><ArrowRight size={19} /></Link></div>
    <ol className={styles.steps} aria-label="Example discovery steps"><li className={routing || visited ? styles.done : ""}><Navigation size={15} />Route</li><li className={visited ? styles.done : ""}><QrCode size={15} />Check in</li><li className={collected ? styles.done : ""}><Award size={15} />Collect dish</li></ol>
    {confirmation === "visit" && !visited ? <div className={styles.confirmation}><QrCode size={42} /><div><strong>Simulated QR check-in</strong><p>No camera, GPS or real visit is checked. Confirm the example visit for 50 demo XP.</p><div className={styles.buttonRow}><button className={styles.primary} onClick={() => { dispatch({ type: "check-in", venueId: venue.id }); setConfirmation(null); }}><Check size={17} />Confirm example check-in</button><button className={styles.secondary} onClick={() => setConfirmation(null)}>Cancel</button></div></div></div>
    : confirmation === "dish" && !collected ? <div className={styles.confirmation}><Award size={40} /><div><strong>Simulated staff confirmation</strong><p>{venue.dish} will enter your example FoodDex. This does not verify a purchase or unlock a real reward.</p><div className={styles.buttonRow}><button className={styles.primary} onClick={() => { dispatch({ type: "collect-dish", venueId: venue.id }); setConfirmation(null); }}><Check size={17} />Confirm example dish</button><button className={styles.secondary} onClick={() => setConfirmation(null)}>Cancel</button></div></div></div>
    : <div className={styles.actionRow}>{!visited ? <>
      {routing && state.route?.stage === "arrived" ? <button className={styles.primary} onClick={() => setConfirmation("visit")}><QrCode size={18} />Simulate QR check-in <span>+50 XP</span></button>
      : routing ? <><button className={styles.primary} onClick={() => dispatch({ type: "arrive" })}><MapPin size={18} />Arrive at this example stop</button><button className={styles.secondary} onClick={() => dispatch({ type: "cancel-route" })}>Cancel route</button></>
      : <button className={styles.primary} onClick={() => dispatch({ type: "route", venueId: venue.id })}><Navigation size={18} />Let&apos;s go here <ArrowRight size={17} /></button>}
      <p>{routing ? "Move around the illustrated map, then use the arrival action." : "Start an example route to begin this discovery."}</p>
    </> : <><span className={styles.success}><Check size={17} />Example visit collected</span>{collected ? <><span className={styles.success}><Award size={17} />Dish in your FoodDex</span>{nextStop && <Link className={styles.primary} href={href("explore")} onClick={() => dispatch({ type: "route", venueId: nextStop })}>Next trail stop <ArrowRight size={17} /></Link>}{!nextStop && nextQuest && <Link className={styles.primary} href={href("quests")}>Claim your trail reward <Gift size={17} /></Link>}</> : <button className={styles.primary} onClick={() => setConfirmation("dish")}><Sparkles size={18} />I tried this example dish <span>+{DEMO_DISH_XP[venue.id as keyof typeof DEMO_DISH_XP]} XP</span></button>}</>}</div>}
    {compact && <VenueDirections venue={venue} />}
  </section>;
}

export function DemoAdventure({ screen, venueId, venues, initialWall = "public", initialPost }: { screen: string; venueId?: string; venues: CatalogueVenue[]; initialWall?: string; initialPost?: string }) {
  const { preferences: avatarPreferences } = useAvatarPreferences();
  const { state, dispatch: send, progress, ready, notice, persistent } = useDemoGame();
  const path = usePathname();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Everything");
  const [mapOptionsOpen, setMapOptionsOpen] = useState(false);
  const mapOptionsToggle = useRef<HTMLButtonElement>(null);
  function closeMapOptions() {
    setMapOptionsOpen(false);
    mapOptionsToggle.current?.focus({ preventScroll: true });
  }
  const [selectedId, setSelectedId] = useState<string | undefined>(venueId);
  const [notifications, setNotifications] = useState(false);
  const [editing, setEditing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [name, setName] = useState("");
  const activeQuest = DEMO_QUESTS.find((quest) => state.activeQuests.includes(quest.id));
  const mission = activeQuest || DEMO_QUESTS[2];
  const completeQuest = activeQuest && demoQuestProgress(state, activeQuest.id) === activeQuest.stops.length;
  const today = demoDay(new Date());
  const dailyClaimed = ready && state.ledger.some((award) => award.kind === "daily" && award.day === today);
  const badges = demoBadges(state);
  const needle = query.trim().toLocaleLowerCase("en-AU");
  const filtered = venues.filter((venue) => (!needle || `${venue.name} ${venue.dish} ${venue.cuisine} ${venue.suburb} ${venue.building?.name || ""}`.toLocaleLowerCase("en-AU").includes(needle)) && (category === "Everything" || (category === "Cafes" && venue.type === "cafe") || (category === "Pizza" && venue.tags.includes("Pizza")) || (category === "In the arcade" && venue.building)));
  const selected = venues.find((venue) => venue.id === (selectedId || state.route?.venueId));
  const venue = venues.find((entry) => entry.id === venueId);
  function dispatch(action: DemoGameAction) {
    const next = send(action);
    if (action.type === "route" || action.type === "start-quest") setSelectedId(next.route?.venueId);
    if (action.type === "check-in") setSelectedId(action.venueId);
    return next;
  }
  function saveName(event: FormEvent<HTMLFormElement>) { event.preventDefault(); dispatch({ type: "name", name }); setEditing(false); }
  function reset() {
    try { localStorage.removeItem(PREVIEW_FEED_KEY); } catch { /* Game reset still works without storage. */ }
    dispatch({ type: "reset" }); setResetting(false); setSelectedId(undefined); setQuery(""); setCategory("Everything");
  }
  const completedStops = demoQuestProgress(state, mission.id);
  const missionPanel = <Link className={styles.missionPill} href={href("quests")} aria-label={`${mission.title}, ${completedStops} of ${mission.stops.length} trail stops complete`}>
    <span className={styles.missionIcon}><Flag size={18} /></span>
    <strong>{mission.title}</strong>
    <span className={styles.missionCount}>{completedStops}<span>/</span>{mission.stops.length}<ChevronRight size={15} /></span>
  </Link>;
  const selectedArea = selected ? venueAreaMaps(selected) : null;
  const mapShortcut = selected && selectedArea ? <a className={`${styles.missionPill} ${styles.mapsPill}`} href={selectedArea.googleMaps} target="_blank" rel="noopener noreferrer" aria-label={`Open real ${selectedArea.area} area in Google Maps`}><Navigation size={18} /><span><strong>{selected.name}</strong><small>Google Maps · {selectedArea.area} area</small></span><ArrowRight size={16} /></a> : missionPanel;
  const overlay = <div className={styles.mapOverlay} onKeyDown={(event) => { if (event.key === "Escape" && mapOptionsOpen) { event.preventDefault(); closeMapOptions(); } }}>
    <div className={styles.searchBox}><Search size={21} /><input aria-label="Search example venues and dishes" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search coffee, pizza, a place…" />{query && <button onClick={() => setQuery("")} aria-label="Clear search"><X size={18} /></button>}<button ref={mapOptionsToggle} className={styles.mapOptionsToggle} aria-label="Map filters and selected place" aria-expanded={mapOptionsOpen} aria-controls="demo-map-options" onClick={() => setMapOptionsOpen((open) => !open)}><Settings2 size={19} /></button></div>
    <div id="demo-map-options" className={`${styles.mapOptions} ${mapOptionsOpen ? styles.mapOptionsOpen : ""}`}>
      <div className={styles.filters} aria-label="Example venue filters">{["Everything", "Cafes", "Pizza", "In the arcade"].map((item) => <button key={item} className={category === item ? styles.filterActive : ""} onClick={() => { setCategory(item); closeMapOptions(); }} aria-pressed={category === item}>{item === "In the arcade" && <Building2 size={14} />}{item}</button>)}</div>{mapShortcut}
    </div>
  </div>;
  const banner = <div className={styles.demoBanner}>
    <span><span className={styles.demoDot} />Demo neighbourhood</span>
    <p>Fictional places. Your discoveries stay on this browser.</p>
    <div className={styles.guideLinks}>
      <Link href={href("quests")}><Flag size={13} />Food trails</Link>
      <Link href={href("rewards")}><Gift size={13} />Rewards</Link>
    </div>
  </div>;

  return <div className={styles.demo}>
    <a className={styles.skip} href="#demo-main">Skip to content</a>
    <div className={styles.workspace}>
      <header className={styles.header}>
        <Link href={href("explore")} className={styles.mastheadBrand} aria-label="Food Go Explore"><Brand /></Link>
        <div className={styles.location}><MapPin size={18} /><span>Melbourne<small>Illustrated neighbourhood</small></span></div>
        <FoodNavigation pathname={path} demo />
        <div className={styles.headerActions}>
          <Link className={styles.xpPill} href={href("passport")} aria-label={`Open Passport, ${progress.xp} demo XP`}>
            <Zap size={17} fill="currentColor" aria-hidden="true" /><strong>{progress.xp}</strong><span>XP</span>
          </Link>
          <button className={styles.bell} aria-label="Demo notifications" aria-expanded={notifications} onClick={() => setNotifications(!notifications)}><Bell size={21} /></button>
          <Link href={href("passport")} className={styles.avatar} aria-label={`Open ${state.name}'s demo passport, level ${progress.level}`}>
            <AvatarIllustration avatarId={avatarPreferences.avatarId} className={styles.avatarPortrait} /><span>{progress.level}</span>
          </Link>
        </div>
      </header>

      {notifications && <section className={styles.notifications} aria-label="Demo notifications"><div className={styles.sectionTitle}><h2>Good things on your radar</h2><button className={styles.roundButton} onClick={() => setNotifications(false)} aria-label="Close notifications"><X size={18} /></button></div><Link href={href("quests")} onClick={() => setNotifications(false)}><Flag size={21} /><span><strong>{completeQuest ? "Your trail reward is ready" : mission.title}</strong><small>{completeQuest ? "Open food trails and claim your example XP." : "Open your trail and choose the next stop."}</small><ArrowRight size={16} /></span></Link><Link href={href("rewards")} onClick={() => setNotifications(false)}><Gift size={21} /><span><strong>{dailyClaimed ? "Daily boost collected" : "25 demo XP is waiting"}</strong><small>Daily claims use the Australia/Sydney calendar.</small></span></Link></section>}
      <main id="demo-main" className={styles.main} key={path}>
        {screen === "explore" && <>
          <div className={styles.mapWrap}><AdventureMap selectionPanel={false} explorerName={state.name} demoVenues={filtered} selected={selected?.id} onSelect={(id) => setSelectedId(id)} overlay={overlay} routeVenueId={state.route?.venueId} routeArrived={state.route?.stage === "arrived"} venueLink={venueHref} sheet={<div className={styles.mapRecommendations}>{filtered.map((entry) => <button key={entry.id} onClick={() => setSelectedId(entry.id)}><Image src={entry.image} alt="" width={100} height={75} /><span><strong>{entry.name}</strong><small>{entry.building ? `${entry.building.name} · ${entry.building.unit}` : entry.cuisine}</small></span><ChevronRight size={17} /></button>)}</div>} resultsLabel={`${filtered.length} example places`} /></div>
          {banner}
          {selected && <StopActions key={selected.id} venue={selected} state={state} dispatch={dispatch} compact />}
          {!filtered.length && <div className={styles.empty}><Search size={26} /><h2>No bites found yet</h2><p>Try another dish, venue or cuisine.</p><button className={styles.secondary} onClick={() => { setQuery(""); setCategory("Everything"); }}>Show every example</button></div>}
          <div className={styles.exploreBelow}><div><h2>Around the neighbourhood</h2><p>Six example places, including three shops inside Garden Arcade. Choose a stop or follow a food trail.</p></div><Link className={styles.primary} href={href("quests")}>Choose a food trail <Flag size={18} /></Link></div>
        </>}
        {screen === "venue" && venue && <div className={styles.content}><Link href={href("explore")} className={styles.back}><ArrowLeft size={17} />Back to Explore</Link><div className={styles.venueHero}><Image src={venue.image} alt={venue.imageAlt} width={1200} height={550} priority /><span className={styles.photoBadge}>Fictional example venue</span></div><div className={styles.sectionTitle}><div><h1>{venue.name}</h1><span className={styles.cuisine}>{venue.cuisine}</span><p>{venue.description}</p></div><button className={styles.secondary} onClick={() => dispatch({ type: "save-venue", venueId: venue.id })} aria-pressed={state.savedVenues.some((id) => id === venue.id)}><Bookmark size={18} fill={state.savedVenues.some((id) => id === venue.id) ? "currentColor" : "none"} />{state.savedVenues.some((id) => id === venue.id) ? "Saved" : "Save venue"}</button></div>{venue.building && <div className={styles.buildingNote}><Building2 size={23} /><div><strong>{venue.building.name}</strong><p>{venue.building.level} · {venue.building.unit}. Other shops in this building have their own check-ins and dishes.</p></div></div>}<StopActions key={venue.id} venue={venue} state={state} dispatch={dispatch} /><VenueDirections venue={venue} /><section className={styles.signature}><Image src={venue.image} alt={venue.imageAlt} width={420} height={280} /><div><h2>{venue.dish}</h2><p>Visit this example venue first, then confirm this dish separately to add it to your FoodDex.</p><span className={styles.rewardTag}><Zap size={16} />{DEMO_DISH_XP[venue.id as keyof typeof DEMO_DISH_XP]} demo XP</span><button className={styles.secondary} onClick={() => dispatch({ type: "save-dish", venueId: venue.id })} aria-pressed={state.savedDishes.some((id) => id === venue.id)}><Bookmark size={17} />{state.savedDishes.some((id) => id === venue.id) ? "Dish saved to try" : "Save dish to try"}</button></div></section><p className={styles.smallPrint}>Photography and venue details are illustrative. Exact directions are available for complete published venue listings in the connected catalogue.</p></div>}
        {(screen === "food-dex" || screen === "venue-dex") && <DemoCollection key={screen} dishes={screen === "food-dex"} venues={venues} state={state} dispatch={dispatch} xp={progress.xp} />}
        {screen === "quests" && <DemoTrails venues={venues} state={state} dispatch={dispatch} />}
        {screen === "deals" && <DemoDeals />}
        {screen === "passport" && <div className={`${styles.content} ${styles.passportPage} ${passportStyles.page}`}>
          <div className={`${styles.sectionTitle} ${passportStyles.title}`}><h1>Passport</h1><button className={styles.secondary} onClick={() => { setName(state.name); setEditing(true); }}><Settings2 size={17} />Edit profile</button></div>
          <section className={passportStyles.cover} aria-label="Explorer pass">
            <div className={passportStyles.identity}>
              <span className={passportStyles.portrait}>
                <AvatarIllustration avatarId={avatarPreferences.avatarId} className={styles.avatarPortrait} />
              </span>
              <div className={passportStyles.identityCopy}>
                <h2>{state.name}</h2>
                <p><MapPin size={15} aria-hidden="true" />Melbourne</p>
                <span className={passportStyles.level}><Star size={14} aria-hidden="true" />Level {progress.level} explorer</span>
              </div>
            </div>
            <div className={passportStyles.coverProgress}>
              <div className={passportStyles.progressHeading}>
                <span><Zap size={16} aria-hidden="true" />Demo XP</span>
                <strong>{progress.xp} <small>/ {progress.nextAt}</small></strong>
              </div>
              <Meter value={progress.intoLevel} max={250} label="Example level progress" />
              <p>{progress.remaining} XP to level {progress.level + 1}</p>
            </div>
          </section>
          <details className={passportStyles.details}>
            <summary><BookOpen size={18} /><span>Progress, badges and avatar</span><ChevronDown size={17} /></summary>
            <div className={passportStyles.detailsBody}><div className={styles.stats}><div><MapPin /><strong>{state.visited.length}</strong><span>Places discovered</span></div><div><BookOpen /><strong>{state.collected.length}</strong><span>Dishes collected</span></div><div><Flag /><strong>{state.claimedQuests.length}</strong><span>Trails completed</span></div><div><Award /><strong>{badges.filter((badge) => badge.earned).length}</strong><span>Badges earned</span></div></div><AvatarWardrobe /><Link href={href("quests")}><Flag size={18} />My food trails<ArrowRight size={16} /></Link><h2 className={styles.sectionHeading}>Your milestones</h2><div className={styles.badgeGrid}>{badges.map((badge) => <div key={badge.id} className={`${styles.badgeCard} ${badge.earned ? styles.badgeEarned : ""}`}><span>{badge.earned ? <Award size={29} /> : <LockKeyhole size={25} />}</span><strong>{badge.name}</strong><p>{badge.detail}</p><small>{badge.earned ? "Earned in this demo" : "A new adventure awaits"}</small></div>)}</div><div className={styles.sectionTitle}><h2>The discovery log</h2><Link className={styles.textButton} href={href("rewards")}>How demo XP works <ArrowRight size={15} /></Link></div><div className={styles.activity}>{state.ledger.slice(-12).reverse().map((entry) => <div key={entry.key}><span className={styles.activityIcon}>{entry.kind === "quest" ? <Flag size={19} /> : ["post", "like", "share", "comment"].includes(entry.kind) ? <MessagesSquare size={19} /> : entry.kind === "daily" ? <Gift size={19} /> : <MapPin size={19} />}</span><div><strong>{entry.kind === "visit" ? `Visited ${venues.find((item) => item.id === entry.subject)?.name}` : entry.kind === "dish" ? `Collected ${venues.find((item) => item.id === entry.subject)?.dish}` : entry.kind === "quest" ? `Completed ${DEMO_QUESTS.find((item) => item.id === entry.subject)?.title}` : entry.kind === "daily" ? "Picked up a daily boost" : entry.kind === "post" ? entry.revoked ? "Removed an example story" : "Shared an example story" : entry.kind === "like" ? "Liked a neighbour's example story" : entry.kind === "comment" ? "Added a kind example comment" : "Shared a neighbour's example story"}</strong><small>{new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", dateStyle: "medium" }).format(new Date(entry.at))}</small></div><strong className={styles.activityXp}>{entry.revoked ? "Removed" : `+${entry.amount} XP`}</strong></div>)}{!state.ledger.length && <p className={styles.smallPrint}>Your first discovery starts on Explore. Your passport begins with 320 example XP.</p>}</div><div className={styles.resetRow}><p>Ready to show the adventure again? Reset clears this browser&apos;s example game and community feed.</p><button className={styles.secondary} onClick={() => setResetting(true)}><RotateCcw size={16} />Reset demo</button></div></div>
          </details>
          <CommunityFeed preview previewName={state.name} basePath="/demo/feed" initialWall="me" presentation="passport" />
        </div>}
        {screen === "rewards" && <DemoRewards ready={ready} claimed={dailyClaimed} onCollect={() => dispatch({ type: "daily" })} />}
        {screen === "feed" && <div className={styles.feedContent}><CommunityFeed preview previewName={state.name} basePath="/demo/feed" initialWall={initialWall} initialPost={initialPost} /></div>}
      </main>
      {screen !== "explore" && banner}
      <footer className={styles.guideFooter}><Link href="/">Browse published places <ArrowRight size={15} /></Link><Link href="/help">Help and privacy</Link></footer>
      <div className={styles.status} role="status" aria-live="polite">
        {notice && <span key={notice + progress.xp} className={notice.startsWith("+") ? styles.xpReceipt : undefined}>
          {notice.startsWith("+") && <Zap size={16} fill="currentColor" aria-hidden="true" />}{notice}
        </span>}
        {!notice && !persistent && "Browser storage is unavailable. Progress lasts for this tab."}
      </div>
      <FoodNavigation pathname={path} demo mobile />
    </div>
    {editing && <DemoDialog titleId="demo-profile-title" onClose={() => setEditing(false)}><button className={styles.modalClose} aria-label="Close profile editor" onClick={() => setEditing(false)}><X size={20} /></button><h2 id="demo-profile-title">Your explorer profile.</h2><form onSubmit={saveName}><label htmlFor="demo-name">Explorer name</label><input id="demo-name" autoFocus required maxLength={40} value={name} onChange={(event) => setName(event.target.value)} /><p>This name stays in the browser demo. It does not create or edit an account.</p><div className={styles.buttonRow}><button className={styles.primary} type="submit">Save changes <Check size={17} /></button><button className={styles.secondary} type="button" onClick={() => setEditing(false)}>Cancel</button></div></form></DemoDialog>}
    {resetting && <DemoDialog titleId="demo-reset-title" onClose={() => setResetting(false)}><h2 id="demo-reset-title">Ready for the next adventure?</h2><p>This clears example visits, dishes, saved items, quests, XP, name changes and the example community feed on this browser.</p><div className={styles.buttonRow}><button className={styles.primary} onClick={reset}><RotateCcw size={17} />Reset demo</button><button className={styles.secondary} autoFocus onClick={() => setResetting(false)}>Keep exploring</button></div></DemoDialog>}
  </div>;
}
