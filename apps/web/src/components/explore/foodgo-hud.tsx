"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search,
  SlidersHorizontal,
  Bell,
  Star,
  Flag,
  ChevronRight,
  Layers,
  Navigation,
  Plus,
  Minus,
  MapPin,
  ChevronDown,
  BookOpen,
  Tag,
  Compass,
  Mountain,
  Eye,
  PersonStanding,
  UserCircle2,
  X,
} from "lucide-react";
import { useJourney } from "../journey-provider";
import type { CatalogueVenue } from "@/lib/catalogue-contracts";
import type { LiveMall, WorldLoot, WorldLootClaim } from "@/lib/world-data";
import type { ExplorerPerspective } from "@/lib/explorer-camera";
import styles from "./foodgo-hud.module.css";
import geoStyles from "../geographic-explore.module.css";

export type ExploreFilterKind = "all" | "restaurant" | "cafe" | "bakery" | "mall" | "loot";

export interface FoodGoHudProps {
  query: string;
  onQueryChange: (val: string) => void;
  activeFilter: ExploreFilterKind;
  onFilterChange: (kind: ExploreFilterKind) => void;
  perspective: ExplorerPerspective;
  onPerspectiveToggle: () => void;
  activeQuestTitle?: string;
  activeQuestProgress?: { current: number; target: number };
  locationName?: string;
  threeD?: boolean;
  onToggleThreeD?: () => void;
  onRecenter?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onOpenAvatar?: () => void;
  venues?: CatalogueVenue[];
  malls?: LiveMall[];
  loots?: WorldLoot[];
  recentClaims?: WorldLootClaim[];
  onPickVenue?: (venue: CatalogueVenue) => void;
  onPickMall?: (mall: LiveMall) => void;
  onPickLoot?: (loot: WorldLoot) => void;
}

