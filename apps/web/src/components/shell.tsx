"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Compass,
  Flag,
  MapPin,
  Store,
  ArrowUpRight,
  CircleHelp,
  Leaf,
  UserRound,
  ChevronDown,
} from "lucide-react";
import { Brand } from "./brand";

const navigation = [
  { href: "/", label: "Explore", icon: Compass },
  { href: "/food-dex", label: "FoodDex", icon: BookOpen },
  { href: "/venue-dex", label: "VenueDex", icon: Store },
  { href: "/quests", label: "Quests & trails", short: "Quests", icon: Flag },
  { href: "/profile", label: "My passport", short: "Profile", icon: UserRound },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const title = pathname.startsWith("/partner")
    ? "Restaurant partners"
    : pathname === "/"
      ? "Explore"
      : pathname === "/food-dex"
        ? "FoodDex"
        : pathname === "/venue-dex"
          ? "VenueDex"
          : pathname === "/quests"
            ? "Quests & trails"
            : pathname === "/help"
              ? "Help & information"
              : pathname.startsWith("/venues/")
                ? "Venue discovery"
                : "My passport";
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar" aria-label="Main navigation">
        <Link href="/" className="brand-link" aria-label="Food Go home">
          <Brand />
        </Link>
        <div className="sidebar-caption">
          A LITTLE CURIOSITY GOES A LONG WAY
        </div>
        <nav className="desktop-nav">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`nav-link ${pathname === href ? "active" : ""}`}
              aria-current={pathname === href ? "page" : undefined}
            >
              <Icon size={19} strokeWidth={1.7} />
              <span>{label}</span>
              {pathname === href && <span className="active-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-invitation">
          <span className="leaf-disc">
            <Leaf size={21} />
          </span>
          <h3>
            Good food.
            <br /> Great little adventures.
          </h3>
          <p>Your next favourite could be closer than you think.</p>
          <Link href="/quests">
            Find your next trail <ArrowUpRight size={15} />
          </Link>
        </div>
        <div className="sidebar-bottom">
          <Link href="/partner">
            <Store size={18} />
            For restaurants
            <ArrowUpRight size={15} />
          </Link>
          <Link href="/help">
            <CircleHelp size={18} />
            Help & information
          </Link>
          <div className="sidebar-region">
            <MapPin size={13} />
            Made for exploring Australia
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="mobile-brand">
            <Link href="/" aria-label="Food Go home">
              <Brand />
            </Link>
          </div>
          <div className="breadcrumb">
            Your food adventure <span>/</span>
            <strong>{title}</strong>
          </div>
          <div className="topbar-actions">
            <span className="preview-badge">
              <span />
              Early preview
            </span>
            <Link
              href="/profile"
              className="guest-button"
              aria-label="Open guest profile"
            >
              <span className="avatar">
                <UserRound size={17} />
              </span>
              <span>Guest explorer</span>
              <ChevronDown size={14} />
            </Link>
          </div>
        </header>
        <main id="main-content" className="main-content">
          {children}
        </main>
        <footer className="page-footer">
          <span>A little discovery. A lot to love.</span>
          <span>
            Example venues and experiences <span className="footer-dot">·</span>
            <Link href="/help">About this preview</Link>
          </span>
        </footer>
      </div>
      <nav className="mobile-navigation" aria-label="Mobile navigation">
        {navigation.map(({ href, label, short, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={pathname === href ? "active" : ""}
            aria-current={pathname === href ? "page" : undefined}
          >
            <Icon size={21} />
            <span>{short || label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
