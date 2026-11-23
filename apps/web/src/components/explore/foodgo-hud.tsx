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
  level?: number;
  xp?: number;
  coins?: number;
  activeQuest?: {
    title: string;
    description: string;
    current: number;
    total: number;
  };
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
  level = 24,
  xp = 3820,
  coins = 3820,
  activeQuest = {
    title: "Active Quest",
    description: "Visit The Ovenhouse and leave a review",
    current: 0,
    total: 1,
  },
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
            <div className={styles.levelPill} title={`Level ${level} (${xp} XP)`}>
              <span className={styles.levelStar}>★</span>
              <span>Lv. {level}</span>
              <div className={styles.levelProgress} aria-hidden="true">
                <div className={styles.levelProgressFill} style={{ width: "65%" }} />
              </div>
            </div>

            <div className={styles.coinsPill} title={`${coins.toLocaleString()} Food Go Coins`}>
              <span className={styles.coinIcon}>$</span>
              <span>{coins.toLocaleString()}</span>
              <span className={styles.coinPlus}>+</span>
            </div>

            <button
              type="button"
              className={styles.bellButton}
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell size={17} />
              <span className={styles.notificationBadge} aria-hidden="true" />
            </button>
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

        {/* Active Quest Card */}
        <div
          className={styles.questCard}
          onClick={onQuestClick}
          role="button"
          tabIndex={0}
          aria-label={`${activeQuest.title}: ${activeQuest.description}. Progress ${activeQuest.current} of ${activeQuest.total}`}
        >
          <div className={styles.questHeader}>
            <Flag size={14} className={styles.questFlag} />
            <span className={styles.questTitle}>{activeQuest.title}</span>
          </div>
          <div className={styles.questBody}>
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
        </div>
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
          aria-label={`Region: ${locationName}. Click to change region.`}
        >
          <MapPin size={15} className={styles.locationIcon} />
          <span>{locationName}</span>
          <ChevronDown size={14} className={styles.locationArrow} />
        </button>
      </div>
    </aside>
  );
}
