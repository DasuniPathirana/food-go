"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Compass,
  Flag,
  Store,
  UserRound,
  ArrowUpRight,
} from "lucide-react";
import { Brand } from "./brand";

const navigation = [
  { href: "/", label: "Explore", icon: Compass },
  { href: "/food-dex", label: "FoodDex", icon: BookOpen },
  { href: "/venue-dex", label: "VenueDex", icon: Store },
  { href: "/quests", label: "Quests", icon: Flag },
  { href: "/profile", label: "Profile", icon: UserRound },
];

export function SiteShell({
  children,
  signedIn = false,
  displayName,
}: {
  children: React.ReactNode;
  signedIn?: boolean;
  displayName?: string;
}) {
  const pathname = usePathname();
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
                aria-current={pathname === href ? "page" : undefined}
                className={pathname === href ? "active" : ""}
              >
                {label === "Profile" ? "My passport" : label}
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
          Example venues. No live bookings or check-ins.
        </span>
        <Link href="/help">What works here</Link>
      </div>
      <main
        id="main-content"
        className={`main-content ${pathname === "/" ? "discovery-main" : ""}`}
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
            className={pathname === href ? "active" : ""}
            aria-current={pathname === href ? "page" : undefined}
          >
            <Icon size={22} strokeWidth={1.65} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
