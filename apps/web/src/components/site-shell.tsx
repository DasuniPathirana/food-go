"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Compass,
  MessagesSquare,
  Store,
  UserRound,
  ArrowUpRight,
} from "lucide-react";
import { Brand } from "./brand";
import type { CatalogueMode } from "@/lib/catalogue-contracts";

const navigation = [
  { href: "/feed", label: "Feed", icon: MessagesSquare },
  { href: "/food-dex", label: "FoodDex", icon: BookOpen },
  { href: "/", label: "Explore", icon: Compass },
  { href: "/venue-dex", label: "VenueDex", icon: Store },
  { href: "/profile", label: "Passport", icon: UserRound },
];

export function SiteShell({
  children,
  signedIn = false,
  displayName,
  catalogueMode,
}: {
  children: React.ReactNode;
  signedIn?: boolean;
  displayName?: string;
  catalogueMode: CatalogueMode;
}) {
  const pathname = usePathname();
  if (pathname === "/demo" || pathname.startsWith("/demo/")) return <>{children}</>;
  const exampleNeighbourhood = pathname === "/explore-preview";
  const examplePage = exampleNeighbourhood || pathname.startsWith("/explore-preview/");
  const socialPreview = pathname === "/feed-preview";
  const navigationIsActive = (href: string) => pathname === href || (href === "/" && examplePage) || (href === "/feed" && socialPreview);
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
          <nav className="site-navigation" aria-label="Main navigation">
            {navigation.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={navigationIsActive(href) ? "page" : undefined}
                className={navigationIsActive(href) ? "active" : ""}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            <Link href="/partner" className="venue-entry">
              For venues <ArrowUpRight size={14} />
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
      <div className="preview-strip">
        <span className="preview-dot" />
        <span>Development preview</span>
        <span className="preview-detail">
          {socialPreview ? "Fictional community. Changes stay on this browser." : examplePage || catalogueMode === "demo" ? "Example venues. No live bookings or check-ins." : "Published venues only. No live bookings or check-ins."}
        </span>
        <Link href="/demo">Play the full adventure demo</Link>
      </div>
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
          <Link href="/help">Help and privacy</Link>
          <a
            href="https://github.com/DasuniPathirana/food-go"
            target="_blank"
            rel="noopener noreferrer"
          >
            Project updates <ArrowUpRight size={13} />
          </a>
        </nav>
      </footer>
      <nav className="mobile-navigation" aria-label="Mobile navigation">
        {navigation.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={navigationIsActive(href) ? "active" : ""}
            aria-current={navigationIsActive(href) ? "page" : undefined}
          >
            <Icon size={22} strokeWidth={1.65} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
