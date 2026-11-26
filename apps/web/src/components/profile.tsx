"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bookmark,
  CalendarCheck,
  Coins,
  Compass,
  Gift,
  KeyRound,
  MapPin,
  ShieldCheck,
  Sparkles,
  Store,
  UserRound,
  Utensils,
} from "lucide-react";
import type { CatalogueState } from "@/lib/catalogue-contracts";
import { reservationSchema, worldLootClaimSchema, type ReservationRecord, type WorldLootClaim } from "@/lib/world-data";
import { playerProgressDisplay } from "@/lib/player-progress-display";
import { useAvatarPreferences } from "@/lib/avatar-preferences";
import { SignOutButton } from "./auth-form";
import { AvatarWardrobe } from "./avatar-customizer";
import { AvatarIllustration } from "./explorer-avatar";
import { AgeRestrictedFeed } from "./feed-access";
import { useJourney } from "./journey-provider";
import styles from "./passport-wall.module.css";

type PassportTab = "wall" | "settings" | "security" | "bookings" | "rewards";

type ClaimedDealRow = {
  id: string;
  promotionId: string;
  claimCode: string;
  status: string;
  claimedAt: string;
  title?: string;
  venueName?: string;
  venueSlug?: string;
  endsAt?: string;
};

export function ExplorerProfile({
  account,
}: {
  account?: {
    displayName: string;
    email: string | null;
    phone?: string | null;
    accountType?: "explorer" | "partner";
  } | null;
  catalogue?: CatalogueState;
}) {
  const journey = useJourney();
  const avatar = useAvatarPreferences();
  const router = useRouter();
  const [tab, setTab] = useState<PassportTab>("wall");
  const [partnerBusy, setPartnerBusy] = useState(false);
  const [partnerErr, setPartnerErr] = useState("");

  // Edit profile state
  const progress = journey?.data?.progress;
  const [displayNameInput, setDisplayNameInput] = useState(progress?.displayName || account?.displayName || "");
  const [bioInput, setBioInput] = useState(progress?.bio || "");
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [profileErr, setProfileErr] = useState("");

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState("");

  // Bookings, Loots & Deal vouchers state
  const [reservations, setReservations] = useState<ReservationRecord[]>([]);
  const [lootClaims, setLootClaims] = useState<WorldLootClaim[]>([]);
  const [dealClaims, setDealClaims] = useState<ClaimedDealRow[]>([]);
  const [rewardsProgress, setRewardsProgress] = useState({ totalClaims: 0, cycleCount: 0, cycleTarget: 5 });

  useEffect(() => {
    if (progress?.displayName) setDisplayNameInput(progress.displayName);
    else if (account?.displayName) setDisplayNameInput(account.displayName);
    if (progress?.bio !== undefined) setBioInput(progress.bio);
  }, [progress?.displayName, progress?.bio, account?.displayName]);

  useEffect(() => {
    const tabParam = new URLSearchParams(window.location.search).get("tab");
    if (tabParam === "deals" || tabParam === "rewards") setTab("rewards");
    else if (tabParam === "bookings") setTab("bookings");
    else if (tabParam === "settings") setTab("settings");
    else if (tabParam === "security") setTab("security");
  }, []);

  useEffect(() => {
    if (!account) return;
    fetch("/api/reservations", { cache: "no-store", credentials: "same-origin" })
      .then(async res => (res.ok ? await res.json() : null))
      .then(data => {
        const parsed = reservationSchema.array().safeParse(data?.reservations ?? []);
        if (parsed.success) setReservations(parsed.data);
      })
      .catch(() => {});

    fetch("/api/world", { cache: "no-store", credentials: "same-origin" })
      .then(async res => (res.ok ? await res.json() : null))
      .then(data => {
        const parsed = worldLootClaimSchema.array().safeParse(data?.myClaims ?? []);
        if (parsed.success) setLootClaims(parsed.data);
      })
      .catch(() => {});

    fetch("/api/deals/claim", { cache: "no-store", credentials: "same-origin" })
      .then(async res => (res.ok ? await res.json() : null))
      .then(data => {
        if (Array.isArray(data?.claims)) setDealClaims(data.claims);
        if (data?.rewardsProgress) setRewardsProgress(data.rewardsProgress);
      })
      .catch(() => {});
  }, [account]);

  async function becomePartner() {
    setPartnerBusy(true);
    setPartnerErr("");
    try {
      const response = await fetch("/api/journey", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "account", accountType: "partner" }),
      });
      if (!response.ok) throw new Error();
      router.refresh();
    } catch {
      setPartnerErr("Your business account could not be opened. Try again.");
    } finally {
      setPartnerBusy(false);
    }
  }

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setProfileBusy(true);
    setProfileMsg("");
    setProfileErr("");
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayNameInput.trim(),
          bio: bioInput.trim(),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "Profile update failed.");
      setProfileMsg("Profile updated across Explore, Feed & Leaderboard.");
      window.dispatchEvent(new Event("food-go:progress"));
      router.refresh();
    } catch (err) {
      setProfileErr(err instanceof Error ? err.message : "Could not save profile.");
    } finally {
      setProfileBusy(false);
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setPwMsg("");
    setPwErr("");
    if (newPassword.length < 12) {
      setPwErr("Use at least 12 characters for your new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwErr("New password and confirmation do not match.");
      return;
    }
    setPwBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(currentPassword.trim() ? { currentPassword } : {}),
          newPassword,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "Could not update password.");
      setPwMsg(body?.message || "Password updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPwErr(err instanceof Error ? err.message : "Password update failed.");
    } finally {
      setPwBusy(false);
    }
  }

  async function cancelReservation(reservationId: string) {
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", reservationId }),
      });
      if (!res.ok) return;
      const body = await res.json();
      const parsed = reservationSchema.array().safeParse(body?.reservations ?? []);
      if (parsed.success) setReservations(parsed.data);
    } catch {
      // ignore transient error
    }
  }

  const progressDisplay = progress ? playerProgressDisplay(progress) : null;
  const coinsBalance = progress?.coins ?? 0;

  return (
    <div className={styles.page}>
      <header className={styles.profileHeading}>
        <div>
          <h1>Passport</h1>
          <p>Your personal wall, 3D avatar, security settings, table bookings, and collected Melbourne rewards.</p>
        </div>
        <Link href="/collect" className={styles.collectLink}>
          <MapPin size={17} /> Collect a discovery <ArrowRight size={15} />
        </Link>
      </header>

      <section className={styles.personalCover} data-tier={progress?.tier} aria-label="Your explorer identity">
        <div className={styles.personalIdentity}>
          <span className={styles.personalPortrait}>
            <AvatarIllustration avatarId={avatar.preferences.avatarId} />
          </span>
          <div>
            <h2>{progress?.displayName || account?.displayName || "Make yourself at home."}</h2>
            <p>
              {account
                ? progress?.bio ||
                  (account.accountType === "partner"
                    ? "Restaurant partner and Melbourne food explorer"
                    : "Melbourne Food Explorer")
                : "Sign in to manage your personal wall, avatar, password, bookings and rewards."}
            </p>
            {account ? (
              <div className={styles.identityActions}>
                <Link href="/">
                  <Compass size={15} /> Back to 3D Explorer
                </Link>
                <Link href="/quests">
                  <Sparkles size={15} /> Quests & Achievements
                </Link>
                <SignOutButton />
              </div>
            ) : (
              <div className={styles.guestActions}>
                <Link href="/auth/register">
                  Create your Passport <ArrowRight size={15} />
                </Link>
                <Link href="/auth/sign-in?next=/profile">Sign in</Link>
              </div>
            )}
          </div>
        </div>

        {account && (
          <div className={styles.personalProgress}>
            {progress ? (
              <>
                <div>
                  <span>
                    <Sparkles size={16} /> Level {progress.level}
                  </span>
                  <strong>
                    {progress.xp.toLocaleString("en-AU")} <small>XP</small>
                  </strong>
                </div>
                <div style={{ marginTop: 6 }}>
                  <span>
                    <Coins size={15} /> Coins
                  </span>
                  <strong>{coinsBalance.toLocaleString("en-AU")}</strong>
                </div>
                {progressDisplay && (
                  <>
                    <progress aria-label="Progress to next level" value={progressDisplay.value} max={progressDisplay.maximum} />
                    <p>{progressDisplay.text}</p>
                  </>
                )}
              </>
            ) : (
              <p>Loading explorer progress...</p>
            )}
          </div>
        )}
      </section>

      {account && (
        <>
          <nav className={styles.discoveryLinks} aria-label="Your discoveries">
            <Link href="/quests">
              <Bookmark size={19} />
              <span>Willing to Visit</span>
              <strong>{journey?.data?.savedVenues.length ?? 0}</strong>
              <ArrowRight size={15} />
            </Link>
            <Link href="/quests">
              <MapPin size={19} />
              <span>Verified Visits</span>
              <strong>{journey?.data?.visits.length ?? 0}</strong>
              <ArrowRight size={15} />
            </Link>
            <Link href="/food-dex">
              <Utensils size={19} />
              <span>Discovered Dishes</span>
              <strong>{journey?.data?.discoveries.length ?? 0}</strong>
              <ArrowRight size={15} />
            </Link>
          </nav>

          <nav className={styles.passportTabs} aria-label="Passport sections">
            <button type="button" className={`${styles.passportTabBtn} ${tab === "wall" ? styles.passportTabActive : ""}`} onClick={() => setTab("wall")}>
              <UserRound size={15} /> Personal Wall
            </button>
            <button type="button" className={`${styles.passportTabBtn} ${tab === "settings" ? styles.passportTabActive : ""}`} onClick={() => setTab("settings")}>
              <Sparkles size={15} /> Edit Profile & Avatar
            </button>
            <button type="button" className={`${styles.passportTabBtn} ${tab === "security" ? styles.passportTabActive : ""}`} onClick={() => setTab("security")}>
              <KeyRound size={15} /> Password & Security
            </button>
            <button type="button" className={`${styles.passportTabBtn} ${tab === "bookings" ? styles.passportTabActive : ""}`} onClick={() => setTab("bookings")}>
              <CalendarCheck size={15} /> Table Bookings ({reservations.length})
            </button>
            <button type="button" className={`${styles.passportTabBtn} ${tab === "rewards" ? styles.passportTabActive : ""}`} onClick={() => setTab("rewards")}>
              <Gift size={15} /> Loots & Deal Passes ({lootClaims.length + dealClaims.length})
            </button>
          </nav>

          {tab === "wall" && (
            <section className={styles.connectedWall} aria-label="Your personal wall">
              <AgeRestrictedFeed initialWall="me" presentation="passport" />
            </section>
          )}

          {tab === "settings" && (
            <div className={styles.passportPanelGrid}>
              <form className={styles.passportCard} onSubmit={saveProfile}>
                <h3>Edit Explorer Profile</h3>
                <p style={{ margin: 0, fontSize: 13, color: "#4b6875" }}>
                  Updates your public name across Feed posts, table bookings, and your Passport card.
                </p>
                {profileMsg && <p style={{ margin: 0, color: "#065f46", fontWeight: 700 }}>{profileMsg}</p>}
                {profileErr && <p style={{ margin: 0, color: "#991b1b", fontWeight: 700 }}>{profileErr}</p>}
                <label className={styles.passportField}>
                  Display Name
                  <input value={displayNameInput} onChange={e => setDisplayNameInput(e.target.value)} required minLength={1} maxLength={80} />
                </label>
                <label className={styles.passportField}>
                  Bio / Food Interests
                  <textarea value={bioInput} onChange={e => setBioInput(e.target.value)} maxLength={300} rows={3} placeholder="Favourite Melbourne cuisine, coffee order, or food goals..." />
                </label>
                <button type="submit" className="primary-button" disabled={profileBusy}>
                  {profileBusy ? "Saving..." : "Save Profile Changes"}
                </button>
              </form>

              <div className={styles.passportCard}>
                <h3>Choose 3D Explorer Avatar</h3>
                <AvatarWardrobe />
              </div>
            </div>
          )}

          {tab === "security" && (
            <div className={styles.passportPanelGrid}>
              <form className={styles.passportCard} onSubmit={changePassword}>
                <h3>Change Password</h3>
                <p style={{ margin: 0, fontSize: 13, color: "#4b6875" }}>
                  Use a unique passphrase of at least 12 characters.
                </p>
                {pwMsg && <p style={{ margin: 0, color: "#065f46", fontWeight: 700 }}>{pwMsg}</p>}
                {pwErr && <p style={{ margin: 0, color: "#991b1b", fontWeight: 700 }}>{pwErr}</p>}
                {account.email && (
                  <label className={styles.passportField}>
                    Current Password (recommended)
                    <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} autoComplete="current-password" />
                  </label>
                )}
                <label className={styles.passportField}>
                  New Password (minimum 12 characters)
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={12} maxLength={128} autoComplete="new-password" />
                </label>
                <label className={styles.passportField}>
                  Confirm New Password
                  <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={12} maxLength={128} autoComplete="new-password" />
                </label>
                <button type="submit" className="primary-button" disabled={pwBusy}>
                  {pwBusy ? "Updating password..." : "Update Password"}
                </button>
              </form>

              <div className={styles.passportCard}>
                <h3>Account & Security Details</h3>
                <div className={styles.recordRow}>
                  <strong>Verified Identity</strong>
                  <span>{account.email || account.phone || "Verified Member"}</span>
                  <span>Role: {account.accountType === "partner" ? "Restaurant Owner & Explorer" : "Normal Explorer"}</span>
                </div>
                <div className={styles.recordRow}>
                  <strong>Authenticator & Safety</strong>
                  <span>Manage multi-factor verification & review Food Go privacy guidance.</span>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                    <Link href="/help" className="secondary-button">
                      <ShieldCheck size={15} /> Security & Privacy Info
                    </Link>
                    <Link href="/admin/security" className="secondary-button">
                      Two-Factor Setup
                    </Link>
                  </div>
                </div>
                <div className={styles.recordRow}>
                  <strong>Restaurant Owner Access</strong>
                  {account.accountType === "partner" ? (
                    <Link className="primary-button" href="/partner/dashboard">
                      <Store size={15} /> Open Restaurant Owner Portal
                    </Link>
                  ) : (
                    <>
                      <span>Manage a cafe, bakery, food truck or restaurant in the Melbourne Pilot?</span>
                      {partnerErr && <span style={{ color: "#991b1b" }}>{partnerErr}</span>}
                      <button type="button" className="primary-button" disabled={partnerBusy} onClick={() => void becomePartner()}>
                        {partnerBusy ? "Enabling partner access..." : "Enable Restaurant Owner Mode"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === "bookings" && (
            <section className={styles.passportCard}>
              <h3>Your Melbourne Table Reservations</h3>
              <p style={{ margin: 0, fontSize: 13, color: "#4b6875" }}>
                Requests are reviewed directly by each venue in their Owner Portal. Stage 1 bookings require zero online payment.
              </p>
              {reservations.length === 0 ? (
                <div className={styles.recordRow}>
                  <strong>No table bookings yet</strong>
                  <span>Open any participating restaurant in the 3D Explorer and tap Reserve Table.</span>
                  <Link href="/" className="primary-button" style={{ width: "fit-content" }}>Explore Restaurants</Link>
                </div>
              ) : (
                reservations.map(r => (
                  <article key={r.id} className={styles.recordRow}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <strong>{r.venueName || "Melbourne Venue"} ({r.partySize} guests)</strong>
                      <span className={styles.voucherMini}>{r.status.toUpperCase()}</span>
                    </div>
                    <span>{new Date(r.reservedFor).toLocaleString("en-AU")} | {r.suburb || "Melbourne"}</span>
                    {r.notes && <span style={{ color: "#4b6875" }}>Your note: {r.notes}</span>}
                    {r.decisionNote && <span style={{ color: "#08786e", fontWeight: 700 }}>Restaurant reply: {r.decisionNote}</span>}
                    {(r.status === "pending" || r.status === "approved") && (
                      <button type="button" className="secondary-button" style={{ width: "fit-content" }} onClick={() => void cancelReservation(r.id)}>
                        Cancel reservation
                      </button>
                    )}
                  </article>
                ))
              )}
            </section>
          )}

          {tab === "rewards" && (
            <div className={styles.passportPanelGrid}>
              <section className={styles.passportCard}>
                <h3>Collected 3D AR & Map Loots ({lootClaims.length})</h3>
                {lootClaims.length === 0 ? (
                  <p style={{ margin: 0, color: "#4b6875", fontSize: 14 }}>
                    Grab rewards on the Melbourne 3D Explorer (by walking up or scanning in AR) to collect XP, Coins, and trophies.
                  </p>
                ) : (
                  lootClaims.map(c => (
                    <article key={c.id} className={styles.recordRow}>
                      <strong>{c.title}</strong>
                      <span>
                        {c.source === "game_admin" ? "Official Game Drop" : c.venueName || "Restaurant Drop"} |{" "}
                        {c.grabMode === "ar_grab" ? "AR Scan Grab" : "3D Map Grab"} | +{c.xpAwarded} XP & +{c.coinsAwarded} Coins
                      </span>
                      {c.claimCode && <span className={styles.voucherMini}>Code: {c.claimCode}</span>}
                    </article>
                  ))
                )}
              </section>

              <section className={styles.passportCard}>
                <h3>Redeemed Deal Passes ({dealClaims.length})</h3>
                <p style={{ margin: 0, fontSize: 13, color: "#08786e", fontWeight: 700 }}>
                  FoodGo Rewards Cycle: {rewardsProgress.cycleCount} / {rewardsProgress.cycleTarget} redeemed ({rewardsProgress.totalClaims} lifetime)
                </p>
                {dealClaims.length === 0 ? (
                  <p style={{ margin: 0, color: "#4b6875", fontSize: 14 }}>
                    Redeem any Admin-approved offer from Deals to store your counter pass here.
                  </p>
                ) : (
                  dealClaims.map(d => (
                    <article key={d.id} className={styles.recordRow}>
                      <strong>{d.title || "Restaurant Deal"}</strong>
                      <span>{d.venueName || "Melbourne Venue"} | Status: {d.status}</span>
                      <span className={styles.voucherMini}>{d.claimCode}</span>
                    </article>
                  ))
                )}
              </section>
            </div>
          )}
        </>
      )}

      {!account && (
        <section className={styles.guestIntroduction}>
          <h2>Your Melbourne food journey.</h2>
          <p>
            Explore the Melbourne Pilot in 3D, grab map & AR loots to level up to Lv. 250, redeem verified local restaurant deals, book tables, and share your discoveries.
          </p>
          <Link href="/">
            Enter 3D Explorer <ArrowRight size={15} />
          </Link>
        </section>
      )}
    </div>
  );
}
