"use client";

import Link from "next/link";
import { ArrowRight, Compass, MapPin, Mountain, Sparkles } from "lucide-react";

export function Outback({ signedIn }: { signedIn: boolean }) {
  return (
    <section
      style={{
        maxWidth: 880,
        margin: "12px auto 32px",
        padding: "32px 24px",
        borderRadius: 24,
        background: "linear-gradient(145deg, #ffffff 0%, #e7f8f2 62%, #f4fbf8 100%)",
        border: "1px solid rgba(0, 184, 148, 0.3)",
        boxShadow: "0 20px 48px rgba(9, 36, 31, 0.1)",
        display: "grid",
        gap: 20,
      }}
    >
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, width: "fit-content", padding: "6px 14px", borderRadius: 999, background: "rgba(9, 36, 31, 0.94)", border: "1px solid rgba(45, 212, 191, 0.4)", color: "#00f0ff", fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
        <Sparkles size={14} color="#f6c944" /> Stage 2 Regional Expansion
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <h1 style={{ margin: 0, fontSize: "clamp(30px, 4.5vw, 44px)", lineHeight: 1.08, color: "#0b4a43" }}>
          Outback Exploration - Coming Soon
        </h1>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: "#355264", maxWidth: "60ch" }}>
          Stage 1 of Food Go is live exclusively across our curated Melbourne CBD Pilot zone so every restaurant location, mall building, deal and AR loot reward is verified end-to-end.
        </p>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "#4b6875", maxWidth: "60ch" }}>
          Regional Australian Outback food trails, country town bakeries, farm gates and intercity expeditions will unlock automatically as new areas go live.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <div style={{ background: "#ffffff", border: "1px solid #d4e3e0", borderRadius: 16, padding: 16 }}>
          <strong style={{ display: "flex", alignItems: "center", gap: 8, color: "#08786e", fontSize: 15 }}>
            <MapPin size={17} /> Melbourne Pilot Active Now
          </strong>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#4b6875" }}>
            Walk Melbourne CBD in 1st-person or 3rd-person 3D view, enter malls, grab crystals and scan restaurant AR drops.
          </p>
        </div>
        <div style={{ background: "#ffffff", border: "1px solid #d4e3e0", borderRadius: 16, padding: 16 }}>
          <strong style={{ display: "flex", alignItems: "center", gap: 8, color: "#08786e", fontSize: 15 }}>
            <Mountain size={17} /> Outback Regions Next
          </strong>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#4b6875" }}>
            Yarra Valley, Great Ocean Road, Barossa, Byron Bay and Red Centre chapters will open post-pilot.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <Link href="/" className="primary-button">
          <Compass size={16} /> Enter Melbourne 3D Explorer <ArrowRight size={15} />
        </Link>
        <Link href="/quests" className="secondary-button">
          View Active Quests & Wishlist
        </Link>
        {!signedIn && (
          <Link href="/auth/sign-in?next=/profile" className="secondary-button">
            Sign in for Explorer updates
          </Link>
        )}
      </div>
    </section>
  );
}
