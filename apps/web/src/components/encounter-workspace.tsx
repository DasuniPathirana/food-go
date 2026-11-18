"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowUpRight, CheckCircle2, Clock3, Copy, Gift, PackageOpen, Plus, RefreshCw, ShieldCheck, Ticket, Trash2, X } from "lucide-react";
import { encounterCommandSchema, rarityLabel, type EncounterCampaign, type EncounterInput, type EncounterInventoryItem, type EncounterRarity, type EncounterSnapshot } from "@/lib/encounters";
import { encounterTimeRemaining, useEncounterAccount, useEncounterClock } from "@/lib/encounter-client";
import { EncounterChest } from "./encounter-panel";
import styles from "./encounter.module.css";

type DraftEntry = { id: string; kind: "collectible" | "offer"; name: string; description: string; rarity: EncounterRarity; weight: string; promotionId: string };
const newEntry = (): DraftEntry => ({ id: crypto.randomUUID(), kind: "collectible", name: "", description: "", rarity: "common", weight: "100", promotionId: "" });
const localDate = (value: Date) => new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const stateLabel = { collected: "Collected", available: "Ready for venue redemption", redeemed: "Redeemed", expired: "Expired", unavailable: "Unavailable" };
type Act = (input: EncounterInput) => Promise<EncounterSnapshot | null>;

