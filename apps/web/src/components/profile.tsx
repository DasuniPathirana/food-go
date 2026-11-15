"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Bookmark, Utensils, Flag } from "lucide-react";
import type { CatalogueState } from "@/lib/catalogue-contracts";
import { SignOutButton } from "./auth-form";
import { GameProgress } from "./game-progress";
import { AvatarWardrobe } from "./avatar-customizer";
import { CommunityFeed } from "./community-feed";
import { useJourney } from "./journey-provider";
import styles from "./passport-wall.module.css";

export function ExplorerProfile({ account }: { account?: {
  displayName: string; email: string | null; phone?: string | null; accountType?: "explorer" | "partner";
} | null; catalogue: CatalogueState }) {
  const journey = useJourney();
  const router = useRouter();
  const [error, setError] = useState("");
  async function becomePartner() {
    setError("");
    try {
      const response = await fetch("/api/journey", { method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "account", accountType: "partner" }) });
      if (!response.ok) throw new Error();
      await journey?.refresh(); router.push("/partner/dashboard"); router.refresh();
    } catch { setError("Your business account could not be opened. Try again."); }
  }
  const visits = journey?.data?.visits.length ?? 0, dishes = journey?.data?.discoveries.length ?? 0;
  return <><header className="page-intro"><div><h1>Your food passport</h1><p>Your stories, discoveries and progress.</p></div>
    <Link className="secondary-button" href="/collect">Collect a discovery</Link></header>
    <section className={`profile-card ${styles.connectedCover}`}><h2>{account?.displayName || "Welcome, explorer"}</h2>
      {account ? <><p>{account.accountType === "partner" ? "Restaurant partner and food explorer" : "Food explorer"}</p><SignOutButton/></> :
        <><p>Sign in to save places, collect XP and share stories.</p><Link className="primary-button" href="/auth/sign-in">Sign in</Link>
          <Link className="secondary-button" href="/auth/register">Create an account</Link></>}
    </section>
    {account && <><GameProgress/><section className="stat-grid" aria-label="Your discoveries">
      <div className="stat-card"><Bookmark size={20}/><strong>{journey?.data?.savedVenues.length ?? 0}</strong><span>Saved places</span></div>
      <div className="stat-card"><MapPin size={20}/><strong>{visits}</strong><span>Verified places</span></div>
      <div className="stat-card"><Utensils size={20}/><strong>{dishes}</strong><span>Verified dishes</span></div>
    </section>
    <section className={styles.connectedWall} aria-label="Your posts"><CommunityFeed initialWall="me" presentation="passport" basePath="/feed"/></section>
    <details className={styles.details}><summary>Achievements, avatar and account</summary><div className={styles.detailsBody}>
      <section className="content-panel"><h2>Your achievements</h2><div className="badge-grid">
        {[{ name: "First good bite", earned: dishes > 0, icon: Utensils, text: "Try your first verified dish." },
          { name: "Neighbourhood curious", earned: visits > 0, icon: MapPin, text: "Collect your first verified visit." },
          { name: "Three places discovered", earned: visits >= 3, icon: Flag, text: "Collect three places for a 100 XP bonus." },
        ].map(({ name, earned, icon: Icon, text }) => <article key={name} className={`badge-tile ${earned ? "" : "is-locked"}`}>
          <Icon size={24}/><h3>{name}</h3><p>{text}</p><strong>{earned ? "Earned" : "Keep exploring"}</strong></article>)}
      </div></section><AvatarWardrobe/>
      <section className="content-panel"><h2>Your business</h2>
        {account.accountType === "partner" ? <Link className="primary-button" href="/partner/dashboard">Manage my restaurants</Link> :
          <button className="secondary-button" onClick={becomePartner}>I own a restaurant or cafe</button>}
        {error && <p className="field-error" role="alert">{error}</p>}
      </section></div></details></>}
  </>;
}
