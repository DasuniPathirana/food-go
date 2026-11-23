"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Bell, BookOpen, ChevronDown, Coins, Gift, Star, Store, UserRound, Zap } from "lucide-react";
import { Brand } from "./brand";
import { FoodNavigation } from "./food-navigation";
import type { CatalogueMode } from "@/lib/catalogue-contracts";
import { useJourney } from "./journey-provider";
import shell from "./shell-adventure.module.css";

export function SiteShell({
  children,
  signedIn = false,
  displayName,
  catalogueMode,
  accountType,
}: {
  children: React.ReactNode;
  signedIn?: boolean;
  displayName?: string;
  catalogueMode: CatalogueMode;
  accountType?: "explorer" | "partner";
}) {
  const pathname = usePathname();
  const journey = useJourney();
  const ownerView = accountType === "partner" && pathname.startsWith("/partner");
  const exampleNeighbourhood = pathname === "/explore-preview";
  const level = journey?.data?.progress.level ?? 24;
  const xp = journey?.data?.progress.xp ?? 3820;
  const coins = xp;

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className={`site-header ${shell.header}`}>
        <div className="header-inner">
          <Link href="/" aria-label="Food Go home" className="brand-link">
            <Brand />
          </Link>
          <FoodNavigation pathname={pathname} owner={ownerView} />

          {/* Unified FoodGo mobile stats bar */}
          <div className="mobile-header-stats" aria-label="Player level and currency">
            <Link href="/profile" className="mobile-level-pill" title={`Level ${level} (${xp} XP)`}>
              <Star size={13} fill="#f6c944" className="star-icon" />
              <span>Lv. {level}</span>
              <div className="pill-progress" aria-hidden="true">
                <div className="pill-progress-fill" style={{ width: "65%" }} />
              </div>
            </Link>

            <Link href="/profile" className="mobile-coins-pill" title={`${coins} coins`}>
              <Coins size={14} className="coin-icon" />
              <span>{coins.toLocaleString("en-AU")}</span>
              <span className="coin-plus-icon">+</span>
            </Link>

            <Link href="/quests" className="mobile-bell-btn" aria-label="Quests and notifications">
              <Bell size={18} />
              <span className="bell-badge-dot" aria-hidden="true" />
            </Link>
          </div>

          {/* Desktop header actions */}
          <div className="header-actions desktop-header-actions">
            {!ownerView && <details className={shell.collectionMenu} key={pathname}
              onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }}
              onKeyDown={event => { if (event.key === "Escape" && event.currentTarget.open) { event.preventDefault(); event.stopPropagation(); event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); } }}>
              <summary aria-label="Collections and Passport"><BookOpen size={16}/><span>Collections</span><ChevronDown size={13}/></summary>
              <nav aria-label="Your collections and profile"><Link href="/food-dex"><BookOpen size={17}/><span>FoodDex<small>Your food discoveries</small></span></Link>
                <Link href="/venue-dex"><Store size={17}/><span>VenueDex<small>Places you have collected</small></span></Link>
                <Link href="/inventory"><Gift size={17}/><span>Inventory<small>Your restaurant encounter items</small></span></Link>
                <Link href="/outback"><Gift size={17}/><span>Village rewards<small>Your Outback progress</small></span></Link>
                <Link href="/profile"><UserRound size={17}/><span>Passport<small>Your profile and personal wall</small></span></Link></nav>
            </details>}
            {signedIn && journey?.data && <Link className="account-entry xp-entry" href="/profile"
              aria-label={`Passport, ${journey.data.progress.xp} XP, level ${journey.data.progress.level}`}><Zap size={15} aria-hidden="true"/><span>{journey.data.progress.xp} XP</span></Link>}
            <Link href={accountType === "partner" ? "/partner/dashboard" : "/partner"} className="venue-entry">
              {accountType === "partner" ? "My restaurants" : "For venues"} <ArrowUpRight size={14} />
            </Link>
            <Link
              href={signedIn ? "/profile" : "/auth/sign-in"}
              className={`account-entry${signedIn ? " account-personal" : ""}`}
              aria-label={signedIn ? `Open ${displayName ? `${displayName}'s` : "your"} Passport` : undefined}
            >
              <UserRound size={16} aria-hidden="true"/>
              <span>{signedIn ? "Passport" : "Sign in"}</span>
            </Link>
          </div>
        </div>
      </header>
      <main
        id="main-content"
        className={`main-content ${pathname === "/" || exampleNeighbourhood ? "discovery-main" : ""}`}
      >
        {children}
      </main>
      <footer className="site-footer">
        <div>
          <strong>Food Go</strong>
          <span>Made for eating out in Australia.</span>
        </div>
        <nav aria-label="Information">
          <Link href="/partner">List your venue</Link>
          <Link href="/collect">Collect a visit</Link>
          <Link href="/food-dex">FoodDex</Link>
          <Link href="/venue-dex">VenueDex</Link>
          <Link href="/acknowledgement">Community acknowledgement</Link>
          <Link href="/help">Help and privacy</Link>
          <a
            href="https://github.com/Kalana8/Food_Go"
            target="_blank"
            rel="noopener noreferrer"
          >
            Project updates <ArrowUpRight size={13} />
          </a>
        </nav>
      </footer>
      <FoodNavigation pathname={pathname} mobile owner={ownerView} />
    </div>
  );
}
