"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Bookmark, Camera, CalendarCheck, Compass, MapPin, Navigation, ScanLine, Sparkles, X } from "lucide-react";
import type { AtlasCanvasProps, AtlasImagery, AtlasPlace, AtlasSelection } from "./atlas-canvas";
import { FoodGoHud, type ExploreFilterKind } from "./explore/foodgo-hud";
import { MallModal } from "./mall-modal";
import { ARRewardView } from "./ar-reward-view";
import { AvatarCustomizer } from "./avatar-customizer";
import { useJourney } from "./journey-provider";
import { useAvatarPreferences } from "@/lib/avatar-preferences";
import { useExplorerLocation } from "./use-explorer-location";
import { useStreetWalk } from "./use-street-walk";
import type { CatalogueVenue } from "@/lib/catalogue-contracts";
import { isInsideMelbournePilot } from "@food-go/domain";
import type { ExplorerPerspective } from "@/lib/explorer-camera";
import { mapDistance, type MapPoint } from "@/lib/map-game";
import type { LiveMall, VenueAppearance, WorldLoot, WorldLootClaim } from "@/lib/world-data";
import styles from "./geographic-explore.module.css";

const Canvas = dynamic(() => import("./atlas-canvas").then(m => m.AtlasCanvas), { ssr: false });
const FlatCanvas = dynamic(() => import("./world-map-fallback").then(m => m.WorldMapFallback), { ssr: false });

const MELBOURNE_GATEWAY: MapPoint = { longitude: 144.9665, latitude: -37.8152 };

