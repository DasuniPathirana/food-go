"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, Check, Clock3, Coffee, Copy, Gift, MapPin, PackageOpen, RefreshCw, ShieldCheck, Store, Utensils, X } from "lucide-react";
import { encounterProximity, rarityLabel, type EncounterCampaign, type EncounterPublic, type EncounterRarity } from "@/lib/encounters";
import { encounterTimeRemaining, requestVenueEncounters, useEncounterAccount, useEncounterClock } from "@/lib/encounter-client";
import type { ExplorerLocationFix } from "@/lib/explorer-location-motion";
import styles from "./encounter.module.css";
import { EncounterCamera } from "./encounter-camera";

export function EncounterChest({ open = false, theme = "restaurant", rarity }: { open?: boolean; theme?: EncounterCampaign["theme"]; rarity?: EncounterRarity }) {
  const Icon = theme === "cafe" ? Coffee : theme === "market" ? Store : Utensils;
  return <div className={styles.chest} data-open={open} data-rarity={rarity ?? "closed"} aria-hidden="true">
    <span className={styles.chestGlow}/><span className={styles.chestSparkA}/><span className={styles.chestSparkB}/>
    <svg viewBox="0 0 320 210" focusable="false">
      <ellipse cx="162" cy="181" rx="98" ry="15" fill="#234b3c" opacity=".12"/>
      <path d="m69 111 91-29 94 29-94 31Z" fill="#a77d40"/>
      <path d="m69 111 91 30v49l-91-31Z" fill="#d6b66a" stroke="#896d3a" strokeWidth="2"/>
      <path d="m160 141 94-30v48l-94 31Z" fill="#ad8245" stroke="#896d3a" strokeWidth="2"/>
      <path d="m79 121 70 23v32l-70-24Z" fill="#f3dc99"/>
      <path d="m171 146 72-23v29l-72 24Z" fill="#bd9656"/>
      <path d="m100 120 11 4v47l-11-4Zm35 12 10 3v47l-10-4Z" fill="#fff3bd"/>
      <path d="m198 129 10-3v46l-10 4Zm32-10 9-3v46l-9 3Z" fill="#e5c377"/>
      <path d="M76 154v-24m170 23v-22" stroke="#866b3d" strokeWidth="2" opacity=".4"/>
      <g className={styles.chestLid}>
        <path d="m66 111 2-28c1-15 15-30 35-36 20-7 40-7 59-2l90 30 3 36-95 31Z" fill="#708d75" stroke="#375c4c" strokeWidth="2"/>
        <path d="m68 84 92 30 92-30v27l-92 31-94-31Z" fill="#456e59"/>
        <path d="m68 84 92 30 92-30-90-30c-19-6-39-6-57 0-19 6-33 18-37 30Z" fill="#93ad8b"/>
        <path d="m93 60 13-5 91 30 1 42-13 4v-41Z" fill="#f4da90"/>
        <path d="m128 49 13 1 92 30 1 38-12 4-1-38Z" fill="#e8cb7d"/>
        <path d="m68 99 92 31 93-31v12l-93 31-94-31Z" fill="#e1c276"/>
        <path d="m73 83 83 28" stroke="#c8d7b6" strokeWidth="3" strokeLinecap="round" opacity=".65"/>
      </g>
      <path d="m140 132 20 7 19-6v27l-19 7-20-8Z" fill="#f9e6a4" stroke="#8b6c36" strokeWidth="2"/>
      <circle cx="160" cy="149" r="4" fill="#607c5c"/><path d="m159 150-2 8 6-2-2-6" fill="#607c5c"/>
      <g fill="#ffe9a0"><circle cx="82" cy="118" r="2"/><circle cx="82" cy="152" r="2"/><circle cx="241" cy="117" r="2"/><circle cx="241" cy="151" r="2"/></g>
    </svg>
    <span className={styles.chestEmblem}><Icon size={21}/></span>
  </div>;
}

