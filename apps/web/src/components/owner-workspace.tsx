"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Building2,
  CalendarCheck,
  Camera,
  CheckCircle2,
  Gift,
  Percent,
  QrCode,
  ShieldCheck,
  Sparkles,
  Store,
  Upload,
  Utensils,
} from "lucide-react";
import { AU_STATES, MELBOURNE_PILOT_CENTER } from "@food-go/domain";
import { workspaceSchema, type Workspace } from "@/lib/journey";
import {
  BUILDING_PRESET_LABELS,
  reservationSchema,
  type BuildingPreset,
  type ReservationRecord,
} from "@/lib/world-data";
import { uploadImageAsset } from "@/lib/media-client";
import { PilotMapPicker } from "./pilot-map-picker";
import styles from "./owner-workspace.module.css";

type OwnerTab = "overview" | "building" | "menu" | "loots" | "deals" | "reservations";

const DEFAULT_LAT = MELBOURNE_PILOT_CENTER[1];
const DEFAULT_LNG = MELBOURNE_PILOT_CENTER[0];

const LOOT_STYLES = [
  { id: "reward_crate", label: "Reward Crate" },
  { id: "golden_crystal", label: "Golden Crystal" },
  { id: "mystery_ring", label: "Mystery Ring (?)" },
  { id: "dish_trophy", label: "Dish Trophy" },
  { id: "star_chest", label: "Star Chest" },
] as const;