export function GeographicExplore(_props: { basePath?: string } = {}) {
  const journey = useJourney();
  const { preferences } = useAvatarPreferences();
  const [places, setPlaces] = useState<AtlasPlace[]>([]);
  const [malls, setMalls] = useState<LiveMall[]>([]);
  const [loots, setLoots] = useState<WorldLoot[]>([]);
  const [myClaims, setMyClaims] = useState<WorldLootClaim[]>([]);
  const [appearances, setAppearances] = useState<Record<string, VenueAppearance>>({});
  const [activeQuestTitle, setActiveQuestTitle] = useState("Explore Melbourne Pilot to discover your next bite");

  const [query, setQuery] = useState("");
  const [filterKind, setFilterKind] = useState<ExploreFilterKind>("all");
  const [perspective, setPerspective] = useState<ExplorerPerspective>("third");
  const [imagery, setImagery] = useState<AtlasImagery>("streets");
  const [follow, setFollow] = useState(true);
  const [refocus, setRefocus] = useState(0);
  const [zoomDelta, setZoomDelta] = useState(0);
  const [webglFailed, setWebglFailed] = useState(false);
  const [statusNotice, setStatusNotice] = useState("");

  const [selected, setSelected] = useState<AtlasSelection | null>(null);
  const [selectedMall, setSelectedMall] = useState<LiveMall | null>(null);
  const [selectedLoot, setSelectedLoot] = useState<WorldLoot | null>(null);
  const [arTarget, setArTarget] = useState<WorldLoot | null>(null);
  const [avatarOpen, setAvatarOpen] = useState(false);

  const [reserveOpen, setReserveOpen] = useState(false);
  const [reserveDate, setReserveDate] = useState("");
  const [reserveParty, setReserveParty] = useState(2);
  const [reserveName, setReserveName] = useState("");
  const [reserveNotes, setReserveNotes] = useState("");
  const [reserveStatus, setReserveStatus] = useState("");
  const [reserveBusy, setReserveBusy] = useState(false);

  const [lootBusy, setLootBusy] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const celebrateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const gps = useExplorerLocation(MELBOURNE_GATEWAY);
  const liveInsidePilot = gps.mode === "live" && isInsideMelbournePilot(gps.position);
  const [pilotPosition, setPilotPosition] = useState<MapPoint>(MELBOURNE_GATEWAY);
  const [pilotHeading, setPilotHeading] = useState(0);
  const [joyWalking, setJoyWalking] = useState(false);
  const [trailCoords, setTrailCoords] = useState<[number, number][]>([
    [MELBOURNE_GATEWAY.longitude, MELBOURNE_GATEWAY.latitude],
  ]);

  const streetWalk = useStreetWalk({
    start: liveInsidePilot ? gps.position : pilotPosition,
    enabled: true,
    initialHeading: pilotHeading,
  });

  const activePlayerPoint = liveInsidePilot
    ? gps.position
    : streetWalk.phase === "walking"
    ? streetWalk.position
    : pilotPosition;
  const activeHeading = liveInsidePilot
    ? gps.heading ?? pilotHeading
    : streetWalk.phase === "walking"
    ? streetWalk.heading
    : pilotHeading;
  const isWalkingNow = liveInsidePilot ? gps.walking : streetWalk.phase === "walking" || joyWalking;

  // Fetch live published Melbourne Pilot venues + live Malls/Loots/Appearances + Active Quest
  const refreshWorldData = useCallback(async () => {
    const fetchWithRetry = async (url: string, init?: RequestInit) => {
      const first = await fetch(url, init);
      if (first.ok) return first.json();
      await new Promise(resolve => setTimeout(resolve, 650));
      const second = await fetch(url, init);
      return second.ok ? second.json() : null;
    };
    try {
      const [venuesRes, worldRes] = await Promise.all([
        fetchWithRetry("/api/venues?state=VIC&limit=50", { cache: "no-store" }),
        fetchWithRetry("/api/world", { credentials: "same-origin", cache: "no-store" }),
      ]);
      const rawVenues: CatalogueVenue[] = Array.isArray(venuesRes?.data) ? venuesRes.data : [];
      const pilotPlaces: AtlasPlace[] = rawVenues
        .filter((v): v is CatalogueVenue & { coordinates: { longitude: number; latitude: number } } =>
          Boolean(v.coordinates && isInsideMelbournePilot(v.coordinates))
        )
        .map(v => ({
          ...v,
          longitude: v.coordinates.longitude,
          latitude: v.coordinates.latitude,
        }));
      setPlaces(pilotPlaces);
      if (worldRes) {
        if (Array.isArray(worldRes.malls)) setMalls(worldRes.malls);
        if (Array.isArray(worldRes.loots)) setLoots(worldRes.loots);
        if (Array.isArray(worldRes.myClaims)) setMyClaims(worldRes.myClaims);
        if (worldRes.appearances && typeof worldRes.appearances === "object") setAppearances(worldRes.appearances);
      }
      if (journey?.signedIn) {
        const advRes = await fetch("/api/adventure", { credentials: "same-origin", cache: "no-store" });
        if (advRes.ok) {
          const adv = await advRes.json();
          const accepted = adv?.quests?.find?.(
            (q: { participation?: { completedAt: string | null } | null }) => q.participation && !q.participation.completedAt
          );
          if (accepted?.title) setActiveQuestTitle(accepted.title);
        }
      }
    } catch {
      // Preserve loaded items cleanly
    }
  }, [journey?.signedIn]);

  useEffect(() => {
    void refreshWorldData();
  }, [refreshWorldData]);

  useEffect(() => {
    if (journey?.data?.displayName && !reserveName) setReserveName(journey.data.displayName);
  }, [journey?.data?.displayName, reserveName]);

  useEffect(() => {
    setTrailCoords(prev => {
      const last = prev[prev.length - 1];
      if (!last) return [[activePlayerPoint.longitude, activePlayerPoint.latitude]];
      if (mapDistance({ longitude: last[0], latitude: last[1] }, activePlayerPoint) < 4) return prev;
      return [...prev.slice(-28), [activePlayerPoint.longitude, activePlayerPoint.latitude]];
    });
  }, [activePlayerPoint.longitude, activePlayerPoint.latitude]);

  const stepPlayer = useCallback((dxMeters: number, dzMeters: number) => {
    const metersPerLat = 111320;
    const metersPerLng = 111320 * Math.cos((-37.8136 * Math.PI) / 180);
    setPilotPosition(curr => {
      const next = {
        longitude: curr.longitude + dxMeters / metersPerLng,
        latitude: curr.latitude + dzMeters / metersPerLat,
      };
      return isInsideMelbournePilot(next) ? next : curr;
    });
    const deg = (Math.atan2(dxMeters, dzMeters) * 180) / Math.PI;
    setPilotHeading((deg + 360) % 360);
    setFollow(true);
  }, []);

  useEffect(() => {
    if (perspective === "first") return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const step = e.shiftKey ? 10 : 6;
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
        e.preventDefault();
        stepPlayer(0, step);
      } else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
        e.preventDefault();
        stepPlayer(0, -step);
      } else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        e.preventDefault();
        stepPlayer(-step, 0);
      } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        e.preventDefault();
        stepPlayer(step, 0);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [perspective, stepPlayer]);

  const joyTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const joyVec = useRef({ dx: 0, dy: 0 });
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });

  function startJoyLoop() {
    if (joyTimer.current) return;
    setJoyWalking(true);
    joyTimer.current = setInterval(() => {
      const { dx, dy } = joyVec.current;
      if (Math.hypot(dx, dy) > 0.12) {
        stepPlayer(dx * 3.8, -dy * 3.8);
      }
    }, 90);
  }
  function stopJoyLoop() {
    if (joyTimer.current) {
      clearInterval(joyTimer.current);
      joyTimer.current = null;
    }
    joyVec.current = { dx: 0, dy: 0 };
    setKnobOffset({ x: 0, y: 0 });
    setJoyWalking(false);
  }
  useEffect(() => () => stopJoyLoop(), []);

  const filteredPlaces = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (filterKind === "mall" || filterKind === "loot") return [];
    return places.filter(v => {
      if (filterKind !== "all" && (v.type as string) !== filterKind) return false;
      if (!q) return true;
      return `${v.name} ${v.cuisine} ${v.suburb}`.toLowerCase().includes(q);
    });
  }, [places, filterKind, query]);

  const filteredMalls = useMemo(() => {
    if (filterKind !== "all" && filterKind !== "mall") return [];
    const q = query.trim().toLowerCase();
    return q ? malls.filter(m => `${m.name} ${m.address}`.toLowerCase().includes(q)) : malls;
  }, [malls, filterKind, query]);

  const filteredLoots = useMemo(() => {
    if (filterKind !== "all" && filterKind !== "loot") return [];
    const q = query.trim().toLowerCase();
    return q ? loots.filter(l => `${l.title} ${l.venueName ?? ""}`.toLowerCase().includes(q)) : loots;
  }, [loots, filterKind, query]);

  const selectedVenue = useMemo(
    () => (selected?.kind === "venue" ? places.find(p => p.id === selected.id) ?? null : null),
    [selected, places]
  );

  function triggerCelebrateToast(message: string) {
    setStatusNotice(message);
    setCelebrating(true);
    if (celebrateTimer.current) clearTimeout(celebrateTimer.current);
    celebrateTimer.current = setTimeout(() => setCelebrating(false), 3200);
  }

  async function grabMapLoot(loot: WorldLoot) {
    if (!journey?.signedIn || lootBusy) return;
    setLootBusy(true);
    setStatusNotice("");
    try {
      const res = await fetch("/api/world/claim", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lootId: loot.id,
          latitude: activePlayerPoint.latitude,
          longitude: activePlayerPoint.longitude,
          arScanConfirmed: false,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Move closer to grab this reward.");
      triggerCelebrateToast(`Grabbed ${loot.title}! +${payload.xpAwarded} XP and +${payload.coinsAwarded} Coins.`);
      window.dispatchEvent(new Event("food-go:progress"));
      setSelectedLoot(null);
      await refreshWorldData();
    } catch (err) {
      setStatusNotice(err instanceof Error ? err.message : "Could not grab reward.");
    } finally {
      setLootBusy(false);
    }
  }

  async function submitReservation(e: FormEvent) {
    e.preventDefault();
    if (!selectedVenue || reserveBusy) return;
    setReserveBusy(true);
    setReserveStatus("");
    try {
      const isoDate = new Date(reserveDate).toISOString();
      const res = await fetch("/api/reservations", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          venueId: selectedVenue.id,
          reservedFor: isoDate,
          partySize: reserveParty,
          guestName: reserveName.trim(),
          notes: reserveNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Could not submit reservation.");
      setReserveStatus("Reservation sent to the restaurant for approval. Track updates in Passport.");
      setReserveNotes("");
    } catch (err) {
      setReserveStatus(err instanceof Error ? err.message : "Check the date and guest details.");
    } finally {
      setReserveBusy(false);
    }
  }

  const canvasProps: AtlasCanvasProps = {
    places: filteredPlaces,
    malls: filteredMalls,
    loots: filteredLoots,
    appearances,
    trailCoords,
    celebrating,
    selectedLootId: selectedLoot?.id ?? null,
    selected,
    player: {
      longitude: activePlayerPoint.longitude,
      latitude: activePlayerPoint.latitude,
      accuracy: gps.accuracy,
      heading: activeHeading,
      walking: isWalkingNow,
      gaitMetres: gps.distanceMetres + streetWalk.sessionMetres,
      live: liveInsidePilot,
      avatar: preferences.avatarId,
    },
    imagery,
    threeD: true,
    perspective,
    follow,
    refocus,
    zoomDelta,
    route: streetWalk.route,
    routeStopId: selectedVenue?.id ?? null,
    revealedCells: [],
    onSelect: sel => {
      setSelectedMall(null);
      setSelectedLoot(null);
      setReserveOpen(false);
      setSelected(sel);
    },
    onSelectMall: mall => {
      setSelected(null);
      setSelectedLoot(null);
      setSelectedMall(mall);
    },
    onSelectLoot: loot => {
      setSelected(null);
      setSelectedMall(null);
      setSelectedLoot(loot);
    },
    onPickRouteDestination: pt => {
      if (isInsideMelbournePilot(pt)) {
        void streetWalk.walkTo(pt);
      } else {
        setStatusNotice("Melbourne CBD Pilot only. Outer regions are coming soon.");
      }
    },
    onFollowChange: setFollow,
    onPerspectiveChange: setPerspective,
    onWebglFallback: () => setWebglFailed(true),
  };

  const selectedLootDist = selectedLoot ? mapDistance(activePlayerPoint, selectedLoot.coordinates) : 0;
  const lootInRange = selectedLoot ? selectedLootDist <= Math.max(selectedLoot.radiusMetres, 85) : false;

  return (
    <main className={styles.atlas} aria-label="Geographic exploration">
      <section className={styles.scene}>
        {webglFailed ? <FlatCanvas {...canvasProps} /> : <Canvas {...canvasProps} />}

        <FoodGoHud
          query={query}
          onQueryChange={setQuery}
          activeFilter={filterKind}
          onFilterChange={setFilterKind}
          perspective={perspective}
          onPerspectiveToggle={() => {
            setFollow(true);
            setPerspective(curr => (curr === "third" ? "first" : curr === "first" ? "overhead" : "third"));
          }}
          activeQuestTitle={activeQuestTitle}
          activeQuestProgress={{ current: journey?.data?.visits.length ?? 0, target: 3 }}
          locationName={liveInsidePilot ? "Melbourne Pilot · GPS Live" : "Melbourne Pilot · Coming Soon Outside"}
          threeD={imagery === "streets"}
          onToggleThreeD={() => setImagery(curr => (curr === "streets" ? "satellite" : "streets"))}
          onRecenter={() => {
            setFollow(true);
            setRefocus(v => v + 1);
            gps.enable();
          }}
          onZoomIn={() => setZoomDelta(d => d + 1)}
          onZoomOut={() => setZoomDelta(d => d - 1)}
          onOpenAvatar={() => setAvatarOpen(true)}
          venues={places}
          malls={malls}
          loots={loots}
          recentClaims={myClaims}
          onPickVenue={v => {
            if (!v.coordinates) return;
            setSelectedMall(null);
            setSelectedLoot(null);
            setSelected({
              kind: "venue",
              id: v.id,
              name: v.name,
              longitude: v.coordinates.longitude,
              latitude: v.coordinates.latitude,
            });
            setPilotPosition({ longitude: v.coordinates.longitude, latitude: v.coordinates.latitude });
            setFollow(true);
            setRefocus(r => r + 1);
          }}
          onPickMall={m => {
            setSelected(null);
            setSelectedLoot(null);
            setSelectedMall(m);
          }}
          onPickLoot={l => {
            setSelected(null);
            setSelectedMall(null);
            setSelectedLoot(l);
            setFollow(true);
            setRefocus(r => r + 1);
          }}
        />

        {/* ANALOG FINE-NAVIGATION THUMBSTICK */}
        <div className={styles.joypadDock}>
          <div
            className={styles.joystick}
            role="application"
            aria-label="Walk explorer joystick. Drag to navigate streets or use WASD keys."
            onPointerDown={e => {
              e.currentTarget.setPointerCapture(e.pointerId);
              const rect = e.currentTarget.getBoundingClientRect();
              const dx = Math.max(-1, Math.min(1, (e.clientX - (rect.left + rect.width / 2)) / 32));
              const dy = Math.max(-1, Math.min(1, (e.clientY - (rect.top + rect.height / 2)) / 32));
              joyVec.current = { dx, dy };
              setKnobOffset({ x: dx * 22, y: dy * 22 });
              startJoyLoop();
            }}
            onPointerMove={e => {
              if (e.buttons !== 1 && e.pointerType === "mouse") return;
              const rect = e.currentTarget.getBoundingClientRect();
              const dx = Math.max(-1, Math.min(1, (e.clientX - (rect.left + rect.width / 2)) / 32));
              const dy = Math.max(-1, Math.min(1, (e.clientY - (rect.top + rect.height / 2)) / 32));
              joyVec.current = { dx, dy };
              setKnobOffset({ x: dx * 22, y: dy * 22 });
            }}
            onPointerUp={stopJoyLoop}
            onPointerCancel={stopJoyLoop}
          >
            <div className={styles.joystickKnob} style={{ transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)` }} />
          </div>
          <span className={styles.joystickHint}>{perspective === "first" ? "1st Person · Look & Walk" : "Walk Joystick"}</span>
        </div>

        {statusNotice && (
          <div className={styles.modeStatus} role="status">
            {statusNotice}
          </div>
        )}

        {/* CONTEXTUAL VENUE DETAIL & RESERVATION SHEET */}
        {selectedVenue && (
          <div className={styles.sheetWrap}>
            <article className={styles.contextSheet} aria-label={selectedVenue.name}>
              <div className={styles.sheetHeader}>
                <div>
                  <span className={styles.sheetBadge}>
                    <MapPin size={12} />
                    {selectedVenue.cuisine} · {Math.round(mapDistance(activePlayerPoint, selectedVenue.coordinates))} m away
                  </span>
                  <h2 className={styles.sheetTitle}>{selectedVenue.name}</h2>
                  <p style={{ fontSize: 13, color: "#4e665c", marginTop: 4 }}>
                    {selectedVenue.address}, {selectedVenue.suburb}
                  </p>
                </div>
                <button type="button" onClick={() => setSelected(null)} aria-label="Close venue panel">
                  <X size={20} />
                </button>
              </div>

              <div className={styles.sheetActions}>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => void streetWalk.walkTo(selectedVenue.coordinates)}
                >
                  <Navigation size={16} />
                  Walk Here (3D)
                </button>
                <button type="button" className="secondary-button" onClick={() => setReserveOpen(v => !v)}>
                  <CalendarCheck size={16} />
                  Reserve Table
                </button>
                <button type="button" className="secondary-button" onClick={() => void journey?.save("venue", selectedVenue.id)}>
                  <Bookmark size={16} />
                  {journey?.data?.savedVenues.includes(selectedVenue.id) ? "Saved" : "Want to Visit"}
                </button>
                <Link className="secondary-button" href={`/venues/${encodeURIComponent(selectedVenue.slug)}`}>
                  <ScanLine size={16} />
                  Menu & Codes
                </Link>
              </div>

              {reserveOpen && (
                <form className={styles.reserveBox} onSubmit={submitReservation}>
                  <strong style={{ fontSize: 13 }}>Request Table Booking (No Payment Required)</strong>
                  <div className={styles.reserveGrid}>
                    <input
                      type="datetime-local"
                      required
                      value={reserveDate}
                      onChange={e => setReserveDate(e.target.value)}
                      aria-label="Reservation date and time"
                    />
                    <input
                      type="number"
                      min={1}
                      max={20}
                      required
                      value={reserveParty}
                      onChange={e => setReserveParty(Number(e.target.value) || 2)}
                      placeholder="Guests"
                      aria-label="Party size"
                    />
                  </div>
                  <input
                    type="text"
                    required
                    minLength={2}
                    placeholder="Your name"
                    value={reserveName}
                    onChange={e => setReserveName(e.target.value)}
                  />
                  <textarea
                    rows={2}
                    placeholder="Dietary or seating notes (optional)"
                    value={reserveNotes}
                    onChange={e => setReserveNotes(e.target.value)}
                  />
                  {journey?.signedIn ? (
                    <button type="submit" className="primary-button" disabled={reserveBusy}>
                      {reserveBusy ? "Sending request…" : "Submit Reservation Request"}
                    </button>
                  ) : (
                    <Link className="primary-button" href="/auth/sign-in?next=/">
                      Sign in to book
                    </Link>
                  )}
                  {reserveStatus && (
                    <p role="status" style={{ fontSize: 12, fontWeight: 700, color: "#0b6e58" }}>
                      {reserveStatus}
                    </p>
                  )}
                </form>
              )}
            </article>
          </div>
        )}

        {/* CONTEXTUAL LOOT / GAME REWARD GRAB SHEET */}
        {selectedLoot && (
          <div className={styles.sheetWrap}>
            <article className={styles.contextSheet} aria-label={selectedLoot.title}>
              <div className={styles.sheetHeader}>
                <div>
                  <span className={styles.sheetBadge}>
                    {selectedLoot.grabMode === "ar_grab" ? <Camera size={12} /> : <Compass size={12} />}
                    {selectedLoot.source === "game_admin" ? "FoodGo Special Game Reward" : "Restaurant Loot"} ·{" "}
                    {selectedLoot.grabMode === "ar_grab" ? "AR Camera Grab" : "Map Grab"}
                  </span>
                  <h2 className={styles.sheetTitle}>{selectedLoot.title}</h2>
                  <p style={{ fontSize: 13, color: "#4e665c", marginTop: 4 }}>{selectedLoot.description}</p>
                  <p style={{ fontSize: 12, fontWeight: 800, color: "#0c5e50", marginTop: 6 }}>
                    Reward: +{selectedLoot.xpReward} XP · +{selectedLoot.coinReward} Coins · Distance: {Math.round(selectedLootDist)} m (Need within{" "}
                    {Math.max(selectedLoot.radiusMetres, 85)} m)
                  </p>
                </div>
                <button type="button" onClick={() => setSelectedLoot(null)} aria-label="Close reward card">
                  <X size={20} />
                </button>
              </div>

              <div className={styles.sheetActions}>
                {!lootInRange ? (
                  <button type="button" className="primary-button" onClick={() => void streetWalk.walkTo(selectedLoot.coordinates)}>
                    <Navigation size={16} />
                    Walk Closer to Reward
                  </button>
                ) : !journey?.signedIn ? (
                  <Link className="primary-button" href="/auth/sign-in?next=/">
                    Sign In to Grab Reward
                  </Link>
                ) : selectedLoot.grabMode === "ar_grab" ? (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => {
                      setArTarget(selectedLoot);
                      setSelectedLoot(null);
                    }}
                  >
                    <Camera size={16} />
                    Open AR Camera Scanner
                  </button>
                ) : (
                  <button type="button" className="primary-button" disabled={lootBusy} onClick={() => void grabMapLoot(selectedLoot)}>
                    <Sparkles size={16} />
                    {lootBusy ? "Grabbing…" : `Grab Map Reward (+${selectedLoot.xpReward} XP)`}
                  </button>
                )}
              </div>
            </article>
          </div>
        )}

        {selectedMall && <MallModal mall={selectedMall} onClose={() => setSelectedMall(null)} />}

        {arTarget && (
          <ARRewardView
            loot={arTarget}
            playerLocation={{
              longitude: activePlayerPoint.longitude,
              latitude: activePlayerPoint.latitude,
              accuracyMetres: gps.accuracy ?? 10,
            }}
            signedIn={Boolean(journey?.signedIn)}
            onClose={() => setArTarget(null)}
            onClaimSuccess={res => {
              triggerCelebrateToast(`AR Grabbed ${res.title}! +${res.xpAwarded} XP · +${res.coinsAwarded} Coins`);
              void refreshWorldData();
            }}
          />
        )}

        {avatarOpen && (
          <div className={styles.sheetWrap} style={{ zIndex: 180 }}>
            <AvatarCustomizer compact onClose={() => setAvatarOpen(false)} />
          </div>
        )}
      </section>
    </main>
  );
}