export function EncounterPanel({ venueId, signedIn, enabled, accountKey, proximity }: {
  venueId: string; signedIn: boolean; enabled: boolean; accountKey?: string;
  proximity: { mode: "manual" | "live"; fix: ExplorerLocationFix | null };
}) {
  const headingId = useId();
  const [publicData, setPublicData] = useState<EncounterPublic | null>(null), [loading, setLoading] = useState(false), [loadError, setLoadError] = useState("");
  const [version, setVersion] = useState(0), [code, setCode] = useState(""), [activeSession, setActiveSession] = useState<string | null>(null), [copyMessage, setCopyMessage] = useState("");
  const [cameraSession, setCameraSession] = useState<string | null>(null);
  const publicRequest = useRef<AbortController | null>(null);
  const account = useEncounterAccount({ signedIn, enabled, accountKey, scope: venueId });
  const now = useEncounterClock(account.data?.serverTime ?? publicData?.serverTime);
  useEffect(() => {
    let alive = true, epoch = 0;
    setPublicData(null); setCode(""); setActiveSession(null); setCopyMessage(""); setCameraSession(null);
    const load = async () => {
      publicRequest.current?.abort(); const controller = new AbortController(); publicRequest.current = controller; const attempt = ++epoch;
      if (!enabled || document.visibilityState === "hidden") { setLoading(false); return; }
      setLoading(true); setLoadError("");
      try {
        const data = await requestVenueEncounters(venueId, controller.signal);
        if (alive && !controller.signal.aborted && attempt === epoch) setPublicData(data);
      } catch { if (alive && !controller.signal.aborted && attempt === epoch) setLoadError("These encounters could not load. Try again shortly."); }
      finally { if (alive && !controller.signal.aborted && attempt === epoch) setLoading(false); }
    };
    const visibility = () => {
      if (document.visibilityState === "hidden") { epoch++; publicRequest.current?.abort(); setCode(""); setCopyMessage(""); setLoading(false); }
      else void load();
    };
    void load(); document.addEventListener("visibilitychange", visibility);
    return () => { alive = false; epoch++; publicRequest.current?.abort(); document.removeEventListener("visibilitychange", visibility); };
  }, [venueId, enabled, accountKey, version]);
  const campaigns = (publicData?.encounters ?? []).filter(campaign => Date.parse(campaign.startsAt) <= now && Date.parse(campaign.endsAt) > now && campaign.claimedCount < campaign.maxClaims);
  const session = account.data?.sessions.find(item => item.id === activeSession && item.venueId === venueId)
    ?? account.data?.sessions.find(item => item.venueId === venueId);
  const item = account.data?.inventory.find(entry => entry.id === account.acknowledgedItemId && entry.venue.id === venueId);
  const sessionCampaign = campaigns.find(campaign => campaign.id === session?.encounterId);
  async function start(campaign: EncounterCampaign) {
    setCode(""); const result = await account.act({ action: "start", encounterId: campaign.id });
    if (result?.result?.sessionId) setActiveSession(result.result.sessionId);
  }
  async function claim(event: FormEvent) {
    event.preventDefault(); if (!session) return;
    const result = await account.act({ action: "claim", sessionId: session.id, code });
    if (result) { setCode(""); setCameraSession(null); }
  }
  async function copyReference() {
    if (!session) return;
    try { await navigator.clipboard.writeText(session.id); setCopyMessage("Encounter reference copied."); }
    catch { setCopyMessage("Select the reference to copy it manually."); }
  }
  const confirmationForm = session ? (<form onSubmit={claim} className={styles.claimForm}><label>Staff confirmation code<input value={code} onChange={event => setCode(event.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false}
              required minLength={32} maxLength={32} pattern="[a-fA-F0-9]{32}" aria-describedby={`${headingId}-code-help`}/></label>
              <p id={`${headingId}-code-help`} className={styles.hint}>Codes are single use, expire after two minutes and belong to this encounter.</p>
              <button className={styles.primary} type="submit" disabled={!!account.busy || !!account.unconfirmed || !sessionCampaign || Date.parse(session.expiresAt) <= now || !["started", "awaiting_confirmation"].includes(session.state)}><ShieldCheck size={17}/>{account.busy === "claim" ? "Confirming…" : "Confirm and open"}</button></form>) : null;
  if (!enabled) return <section className={styles.panel} aria-labelledby={headingId}><div className={styles.sectionHeading}><Gift size={20}/><h2 id={headingId}>Restaurant encounters</h2></div>
    <p>Encounters are not enabled yet. Manual walking does not grant items or offers.</p><Link href="/inventory">Open inventory<ArrowUpRight size={14}/></Link></section>;
  return <section className={styles.panel} aria-labelledby={headingId} aria-busy={loading}>
    <div className={styles.sectionHeading}><Gift size={21}/><h2 id={headingId}>A little more to discover</h2><Link href="/inventory">Your inventory<ArrowUpRight size={14}/></Link>
      <button type="button" className={styles.secondary} disabled={loading} onClick={() => setVersion(value => value + 1)}><RefreshCw size={15}/>Refresh encounters</button></div>
    <p className={styles.intro}>Approved experiences from this restaurant. Staff confirmation is required before an item can be drawn.</p>
    {loading && <p role="status">Checking restaurant encounters…</p>}
    {loadError && <div className={styles.notice} role="alert">{loadError}<button type="button" onClick={() => setVersion(value => value + 1)}><RefreshCw size={15}/>Try again</button></div>}
    {!loading && !loadError && !campaigns.length && <p className={styles.empty}>There are no approved encounters at this restaurant right now.</p>}
    <div className={styles.campaigns}>{campaigns.map(campaign => {
      const near = proximity.mode === "live" ? encounterProximity(proximity.fix, campaign.venue.coordinates, campaign.radiusMetres, Date.now()) : null;
      const weight = campaign.pool.reduce((total, entry) => total + entry.weight, 0);
      const collected = account.data?.inventory.some(entry => entry.encounterId === campaign.id && Date.parse(entry.claimedAt) + campaign.cooldownHours * 3600000 > now);
      return <article key={campaign.id} className={styles.campaign} data-nearby={near?.nearby ?? false}>
        <div className={styles.campaignCopy}><span className={styles.eyebrow}>{campaign.venue.name}</span><h3>{campaign.title}</h3><p>{campaign.description}</p>
          <p className={styles.proximity}><MapPin size={14}/>{proximity.mode === "manual" ? "Manual preview. Your physical location is not confirmed."
            : near ? `${near.nearby ? "Nearby" : "About"} ${Math.round(near.distance)} m away. GPS is a guide only.` : "Waiting for a fresh, accurate location fix. You can still ask staff about this encounter."}</p>
          <div className={styles.meta}><span><Clock3 size={14}/>{campaign.cooldownHours} h between claims</span><span>{Math.max(0, campaign.maxClaims - campaign.claimedCount)} items remaining</span></div>
          {signedIn ? <button type="button" className={styles.primary} disabled={!!account.busy || campaign.claimedCount >= campaign.maxClaims || !!account.unconfirmed || collected}
            onClick={() => void start(campaign)}><PackageOpen size={17}/>{collected ? "Collected for now" : account.data?.sessions.some(entry => entry.encounterId === campaign.id) ? "Continue encounter" : "Begin encounter"}</button>
            : <Link className={styles.primary} href="/auth/sign-in">Sign in to begin<ArrowUpRight size={16}/></Link>}
        </div>
        <details className={styles.pool}><summary>View approved item pool</summary><p>One item is drawn after confirmation. Rarity does not change the visit requirements.</p>
          {campaign.pool.map(entry => <div key={entry.id} className={styles.poolRow}><span><strong>{entry.name}</strong><small>{entry.kind === "offer" ? "Approved restaurant offer" : "Digital collectible · no monetary value"}</small></span>
            <span className={styles.rarity} data-rarity={entry.rarity}>{rarityLabel[entry.rarity]}<small>{(entry.weight / weight * 100).toLocaleString("en-AU", { maximumFractionDigits: 1 })}%</small></span></div>)}</details>
      </article>;
    })}</div>
    {session && <div className={styles.encounterStage} data-encounter-state={session.state}>
      <EncounterChest open={!!item} theme={sessionCampaign?.theme} rarity={item?.rarity}/>
      <div className={styles.confirmation}><span className={styles.eyebrow}>{item ? "ADDED TO YOUR INVENTORY" : "YOUR ENCOUNTER"}</span>
        <h3>{item?.name ?? session.title}</h3>
        {item ? <><p>{item.description}</p><span className={styles.rarity} data-rarity={item.rarity}>{rarityLabel[item.rarity]}</span><p className={styles.success}><Check size={16}/>Confirmed item saved.</p><Link className={styles.primary} href="/inventory">View your item<ArrowUpRight size={15}/></Link></>
          : <><p>Show this reference to staff, then enter the fresh confirmation code they give you.</p>
            <div className={styles.reference}><code>{session.id}</code><button type="button" aria-label="Copy encounter reference" onClick={() => void copyReference()}><Copy size={16}/></button></div>
            {copyMessage && <p role="status" className={styles.hint}>{copyMessage}</p>}
            <p className={styles.hint}><Clock3 size={14}/>{Date.parse(session.expiresAt) <= now ? "This encounter has expired. Start again when ready." : `Encounter expires in ${encounterTimeRemaining(session.expiresAt, now)}.`}</p>
            {!sessionCampaign && <p className={styles.hint}>This encounter is no longer available. Refresh encounters or cancel it.</p>}
            {cameraSession === session.id && sessionCampaign && !item && Date.parse(session.expiresAt) > now && ["started", "awaiting_confirmation"].includes(session.state)
              ? <EncounterCamera title={session.title} onClose={() => setCameraSession(null)} collectible={<EncounterChest theme={sessionCampaign.theme}/>}>
                  {confirmationForm}
                  {account.error && <p role="alert" className={styles.error}>{account.error}</p>}
                  {account.unconfirmed && <button type="button" className={styles.secondary} onClick={() => setCameraSession(null)}>Return to inventory verification</button>}
                </EncounterCamera>
              : <>{confirmationForm}{sessionCampaign && Date.parse(session.expiresAt) > now && ["started", "awaiting_confirmation"].includes(session.state) && <button type="button" className={styles.secondary} onClick={() => setCameraSession(session.id)}>Open camera encounter</button>}</>}

            <button className={styles.secondary} type="button" disabled={!!account.busy || account.unconfirmed} onClick={() => { setCode(""); void account.act({ action: "cancel", sessionId: session.id }); }}><X size={15}/>Cancel encounter</button>
          </>}
      </div>
    </div>}
    {!session && item && <div className={styles.encounterStage}><EncounterChest open theme={publicData?.encounters.find(campaign => campaign.id === item.encounterId)?.theme} rarity={item.rarity}/><div><span className={styles.eyebrow}>CONFIRMED ITEM</span><h3>{item.name}</h3><p>{item.description}</p><div className={styles.actions}><span className={styles.rarity} data-rarity={item.rarity}>{rarityLabel[item.rarity]}</span><Link className={styles.primary} href="/inventory">Open inventory<ArrowUpRight size={15}/></Link></div></div></div>}
    {account.loading && signedIn && <p role="status">Loading your current encounters…</p>}
    {account.message && <p className={styles.hint} role="status">{account.message}</p>}
    {account.error && <p className={styles.error} role="alert">{account.error}</p>}
    {(account.error || account.unconfirmed) && signedIn && <div className={styles.actions}>{account.canRetry && <button className={styles.primary} type="button" disabled={!!account.busy} onClick={() => void account.retry()}>Retry same submission</button>}
      <button className={styles.secondary} type="button" disabled={!!account.busy} onClick={() => void account.refresh()}><RefreshCw size={15}/>Refresh inventory</button></div>}
    <p className={styles.footnote}>Walking and GPS never confirm a visit or grant XP. Restaurant offers require the venue's redemption check. Digital collectibles have no monetary value.</p>
  </section>;
}
