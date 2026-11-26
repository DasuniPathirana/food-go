"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, Download, RefreshCw, Sparkles, Upload } from "lucide-react";
import { MELBOURNE_PILOT_CENTER } from "@food-go/domain";
import type { OperatorRow, OperatorSection } from "@/lib/operator";
import type { LiveMall } from "@/lib/world-data";
import { uploadImageAsset } from "@/lib/media-client";
import { PilotMapPicker } from "./pilot-map-picker";
import styles from "@/app/admin/operator.module.css";

const labels = {
  "venue.verify": "Verify ownership",
  "venue.revoke": "Revoke ownership",
  "venue.publish": "Approve venue",
  "venue.suspend": "Suspend venue",
  "venue.locate": "Set map position",
  "building.approve": "Approve 3D building & pin",
  "building.reject": "Reject 3D proposal",
  "mall.upsert": "Save Mall",
  "mall.publish": "Publish Mall",
  "mall.suspend": "Suspend Mall",
  "reward.upsert": "Save Game Special Reward",
  "loot.approve": "Approve Loot",
  "loot.reject": "Reject Loot",
  "loot.withdraw": "Withdraw Loot",
  "promo.create": "Create deal",
  "promo.edit": "Edit deal",
  "promo.publish": "Approve & publish deal",
  "promo.withdraw": "Withdraw deal",
  "quest.approve": "Approve & publish quest",
  "quest.reject": "Reject quest",
  "quest.withdraw": "Withdraw quest",
  "post.publish": "Approve post",
  "post.remove": "Remove post",
  "comment.publish": "Approve comment",
  "comment.remove": "Remove comment",
  "report.dismiss": "Keep post",
  "report.remove": "Remove reported post",
} as const;

type Action = keyof typeof labels;

const guidance: Partial<Record<Action, string>> = {
  "venue.verify": "Confirm that the operator verified direct restaurant ownership before allowing deals or loot.",
  "venue.publish": "Make the verified food venue visible in the Melbourne 3D Explorer and catalogue.",
  "building.approve": "Applies proposed map pin, assigned Mall floor/unit, and 3D building style live.",
  "building.reject": "Rejects proposed 3D building / location and keeps previous approved placement.",
  "loot.approve": "Publishes this restaurant AR/Map loot drop inside the Melbourne 3D Explorer.",
  "promo.publish": "Publishes this deal to the Deals hub and marks it eligible for FoodGo Rewards.",
  "quest.approve": "Publishes this food quest so Melbourne explorers can join and complete check-in goals.",
  "report.dismiss": "Clears active community reports without removing the post.",
  "report.remove": "Clears active reports and permanently removes the post from walls.",
};

type AnalyticsPayload = {
  generatedAt?: string;
  accountsTotal: number;
  partnerAccounts: number;
  venues: { total: number; published: number; pending: number; suspended: number; pendingBuildingReviews: number };
  malls: { total: number; published: number; assignedShops: number };
  deals: { published: number; draft: number; claims: number; foodDeals: number; restaurantDeals: number; cafeOffers: number };
  loots: {
    publishedRestaurantLoots: number;
    pendingRestaurantLoots: number;
    publishedGameRewards: number;
    totalClaims: number;
    arGrabs: number;
    mapGrabs: number;
  };
  reservations: { total: number; pending: number; approved: number; completed: number; declined: number };
  quests: { published: number; pending: number; completions: number };
  community: { publishedPosts: number; pendingPosts: number; pendingComments: number; openReports: number };
  visitsAndCheckIns: number;
  topVenues: Array<{ id: string; name: string; suburb: string; visits: number; reservations: number; lootClaims: number }>;
};

