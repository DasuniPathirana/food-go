"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { Brand } from "./brand";
import { FoodNavigation } from "./food-navigation";
import type { CatalogueMode } from "@/lib/catalogue-contracts";
import { useJourney } from "./journey-provider";

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
  const examplePage = exampleNeighbourhood || pathname.startsWith("/explore-preview/");
  const socialPreview = pathname === "/feed-preview";
  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Link href="/" aria-label="Food Go home" className="brand-link">
            <Brand />
          </Link>
          <FoodNavigation pathname={pathname} owner={ownerView} />
          <div className="header-actions">
            {signedIn && journey?.data && <Link className="account-entry" href="/profile">{journey.data.progress.xp} XP · Level {journey.data.progress.level}</Link>}
            <Link href={accountType === "partner" ? "/partner/dashboard" : "/partner"} className="venue-entry">
              {accountType === "partner" ? "My restaurants" : "For venues"} <ArrowUpRight size={14} />
            </Link>
            <Link
              href={signedIn ? "/profile" : "/auth/sign-in"}
              className="account-entry"
            >
              <span>{signedIn ? displayName || "My account" : "Sign in"}</span>
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
