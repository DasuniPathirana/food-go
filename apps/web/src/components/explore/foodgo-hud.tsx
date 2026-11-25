"use client";

import Link from "next/link";
import { type ChangeEvent, type FormEvent, useState } from "react";
import {
  Bell,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Compass,
  Flag,
  Layers,
  MapPin,
  Minus,
  Mountain,
  Navigation,
  Plus,
  Search,
  SlidersHorizontal,
  Ticket,
  UtensilsCrossed,
} from "lucide-react";
import styles from "./foodgo-hud.module.css";

export type FoodGoHudProps = {
  signedIn?: boolean;
  level?: number;
  xp?: number;
  coins?: number;
  activeQuest?: {
    title: string;
    description: string;
    current: number;
    total: number;
  } | null;
  locationName?: string;
  onSearch?: (query: string) => void;
  onFilterClick?: () => void;
  onRecenter?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onLayersToggle?: () => void;
  onLocationClick?: () => void;
  onQuestClick?: () => void;
  currentSection?: "feed" | "deals" | "explore" | "quests" | "outback";
};

export function FoodGoHud({
  signedIn = false,
  level,
  xp,
  coins,
  activeQuest,
  locationName = "Melbourne",
  onSearch,
  onFilterClick,
  onRecenter,
  onZoomIn,
  onZoomOut,
  onLayersToggle,
  onLocationClick,
  onQuestClick,
  currentSection = "explore",
}: FoodGoHudProps) {
  const [searchValue, setSearchValue] = useState("");
  const [questExpanded, setQuestExpanded] = useState(false);

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    if (onSearch) onSearch(searchValue);
  }

  function handleSearchChange(e: ChangeEvent<HTMLInputElement>) {
    setSearchValue(e.target.value);
    if (onSearch) onSearch(e.target.value);
  }

  return (
    <aside className={styles.hud} aria-label="Food Go Explorer Interface">
      {/* ---------------- TOP SECTION: Header, Search, Quest ---------------- */}
      <div>
        {/* Top Header */}
        <header className={styles.topBar}>
          <Link href="/" className={styles.brand} aria-label="Food Go Home">
            <span className={styles.brandIcon}>
              <UtensilsCrossed size={17} />
            </span>
            <span className={styles.brandText}>
              foodgo<span className={styles.brandDot}>.</span>
            </span>
          </Link>

          <div className={styles.topPills}>
            {signedIn && level != null ? (
              <>
                <Link href="/profile" className={styles.levelPill} title={`Level ${level} (${xp ?? 0} XP)`}>
                  <span className={styles.levelStar}>★</span>
                  <span>Lv. {level}</span>
                  <div className={styles.levelProgress} aria-hidden="true">
                    <div className={styles.levelProgressFill} style={{ width: `${Math.min(100, ((xp ?? 0) % 1000) / 10)}%` }} />
                  </div>
                </Link>

                <Link href="/profile" className={styles.coinsPill} title={`${(coins ?? 0).toLocaleString()} Food Go Coins`}>
                  <span className={styles.coinIcon}>$</span>
                  <span>{(coins ?? 0).toLocaleString()}</span>
                  <span className={styles.coinPlus}>+</span>
                </Link>
              </>
            ) : (
              <Link href="/auth/sign-in" className={styles.guestPill} aria-label="Sign in">
                <span>Sign in</span>
              </Link>
            )}

            <Link
              href="/quests"
              className={styles.bellButton}
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell size={17} />
              {signedIn && <span className={styles.notificationBadge} aria-hidden="true" />}
            </Link>
          </div>
        </header>

        {/* Search Bar */}
        <div className={styles.searchSection}>
          <form className={styles.searchBar} onSubmit={handleSearchSubmit}>
            <Search size={18} className={styles.searchIcon} />
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Search restaurants, cuisines, or adventures"
              value={searchValue}
              onChange={handleSearchChange}
              aria-label="Search restaurants, cuisines, or adventures"
            />
            <button
              type="button"
              className={styles.filterButton}
              onClick={onFilterClick}
              aria-label="Search filters"
              title="Search filters"
            >
              <SlidersHorizontal size={17} />
            </button>
          </form>
        </div>

        {/* Active Quest Card: Compact and Collapsible */}
        {activeQuest && (
          <div
            className={styles.questCard}
            role="region"
            aria-label={`${activeQuest.title}: ${activeQuest.description}`}
          >
            <div
              className={styles.questHeader}
              onClick={() => setQuestExpanded(v => !v)}
              style={{ cursor: "pointer" }}
            >
              <Flag size={14} className={styles.questFlag} />
              <span className={styles.questTitle}>{activeQuest.title}</span>
              <button
                type="button"
                className={styles.questToggleBtn}
                aria-label={questExpanded ? "Collapse quest card" : "Expand quest card"}
                onClick={e => { e.stopPropagation(); setQuestExpanded(v => !v); }}
              >
                <ChevronDown size={14} className={questExpanded ? styles.questChevronOpen : ""} />
              </button>
            </div>
            {questExpanded && (
              <>
                <div
                  className={styles.questBody}
                  onClick={onQuestClick}
                  style={{ cursor: onQuestClick ? "pointer" : "default" }}
                >
                  <span className={styles.questDescription}>{activeQuest.description}</span>
                  <ChevronRight size={16} className={styles.questChevron} />
                </div>
                <div className={styles.questProgressRow}>
                  <div className={styles.questProgressBar}>
                    <div
                      className={styles.questProgressFill}
                      style={{
                        width: `${Math.min(100, Math.max(0, (activeQuest.current / Math.max(1, activeQuest.total)) * 100))}%`,
                      }}
                    />
                  </div>
                  <span className={styles.questProgressCounter}>
                    {activeQuest.current} / {activeQuest.total}
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ---------------- FLOATING CONTROLS (RIGHT) ---------------- */}
      <div className={styles.rightControls}>
        <button
          type="button"
          className={styles.controlButton}
          onClick={onLayersToggle}
          aria-label="Map Layers"
          title="Map Layers"
        >
          <Layers size={19} />
        </button>
        <button
          type="button"
          className={styles.controlButton}
          onClick={onRecenter}
          aria-label="Re-center onto my location"
          title="Re-center"
        >
          <Navigation size={18} style={{ transform: "rotate(45deg)" }} />
        </button>
        <button
          type="button"
          className={styles.controlButton}
          onClick={onZoomIn}
          aria-label="Zoom in"
          title="Zoom in"
        >
          <Plus size={20} />
        </button>
        <button
          type="button"
          className={styles.controlButton}
          onClick={onZoomOut}
          aria-label="Zoom out"
          title="Zoom out"
        >
          <Minus size={20} />
        </button>
      </div>

      {/* ---------------- BOTTOM SECTION: Location Pill ---------------- */}
      <div className={styles.bottomArea}>
        <button
          type="button"
          className={styles.locationPill}
          onClick={onLocationClick}
          aria-label={`Show full ${locationName} pilot area. Other regions coming soon.`}
          title="Show playable pilot area"
        >
          <MapPin size={15} className={styles.locationIcon} />
          <span>{locationName}</span>
          <ChevronDown size={14} className={styles.locationArrow} />
        </button>
      </div>
    </aside>
  );
}