export function OwnerWorkspace({ venueId }: { venueId: string }) {
  const [data, setData] = useState<Workspace | null>(null);
  const [reservations, setReservations] = useState<ReservationRecord[]>([]);
  const [tab, setTab] = useState<OwnerTab>("overview");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [version, setVersion] = useState(0);
  const [proof, setProof] = useState<{ code: string; qr: string; expiresAt: string } | null>(null);
  const [dishFilter, setDishFilter] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/partner/manage?venueId=" + encodeURIComponent(venueId), {
      cache: "no-store",
      credentials: "same-origin",
    })
      .then(async response => ({ ok: response.ok, body: await response.json() }))
      .then(({ ok, body }) => {
        if (!active) return;
        const parsed = workspaceSchema.safeParse(body);
        if (ok && parsed.success) {
          setData(parsed.data);
          setError("");
        } else {
          setError(typeof body?.error === "string" ? body.error : "Workspace could not be loaded.");
        }
      })
      .catch(() => {
        if (active) setError("Workspace could not be loaded.");
      });

    fetch("/api/partner/reservations?venueId=" + encodeURIComponent(venueId), {
      cache: "no-store",
      credentials: "same-origin",
    })
      .then(async res => (res.ok ? await res.json() : null))
      .then(payload => {
        if (!active || !payload?.reservations) return;
        const parsed = reservationSchema.array().safeParse(payload.reservations);
        if (parsed.success) setReservations(parsed.data);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [venueId, version]);

  async function act(input: Record<string, unknown>, okMessage?: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/partner/manage", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venueId, ...input }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(typeof body?.error === "string" ? body.error : "Changes could not be saved.");
        return false;
      }
      if (input.action === "issue" && typeof body?.code === "string") {
        setProof(body);
        setMessage("Check-in code generated. Valid for 10 minutes.");
        return true;
      }
      const parsed = workspaceSchema.safeParse(body);
      if (parsed.success) setData(parsed.data);
      else setVersion(v => v + 1);
      setMessage(okMessage || "Saved.");
      return true;
    } catch {
      setError("Network error while saving changes.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function actReservations(input: Record<string, unknown>, okMessage?: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/partner/reservations", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venueId, ...input }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(typeof body?.error === "string" ? body.error : "Reservation update failed.");
        return;
      }
      if (Array.isArray(body?.reservations)) {
        const parsed = reservationSchema.array().safeParse(body.reservations);
        if (parsed.success) setReservations(parsed.data);
      }
      setMessage(okMessage || "Reservations updated.");
      setVersion(v => v + 1);
    } catch {
      setError("Could not reach the reservations service.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUploadCover(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const url = await uploadImageAsset(file, "venue");
      await act({ action: "media", coverImageUrl: url }, "Storefront cover photo updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed.");
    } finally {
      setUploading(false);
    }
  }

  const venue = data?.venue;
  const activeLootsCount = useMemo(
    () => (data?.loots ?? []).filter(l => l.status === "published" || l.status === "pending").length,
    [data?.loots],
  );

  if (!data) {
    return (
      <section className="empty-state">
        <h1>{error || "Loading restaurant studio..."}</h1>
        <p>Preparing your Melbourne location, 3D building style, menu, loots, deals and bookings.</p>
        <Link href="/partner/dashboard" className="secondary-button">Back to partner dashboard</Link>
      </section>
    );
  }

  const publishedPromotions = data.promotions.filter(p => p.status === "published");
  const isPublishedVenue = venue!.status === "published" && Boolean(venue!.ownership_verified_at);

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.topbarMeta}>
          <span className={styles.eyebrow}>Restaurant Owner Portal</span>
          <h1>{venue!.name}</h1>
          <div className={styles.statusRow}>
            <span className={styles.pill}>{venue!.venue_type.replace("_", " ")}</span>
            <span className={`${styles.pill} ${venue!.status === "published" ? styles.pillSuccess : venue!.status === "pending" ? styles.pillWarn : styles.pillNeutral}`}>
              Listing: {venue!.status}
            </span>
            <span className={`${styles.pill} ${venue!.ownership_verified_at ? styles.pillSuccess : styles.pillWarn}`}>
              <ShieldCheck size={14} />
              {venue!.ownership_verified_at ? "Ownership verified" : "Ownership review needed"}
            </span>
            <span className={`${styles.pill} ${venue!.building_review_status === "approved" ? styles.pillSuccess : venue!.building_review_status === "pending" ? styles.pillWarn : styles.pillNeutral}`}>
              3D Building: {venue!.building_review_status}
            </span>
          </div>
        </div>
        <div className={styles.topActions}>
          <Link href="/partner/dashboard" className="secondary-button">All venues</Link>
          {venue!.status === "draft" && (
            <button
              type="button"
              className="primary-button"
              disabled={busy}
              onClick={() => act({ action: "submit", version: venue!.updated_at }, "Submitted to Admin for review and verification.")}
            >
              Submit venue for approval
            </button>
          )}
        </div>
      </header>

      <div className={styles.statsGrid}>
        <article className={styles.statCard}>
          <span>Verified Visits</span>
          <strong>{data.visits}</strong>
        </article>
        <article className={styles.statCard}>
          <span>Dish Discoveries</span>
          <strong>{data.discoveries}</strong>
        </article>
        <article className={styles.statCard}>
          <span>Map & AR Loots</span>
          <strong>{activeLootsCount}</strong>
        </article>
        <article className={styles.statCard}>
          <span>Pending Reservations</span>
          <strong>{data.pendingReservations}</strong>
        </article>
      </div>

      {message && <div className={styles.bannerOk} role="status">{message}</div>}
      {error && <div className={styles.bannerErr} role="alert">{error}</div>}

      <nav className={styles.tabBar} aria-label="Restaurant studio sections">
        <button type="button" className={`${styles.tabBtn} ${tab === "overview" ? styles.tabBtnActive : ""}`} onClick={() => setTab("overview")}>
          <Store size={15} /> Overview & Details
        </button>
        <button type="button" className={`${styles.tabBtn} ${tab === "building" ? styles.tabBtnActive : ""}`} onClick={() => setTab("building")}>
          <Building2 size={15} /> Location, Mall & 3D Building
        </button>
        <button type="button" className={`${styles.tabBtn} ${tab === "menu" ? styles.tabBtnActive : ""}`} onClick={() => setTab("menu")}>
          <Utensils size={15} /> Menu & Dish Photos
        </button>
        <button type="button" className={`${styles.tabBtn} ${tab === "loots" ? styles.tabBtnActive : ""}`} onClick={() => setTab("loots")}>
          <Gift size={15} /> Map & AR Loots
        </button>
        <button type="button" className={`${styles.tabBtn} ${tab === "deals" ? styles.tabBtnActive : ""}`} onClick={() => setTab("deals")}>
          <Percent size={15} /> Deals & Promotions
        </button>
        <button type="button" className={`${styles.tabBtn} ${tab === "reservations" ? styles.tabBtnActive : ""}`} onClick={() => setTab("reservations")}>
          <CalendarCheck size={15} /> Reservations ({reservations.filter(r => r.status === "pending").length}) & QR
        </button>
      </nav>

      {tab === "overview" && (
        <div className={styles.panelGrid}>
          <VenueDetailsForm
            venue={venue!}
            busy={busy}
            onSave={fields => act({ action: "details", version: venue!.updated_at, ...fields }, "Venue profile saved.")}
          />
          <section className={styles.panel}>
            <h2>Storefront Cover Photo</h2>
            <p className={styles.muted}>Shown on the 3D Explorer venue sheet, Catalogue cards, and Search results.</p>
            {venue!.cover_image_url ? (
              <img src={venue!.cover_image_url} alt={venue!.name} className={styles.coverPreview} />
            ) : (
              <div className={styles.itemCard}>
                <p className={styles.muted}>No cover photo uploaded yet. Upload a sharp exterior or hero dish photo.</p>
              </div>
            )}
            <div className={styles.uploadRow}>
              <label className="primary-button" style={{ cursor: "pointer" }}>
                <Upload size={15} />
                {uploading ? "Uploading photo..." : "Upload venue cover photo"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  disabled={uploading || busy}
                  onChange={e => void handleUploadCover(e.target.files?.[0])}
                />
              </label>
              {venue!.cover_image_url && (
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => act({ action: "media", coverImageUrl: null }, "Cover photo removed.")}
                >
                  Remove photo
                </button>
              )}
            </div>
            <div className={styles.itemCard}>
              <strong>Business Contact</strong>
              <p className={styles.muted}>{data.contact?.email || "No email"} | {data.contact?.phone || "No phone"}</p>
            </div>
          </section>
        </div>
      )}

      {tab === "building" && (
        <BuildingStudioSection
          data={data}
          busy={busy}
          onSubmitProposal={payload =>
            act(
              { action: "building", ...payload },
              "Location and 3D building style submitted to Admin for verification.",
            )
          }
        />
      )}

      {tab === "menu" && (
        <MenuManagerSection
          dishes={data.dishes}
          busy={busy}
          onSaveDish={payload => act({ action: "dish", ...payload }, "Menu item saved.")}
          onIssueDishCode={dishId => act({ action: "issue", dishId })}
        />
      )}

      {tab === "loots" && (
        <LootBuilderSection
          data={data}
          publishedPromotions={publishedPromotions}
          isPublishedVenue={isPublishedVenue}
          busy={busy}
          onCreateLoot={payload =>
            act(
              { action: "lootCreate", ...payload },
              "Loot drop submitted for Admin approval. Once approved it goes live on the Melbourne 3D map.",
            )
          }
          onWithdrawLoot={lootId => act({ action: "lootWithdraw", lootId }, "Loot drop withdrawn from map.")}
        />
      )}

      {tab === "deals" && (
        <DealsManagerSection
          promotions={data.promotions}
          isPublishedVenue={isPublishedVenue}
          busy={busy}
          onCreatePromo={payload =>
            act(
              { action: "promo", ...payload },
              "Deal submitted. Deals go live in the Deals hub as soon as an Admin approves them.",
            )
          }
        />
      )}

      {tab === "reservations" && (
        <div className={styles.panelGrid}>
          <section className={styles.panel}>
            <div className={styles.itemHead}>
              <div>
                <h2>Table Reservations Inbox</h2>
                <p className={styles.muted}>Zero-payment table booking requests for {venue!.name}. Approve or decline requests in real time.</p>
              </div>
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={venue!.reservations_enabled}
                  disabled={busy}
                  onChange={e =>
                    void actReservations(
                      { action: "settings", enabled: e.target.checked, notes: venue!.reservation_notes ?? "" },
                      e.target.checked ? "Table bookings enabled on Explorer." : "Table bookings paused.",
                    )
                  }
                />
                Accept table bookings
              </label>
            </div>

            {reservations.length === 0 ? (
              <div className={styles.itemCard}>
                <p className={styles.muted}>No customer reservations yet. Bookings submitted from the 3D Explorer venue sheet appear here immediately.</p>
              </div>
            ) : (
              <div className={styles.listGrid}>
                {reservations.map(r => (
                  <ReservationItemRow
                    key={r.id}
                    reservation={r}
                    busy={busy}
                    onDecide={(decision, note) =>
                      actReservations(
                        { action: "decide", reservationId: r.id, decision, note },
                        `Reservation marked ${decision}.`,
                      )
                    }
                  />
                ))}
              </div>
            )}
          </section>

          <section className={styles.panel}>
            <h2>Counter Check-in QR Code</h2>
            <p className={styles.muted}>
              Generate a 10-minute verification code for diners visiting in person or ordering a signature dish. Zero card checkout required.
            </p>
            <div className={styles.field}>
              <label htmlFor="qr-dish-pick">Link code to</label>
              <select id="qr-dish-pick" value={dishFilter} onChange={e => setDishFilter(e.target.value)}>
                <option value="">General Restaurant Visit Check-in (+100 XP)</option>
                {data.dishes.filter(d => d.is_available).map(d => (
                  <option key={d.id} value={d.id}>
                    Dish Discovery: {d.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="primary-button"
              disabled={busy || !isPublishedVenue || !venue!.game_enabled}
              onClick={() => act({ action: "issue", dishId: dishFilter || null })}
            >
              <QrCode size={16} /> Issue 10-Minute Check-in QR
            </button>
            {(!isPublishedVenue || !venue!.game_enabled) && (
              <p className={styles.muted}>Publish your venue and keep Food Discovery enabled to issue live QR codes.</p>
            )}
            {proof && (
              <div className={styles.qrCard}>
                <img src={proof.qr} alt="Customer check-in QR code" className={styles.qrImage} />
                <strong style={{ letterSpacing: "0.08em", fontSize: 15 }}>{proof.code}</strong>
                <span className={styles.muted}>Expires at {new Date(proof.expiresAt).toLocaleTimeString()}</span>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function VenueDetailsForm({
  venue,
  busy,
  onSave,
}: {
  venue: Workspace["venue"];
  busy: boolean;
  onSave: (fields: Record<string, unknown>) => Promise<boolean>;
}) {
  const [name, setName] = useState(venue.name);
  const [venueType, setVenueType] = useState(venue.venue_type);
  const [cuisine, setCuisine] = useState(venue.cuisine);
  const [address, setAddress] = useState(venue.address);
  const [suburb, setSuburb] = useState(venue.suburb);
  const [state, setState] = useState(venue.state);
  const [postcode, setPostcode] = useState(venue.postcode);
  const [description, setDescription] = useState(venue.description);
  const [gameEnabled, setGameEnabled] = useState(venue.game_enabled);

  useEffect(() => {
    setName(venue.name);
    setVenueType(venue.venue_type);
    setCuisine(venue.cuisine);
    setAddress(venue.address);
    setSuburb(venue.suburb);
    setState(venue.state);
    setPostcode(venue.postcode);
    setDescription(venue.description);
    setGameEnabled(venue.game_enabled);
  }, [venue]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void onSave({ name, venueType, cuisine, address, suburb, state, postcode, description, gameEnabled });
  }

  return (
    <form className={styles.panel} onSubmit={handleSubmit}>
      <h2>Venue Details & Category</h2>
      <div className={styles.formGrid}>
        <label className={styles.field}>
          Venue Name
          <input value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={120} />
        </label>
        <label className={styles.field}>
          Food Category
          <select value={venueType} onChange={e => setVenueType(e.target.value as Workspace["venue"]["venue_type"])}>
            <option value="restaurant">Restaurant</option>
            <option value="cafe">Cafe</option>
            <option value="bakery">Bakery</option>
            <option value="food_truck">Food Truck</option>
            <option value="market">Food Market / Precinct</option>
          </select>
        </label>
        <label className={styles.field}>
          Cuisine
          <input value={cuisine} onChange={e => setCuisine(e.target.value)} required minLength={2} maxLength={60} />
        </label>
        <label className={styles.field}>
          Suburb
          <input value={suburb} onChange={e => setSuburb(e.target.value)} required minLength={2} maxLength={100} />
        </label>
        <label className={`${styles.field} ${styles.fieldFull}`}>
          Street Address
          <input value={address} onChange={e => setAddress(e.target.value)} required minLength={5} maxLength={200} />
        </label>
        <label className={styles.field}>
          State
          <select value={state} onChange={e => setState(e.target.value)}>
            {AU_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className={styles.field}>
          Postcode
          <input value={postcode} onChange={e => setPostcode(e.target.value)} required pattern="^[0-9]{4}$" maxLength={4} />
        </label>
        <label className={`${styles.field} ${styles.fieldFull}`}>
          Description
          <textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={1000} />
        </label>
      </div>
      <label className={styles.checkboxRow}>
        <input type="checkbox" checked={gameEnabled} onChange={e => setGameEnabled(e.target.checked)} />
        Include in live 3D Food Go Explorer, Quests & AR Loots
      </label>
      <button type="submit" className="primary-button" disabled={busy}>
        {busy ? "Saving details..." : "Save venue details"}
      </button>
    </form>
  );
}

function BuildingStudioSection({
  data,
  busy,
  onSubmitProposal,
}: {
  data: Workspace;
  busy: boolean;
  onSubmitProposal: (payload: Record<string, unknown>) => Promise<boolean>;
}) {
  const proposal = data.buildingProposal;
  const venue = data.venue;
  const [mallId, setMallId] = useState<string>(proposal?.proposed_mall_id ?? venue.mall_id ?? "");
  const [floor, setFloor] = useState<string>(proposal?.proposed_floor ?? venue.mall_floor ?? "");
  const [unit, setUnit] = useState<string>(proposal?.proposed_unit ?? venue.mall_unit ?? "");
  const [preset, setPreset] = useState<BuildingPreset>(proposal?.proposed_building_preset ?? venue.building_preset ?? "city-bistro");
  const [accentColour, setAccentColour] = useState<string>(proposal?.proposed_accent_colour ?? venue.building_accent_colour ?? "#00c49a");
  const [signage, setSignage] = useState<string>(proposal?.proposed_signage ?? venue.building_signage ?? venue.name.slice(0, 24));
  const [coords, setCoords] = useState<{ latitude: number; longitude: number }>({
    latitude: proposal?.proposed_latitude ?? venue.latitude ?? DEFAULT_LAT,
    longitude: proposal?.proposed_longitude ?? venue.longitude ?? DEFAULT_LNG,
  });

  function selectMall(nextMallId: string) {
    setMallId(nextMallId);
    if (nextMallId) {
      const m = data.malls.find(x => x.id === nextMallId);
      if (m) {
        setCoords({ latitude: m.coordinates.latitude, longitude: m.coordinates.longitude });
        setPreset("mall-unit");
        if (!floor && m.floors[0]) setFloor(m.floors[0].code);
      }
    }
  }

  const selectedMall = data.malls.find(m => m.id === mallId) ?? null;

  return (
    <div className={styles.panelGrid}>
      <section className={styles.panel}>
        <div>
          <h2>1. Pin Melbourne Location & Shared Mall</h2>
          <p className={styles.muted}>
            Standalone restaurants appear directly on the street map. If your venue operates inside a shopping centre or arcade (with multiple food outlets in one building), choose the Mall below and enter your floor & unit.
          </p>
        </div>

        <label className={styles.field}>
          Shared Building / Shopping Mall
          <select value={mallId} onChange={e => selectMall(e.target.value)}>
            <option value="">Standalone street location (outside mall)</option>
            {data.malls.map(m => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.address}) - {m.shopCount} shops
              </option>
            ))}
          </select>
        </label>

        {selectedMall && (
          <div className={styles.formGrid}>
            <label className={styles.field}>
              Floor Level
              <select value={floor} onChange={e => setFloor(e.target.value)}>
                <option value="">Select floor</option>
                {selectedMall.floors.map(fl => (
                  <option key={fl.id} value={fl.code}>
                    {fl.code} - {fl.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              Unit / Tenancy Number
              <input value={unit} onChange={e => setUnit(e.target.value)} placeholder="e.g. Shop 14 / Kiosk B" maxLength={40} />
            </label>
          </div>
        )}

        <PilotMapPicker
          latitude={coords.latitude}
          longitude={coords.longitude}
          onChange={setCoords}
          malls={data.malls}
          pinLabel="Drag pin or click inside Melbourne Pilot zone (amber squares = Malls)"
          height={310}
        />
      </section>

      <section className={styles.panel}>
        <div>
          <h2>2. Choose 3D Building Style</h2>
          <p className={styles.muted}>
            Pick how your storefront renders in the 3D WebGL Explorer. Proposals are verified by an Admin before replacing live coordinates.
          </p>
        </div>

        {(proposal || venue.building_review_status !== "none") && (
          <div className={styles.itemCard}>
            <div className={styles.itemHead}>
              <strong>3D Building Review Status</strong>
              <span className={`${styles.pill} ${venue.building_review_status === "approved" ? styles.pillSuccess : venue.building_review_status === "rejected" ? styles.pillDanger : styles.pillWarn}`}>
                {proposal?.review_status ?? venue.building_review_status}
              </span>
            </div>
            {proposal?.review_note && <p className={styles.muted}>Admin note: {proposal.review_note}</p>}
          </div>
        )}

        <div className={styles.presetGrid}>
          {(Object.keys(BUILDING_PRESET_LABELS) as BuildingPreset[]).map(key => {
            const info = BUILDING_PRESET_LABELS[key];
            return (
              <button
                key={key}
                type="button"
                className={`${styles.presetCard} ${preset === key ? styles.presetCardActive : ""}`}
                onClick={() => setPreset(key)}
              >
                <strong>{info.label}</strong>
                <span>{info.summary}</span>
              </button>
            );
          })}
        </div>

        <div className={styles.formGrid}>
          <label className={styles.field}>
            3D Awning Signage Text
            <input value={signage} onChange={e => setSignage(e.target.value)} maxLength={40} placeholder="Displayed above your entrance" />
          </label>
          <label className={styles.field}>
            Building Accent Colour
            <input type="color" value={accentColour} onChange={e => setAccentColour(e.target.value)} style={{ height: 42, padding: 4 }} />
          </label>
        </div>

        <button
          type="button"
          className="primary-button"
          disabled={busy}
          onClick={() =>
            void onSubmitProposal({
              latitude: coords.latitude,
              longitude: coords.longitude,
              mallId: mallId || null,
              floor: mallId ? floor || null : null,
              unit: mallId ? unit || null : null,
              buildingPreset: preset,
              accentColour,
              signage: signage.trim() || null,
            })
          }
        >
          <CheckCircle2 size={16} />
          {busy ? "Submitting 3D building..." : "Submit location & 3D building for Admin review"}
        </button>
      </section>
    </div>
  );
}

function MenuManagerSection({
  dishes,
  busy,
  onSaveDish,
  onIssueDishCode,
}: {
  dishes: Workspace["dishes"];
  busy: boolean;
  onSaveDish: (payload: Record<string, unknown>) => Promise<boolean>;
  onIssueDishCode: (dishId: string) => Promise<boolean>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [priceAud, setPriceAud] = useState("18.50");
  const [description, setDescription] = useState("");
  const [available, setAvailable] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");

  function startEdit(d: Workspace["dishes"][number]) {
    setEditingId(d.id);
    setName(d.name);
    setPriceAud(((d.price_aud_cents ?? 0) / 100).toFixed(2));
    setDescription(d.description);
    setAvailable(d.is_available);
    setImageUrl(d.image_url ?? null);
  }

  function clearForm() {
    setEditingId(null);
    setName("");
    setPriceAud("18.50");
    setDescription("");
    setAvailable(true);
    setImageUrl(null);
  }

  async function handleDishPhoto(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setUploadErr("");
    try {
      const url = await uploadImageAsset(file, "dish");
      setImageUrl(url);
    } catch (err) {
      setUploadErr(err instanceof Error ? err.message : "Dish photo upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function submitDish(e: FormEvent) {
    e.preventDefault();
    const dishId = editingId ?? crypto.randomUUID();
    const existing = dishes.find(x => x.id === dishId);
    const cents = Math.max(0, Math.round(Number.parseFloat(priceAud || "0") * 100));
    const ok = await onSaveDish({
      dishId,
      version: existing?.updated_at,
      name,
      description,
      price: cents,
      available,
      imageUrl: imageUrl ?? null,
    });
    if (ok) clearForm();
  }

  return (
    <div className={styles.panelGrid}>
      <form className={styles.panel} onSubmit={submitDish}>
        <h2>{editingId ? "Edit Signature Dish" : "Add Menu Dish"}</h2>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            Dish Name
            <input value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={120} />
          </label>
          <label className={styles.field}>
            Display Price (AUD $)
            <input type="number" step="0.50" min="0" value={priceAud} onChange={e => setPriceAud(e.target.value)} required />
          </label>
          <label className={`${styles.field} ${styles.fieldFull}`}>
            Dish Description
            <textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={1000} />
          </label>
        </div>

        <label className={styles.checkboxRow}>
          <input type="checkbox" checked={available} onChange={e => setAvailable(e.target.checked)} />
          Available for discovery & deals
        </label>

        <div className={styles.uploadRow}>
          <label className="secondary-button" style={{ cursor: "pointer" }}>
            <Camera size={15} />
            {uploading ? "Uploading dish photo..." : imageUrl ? "Change dish photo" : "Upload dish photo"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              disabled={uploading}
              onChange={e => void handleDishPhoto(e.target.files?.[0])}
            />
          </label>
          {imageUrl && <img src={imageUrl} alt="Dish preview" className={styles.thumb} />}
          {uploadErr && <span className={styles.bannerErr}>{uploadErr}</span>}
        </div>

        <div className={styles.btnRow}>
          <button type="submit" className="primary-button" disabled={busy || uploading}>
            {editingId ? "Update dish" : "Add dish to menu"}
          </button>
          {editingId && (
            <button type="button" className="secondary-button" onClick={clearForm}>
              Cancel edit
            </button>
          )}
        </div>
      </form>

      <section className={styles.panel}>
        <h2>Menu Items ({dishes.length})</h2>
        {dishes.length === 0 ? (
          <p className={styles.muted}>No dishes added yet.</p>
        ) : (
          <div className={styles.listGrid}>
            {dishes.map(d => (
              <article key={d.id} className={styles.itemCard}>
                <div className={styles.itemHead}>
                  <div className={styles.itemTitleRow}>
                    {d.image_url && <img src={d.image_url} alt={d.name} className={styles.thumb} />}
                    <div>
                      <strong>{d.name}</strong>
                      <p className={styles.muted}>${((d.price_aud_cents ?? 0) / 100).toFixed(2)} | {d.is_available ? "Available" : "Hidden"}</p>
                    </div>
                  </div>
                  <div className={styles.btnRow}>
                    <button type="button" className="secondary-button" onClick={() => startEdit(d)}>Edit</button>
                    {d.is_available && (
                      <button type="button" className="secondary-button" disabled={busy} onClick={() => void onIssueDishCode(d.id)}>
                        <QrCode size={14} /> QR
                      </button>
                    )}
                  </div>
                </div>
                {d.description && <p className={styles.muted}>{d.description}</p>}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function LootBuilderSection({
  data,
  publishedPromotions,
  isPublishedVenue,
  busy,
  onCreateLoot,
  onWithdrawLoot,
}: {
  data: Workspace;
  publishedPromotions: Workspace["promotions"];
  isPublishedVenue: boolean;
  busy: boolean;
  onCreateLoot: (payload: Record<string, unknown>) => Promise<boolean>;
  onWithdrawLoot: (lootId: string) => Promise<boolean>;
}) {
  const venue = data.venue;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [grabMode, setGrabMode] = useState<"ar_grab" | "map_grab">("ar_grab");
  const [rewardKind, setRewardKind] = useState<"collectible" | "offer" | "xp_coins">("collectible");
  const [modelStyle, setModelStyle] = useState<(typeof LOOT_STYLES)[number]["id"]>("reward_crate");
  const [rarity, setRarity] = useState<"common" | "rare" | "epic" | "legendary">("rare");
  const [xpReward, setXpReward] = useState(80);
  const [coinReward, setCoinReward] = useState(40);
  const [promotionId, setPromotionId] = useState("");
  const [radiusMetres, setRadiusMetres] = useState(65);
  const [cooldownHours, setCooldownHours] = useState(24);
  const [maxClaims, setMaxClaims] = useState(250);
  const [mallFloor, setMallFloor] = useState(venue.mall_floor ?? "");
  const [coords, setCoords] = useState<{ latitude: number; longitude: number }>({
    latitude: venue.latitude ?? DEFAULT_LAT,
    longitude: venue.longitude ?? DEFAULT_LNG,
  });

  async function submitLoot(e: FormEvent) {
    e.preventDefault();
    const ok = await onCreateLoot({
      title,
      description,
      grabMode,
      rewardKind,
      modelStyle,
      rarity,
      xpReward,
      coinReward,
      promotionId: promotionId || null,
      latitude: coords.latitude,
      longitude: coords.longitude,
      radiusMetres,
      cooldownHours,
      maxClaims,
      mallFloor: mallFloor.trim() || null,
    });
    if (ok) {
      setTitle("");
      setDescription("");
    }
  }

  return (
    <div className={styles.panelGrid}>
      <form className={styles.panel} onSubmit={submitLoot}>
        <div>
          <h2>Place Map or AR Loot</h2>
          <p className={styles.muted}>
            Choose <strong>AR Grab</strong> to require players to visit your venue and scan with their camera, or <strong>Map Grab</strong> so explorers walk up via 3D map navigation and claim it directly.
          </p>
        </div>

        {!isPublishedVenue && (
          <div className={styles.bannerErr}>
            Your venue must be Admin-published with verified coordinates before placing live Map or AR loots.
          </div>
        )}

        <div className={styles.formGrid}>
          <label className={styles.field}>
            Loot Headline
            <input value={title} onChange={e => setTitle(e.target.value)} required minLength={2} maxLength={90} placeholder="e.g. Golden Croissant AR Crate" />
          </label>
          <label className={styles.field}>
            Grab Mode
            <select value={grabMode} onChange={e => setGrabMode(e.target.value as "ar_grab" | "map_grab")}>
              <option value="ar_grab">AR Grab (Visit + Camera AR Scan)</option>
              <option value="map_grab">Map Grab (Shown on 3D Explorer Map)</option>
            </select>
          </label>
          <label className={styles.field}>
            3D Object Model
            <select value={modelStyle} onChange={e => setModelStyle(e.target.value as (typeof LOOT_STYLES)[number]["id"])}>
              {LOOT_STYLES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          <label className={styles.field}>
            Reward Type
            <select value={rewardKind} onChange={e => setRewardKind(e.target.value as "collectible" | "offer" | "xp_coins")}>
              <option value="collectible">Collectible Badge & Coins</option>
              <option value="offer">Approved Deal Voucher Drop</option>
              <option value="xp_coins">XP & Coins Cache</option>
            </select>
          </label>
          <label className={styles.field}>
            Rarity
            <select value={rarity} onChange={e => setRarity(e.target.value as "common" | "rare" | "epic" | "legendary")}>
              <option value="common">Common</option>
              <option value="rare">Rare</option>
              <option value="epic">Epic</option>
              <option value="legendary">Legendary</option>
            </select>
          </label>
          <label className={styles.field}>
            Link Approved Deal (optional)
            <select value={promotionId} onChange={e => setPromotionId(e.target.value)}>
              <option value="">None</option>
              {publishedPromotions.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </label>
          <label className={styles.field}>
            XP Reward (25 to 300)
            <input type="number" min={25} max={300} value={xpReward} onChange={e => setXpReward(Number(e.target.value))} />
          </label>
          <label className={styles.field}>
            Coin Reward (0 to 200)
            <input type="number" min={0} max={200} value={coinReward} onChange={e => setCoinReward(Number(e.target.value))} />
          </label>
          <label className={styles.field}>
            Proximity Radius (m)
            <input type="number" min={25} max={150} value={radiusMetres} onChange={e => setRadiusMetres(Number(e.target.value))} />
          </label>
          <label className={styles.field}>
            Max Total Claims
            <input type="number" min={1} max={5000} value={maxClaims} onChange={e => setMaxClaims(Number(e.target.value))} />
          </label>
          <label className={styles.field}>
            Player Cooldown (Hours)
            <input type="number" min={0} max={168} value={cooldownHours} onChange={e => setCooldownHours(Number(e.target.value))} />
          </label>
          <label className={styles.field}>
            Mall Floor (if inside mall)
            <input value={mallFloor} onChange={e => setMallFloor(e.target.value)} placeholder="e.g. Level 2" maxLength={24} />
          </label>
          <label className={`${styles.field} ${styles.fieldFull}`}>
            Loot Description & Instructions
            <textarea value={description} onChange={e => setDescription(e.target.value)} required minLength={2} maxLength={600} />
          </label>
        </div>

        <PilotMapPicker
          latitude={coords.latitude}
          longitude={coords.longitude}
          onChange={setCoords}
          malls={data.malls}
          markers={data.loots
            .filter(l => typeof l.latitude === "number" && typeof l.longitude === "number")
            .map(l => ({ id: l.id, label: l.title, kind: "loot", latitude: l.latitude!, longitude: l.longitude! }))}
          pinLabel="Pin where this AR or Map loot appears"
          height={240}
        />

        <button type="submit" className="primary-button" disabled={busy || !isPublishedVenue}>
          <Sparkles size={16} /> Submit loot for Admin review
        </button>
      </form>

      <section className={styles.panel}>
        <h2>Your Active & Pending Loots ({data.loots.length})</h2>
        {data.loots.length === 0 ? (
          <p className={styles.muted}>No loots placed yet.</p>
        ) : (
          <div className={styles.listGrid}>
            {data.loots.map(l => (
              <article key={l.id} className={styles.itemCard}>
                <div className={styles.itemHead}>
                  <div>
                    <strong>{l.title}</strong>
                    <div className={styles.statusRow} style={{ marginTop: 6 }}>
                      <span className={`${styles.pill} ${styles.pillNeutral}`}>
                        {l.grabMode === "ar_grab" ? "AR Camera Grab" : "Map Grab"}
                      </span>
                      <span className={`${styles.pill} ${l.status === "published" ? styles.pillSuccess : l.status === "pending" ? styles.pillWarn : styles.pillDanger}`}>
                        {l.status}
                      </span>
                      <span className={styles.muted}>+{l.xpReward} XP | +{l.coinReward} Coins</span>
                    </div>
                  </div>
                  {(l.status === "pending" || l.status === "published") && (
                    <button type="button" className="secondary-button" disabled={busy} onClick={() => void onWithdrawLoot(l.id)}>
                      Withdraw
                    </button>
                  )}
                </div>
                <p className={styles.muted}>{l.description}</p>
                <p className={styles.muted}>Claims: {l.claimedCount} / {l.maxClaims}{l.reviewNote ? ` | Admin: ${l.reviewNote}` : ""}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function DealsManagerSection({
  promotions,
  isPublishedVenue,
  busy,
  onCreatePromo,
}: {
  promotions: Workspace["promotions"];
  isPublishedVenue: boolean;
  busy: boolean;
  onCreatePromo: (payload: Record<string, unknown>) => Promise<boolean>;
}) {
  const [kind, setKind] = useState<"food" | "restaurant" | "cafe">("restaurant");
  const [badgeText, setBadgeText] = useState("20% OFF");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [daysValid, setDaysValid] = useState(14);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");

  async function handleDealImage(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setUploadErr("");
    try {
      const url = await uploadImageAsset(file, "promotion");
      setImageUrl(url);
    } catch (err) {
      setUploadErr(err instanceof Error ? err.message : "Image upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function submitPromo(e: FormEvent) {
    e.preventDefault();
    const now = new Date();
    const end = new Date(now.getTime() + daysValid * 24 * 60 * 60 * 1000);
    const ok = await onCreatePromo({
      id: crypto.randomUUID(),
      kind,
      badgeText: badgeText.trim() || undefined,
      title,
      description,
      imageUrl: imageUrl ?? null,
      startsAt: now.toISOString(),
      endsAt: end.toISOString(),
    });
    if (ok) {
      setTitle("");
      setDescription("");
      setImageUrl(null);
    }
  }

  return (
    <div className={styles.panelGrid}>
      <form className={styles.panel} onSubmit={submitPromo}>
        <div>
          <h2>Post a Food Deal or Offer</h2>
          <p className={styles.muted}>
            Deals go live in the user Deals hub and earn FoodGo Rewards stamps only after Admin approval. Zero online payment required.
          </p>
        </div>

        {!isPublishedVenue && (
          <div className={styles.bannerErr}>
            Verify and publish your venue listing before submitting public deals.
          </div>
        )}

        <div className={styles.formGrid}>
          <label className={styles.field}>
            Deal Category
            <select value={kind} onChange={e => setKind(e.target.value as "food" | "restaurant" | "cafe")}>
              <option value="food">Food Deals (Meals & combos)</option>
              <option value="restaurant">Restaurant Deals (Dine & save)</option>
              <option value="cafe">Cafe Offers (Drinks & treats)</option>
            </select>
          </label>
          <label className={styles.field}>
            Gold Badge Headline
            <input value={badgeText} onChange={e => setBadgeText(e.target.value)} maxLength={40} placeholder="e.g. 20% OFF" />
          </label>
          <label className={`${styles.field} ${styles.fieldFull}`}>
            Offer Title
            <input value={title} onChange={e => setTitle(e.target.value)} required minLength={2} maxLength={90} placeholder="e.g. 20% OFF on wood-fired mains this week" />
          </label>
          <label className={`${styles.field} ${styles.fieldFull}`}>
            Offer Terms & Description
            <textarea value={description} onChange={e => setDescription(e.target.value)} required minLength={2} maxLength={400} />
          </label>
          <label className={styles.field}>
            Active Duration (Days)
            <input type="number" min={1} max={90} value={daysValid} onChange={e => setDaysValid(Number(e.target.value))} />
          </label>
        </div>

        <div className={styles.uploadRow}>
          <label className="secondary-button" style={{ cursor: "pointer" }}>
            <Camera size={15} />
            {uploading ? "Uploading dish image..." : imageUrl ? "Replace dish image" : "Upload deal dish photo"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              disabled={uploading}
              onChange={e => void handleDealImage(e.target.files?.[0])}
            />
          </label>
          {imageUrl && <img src={imageUrl} alt="Deal preview" className={styles.thumb} />}
          {uploadErr && <span className={styles.bannerErr}>{uploadErr}</span>}
        </div>

        <button type="submit" className="primary-button" disabled={busy || uploading || !isPublishedVenue}>
          Submit deal for Admin approval
        </button>
      </form>

      <section className={styles.panel}>
        <h2>Your Venue Deals ({promotions.length})</h2>
        {promotions.length === 0 ? (
          <p className={styles.muted}>No deals created yet.</p>
        ) : (
          <div className={styles.listGrid}>
            {promotions.map(p => (
              <article key={p.id} className={styles.itemCard}>
                <div className={styles.itemHead}>
                  <div className={styles.itemTitleRow}>
                    {p.image_url && <img src={p.image_url} alt={p.title} className={styles.thumb} />}
                    <div>
                      <strong>{p.badge_text ? `${p.badge_text} - ` : ""}{p.title}</strong>
                      <div className={styles.statusRow} style={{ marginTop: 4 }}>
                        <span className={`${styles.pill} ${styles.pillNeutral}`}>
                          {p.kind === "cafe" ? "Cafe Offers" : p.kind === "food" ? "Food Deals" : "Restaurant Deals"}
                        </span>
                        <span className={`${styles.pill} ${p.status === "published" ? styles.pillSuccess : p.status === "draft" ? styles.pillWarn : styles.pillDanger}`}>
                          {p.status === "draft" ? "Awaiting Admin approval" : p.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                {p.description && <p className={styles.muted}>{p.description}</p>}
                <p className={styles.muted}>Ends {new Date(p.ends_at).toLocaleDateString("en-AU")}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ReservationItemRow({
  reservation,
  busy,
  onDecide,
}: {
  reservation: ReservationRecord;
  busy: boolean;
  onDecide: (decision: "approved" | "declined" | "completed", note: string) => Promise<void>;
}) {
  const [note, setNote] = useState(reservation.decisionNote ?? "");
  return (
    <article className={styles.itemCard}>
      <div className={styles.itemHead}>
        <div>
          <strong>{reservation.guestName} ({reservation.partySize} guests)</strong>
          <p className={styles.muted}>
            {new Date(reservation.reservedFor).toLocaleString("en-AU")}
            {reservation.guestContact ? ` | ${reservation.guestContact}` : ""}
          </p>
        </div>
        <span className={`${styles.pill} ${reservation.status === "approved" ? styles.pillSuccess : reservation.status === "pending" ? styles.pillWarn : reservation.status === "completed" ? styles.pillSuccess : styles.pillDanger}`}>
          {reservation.status}
        </span>
      </div>
      {reservation.notes && <p className={styles.muted}>Guest note: {reservation.notes}</p>}
      {(reservation.status === "pending" || reservation.status === "approved") && (
        <div className={styles.formGrid}>
          <input
            type="text"
            placeholder="Optional note for guest (e.g. Table 4 confirmed)"
            value={note}
            onChange={e => setNote(e.target.value)}
            maxLength={240}
            style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1", fontSize: 13 }}
          />
          <div className={styles.btnRow}>
            {reservation.status === "pending" && (
              <>
                <button type="button" className="primary-button" disabled={busy} onClick={() => void onDecide("approved", note)}>
                  Approve
                </button>
                <button type="button" className="secondary-button" disabled={busy} onClick={() => void onDecide("declined", note)}>
                  Decline
                </button>
              </>
            )}
            {reservation.status === "approved" && (
              <button type="button" className="primary-button" disabled={busy} onClick={() => void onDecide("completed", note)}>
                Mark seated / completed
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
