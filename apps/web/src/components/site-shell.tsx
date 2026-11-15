"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { Brand } from "./brand";
import { FoodNavigation } from "./food-navigation";
import type { CatalogueMode } from "@/lib/catalogue-contracts";

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
          <FoodNavigation pathname={pathname} />
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
      <main
        id="main-content"
        className={`main-content ${pathname === "/" || exampleNeighbourhood ? "discovery-main" : ""}`}
      >
        {children}
      </main>
      {(socialPreview || examplePage || catalogueMode === "demo") && <div className="preview-strip">
        <span className="preview-dot" /><span>{socialPreview ? "Example feed" : "Demo neighbourhood"}</span>
        <span className="preview-detail">Example activity stays on this browser.</span>
      </div>}
      <footer className="site-footer">
        <div>
          <strong>Food Go</strong>
          <span>Made for eating out in Australia.</span>
        </div>
        <nav aria-label="Information">
          <Link href="/partner">List your venue</Link>
          <Link href="/demo">Play the full adventure demo</Link>
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
      <FoodNavigation pathname={pathname} mobile />
    </div>
  );
}