function rowActions(section: OperatorSection, row: OperatorRow): Action[] {
  if (section === "venues") {
    const list: Action[] = [row.verified ? "venue.revoke" : "venue.verify", "venue.locate"];
    if (row.verified && row.state !== "published") list.push("venue.publish");
    if (row.state !== "suspended") list.push("venue.suspend");
    if (row.state === "published" && row.verified) list.push("promo.create");
    return list;
  }
  if (section === "buildings") {
    return row.state === "pending"
      ? ["building.approve", "building.reject"]
      : ["building.approve", "building.reject"];
  }
  if (section === "malls") {
    return row.state === "published" ? ["mall.suspend"] : ["mall.publish"];
  }
  if (section === "loots") {
    const out: Action[] = [];
    if (row.state === "pending" || row.state === "rejected") out.push("loot.approve");
    if (row.state === "pending") out.push("loot.reject");
    if (row.state === "published" || row.state === "pending") out.push("loot.withdraw");
    return out;
  }
  if (section === "promotions") {
    return ["promo.edit", ...(row.state === "published" ? (["promo.withdraw"] as const) : (["promo.publish"] as const))];
  }
  if (section === "quests") {
    if (row.state === "pending" || row.state === "draft") return ["quest.approve", "quest.reject"];
    if (row.state === "published") return ["quest.withdraw"];
    return [];
  }
  if (section === "posts") return row.state === "published" ? ["post.remove"] : ["post.publish", "post.remove"];
  if (section === "comments") return row.state === "published" ? ["comment.remove"] : ["comment.publish", "comment.remove"];
  if (section === "reports") return ["report.dismiss", "report.remove"];
  return [];
}

function displayDate(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Date(parsed).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Australia/Melbourne" });
}

function isoDateTime(local: string) {
  return local ? `${local}:00+11:00` : "";
}

function localInput(value?: string) {
  return value ? value.slice(0, 16) : "";
}

async function submitOperatorAction(payload: Record<string, unknown>) {
  const res = await fetch("/api/admin", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) throw new Error(body?.error || "Operator update could not be saved.");
}

async function submitQuestDecision(payload: { questId: string; decision: "approve" | "reject" | "withdraw"; reason: string; requestId: string }) {
  const res = await fetch("/api/adventure", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "questReview", ...payload }),
  });
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) throw new Error(body?.error || "Quest review could not be saved.");
}