function CampaignRow({ campaign, managed, operator, busy, act }: { campaign: EncounterCampaign; managed: boolean; operator: boolean; busy: boolean; act: Act }) {
  const [reason, setReason] = useState("");
  const [decision, setDecision] = useState<"approve" | "reject" | "withdraw">(campaign.state === "published" ? "withdraw" : "approve");
  async function review(event: FormEvent) {
    event.preventDefault(); await act({ action: "review", encounterId: campaign.id, version: campaign.version, decision, reason });
  }
  return <article className={styles.managedCampaign}><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>{campaign.venue.name}</span><h3>{campaign.title}</h3></div><strong className={styles.state}>{campaign.state}</strong></div>
    <p>{campaign.description}</p><p className={styles.hint}>{new Date(campaign.startsAt).toLocaleString("en-AU")} to {new Date(campaign.endsAt).toLocaleString("en-AU")}</p>
    <div className={styles.meta}><span>{campaign.claimedCount} / {campaign.maxClaims} claimed</span><span>{campaign.radiusMetres} m discovery radius</span><span>{campaign.cooldownHours} h cooldown</span></div>
    <details className={styles.pool}><summary>Review item pool and terms</summary>{campaign.pool.map(item => <div className={styles.poolRow} key={item.id}><span><strong>{item.name}</strong><small>{item.description}</small>{item.promotionId && <small>Approved promotion: {item.promotionId}</small>}</span>
      <span className={styles.rarity} data-rarity={item.rarity}>{rarityLabel[item.rarity]}<small>Weight {item.weight}</small></span></div>)}</details>
    {managed && campaign.state === "draft" && <button className={styles.primary} type="button" disabled={busy} onClick={() => void act({ action: "submit", encounterId: campaign.id, version: campaign.version })}>Submit for independent review</button>}
    {operator && !managed && ["pending", "published"].includes(campaign.state) && <form className={styles.reviewForm} onSubmit={review}>
      <h4>Independent operator decision</h4><p className={styles.hint}>Check participation, item descriptions, quantities and linked offer terms before approving.</p>
      <label>Decision<select value={decision} onChange={event => setDecision(event.target.value as typeof decision)}>{campaign.state === "pending" ? <><option value="approve">Approve encounter</option><option value="reject">Reject draft</option></> : <option value="withdraw">Withdraw encounter</option>}</select></label>
      <label>Review reason<textarea minLength={5} maxLength={400} required value={reason} onChange={event => setReason(event.target.value)} rows={2}/></label>
      <button className={styles.secondary} type="submit" disabled={busy}><ShieldCheck size={16}/>Save decision</button>
    </form>}
    {operator && managed && ["pending", "published"].includes(campaign.state) && <p className={styles.hint}>Another independent operator must review your organisation's encounter.</p>}
  </article>;
}

function CreateCampaign({ venues, act, busy, onClose }: { venues: NonNullable<EncounterSnapshot>["managedVenues"]; act: Act; busy: boolean; onClose: () => void }) {
  const [identity] = useState(() => crypto.randomUUID()), [entries, setEntries] = useState<DraftEntry[]>(() => [newEntry()]);
  const [error, setError] = useState("");
  const [dates] = useState(() => ({ start: localDate(new Date(Date.now() + 5 * 60000)), end: localDate(new Date(Date.now() + 7 * 86400000)) }));
  const [timezone, setTimezone] = useState("your local time");
  useEffect(() => setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone), []);
  function update(id: string, value: Partial<DraftEntry>) { setEntries(items => items.map(item => item.id === id ? { ...item, ...value } : item)); }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const form = new FormData(event.currentTarget), get = (key: string) => String(form.get(key) ?? "");
    let startsAt: string, endsAt: string;
    try { startsAt = new Date(get("startsAt")).toISOString(); endsAt = new Date(get("endsAt")).toISOString(); }
    catch { setError("Choose valid start and end times."); return; }
    const pool = entries.map(entry => entry.kind === "collectible" ? { id: entry.id, kind: entry.kind, name: entry.name, description: entry.description, rarity: entry.rarity, weight: Number(entry.weight) }
      : { id: entry.id, kind: entry.kind, promotionId: entry.promotionId.trim(), rarity: entry.rarity, weight: Number(entry.weight) });
    const parsed = encounterCommandSchema.safeParse({ action: "create", requestId: identity, encounterId: identity, venueId: get("venueId"), title: get("title"), description: get("description"), theme: get("theme"),
      radiusMetres: Number(get("radiusMetres")), cooldownHours: Number(get("cooldownHours")), startsAt, endsAt, maxClaims: Number(get("maxClaims")), offerValidityHours: Number(get("offerValidityHours")), pool });
    if (!parsed.success || parsed.data.action !== "create") { setError("Check the details, pool entries and schedule. Encounters can run for up to 90 days."); return; }
    const { requestId: _requestId, ...input } = parsed.data;
    if (await act(input)) onClose();
  }
  return <form className={styles.createForm} onSubmit={create}>
    <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>INVITE A LITTLE DISCOVERY</span><h2>Create a restaurant encounter</h2></div><button type="button" className={styles.iconButton} aria-label="Close encounter draft" onClick={onClose}><X size={20}/></button></div>
    <p>Describe genuine items your restaurant can provide. Offers must already be published and cover the full encounter schedule. A separate operator reviews the pool before it appears on the map.</p>
    <div className={styles.formGrid}>
      <label>Restaurant<select name="venueId" required>{venues.map(venue => <option key={venue.id} value={venue.id}>{venue.name}</option>)}</select></label>
      <label>Theme<select name="theme" defaultValue="restaurant"><option value="restaurant">Restaurant table</option><option value="cafe">Cafe counter</option><option value="market">Market basket</option></select></label>
      <label className={styles.wide}>Encounter title<input name="title" required minLength={2} maxLength={90}/></label>
      <label className={styles.wide}>What should guests expect?<textarea name="description" required minLength={2} maxLength={600} rows={3}/></label>
      <label>Starts on<input name="startsAt" type="datetime-local" defaultValue={dates.start} required/></label><label>Ends on<input name="endsAt" type="datetime-local" defaultValue={dates.end} required/></label>
      <p className={`${styles.hint} ${styles.wide}`}>Times use {timezone} and are saved with an explicit time zone.</p>
      <label>Discovery radius (metres)<input name="radiusMetres" type="number" step="1" min={30} max={150} defaultValue={60} required/></label>
      <label>Hours between venue claims<input name="cooldownHours" type="number" step="1" min={24} max={168} defaultValue={24} required/></label>
      <label>Total available items<input name="maxClaims" type="number" step="1" min={1} max={10000} defaultValue={50} required/></label>
      <label>Offer validity after claim (hours)<input name="offerValidityHours" type="number" step="1" min={1} max={168} defaultValue={24} required/></label>
    </div>
    <div className={styles.sectionHeading}><h3>Approved item pool</h3><button type="button" className={styles.secondary} disabled={entries.length >= 8 || busy} onClick={() => setEntries(items => [...items, newEntry()])}><Plus size={16}/>Add item</button></div>
    <p className={styles.hint}>Weights set each item's chance. Digital collectibles have no cash value. Rarity never removes the confirmation requirement.</p>
    {entries.map((entry, index) => <fieldset className={styles.poolEditor} key={entry.id}><legend>Item {index + 1}</legend><div className={styles.formGrid}>
      <label>Item type<select value={entry.kind} onChange={event => update(entry.id, { kind: event.target.value as DraftEntry["kind"] })}><option value="collectible">Digital collectible</option><option value="offer">Existing approved offer</option></select></label>
      <label>Rarity<select value={entry.rarity} onChange={event => update(entry.id, { rarity: event.target.value as EncounterRarity })}>{Object.entries(rarityLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      {entry.kind === "collectible" ? <><label>Collectible name<input required minLength={2} maxLength={80} value={entry.name} onChange={event => update(entry.id, { name: event.target.value })}/></label>
        <label className={styles.wide}>Collectible description<textarea required minLength={2} maxLength={300} rows={2} value={entry.description} onChange={event => update(entry.id, { description: event.target.value })}/></label></>
        : <label className={styles.wide}>Published promotion ID<input required minLength={36} maxLength={36} value={entry.promotionId} autoComplete="off" onChange={event => update(entry.id, { promotionId: event.target.value })}/><small>Name and terms come from the approved promotion. No new discount is created here.</small></label>}
      <label>Draw weight<input required type="number" min={1} max={1000} step="1" value={entry.weight} onChange={event => update(entry.id, { weight: event.target.value })}/></label>
      <div className={styles.fieldAction}><button className={styles.secondary} type="button" disabled={entries.length <= 1 || busy} onClick={() => setEntries(items => items.filter(item => item.id !== entry.id))}><Trash2 size={15}/>Remove item {index + 1}</button></div>
    </div></fieldset>)}
    {error && <p className={styles.error} role="alert">{error}</p>}
    <button className={styles.primary} type="submit" disabled={busy}>Save encounter draft</button>
  </form>;
}

function InventoryCard({ item, now, busy, act }: { item: EncounterInventoryItem; now: number; busy: boolean; act: Act }) {
  const expired = item.kind === "offer" && item.expiresAt !== null && Date.parse(item.expiresAt) <= now;
  const state = expired && item.state === "available" ? "expired" : item.state;
  return <article className={styles.inventoryCard} data-rarity={item.rarity}>
    <div className={styles.itemMark} aria-hidden="true">{item.kind === "offer" ? <Ticket size={34}/> : <Gift size={34}/>}</div>
    <div className={styles.inventoryCopy}><span className={styles.eyebrow}>{item.venue.name}</span><h3>{item.name}</h3><p>{item.description}</p>
      <div className={styles.meta}><span className={styles.rarity} data-rarity={item.rarity}>{rarityLabel[item.rarity]}</span><strong>{stateLabel[state]}</strong></div>
      {item.kind === "collectible" ? <p className={styles.hint}>Digital collectible. No monetary value and no expiry.</p> : item.expiresAt && <p className={styles.hint}><Clock3 size={14}/>{state === "available" ? `Expires in ${encounterTimeRemaining(item.expiresAt, now)}.` : `Valid until ${new Date(item.expiresAt).toLocaleString("en-AU")}.`}</p>}
      {state === "available" && <button className={styles.primary} type="button" disabled={busy} onClick={() => void act({ action: "prepareRedemption", itemId: item.id })}><ShieldCheck size={16}/>Show venue redemption code</button>}
      {item.redeemedAt && <p className={styles.hint}><CheckCircle2 size={15}/>Redeemed {new Date(item.redeemedAt).toLocaleString("en-AU")}</p>}
      <Link href={`/venues/${encodeURIComponent(item.venue.slug)}`}>View restaurant<ArrowUpRight size={14}/></Link>
    </div>
  </article>;
}

export function EncounterWorkspace({ mode, signedIn, enabled, accountKey }: { mode: "inventory" | "manage"; signedIn: boolean; enabled: boolean; accountKey?: string }) {
  const account = useEncounterAccount({ signedIn, enabled, accountKey, scope: mode });
  const now = useEncounterClock(account.data?.serverTime);
  const [creating, setCreating] = useState(false), [reference, setReference] = useState(""), [redemption, setRedemption] = useState(""), [copyMessage, setCopyMessage] = useState("");
  const [filter, setFilter] = useState<"all" | "collectible" | "offer">("all");
  useEffect(() => {
    const clear = () => { if (document.visibilityState === "hidden") { setReference(""); setRedemption(""); setCopyMessage(""); } };
    document.addEventListener("visibilitychange", clear); setReference(""); setRedemption(""); setCopyMessage(""); setCreating(false);
    return () => document.removeEventListener("visibilitychange", clear);
  }, [accountKey, mode, signedIn]);
  async function issue(event: FormEvent) { event.preventDefault(); await account.act({ action: "issue", sessionId: reference.trim() }); }
  async function redeem(event: FormEvent) { event.preventDefault(); if (await account.act({ action: "redeem", code: redemption })) setRedemption(""); }
  async function copyIssued() {
    if (!account.issued) return;
    try { await navigator.clipboard.writeText(account.issued.code); setCopyMessage("Confirmation code copied."); }
    catch { setCopyMessage("Select the code to copy it manually."); }
  }
  const managed = new Set(account.data?.managedVenues.map(venue => venue.id) ?? []);
  const inventory = account.data?.inventory.filter(item => filter === "all" || item.kind === filter) ?? [];
  return <div className={styles.workspace}>
    <header className={styles.workspaceHeading}><div><span className={styles.eyebrow}>FOOD GO · DISCOVERY CLUB</span><h1>{mode === "inventory" ? "Your little collection." : "Restaurant encounters."}</h1>
      <p>{mode === "inventory" ? "Keepsakes from confirmed experiences, and genuine offers ready for the venue to check." : "Create considered item pools, confirm guest encounters and redeem approved offers."}</p></div>
      <Link className={styles.secondary} href={mode === "inventory" ? "/" : "/inventory"}>{mode === "inventory" ? "Explore the map" : "Open inventory"}<ArrowUpRight size={16}/></Link></header>
    {!enabled ? <section className={styles.emptyState}><PackageOpen size={35}/><h2>Encounters are not enabled yet.</h2><p>Restaurant items will appear here after the approved encounter service is available. Manual exploration never grants items or offers.</p><Link className={styles.primary} href="/">Keep exploring<ArrowUpRight size={16}/></Link></section>
      : !signedIn ? <section className={styles.emptyState}><EncounterChest/><h2>A place for your discoveries.</h2><p>Sign in with a verified account to keep confirmed items and manage your encounters.</p><Link className={styles.primary} href={mode === "inventory" ? "/auth/sign-in?next=/inventory" : "/auth/sign-in?next=/encounters"}>Sign in to continue<ArrowUpRight size={16}/></Link></section>
        : <>
          <div className={styles.workspaceTools}><span>{account.data ? `${account.data.inventory.length} confirmed items` : "Your encounter account"}</span><button type="button" className={styles.secondary} disabled={!!account.busy} onClick={() => void account.refresh()}><RefreshCw size={16}/>Refresh</button></div>
          {account.loading && <p role="status">Loading your encounters…</p>}
          {account.message && <p role="status" className={styles.notice}>{account.message}</p>}
          {account.error && <p role="alert" className={styles.error}>{account.error}</p>}
          {account.canRetry && <button type="button" className={styles.primary} disabled={!!account.busy} onClick={() => void account.retry()}>Retry same submission</button>}
          {account.issued && <section className={styles.issuedCode} aria-label="Temporary confirmation code"><div><ShieldCheck size={22}/><h2>{account.issued.action === "issue" ? "Give this code to this guest." : "Show this code to venue staff."}</h2>
            <p>{account.issued.action === "issue" ? "Confirm the guest's qualifying visit before sharing. The code belongs only to their current encounter." : "Only staff at the issuing restaurant can confirm redemption. Sharing this code does not redeem the offer."}</p></div>
            <code>{account.issued.code}</code><div className={styles.actions}><button type="button" className={styles.secondary} onClick={() => void copyIssued()}><Copy size={16}/>Copy code</button>
              <button type="button" className={styles.secondary} onClick={account.dismissCode}><X size={16}/>Close code</button></div><p className={styles.hint}>Expires in {encounterTimeRemaining(account.issued.expiresAt, now)}. Codes are single use.</p>{copyMessage && <p role="status">{copyMessage}</p>}</section>}
          {mode === "inventory" ? <>
            <div className={styles.filters} role="group" aria-label="Inventory type">{([["all", "All items"], ["collectible", "Collectibles"], ["offer", "Restaurant offers"]] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
            {!account.loading && account.data && !inventory.length && <section className={styles.emptyState}><EncounterChest/><h2>{filter === "all" ? "A good story starts outside." : "No items in this collection yet."}</h2><p>Find an approved restaurant encounter on the map, then ask staff to confirm your visit.</p><Link className={styles.primary} href="/">Explore nearby restaurants<ArrowUpRight size={16}/></Link></section>}
            <div className={styles.inventoryGrid}>{inventory.map(item => <InventoryCard key={item.id} item={item} now={now} busy={!!account.busy || account.unconfirmed} act={account.act}/>)}</div>
            {!!account.data?.sessions.length && <section className={styles.pendingSessions}><h2>Encounters in progress</h2>{account.data.sessions.map(session => <div key={session.id}><span><strong>{session.title}</strong><small>{session.state.replaceAll("_", " ")} · {encounterTimeRemaining(session.expiresAt, now)} remaining</small></span><Link href="/">Return to map<ArrowUpRight size={14}/></Link></div>)}</section>}
            <p className={styles.footnote}>Collectibles are digital keepsakes with no monetary value. Offers retain the restaurant's approved terms, expiry and redemption checks. Items cannot be transferred.</p>
          </> : <>
            {!!account.data?.managedVenues.length && <section className={styles.managementIntro}><div><h2>Bring a little discovery to your restaurant.</h2><p>Start with a small, genuine item pool. Published offers can be linked to your campaign without changing their terms.</p></div><button className={styles.primary} type="button" disabled={!!account.busy || account.unconfirmed} aria-expanded={creating} onClick={() => setCreating(value => !value)}><Plus size={17}/>Create encounter</button></section>}
            {creating && !!account.data?.managedVenues.length && <CreateCampaign venues={account.data.managedVenues} busy={!!account.busy || account.unconfirmed} act={account.act} onClose={() => setCreating(false)}/>}
            {!!account.data?.managedVenues.length && <details className={styles.staffTools}><summary><ShieldCheck size={19}/>Staff confirmation and redemption</summary><div className={styles.staffForms}>
              <form onSubmit={issue}><h3>Confirm a guest encounter</h3><p>Ask the guest to show their current encounter reference. Check their qualifying activity before issuing a code.</p><label>Guest encounter reference<input minLength={36} maxLength={36} required autoComplete="off" value={reference} onChange={event => setReference(event.target.value)}/></label>
                <button className={styles.primary} type="submit" disabled={!!account.busy || account.unconfirmed}>Generate confirmation code</button></form>
              <form onSubmit={redeem}><h3>Redeem an approved offer</h3><p>Check the guest's item and its restaurant terms. Enter the fresh redemption code from their inventory.</p><label>Guest redemption code<input minLength={32} maxLength={32} pattern="[a-fA-F0-9]{32}" required autoComplete="off" autoCapitalize="none" spellCheck={false} value={redemption} onChange={event => setRedemption(event.target.value)}/></label>
                <button className={styles.primary} type="submit" disabled={!!account.busy || account.unconfirmed}>Confirm offer redemption</button></form>
            </div></details>}
            {account.data?.operator && <p className={styles.notice}><ShieldCheck size={18}/>Independent operator review is available for this verified operator session.</p>}
            {account.data && !account.data.managedVenues.length && !account.data.operator && <section className={styles.emptyState}><ShieldCheck size={32}/><h2>No restaurant management access.</h2><p>Current owners and managers of approved, game-enabled restaurants can submit encounter pools. Operator review requires a separate authorised session.</p><Link className={styles.secondary} href="/partner">Open restaurant workspace<ArrowUpRight size={15}/></Link></section>}
            {!!account.data?.campaigns.length && <section className={styles.campaignList}><h2>{account.data.operator ? "Encounter review and management" : "Your restaurant encounters"}</h2>{account.data.campaigns.map(campaign => <CampaignRow key={`${campaign.id}:${campaign.version}`} campaign={campaign} managed={managed.has(campaign.venue.id)} operator={account.data!.operator} busy={!!account.busy || account.unconfirmed} act={account.act}/>)}</section>}
          </>}
        </>}
  </div>;
}