export function FoodGoHud({
  query,
  onQueryChange,
  activeFilter,
  onFilterChange,
  perspective,
  onPerspectiveToggle,
  activeQuestTitle = "Explore Melbourne Pilot to discover a food stop",
  activeQuestProgress = { current: 0, target: 1 },
  locationName = "Melbourne Pilot",
  threeD = true,
  onToggleThreeD,
  onRecenter,
  onZoomIn,
  onZoomOut,
  onOpenAvatar,
  venues = [],
  malls = [],
  loots = [],
  recentClaims = [],
  onPickVenue,
  onPickMall,
  onPickLoot,
}: FoodGoHudProps) {
  const journey = useJourney();
  const pathname = usePathname();
  const [searchFocused, setSearchFocused] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [questCollapsed, setQuestCollapsed] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth <= 640) {
      setQuestCollapsed(true);
    }
  }, []);

  const signedIn = journey?.signedIn;
  const profile = journey?.data?.progress;
  const level = profile?.level ?? 1;
  const xp = profile?.xp ?? 0;
  const coins = profile?.coins ?? 0;
  const nextLevelXp = profile?.nextLevelXp ?? 250;
  const xpPct = Math.min(100, Math.round((xp / Math.max(nextLevelXp, 1)) * 100));

  const questPct = activeQuestProgress
    ? Math.min(100, Math.round((activeQuestProgress.current / Math.max(activeQuestProgress.target, 1)) * 100))
    : 0;

  const trimmed = query.trim().toLowerCase();
  const matchedVenues = trimmed
    ? venues.filter(v => `${v.name} ${v.cuisine} ${v.suburb}`.toLowerCase().includes(trimmed)).slice(0, 5)
    : [];
  const matchedMalls = trimmed
    ? malls.filter(m => `${m.name} ${m.address}`.toLowerCase().includes(trimmed)).slice(0, 3)
    : [];
  const matchedLoots = trimmed
    ? loots.filter(l => `${l.title} ${l.venueName ?? ""} ${l.grabMode}`.toLowerCase().includes(trimmed)).slice(0, 4)
    : [];
  const hasSearchMatches = matchedVenues.length > 0 || matchedMalls.length > 0 || matchedLoots.length > 0;

  return (
    <div className={styles.hud}>
      <div>
        <header className={styles.topBar}>
          <Link href="/" className={styles.brand} aria-label="Food Go home">
            <span className={styles.brandIcon}>
              <MapPin size={18} strokeWidth={2.5} />
            </span>
            <span className={styles.brandText}>
              foodgo<span className={styles.brandDot}>.</span>
            </span>
          </Link>

          <div className={styles.topPills}>
            <button
              type="button"
              className={`${styles.bellButton} ${styles.mobileSearchBtn}`}
              aria-label="Search restaurants and rewards"
              aria-expanded={mobileSearchOpen}
              onClick={() => setMobileSearchOpen(prev => !prev)}
            >
              <Search size={17} />
            </button>

            {signedIn ? (
              <>
                <Link href="/profile" className={styles.levelPill} title="Open Passport & Level track" style={{ textDecoration: "none" }}>
                  <Star size={14} fill="#f6c944" className={styles.levelStar} />
                  <span>Lv. {level}</span>
                  <div className={styles.levelProgress}>
                    <div className={styles.levelProgressFill} style={{ width: `${xpPct}%` }} />
                  </div>
                </Link>

                <Link href="/deals" className={styles.coinsPill} title="Earned Coins & Deals" style={{ textDecoration: "none" }}>
                  <span className={styles.coinIcon}>$</span>
                  <span>{coins.toLocaleString("en-AU")}</span>
                  <span className={styles.coinPlus}>+</span>
                </Link>

                <Link href="/profile" className={`${styles.bellButton} ${styles.mobileHideProfile}`} aria-label="Explorer profile & security" title="Passport & Profile">
                  <UserCircle2 size={18} />
                </Link>
              </>
            ) : (
              <Link href="/auth/sign-in?next=/" className={styles.guestPill}>
                <span>Sign In</span>
              </Link>
            )}

            <div style={{ position: "relative" }}>
              <button
                type="button"
                className={styles.bellButton}
                aria-label="Recent rewards and notifications"
                onClick={() => setAlertsOpen(prev => !prev)}
              >
                <Bell size={18} />
                {(recentClaims.length > 0 || loots.length > 0) && <span className={styles.notificationBadge} />}
              </button>

              {alertsOpen && (
                <div
                  className={geoStyles.searchDrop}
                  style={{ width: 280, right: 0, left: "auto", padding: 12 }}
                  role="dialog"
                  aria-label="Activity updates"
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <strong style={{ fontSize: 13 }}>Melbourne Activity</strong>
                    <button type="button" onClick={() => setAlertsOpen(false)} aria-label="Close notifications">
                      <X size={16} />
                    </button>
                  </div>
                  {loots.length > 0 && (
                    <p style={{ fontSize: 12, color: "#0c5e50", fontWeight: 700, marginBottom: 8 }}>
                      {loots.length} live rewards active inside Melbourne Pilot.
                    </p>
                  )}
                  {recentClaims.length > 0 ? (
                    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
                      {recentClaims.slice(0, 4).map(claim => (
                        <li key={claim.id} style={{ fontSize: 12, padding: "6px 8px", borderRadius: 8, background: "#eef8f4" }}>
                          <strong>{claim.title}</strong> · +{claim.xpAwarded} XP · +{claim.coinsAwarded} Coins
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ fontSize: 12, color: "#546d63" }}>
                      Explore Melbourne CBD to grab map crystals, AR loots and earn XP!
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        <section
          className={`${styles.searchSection} ${mobileSearchOpen ? styles.searchSectionOpenMobile : styles.searchSectionCollapsedMobile}`}
          style={{ position: "relative" }}
        >
          <form
            className={styles.searchBar}
            onSubmit={e => {
              e.preventDefault();
              if (matchedVenues[0] && onPickVenue) onPickVenue(matchedVenues[0]);
              else if (matchedMalls[0] && onPickMall) onPickMall(matchedMalls[0]);
              else if (matchedLoots[0] && onPickLoot) onPickLoot(matchedLoots[0]);
              setSearchFocused(false);
            }}
          >
            <Search size={18} className={styles.searchIcon} />
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Search restaurants, cafes, malls or rewards"
              value={query}
              onChange={e => onQueryChange(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              aria-label="Search restaurants, cuisines, malls or rewards"
            />
            {query && (
              <button
                type="button"
                className={styles.filterButton}
                aria-label="Clear search"
                onClick={() => onQueryChange("")}
              >
                <X size={15} />
              </button>
            )}
            <button
              type="button"
              className={styles.filterButton}
              aria-label="Toggle category filters"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen(prev => !prev)}
            >
              <SlidersHorizontal size={16} />
            </button>
          </form>

          {filtersOpen && (
            <div className={geoStyles.filterDrawer} role="group" aria-label="Filter explore map">
              {(
                [
                  ["all", "All Pilot"],
                  ["restaurant", "Restaurants"],
                  ["cafe", "Cafes"],
                  ["bakery", "Bakeries"],
                  ["mall", "Malls"],
                  ["loot", "Loots & Crystals"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={geoStyles.filterChip}
                  aria-pressed={activeFilter === key}
                  onClick={() => onFilterChange(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {searchFocused && trimmed.length > 0 && (
            <div className={geoStyles.searchDrop}>
              {!hasSearchMatches ? (
                <p style={{ padding: "8px 12px", fontSize: 12, color: "#546d63" }}>
                  No published Melbourne venues or rewards matched "{query}".
                </p>
              ) : (
                <>
                  {matchedMalls.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      className={geoStyles.searchResultButton}
                      onClick={() => {
                        onPickMall?.(m);
                        setSearchFocused(false);
                      }}
                    >
                      <span>{m.name}</span>
                      <span className={geoStyles.searchResultSub}>Mall · {m.shopCount} venues</span>
                    </button>
                  ))}
                  {matchedVenues.map(v => (
                    <button
                      key={v.id}
                      type="button"
                      className={geoStyles.searchResultButton}
                      onClick={() => {
                        onPickVenue?.(v);
                        setSearchFocused(false);
                      }}
                    >
                      <span>{v.name}</span>
                      <span className={geoStyles.searchResultSub}>{v.cuisine} · {v.suburb}</span>
                    </button>
                  ))}
                  {matchedLoots.map(l => (
                    <button
                      key={l.id}
                      type="button"
                      className={geoStyles.searchResultButton}
                      onClick={() => {
                        onPickLoot?.(l);
                        setSearchFocused(false);
                      }}
                    >
                      <span>{l.title}</span>
                      <span className={geoStyles.searchResultSub}>
                        {l.grabMode === "ar_grab" ? "AR Grab" : "Map Grab"} · +{l.xpReward} XP
                      </span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </section>

        <div className={`${styles.questCard} ${questCollapsed ? styles.questCardCollapsed : ""}`}>
          <div className={styles.questHeader}>
            <Flag size={14} fill="#f6c944" className={styles.questFlag} />
            <span className={styles.questTitle}>Active Quest</span>
            <button
              type="button"
              className={styles.questToggleBtn}
              onClick={() => setQuestCollapsed(!questCollapsed)}
              aria-label={questCollapsed ? "Expand active quest" : "Collapse active quest"}
              aria-expanded={!questCollapsed}
            >
              <ChevronRight size={15} className={questCollapsed ? undefined : styles.questChevronOpen} />
            </button>
          </div>
          {!questCollapsed && (
            <>
              <Link href="/quests" style={{ textDecoration: "none", display: "block" }}>
                <div className={styles.questBody}>
                  <span className={styles.questDescription}>{activeQuestTitle}</span>
                  <ChevronRight size={16} className={styles.questChevron} />
                </div>
                {activeQuestProgress && (
                  <div className={styles.questProgressRow}>
                    <div className={styles.questProgressBar}>
                      <div className={styles.questProgressFill} style={{ width: `${questPct}%` }} />
                    </div>
                    <span className={styles.questProgressCounter}>
                      {activeQuestProgress.current} / {activeQuestProgress.target}
                    </span>
                  </div>
                )}
              </Link>
            </>
          )}
        </div>
      </div>

      {/* RIGHT FLOATING 3D CAMERA & VIEWPORT CONTROLS */}
      <div className={styles.rightControls}>
        <button
          type="button"
          className={styles.controlButton}
          onClick={onPerspectiveToggle}
          title={perspective === "first" ? "Switch to 3rd-Person Follow View" : "Switch to 1st-Person Street View"}
          aria-label="Switch 1st person and 3rd person view"
          style={perspective === "first" ? { borderColor: "#00f0ff", background: "#006d68" } : undefined}
        >
          <Eye size={19} />
          <span style={{ position: "absolute", bottom: -14, fontSize: 9, fontWeight: 800, background: "rgba(9,36,31,0.92)", padding: "1px 5px", borderRadius: 6 }}>
            {perspective === "first" ? "1st" : perspective === "overhead" ? "Top" : "3rd"}
          </span>
        </button>

        {onToggleThreeD && (
          <button
            type="button"
            className={styles.controlButton}
            onClick={onToggleThreeD}
            title={threeD ? "Toggle satellite imagery" : "Return to stylized 3D game world"}
            aria-label="Toggle map layer"
          >
            <Layers size={19} />
          </button>
        )}

        <button
          type="button"
          className={styles.controlButton}
          onClick={onRecenter}
          title="Recentre on Explorer inside Melbourne Pilot"
          aria-label="Recentre on explorer"
        >
          <Navigation size={19} />
        </button>

        {onOpenAvatar && (
          <button
            type="button"
            className={styles.controlButton}
            onClick={onOpenAvatar}
            title="Change 3D explorer outfit"
            aria-label="Customise 3D explorer"
          >
            <PersonStanding size={19} />
          </button>
        )}

        <button type="button" className={styles.controlButton} onClick={onZoomIn} title="Zoom in" aria-label="Zoom in">
          <Plus size={19} />
        </button>
        <button type="button" className={styles.controlButton} onClick={onZoomOut} title="Zoom out" aria-label="Zoom out">
          <Minus size={19} />
        </button>
      </div>

      {/* BOTTOM LEFT PILOT PILL */}
      <div className={styles.bottomArea}>
        <div className={styles.locationPill} title="Stage 1 active in Melbourne CBD Pilot. Other regions coming soon.">
          <MapPin size={15} className={styles.locationIcon} />
          <span>{locationName}</span>
          <ChevronDown size={15} className={styles.locationArrow} />
        </div>
      </div>

      {/* BOTTOM NAVIGATION BAR */}
      <nav className={styles.bottomNav} aria-label="Primary navigation">
        <Link href="/feed" className={styles.navItem} data-active={pathname.startsWith("/feed")}>
          <div className={styles.navIconWrapper}>
            <BookOpen size={20} strokeWidth={2.2} />
          </div>
          <span>Feed</span>
        </Link>

        <Link href="/deals" className={styles.navItem} data-active={pathname.startsWith("/deals")}>
          <div className={styles.navIconWrapper}>
            <Tag size={20} strokeWidth={2.2} />
          </div>
          <span>Deals</span>
        </Link>

        <Link href="/" className={styles.exploreItem} aria-label="Explore Food Go 3D map">
          <div className={styles.exploreHexagon}>
            <Compass size={26} strokeWidth={2.4} />
          </div>
          <span className={styles.exploreLabel}>Explore</span>
        </Link>

        <Link href="/quests" className={styles.navItem} data-active={pathname.startsWith("/quests")}>
          <div className={styles.navIconWrapper}>
            <Flag size={20} strokeWidth={2.2} />
            <span className={styles.navBadge} />
          </div>
          <span>Quests</span>
        </Link>

        <Link href="/outback" className={styles.navItem} data-active={pathname.startsWith("/outback")}>
          <div className={styles.navIconWrapper}>
            <Mountain size={20} strokeWidth={2.2} />
          </div>
          <span>Outback</span>
        </Link>
      </nav>
    </div>
  );
}