function AdminAnalyticsSection() {
  const [report, setReport] = useState<AnalyticsPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadReport() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/analytics", { cache: "no-store", credentials: "same-origin" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Analytics report could not be loaded.");
      setReport(data as AnalyticsPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analytics unavailable.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReport();
  }, []);

  function downloadCsv() {
    if (!report) return;
    const rows: string[][] = [
      ["Section", "Metric", "Value"],
      ["Accounts", "Total Users", String(report.accountsTotal)],
      ["Accounts", "Partner Accounts", String(report.partnerAccounts)],
      ["Venues", "Published & Verified", String(report.venues.published)],
      ["Venues", "Pending / Draft", String(report.venues.pending)],
      ["Venues", "Pending 3D Building Proposals", String(report.venues.pendingBuildingReviews)],
      ["Malls", "Published Malls", String(report.malls.published)],
      ["Malls", "Shops Inside Malls", String(report.malls.assignedShops)],
      ["Deals", "Published Active Deals", String(report.deals.published)],
      ["Deals", "Food Deals", String(report.deals.foodDeals)],
      ["Deals", "Restaurant Deals", String(report.deals.restaurantDeals)],
      ["Deals", "Cafe Offers", String(report.deals.cafeOffers)],
      ["Deals", "Total Member Claims", String(report.deals.claims)],
      ["Loots", "Published Restaurant Loots", String(report.loots.publishedRestaurantLoots)],
      ["Loots", "Pending Restaurant Loots", String(report.loots.pendingRestaurantLoots)],
      ["Loots", "Published Admin Game Rewards", String(report.loots.publishedGameRewards)],
      ["Loots", "Total Claims", String(report.loots.totalClaims)],
      ["Loots", "AR Camera Grabs", String(report.loots.arGrabs)],
      ["Loots", "Map Grabs", String(report.loots.mapGrabs)],
      ["Reservations", "Total", String(report.reservations.total)],
      ["Reservations", "Pending", String(report.reservations.pending)],
      ["Reservations", "Approved", String(report.reservations.approved)],
      ["Reservations", "Completed", String(report.reservations.completed)],
      ["Community", "Published Posts", String(report.community.publishedPosts)],
      ["Community", "Open Reports", String(report.community.openReports)],
      ["Exploration", "Total Check-ins", String(report.visitsAndCheckIns)],
      [],
      ["Top Venue", "Suburb", "Visits", "Reservations", "Loot Claims"],
      ...report.topVenues.map(v => [v.name, v.suburb, String(v.visits), String(v.reservations), String(v.lootClaims)]),
    ];
    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `food-go-melbourne-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className={styles.actions}>
        <button type="button" onClick={() => void loadReport()} disabled={loading}>
          <RefreshCw size={15} /> {loading ? "Refreshing..." : "Refresh Live Report"}
        </button>
        {report && (
          <button type="button" onClick={downloadCsv}>
            <Download size={15} /> Export Full CSV Report
          </button>
        )}
      </div>

      {error && <p className={styles.bannerErr}>{error}</p>}
      {loading && !report && <p className={styles.help}>Loading real-time Melbourne platform metrics...</p>}

      {report && (
        <>
          <div className={styles.kpiGrid}>
            <article className={styles.kpiCard}>
              <span>Users & Partners</span>
              <strong>{report.accountsTotal}</strong>
              <small>{report.partnerAccounts} registered restaurant partners</small>
            </article>
            <article className={styles.kpiCard}>
              <span>Melbourne Food Venues</span>
              <strong>{report.venues.published} / {report.venues.total}</strong>
              <small>{report.venues.pending} pending approval | {report.venues.pendingBuildingReviews} 3D building reviews</small>
            </article>
            <article className={styles.kpiCard}>
              <span>Shared Malls</span>
              <strong>{report.malls.published}</strong>
              <small>{report.malls.assignedShops} published food outlets inside malls</small>
            </article>
            <article className={styles.kpiCard}>
              <span>Approved Deals & Claims</span>
              <strong>{report.deals.published}</strong>
              <small>Food: {report.deals.foodDeals} | Restaurant: {report.deals.restaurantDeals} | Cafe: {report.deals.cafeOffers} | Claims: {report.deals.claims}</small>
            </article>
            <article className={styles.kpiCard}>
              <span>AR & Map Loots</span>
              <strong>{report.loots.totalClaims} claims</strong>
              <small>{report.loots.arGrabs} AR grabs vs {report.loots.mapGrabs} Map grabs | {report.loots.publishedGameRewards} Game Rewards live</small>
            </article>
            <article className={styles.kpiCard}>
              <span>Table Reservations</span>
              <strong>{report.reservations.total}</strong>
              <small>Pending: {report.reservations.pending} | Approved: {report.reservations.approved} | Completed: {report.reservations.completed}</small>
            </article>
            <article className={styles.kpiCard}>
              <span>Quests & Check-ins</span>
              <strong>{report.visitsAndCheckIns}</strong>
              <small>{report.quests.published} active quests | {report.quests.completions} completions</small>
            </article>
            <article className={styles.kpiCard}>
              <span>Community Safety</span>
              <strong>{report.community.openReports} reports</strong>
              <small>{report.community.publishedPosts} live posts | {report.community.pendingPosts} posts pending | {report.community.pendingComments} comments pending</small>
            </article>
          </div>

          <section className={styles.tableWrap}>
            <h3>Top Performing Melbourne Pilot Venues</h3>
            {report.topVenues.length === 0 ? (
              <p className={styles.help}>No published venues recorded yet.</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Venue</th>
                    <th>Suburb</th>
                    <th>Check-in Visits</th>
                    <th>Reservations</th>
                    <th>Loot Claims</th>
                  </tr>
                </thead>
                <tbody>
                  {report.topVenues.map(v => (
                    <tr key={v.id}>
                      <td><strong>{v.name}</strong></td>
                      <td>{v.suburb}</td>
                      <td>{v.visits}</td>
                      <td>{v.reservations}</td>
                      <td>{v.lootClaims}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function AdminSpecialRewardPlacer({
  malls,
  existingLoots,
  editingLoot,
  onClearEdit,
  onSaved,
}: {
  malls: readonly LiveMall[];
  existingLoots: readonly OperatorRow[];
  editingLoot: OperatorRow | null;
  onClearEdit: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [grabMode, setGrabMode] = useState<"map_grab" | "ar_grab">("map_grab");
  const [rewardKind, setRewardKind] = useState<"xp_coins" | "collectible" | "offer">("xp_coins");
  const [modelStyle, setModelStyle] = useState<"golden_crystal" | "mystery_ring" | "reward_crate" | "dish_trophy" | "star_chest">("golden_crystal");
  const [visibilityMode, setVisibilityMode] = useState<"always_visible" | "proximity_reveal" | "scheduled_drop">("always_visible");
  const [rarity, setRarity] = useState<"common" | "rare" | "epic" | "legendary">("epic");
  const [xpReward, setXpReward] = useState(120);
  const [coinReward, setCoinReward] = useState(60);
  const [radiusMetres, setRadiusMetres] = useState(75);
  const [cooldownHours, setCooldownHours] = useState(24);
  const [maxClaims, setMaxClaims] = useState(2000);
  const [reason, setReason] = useState("Official Food Go pilot city special drop");
  const [coords, setCoords] = useState({ latitude: MELBOURNE_PILOT_CENTER[1], longitude: MELBOURNE_PILOT_CENTER[0] });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!editingLoot) return;
    setTitle(editingLoot.name);
    setDescription(editingLoot.detail || "Food Go city-wide special reward.");
    if (editingLoot.grabMode === "ar_grab" || editingLoot.grabMode === "map_grab") setGrabMode(editingLoot.grabMode);
    if (editingLoot.modelStyle === "golden_crystal" || editingLoot.modelStyle === "mystery_ring" || editingLoot.modelStyle === "reward_crate" || editingLoot.modelStyle === "dish_trophy" || editingLoot.modelStyle === "star_chest") {
      setModelStyle(editingLoot.modelStyle);
    }
    if (editingLoot.visibilityMode === "always_visible" || editingLoot.visibilityMode === "proximity_reveal" || editingLoot.visibilityMode === "scheduled_drop") {
      setVisibilityMode(editingLoot.visibilityMode);
    }
    if (editingLoot.rarity === "common" || editingLoot.rarity === "rare" || editingLoot.rarity === "epic" || editingLoot.rarity === "legendary") {
      setRarity(editingLoot.rarity);
    }
    setXpReward(editingLoot.xpReward ?? 120);
    setCoinReward(editingLoot.coinReward ?? 60);
    setRadiusMetres(editingLoot.radiusMetres ?? 75);
    if (typeof editingLoot.latitude === "number" && typeof editingLoot.longitude === "number") {
      setCoords({ latitude: editingLoot.latitude, longitude: editingLoot.longitude });
    }
  }, [editingLoot]);

  async function submitReward(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    setErr("");
    try {
      await submitOperatorAction({
        action: "reward.upsert",
        id: editingLoot?.id ?? crypto.randomUUID(),
        requestId: crypto.randomUUID(),
        reason,
        title,
        description,
        grabMode,
        rewardKind,
        modelStyle,
        visibilityMode,
        rarity,
        xpReward,
        coinReward,
        latitude: coords.latitude,
        longitude: coords.longitude,
        radiusMetres,
        cooldownHours,
        maxClaims,
      });
      setMsg(editingLoot ? "Game reward updated on Melbourne map." : "Special Game Reward placed live on Melbourne map.");
      if (!editingLoot) {
        setTitle("");
        setDescription("");
      } else {
        onClearEdit();
      }
      onSaved();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Could not place game reward.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.studioPanel}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h3><Sparkles size={18} style={{ verticalAlign: "middle" }} /> {editingLoot ? `Edit Special Reward: ${editingLoot.name}` : "Place Special Game Reward (Admin Map Drop)"}</h3>
          <p className={styles.help}>
            Decide exactly where official Food Go level-up crystals, mystery rings, and coin chests appear across Melbourne Pilot and how they reveal to explorers.
          </p>
        </div>
        {editingLoot && (
          <button type="button" className="secondary-button" onClick={onClearEdit}>New Game Reward</button>
        )}
      </header>

      {msg && <div className={styles.bannerOk}><Check size={15} /> {msg}</div>}
      {err && <div className={styles.bannerErr}>{err}</div>}

      <div className={styles.studioGrid}>
        <PilotMapPicker
          latitude={coords.latitude}
          longitude={coords.longitude}
          onChange={setCoords}
          malls={malls}
          markers={existingLoots
            .filter(l => typeof l.latitude === "number" && typeof l.longitude === "number")
            .map(l => ({ id: l.id, label: l.name, kind: l.source === "game_admin" ? "game_admin" : "loot", latitude: l.latitude!, longitude: l.longitude! }))}
          pinLabel="Click inside the Melbourne Pilot zone to position special game reward"
          height={330}
        />

        <form className={styles.form} style={{ marginTop: 0 }} onSubmit={submitReward}>
          <div className={styles.formGrid}>
            <label className={styles.fieldFull}>
              Reward Title
              <input value={title} onChange={e => setTitle(e.target.value)} required minLength={2} maxLength={90} placeholder="e.g. Swanston Mystery Crystal" />
            </label>
            <label>
              Discovery Mode
              <select value={grabMode} onChange={e => setGrabMode(e.target.value as "map_grab" | "ar_grab")}>
                <option value="map_grab">Map Grab (Direct on 3D map)</option>
                <option value="ar_grab">AR Grab (Camera AR scan)</option>
              </select>
            </label>
            <label>
              3D Object Model
              <select value={modelStyle} onChange={e => setModelStyle(e.target.value as typeof modelStyle)}>
                <option value="golden_crystal">Golden Crystal</option>
                <option value="mystery_ring">Mystery Ring (?)</option>
                <option value="star_chest">Star Chest</option>
                <option value="reward_crate">Reward Crate</option>
                <option value="dish_trophy">Dish Trophy</option>
              </select>
            </label>
            <label>
              Visibility Mode
              <select value={visibilityMode} onChange={e => setVisibilityMode(e.target.value as typeof visibilityMode)}>
                <option value="always_visible">Always Visible on 3D Map</option>
                <option value="proximity_reveal">Reveal Near Player (150m)</option>
                <option value="scheduled_drop">Timed Event Drop</option>
              </select>
            </label>
            <label>
              Rarity Tier
              <select value={rarity} onChange={e => setRarity(e.target.value as typeof rarity)}>
                <option value="common">Common</option>
                <option value="rare">Rare</option>
                <option value="epic">Epic</option>
                <option value="legendary">Legendary</option>
              </select>
            </label>
            <label>
              XP Bonus (10 to 1000)
              <input type="number" min={10} max={1000} value={xpReward} onChange={e => setXpReward(Number(e.target.value))} />
            </label>
            <label>
              Coin Bonus (0 to 1000)
              <input type="number" min={0} max={1000} value={coinReward} onChange={e => setCoinReward(Number(e.target.value))} />
            </label>
            <label>
              Grab Radius (20 to 250m)
              <input type="number" min={20} max={250} value={radiusMetres} onChange={e => setRadiusMetres(Number(e.target.value))} />
            </label>
            <label>
              Max Total Claims
              <input type="number" min={1} max={100000} value={maxClaims} onChange={e => setMaxClaims(Number(e.target.value))} />
            </label>
            <label>
              Player Cooldown (Hours)
              <input type="number" min={0} max={720} value={cooldownHours} onChange={e => setCooldownHours(Number(e.target.value))} />
            </label>
            <label>
              Reward Category
              <select value={rewardKind} onChange={e => setRewardKind(e.target.value as typeof rewardKind)}>
                <option value="xp_coins">Level-Up XP & Coins</option>
                <option value="collectible">City Collectible Badge</option>
                <option value="offer">Special City Bonus</option>
              </select>
            </label>
            <label className={styles.fieldFull}>
              Explorer Description
              <textarea value={description} onChange={e => setDescription(e.target.value)} required minLength={2} maxLength={600} rows={2} />
            </label>
            <label className={styles.fieldFull}>
              Audit Note
              <input value={reason} onChange={e => setReason(e.target.value)} required minLength={3} maxLength={240} />
            </label>
          </div>
          <div className={styles.actions}>
            <button type="submit" className="primary-button" disabled={busy}>
              {busy ? "Publishing drop..." : editingLoot ? "Update Special Reward" : "Drop Reward on Melbourne Map"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

function AdminMallCreator({
  editingMall,
  onClearEdit,
  onSaved,
}: {
  editingMall: OperatorRow | null;
  onClearEdit: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [suburb, setSuburb] = useState("Melbourne");
  const [postcode, setPostcode] = useState("3000");
  const [entranceDescription, setEntranceDescription] = useState("Main CBD street atrium entrance");
  const [modelPreset, setModelPreset] = useState<"city-mall" | "arcade-heritage" | "urban-precinct" | "skyline-complex">("city-mall");
  const [coords, setCoords] = useState({ latitude: MELBOURNE_PILOT_CENTER[1], longitude: MELBOURNE_PILOT_CENTER[0] });
  const [reason, setReason] = useState("Approved Melbourne shared food mall building");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!editingMall) return;
    setName(editingMall.name);
    setAddress(editingMall.detail?.split(" · ")[0] || "211 La Trobe St");
    if (typeof editingMall.latitude === "number" && typeof editingMall.longitude === "number") {
      setCoords({ latitude: editingMall.latitude, longitude: editingMall.longitude });
    }
    if (editingMall.modelPreset === "city-mall" || editingMall.modelPreset === "arcade-heritage" || editingMall.modelPreset === "urban-precinct" || editingMall.modelPreset === "skyline-complex") {
      setModelPreset(editingMall.modelPreset);
    }
  }, [editingMall]);

  async function submitMall(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    setErr("");
    try {
      await submitOperatorAction({
        action: "mall.upsert",
        id: editingMall?.id ?? crypto.randomUUID(),
        requestId: crypto.randomUUID(),
        reason,
        name,
        address,
        suburb,
        postcode,
        latitude: coords.latitude,
        longitude: coords.longitude,
        entranceDescription,
        modelPreset,
      });
      setMsg("Shared Mall saved and ready for multi-restaurant floor assignments.");
      if (!editingMall) {
        setName("");
        setAddress("");
      } else {
        onClearEdit();
      }
      onSaved();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Could not save Mall.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.studioPanel}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h3>{editingMall ? `Edit Mall: ${editingMall.name}` : "Add Shared Melbourne Food Mall / Arcade"}</h3>
          <p className={styles.help}>Multiple restaurants and cafes can share a single Mall building marker on the 3D Explorer map.</p>
        </div>
        {editingMall && <button type="button" className="secondary-button" onClick={onClearEdit}>Add New Mall</button>}
      </header>

      {msg && <div className={styles.bannerOk}><Check size={15} /> {msg}</div>}
      {err && <div className={styles.bannerErr}>{err}</div>}

      <div className={styles.studioGrid}>
        <PilotMapPicker latitude={coords.latitude} longitude={coords.longitude} onChange={setCoords} pinLabel="Pin Mall building centre" height={270} />
        <form className={styles.form} style={{ marginTop: 0 }} onSubmit={submitMall}>
          <div className={styles.formGrid}>
            <label>
              Mall Name
              <input value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={120} />
            </label>
            <label>
              3D Building Architecture
              <select value={modelPreset} onChange={e => setModelPreset(e.target.value as typeof modelPreset)}>
                <option value="city-mall">City Multi-Level Mall</option>
                <option value="arcade-heritage">Heritage Shopping Arcade</option>
                <option value="urban-precinct">Urban Dining Precinct</option>
                <option value="skyline-complex">Skyline Dining Complex</option>
              </select>
            </label>
            <label className={styles.fieldFull}>
              Street Address
              <input value={address} onChange={e => setAddress(e.target.value)} required minLength={5} maxLength={200} />
            </label>
            <label>
              Suburb
              <input value={suburb} onChange={e => setSuburb(e.target.value)} maxLength={100} />
            </label>
            <label>
              Postcode
              <input value={postcode} onChange={e => setPostcode(e.target.value)} pattern="^[0-9]{4}$" maxLength={4} />
            </label>
            <label className={styles.fieldFull}>
              Entrance Notes
              <input value={entranceDescription} onChange={e => setEntranceDescription(e.target.value)} maxLength={180} />
            </label>
            <label className={styles.fieldFull}>
              Audit Note
              <input value={reason} onChange={e => setReason(e.target.value)} required minLength={3} maxLength={240} />
            </label>
          </div>
          <div className={styles.actions}>
            <button type="submit" className="primary-button" disabled={busy}>
              {busy ? "Saving Mall..." : "Save Mall Building"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

function DecisionForm({
  action,
  row,
  onClose,
  onSaved,
}: {
  action: Action;
  row: OperatorRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [locateCoords, setLocateCoords] = useState({
    latitude: row.latitude ?? MELBOURNE_PILOT_CENTER[1],
    longitude: row.longitude ?? MELBOURNE_PILOT_CENTER[0],
  });
  const [promoKind, setPromoKind] = useState<"food" | "restaurant" | "cafe">(
    row.kind === "food" || row.kind === "cafe" ? row.kind : "restaurant",
  );
  const [badgeText, setBadgeText] = useState(row.badgeText ?? "20% OFF");
  const [promoImageUrl, setPromoImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    const reason = text("reason");

    setBusy(true);
    setError("");
    try {
      if (action === "quest.approve" || action === "quest.reject" || action === "quest.withdraw") {
        await submitQuestDecision({
          questId: row.id,
          decision: action === "quest.approve" ? "approve" : action === "quest.reject" ? "reject" : "withdraw",
          reason,
          requestId: crypto.randomUUID(),
        });
        onSaved();
        return;
      }

      const payload: Record<string, unknown> = {
        action,
        id: action === "promo.create" ? crypto.randomUUID() : row.id,
        requestId: crypto.randomUUID(),
        reason,
      };
      if (action !== "promo.create" && row.version) {
        payload.version = row.version;
      }
      if (action === "venue.locate") {
        payload.latitude = locateCoords.latitude;
        payload.longitude = locateCoords.longitude;
      }
      if (action === "promo.create" || action === "promo.edit") {
        Object.assign(payload, {
          venueId: action === "promo.create" ? row.id : row.venueId,
          title: text("title"),
          description: text("description"),
          kind: promoKind,
          badgeText: badgeText.trim() || undefined,
          ...(promoImageUrl ? { imageUrl: promoImageUrl } : {}),
          startsAt: isoDateTime(text("startsAt")),
          endsAt: isoDateTime(text("endsAt")),
        });
      }
      await submitOperatorAction(payload);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save review decision.");
    } finally {
      setBusy(false);
    }
  }

  const isOffer = action === "promo.create" || action === "promo.edit";

  return (
    <form className={styles.form} onSubmit={save}>
      <h4>{labels[action]}</h4>
      {guidance[action] && <p className={styles.help}>{guidance[action]}</p>}
      {/^(post|comment|report)\./u.test(action) && (
        <p className={styles.help}>
          Apply the <a href="/acknowledgement" target="_blank" rel="noreferrer">Community Rules</a>.
        </p>
      )}
      {action === "venue.locate" && (
        <PilotMapPicker
          latitude={locateCoords.latitude}
          longitude={locateCoords.longitude}
          onChange={setLocateCoords}
          pinLabel="Set official Melbourne venue pin"
          height={230}
        />
      )}
      {isOffer && (
        <div className={styles.formGrid}>
          <label>
            Offer Category
            <select value={promoKind} onChange={e => setPromoKind(e.target.value as "food" | "restaurant" | "cafe")}>
              <option value="food">Food Deals</option>
              <option value="restaurant">Restaurant Deals</option>
              <option value="cafe">Cafe Offers</option>
            </select>
          </label>
          <label>
            Badge Text
            <input value={badgeText} onChange={e => setBadgeText(e.target.value)} maxLength={40} />
          </label>
          <label className={styles.fieldFull}>
            Offer Title
            <input name="title" required minLength={2} maxLength={90} defaultValue={action === "promo.edit" ? row.name : ""} />
          </label>
          <label className={styles.fieldFull}>
            Offer Details
            <textarea name="description" required minLength={2} maxLength={400} defaultValue={action === "promo.edit" ? row.detail ?? "" : ""} />
          </label>
          <label>
            Starts (Melbourne)
            <input name="startsAt" type="datetime-local" required defaultValue={action === "promo.edit" ? localInput(row.startsAt) : ""} />
          </label>
          <label>
            Ends (Melbourne)
            <input name="endsAt" type="datetime-local" required defaultValue={action === "promo.edit" ? localInput(row.endsAt) : ""} />
          </label>
          <div className={styles.fieldFull}>
            <label className="secondary-button" style={{ cursor: "pointer", display: "inline-flex" }}>
              <Upload size={14} /> {uploading ? "Uploading photo..." : promoImageUrl ? "Deal image attached" : "Upload deal dish photo (optional)"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                disabled={uploading}
                onChange={async e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  try {
                    const url = await uploadImageAsset(file, "promotion");
                    setPromoImageUrl(url);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Upload failed.");
                  } finally {
                    setUploading(false);
                  }
                }}
              />
            </label>
          </div>
        </div>
      )}
      <label>
        Reason for Record
        <textarea name="reason" required minLength={3} maxLength={240} rows={2} placeholder="Write the factual decision reason..." />
      </label>
      {error && <p role="alert">{error}</p>}
      <div className={styles.actions}>
        <button type="submit" className="primary-button" disabled={busy || uploading}>
          {busy ? "Saving..." : "Confirm"}
        </button>
        <button type="button" onClick={onClose}>Cancel</button>
      </div>
    </form>
  );
}

function RecordCard({
  section,
  row,
  onPickEdit,
}: {
  section: OperatorSection;
  row: OperatorRow;
  onPickEdit?: (row: OperatorRow) => void;
}) {
  const [action, setAction] = useState<Action | null>(null);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  return (
    <article className={styles.record}>
      <header>
        <div>
          {row.venueName && <small>{row.venueName}</small>}
          <h3>{section === "audit" && row.name in labels ? labels[row.name as Action] : row.name}</h3>
        </div>
        {section !== "audit" && (
          <div className={styles.badges}>
            {row.source && (
              <span className={`${styles.state} ${row.source === "game_admin" ? styles.badgeTeal : styles.badgeSlate}`}>
                {row.source === "game_admin" ? "Game Admin" : "Restaurant"}
              </span>
            )}
            {row.grabMode && (
              <span className={`${styles.state} ${styles.badgeSlate}`}>
                {row.grabMode === "ar_grab" ? "AR Grab" : "Map Grab"}
              </span>
            )}
            <span className={`${styles.state} ${row.state === "published" || row.state === "approved" ? styles.badgeTeal : ""}`}>
              {row.state}
            </span>
          </div>
        )}
      </header>

      {row.detail && <p>{row.detail}</p>}
      {row.context && <blockquote><small>On post: {row.context}</small></blockquote>}

      {section === "venues" && (
        <details>
          <summary>Ownership, Mall & 3D Map Placement</summary>
          <p>{row.organisation} | {row.contactEmail} | {row.contactPhone}</p>
          <small>
            {row.verified ? "Ownership verified" : "Ownership unverified"}
            {row.latitude != null && row.longitude != null ? ` | ${row.latitude.toFixed(5)}, ${row.longitude.toFixed(5)}` : " | Map position not set"}
            {row.buildingPreset ? ` | 3D Model: ${row.buildingPreset}` : ""}
            {row.mallFloor || row.mallUnit ? ` | Mall ${row.mallFloor ?? ""} ${row.mallUnit ?? ""}` : ""}
          </small>
        </details>
      )}

      {section === "buildings" && (
        <small>
          Proposed Pin: {row.proposedLatitude != null && row.proposedLongitude != null ? `${row.proposedLatitude.toFixed(5)}, ${row.proposedLongitude.toFixed(5)}` : "Unchanged"}
          {row.proposedSignage ? ` | Awning: ${row.proposedSignage}` : ""}
          {row.proposedFloor ? ` | Floor: ${row.proposedFloor}` : ""}
          {row.proposedUnit ? ` | Unit: ${row.proposedUnit}` : ""}
        </small>
      )}

      {section === "loots" && (
        <small>
          3D Model: {row.modelStyle} | Rarity: {row.rarity} | Visibility: {row.visibilityMode} | Claims: {row.claimedCount ?? 0} / {row.maxClaims ?? 0}
        </small>
      )}

      {row.startsAt && row.endsAt && (
        <small>{displayDate(row.startsAt)} to {displayDate(row.endsAt)} (Melbourne)</small>
      )}

      {section === "audit" && row.at && (
        <small>{displayDate(row.at)} (Melbourne) | Operator {row.actor} | Target {row.id}</small>
      )}

      {saved && <p className={styles.saved} role="status"><Check size={16} /> Saved.</p>}

      <div className={styles.actions}>
        {rowActions(section, row).map(value => (
          <button
            key={value}
            type="button"
            aria-pressed={action === value}
            onClick={() => {
              setSaved(false);
              setAction(value);
            }}
          >
            {labels[value]}
          </button>
        ))}
        {((section === "loots" && row.source === "game_admin") || section === "malls") && onPickEdit && (
          <button type="button" onClick={() => onPickEdit(row)}>
            Edit in Map Studio
          </button>
        )}
      </div>

      {action && (
        <DecisionForm
          key={action}
          row={row}
          action={action}
          onClose={() => setAction(null)}
          onSaved={() => {
            setSaved(true);
            setAction(null);
            router.refresh();
          }}
        />
      )}
    </article>
  );
}

export function OperatorBoard({
  section,
  rows,
  malls = [],
}: {
  section: OperatorSection;
  rows: OperatorRow[];
  malls?: readonly LiveMall[];
}) {
  const router = useRouter();
  const [editingRow, setEditingRow] = useState<OperatorRow | null>(null);

  if (section === "analytics") {
    return <AdminAnalyticsSection />;
  }

  return (
    <div>
      {section === "loots" && (
        <AdminSpecialRewardPlacer
          malls={malls}
          existingLoots={rows}
          editingLoot={editingRow}
          onClearEdit={() => setEditingRow(null)}
          onSaved={() => router.refresh()}
        />
      )}

      {section === "malls" && (
        <AdminMallCreator
          editingMall={editingRow}
          onClearEdit={() => setEditingRow(null)}
          onSaved={() => router.refresh()}
        />
      )}

      {!rows.length ? (
        <p className={styles.empty}>Nothing waiting in this queue right now.</p>
      ) : (
        <div className={styles.records}>
          {rows.map(row => (
            <RecordCard
              key={row.id}
              section={section}
              row={row}
              onPickEdit={r => {
                setEditingRow(r);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
