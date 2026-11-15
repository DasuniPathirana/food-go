"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Bookmark, Utensils, Flag, ArrowRight, ChevronDown, Sparkles, Compass } from "lucide-react";
import type { CatalogueState } from "@/lib/catalogue-contracts";
import { SignOutButton } from "./auth-form";
import { GameProgress } from "./game-progress";
import { AvatarWardrobe } from "./avatar-customizer";
import { CommunityFeed } from "./community-feed";
import { useJourney } from "./journey-provider";
import { AvatarIllustration } from "./explorer-avatar";
import { useAvatarPreferences } from "@/lib/avatar-preferences";
import styles from "./passport-wall.module.css";

export function ExplorerProfile({ account }: { account?: {
  displayName: string; email: string | null; phone?: string | null; accountType?: "explorer" | "partner";
} | null; catalogue: CatalogueState }) {
  const journey = useJourney();
  const avatar = useAvatarPreferences();
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
  const progress = journey?.data?.progress;
  return <div className={styles.page}><header className={styles.profileHeading}><div><h1>Passport</h1><p>Your food story, all in one place.</p></div>
    <Link href="/collect" className={styles.collectLink}><MapPin size={17}/>Collect a discovery<ArrowRight size={16}/></Link></header>
    <section className={styles.personalCover} aria-label="Your explorer identity">
      <div className={styles.personalIdentity}><span className={styles.personalPortrait}><AvatarIllustration avatarId={avatar.preferences.avatarId}/></span><div>
        <h2>{account?.displayName || "Make yourself at home."}</h2>
        <p>{account ? account.accountType === "partner" ? "Restaurant partner and food explorer" : "Food explorer" : "Save your favourites. Collect your discoveries. Share your story."}</p>
        {account ? <div className={styles.identityActions}><Link href="/" ><Compass size={15}/>Back to the map<ArrowRight size={14}/></Link><SignOutButton/></div> :
          <div className={styles.guestActions}><Link href="/auth/register">Create your Passport<ArrowRight size={16}/></Link><Link href="/auth/sign-in">Sign in</Link></div>}
      </div></div>
      {account && <div className={styles.personalProgress}>{progress ? <><div><span><Sparkles size={16}/>Level {progress.level}</span><strong>{progress.xp.toLocaleString("en-AU")} <small>XP</small></strong></div>
        <progress aria-label="Progress to next level" value={progress.xp % 250} max={250}/><p>{progress.nextLevelXp - progress.xp} XP to your next level</p></> : <p role="status">{journey?.error ? "Your progress could not load." : "Loading your progress…"}</p>}</div>}
    </section>
    {account && <><nav className={styles.discoveryLinks} aria-label="Your discoveries">
      <Link href="/venue-dex"><Bookmark size={19}/><span>Saved places</span>{journey?.data && <strong>{journey.data.savedVenues.length}</strong>}<ArrowRight size={15}/></Link>
      <Link href="/venue-dex"><MapPin size={19}/><span>Verified places</span>{journey?.data && <strong>{visits}</strong>}<ArrowRight size={15}/></Link>
      <Link href="/food-dex"><Utensils size={19}/><span>Verified dishes</span>{journey?.data && <strong>{dishes}</strong>}<ArrowRight size={15}/></Link>
    </nav>
    <section className={styles.connectedWall} aria-label="Your posts"><CommunityFeed initialWall="me" presentation="passport" basePath="/feed"/></section>
    <details className={styles.details}><summary><Sparkles size={18}/>Achievements, avatar and account<ChevronDown size={18}/></summary><div className={styles.detailsBody}>
      <GameProgress/>
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
    {!account && <section className={styles.guestIntroduction}><h2>A little more you.</h2><p>Your Passport brings your saved places, verified food discoveries and personal wall together. Start with a place you want to try.</p><Link href="/"><Compass size={18}/>Find your next stop<ArrowRight size={16}/></Link></section>}
  </div>;
}
