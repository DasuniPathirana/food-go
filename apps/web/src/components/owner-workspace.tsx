"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { workspaceSchema, type Workspace } from "@/lib/journey";
import {
  buildingCustomizationSchema,
  lootLocationProposalSchema,
  restaurantQuestProposalSchema,
  validateBuildingPlacementTolerance,
  type BuildingCustomization,
  type LootLocationProposal,
  type RestaurantQuestProposal,
} from "@food-go/domain";

export function OwnerWorkspace({ venueId }: { venueId: string }) {
  const [data, setData] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const [proof, setProof] = useState<{ code: string; qr: string; expiresAt: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/partner/manage?venueId=" + encodeURIComponent(venueId), {
      credentials: "same-origin", cache: "no-store", signal: controller.signal,
    }).then(async response => {
      const body = await response.json(), parsed = workspaceSchema.safeParse(body);
      if (!response.ok || !parsed.success) throw new Error(body.error || "Your restaurant could not load.");
      if (!controller.signal.aborted) { setData(parsed.data); setError(""); }
    }).catch(failure => { if (!controller.signal.aborted) setError(failure.message || "Please try again."); });
    return () => controller.abort();
  }, [venueId, version]);
  async function act(input: Record<string, unknown>) {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/partner/manage", { method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, venueId }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Your change could not be saved.");
      if (input.action === "issue") setProof(body);
      else { setData(workspaceSchema.parse(body)); setMessage("Your change has been saved."); }
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Please try again."); }
    finally { setBusy(false); }
  }
  if (!data) return <section className="empty-state"><h1>Your restaurant</h1><p role="status">{error || "Loading restaurant…"}</p>
    <button className="secondary-button" onClick={() => setVersion(n => n + 1)}>Try again</button></section>;
  const venue = data.venue;
  const published = venue.status === "published" && !!venue.ownership_verified_at;
  return <div className="owner-workspace"><Link className="back-link" href="/partner/dashboard">All my restaurants</Link>
    <header className="page-intro"><div><h1>{venue.name}</h1><p>{venue.status} · {venue.ownership_verified_at ? "Ownership verified" : "Ownership review required"}</p></div>
      {published && <Link className="secondary-button" href={"/venues/" + venueId}>View public listing</Link>}</header>
    {error && <p role="alert" className="field-error">{error}</p>}
    {message && <p role="status" className="inline-notice">{message}</p>}
    <p>{data.visits} verified visits · {data.discoveries} verified dishes</p>
    <section className="content-panel"><h2>Listing details</h2>
      <form key={venue.updated_at} onSubmit={event => {
        event.preventDefault(); const form = new FormData(event.currentTarget);
        void act({ action: "details", version: venue.updated_at, ...Object.fromEntries(
          ["name","description","cuisine","address","suburb","state","postcode"].map(key => [key, form.get(key)])),
          gameEnabled: form.get("gameEnabled") === "on" });
      }}><fieldset disabled={busy}>
        <div className="form-grid">{[
          ["name","Restaurant name",venue.name], ["cuisine","Cuisine",venue.cuisine],
          ["address","Street address",venue.address], ["suburb","Suburb",venue.suburb], ["postcode","Postcode",venue.postcode],
        ].map(([key,label,value]) => <div className="form-field" key={key}><label htmlFor={"owner-" + key}>{label}</label>
          <input id={"owner-" + key} name={key} defaultValue={value} maxLength={key === "address" ? 200 : 120} required /></div>)}
          <div className="form-field"><label htmlFor="owner-state">State</label><select id="owner-state" name="state" defaultValue={venue.state}>
            {["ACT","NSW","NT","QLD","SA","TAS","VIC","WA"].map(state => <option key={state}>{state}</option>)}</select></div>
          <div className="form-field full-width"><label htmlFor="owner-description">About your restaurant</label>
            <textarea id="owner-description" name="description" maxLength={1000} defaultValue={venue.description}/></div></div>
        <label className="checkbox-field"><input type="checkbox" name="gameEnabled" defaultChecked={venue.game_enabled}/>Offer verified visits and dish discoveries</label>
        <p>Changing the business name or address sends the listing for a fresh ownership review.</p>
        <button className="primary-button">Save details</button>
      </fieldset></form>
      {["draft","pending"].includes(venue.status) && <button className="secondary-button" disabled={busy} onClick={() => void act({ action: "submit", version: venue.updated_at })}>
        {venue.status === "pending" ? "Resubmit for review" : "Submit for ownership review"}</button>}
    </section>
    <section className="content-panel"><h2>Your menu</h2><p>Available menu items appear on the public listing after restaurant approval.</p>
      {data.dishes.map(dish => <MenuForm key={dish.id + dish.updated_at} dish={dish} busy={busy} save={input => void act(input)} />)}
      <details><summary>Add a dish</summary><MenuForm key={"new-" + data.dishes.length} busy={busy} save={input => void act(input)}/></details>
    </section>
    <section className="content-panel"><h2>Customer verification</h2><p>Show a fresh QR at the counter for visits. Issue a dish code only after the customer has tried that dish.</p>
      {published && venue.game_enabled ? <><button className="primary-button" disabled={busy} onClick={() => void act({ action: "issue" })}>Create visit QR</button>
        {data.dishes.filter(d => d.is_available).map(d => <button key={d.id} className="secondary-button" disabled={busy}
          onClick={() => void act({ action: "issue", dishId: d.id })}>Create code for {d.name}</button>)}</> :
        <p>Verification opens when ownership is verified, the listing is published and discoveries are enabled.</p>}
      {proof && <div role="status"><img width={280} height={280} src={proof.qr} alt="Customer discovery QR code"/>
        <p><code>{proof.code}</code></p><p>Expires {new Date(proof.expiresAt).toLocaleTimeString("en-AU")}</p></div>}
    </section>
    <section className="content-panel"><h2>Promotions</h2>
      {data.promotions.map(p => <p key={p.id}>{p.title} · {p.kind === "food" ? "Food deal" : "Restaurant deal"} · {p.status} · Ends {new Date(p.ends_at).toLocaleDateString("en-AU")}</p>)}
      {published ? <PromotionForm key={data.promotions.length} busy={busy} save={input => void act(input)}/> : <p>Publish your listing before submitting an offer.</p>}
    </section>
    <section className="content-panel"><h2>3D Map Representation and Building Customization</h2>
      <p>Customise how your restaurant appears on the Melbourne 3D exploration map. Changes require administrator review before going live.</p>
      <BuildingCustomizationForm venueId={venueId} venueName={venue.name} />
    </section>
    <section className="content-panel"><h2>Proposed Loot and Quests</h2>
      <p>Propose interactive reward drops and custom dining quests around your venue. All loot placements are verified by administrators.</p>
      <LootProposalForm venueId={venueId} />
      <QuestProposalForm venueId={venueId} />
    </section>
  </div>;
}
function MenuForm({ dish, busy, save }: { dish?: Workspace["dishes"][number]; busy: boolean; save: (input: Record<string, unknown>) => void }) {
  const [id] = useState(() => dish?.id || crypto.randomUUID());
  return <form className="content-panel" onSubmit={(event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    save({ action: "dish", dishId: id, ...(dish && { version: dish.updated_at }), name: form.get("name"),
      description: form.get("description"), price: Math.round(Number(form.get("price")) * 100), available: form.get("available") === "on" });
  }}><fieldset disabled={busy}><legend>{dish ? dish.name : "New menu item"}</legend>
    <label>Dish name<input name="name" required minLength={2} maxLength={120} defaultValue={dish?.name}/></label>
    <label>Description<textarea name="description" maxLength={1000} defaultValue={dish?.description}/></label>
    <label>Price in AUD<input name="price" type="number" min="0" max="10000" step="0.01" required defaultValue={(dish?.price_aud_cents ?? 0) / 100}/></label>
    <label><input type="checkbox" name="available" defaultChecked={dish?.is_available ?? true}/>Available</label>
    <button className="secondary-button">Save dish</button>
  </fieldset></form>;
}
function PromotionForm({ busy, save }: { busy: boolean; save: (input: Record<string, unknown>) => void }) {
  const [id] = useState(() => crypto.randomUUID());
  return <form onSubmit={event => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    save({ action: "promo", id, title: form.get("title"), description: form.get("description"), kind: form.get("kind"),
      startsAt: new Date(String(form.get("start"))).toISOString(), endsAt: new Date(String(form.get("end"))).toISOString() });
  }}><fieldset disabled={busy}><legend>Submit an offer for review</legend>
    <label>Deal category<select name="kind" defaultValue="restaurant"><option value="food">Food deal</option><option value="restaurant">Restaurant deal</option></select></label>
    <label>Title<input name="title" required minLength={2} maxLength={90}/></label>
    <label>Offer details<textarea name="description" required minLength={2} maxLength={400}/></label>
    <label>Starts<input name="start" type="datetime-local" required/></label><label>Ends<input name="end" type="datetime-local" required/></label>
    <p>An operator reviews and publishes the offer before it appears to customers.</p><button className="primary-button">Submit promotion</button>
  </fieldset></form>;
}

function BuildingCustomizationForm({ venueId, venueName }: { venueId: string; venueName: string }) {
  const [palette, setPalette] = useState<BuildingCustomization["palette"]>("heritage-brick");
  const [roofStyle, setRoofStyle] = useState<BuildingCustomization["roofStyle"]>("classic-mansard");
  const [lightingStyle, setLightingStyle] = useState<BuildingCustomization["lightingStyle"]>("warm-amber");
  const [signageText, setSignageText] = useState(venueName.slice(0, 40));
  const [signageColor, setSignageColor] = useState("#ffd445");
  const [floorLevel, setFloorLevel] = useState("Ground");
  const [unitIdentifier, setUnitIdentifier] = useState("Shop 1");
  const [lat, setLat] = useState(-37.8136);
  const [lng, setLng] = useState(144.9631);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    setError(null);

    // Verify placement tolerance against verified coordinate (Melbourne CBD baseline for demo)
    const verifiedCoord = { latitude: -37.8136, longitude: 144.9631 };
    const proposedCoord = { latitude: lat, longitude: lng };
    const tolerance = validateBuildingPlacementTolerance(verifiedCoord, proposedCoord);
    if (!tolerance.valid) {
      setError(`Building placement deviates ${tolerance.distanceMetres}m, exceeding the 60-metre threshold from your verified location.`);
      setBusy(false);
      return;
    }

    const payload = {
      id: crypto.randomUUID(),
      venueId,
      buildingId: "bldg-" + venueId.slice(0, 8),
      palette,
      roofStyle,
      lightingStyle,
      signage: {
        text: signageText.trim() || venueName.slice(0, 40),
        color: signageColor,
        illuminated: true,
      },
      location: {
        latitude: lat,
        longitude: lng,
        floorLevel: floorLevel.trim() || "Ground",
        unitIdentifier: unitIdentifier.trim() || "Shop 1",
      },
      status: "pending_review" as const,
      submittedAt: new Date().toISOString(),
    };

    const parsed = buildingCustomizationSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Invalid customization request.");
      setBusy(false);
      return;
    }

    setStatus("Building customisation request submitted for administrator review.");
    setBusy(false);
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: "1rem" }}>
      <fieldset disabled={busy}>
        <legend>Request Building Appearance</legend>
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="owner-palette">Building architectural palette</label>
            <select
              id="owner-palette"
              value={palette}
              onChange={e => setPalette(e.target.value as BuildingCustomization["palette"])}
            >
              <option value="heritage-brick">Heritage Red Brick</option>
              <option value="modern-glass">Modern Glazed Storefront</option>
              <option value="warm-timber">Warm Melbourne Timber</option>
              <option value="petrol-slate">Petrol Slate Facade</option>
              <option value="golden-sandstone">Golden Sandstone</option>
              <option value="terracotta-clay">Terracotta Clay</option>
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="owner-roof-style">Roof style</label>
            <select
              id="owner-roof-style"
              value={roofStyle}
              onChange={e => setRoofStyle(e.target.value as BuildingCustomization["roofStyle"])}
            >
              <option value="classic-mansard">Classic Mansard Roof</option>
              <option value="terrace-garden">Rooftop Dining Terrace</option>
              <option value="solar-canopy">Solar Canopy</option>
              <option value="lantern-pavilion">Lantern Pavilion</option>
              <option value="skylight-atrium">Skylight Atrium</option>
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="owner-lighting">Lighting ambiance</label>
            <select
              id="owner-lighting"
              value={lightingStyle}
              onChange={e => setLightingStyle(e.target.value as BuildingCustomization["lightingStyle"])}
            >
              <option value="warm-amber">Warm Amber Glow</option>
              <option value="cool-white">Crisp Cool White</option>
              <option value="neon-gold">Neon Gold Accent</option>
              <option value="subtle-lantern">Subtle Laneway Lantern</option>
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="owner-signage-color">Signage colour</label>
            <input
              id="owner-signage-color"
              type="color"
              value={signageColor}
              onChange={e => setSignageColor(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="owner-signage">3D Signage text</label>
            <input
              id="owner-signage"
              type="text"
              minLength={2}
              maxLength={40}
              value={signageText}
              onChange={e => setSignageText(e.target.value)}
              placeholder="e.g. Pellegrini's Espresso Bar"
            />
          </div>
          <div className="form-field">
            <label htmlFor="owner-floor">Mall floor level (if applicable)</label>
            <input
              id="owner-floor"
              type="text"
              maxLength={20}
              value={floorLevel}
              onChange={e => setFloorLevel(e.target.value)}
              placeholder="e.g. Ground, L1, L2"
            />
          </div>
          <div className="form-field">
            <label htmlFor="owner-shop-unit">Shop / arcade unit</label>
            <input
              id="owner-shop-unit"
              type="text"
              maxLength={20}
              value={unitIdentifier}
              onChange={e => setUnitIdentifier(e.target.value)}
              placeholder="e.g. Shop 24B"
            />
          </div>
          <div className="form-field">
            <label htmlFor="owner-latitude">Latitude (within 60m)</label>
            <input
              id="owner-latitude"
              type="number"
              step="any"
              value={lat}
              onChange={e => setLat(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="owner-longitude">Longitude (within 60m)</label>
            <input
              id="owner-longitude"
              type="number"
              step="any"
              value={lng}
              onChange={e => setLng(parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>
        {error && <p role="alert" className="field-error" style={{ color: "#d93829", marginTop: "0.5rem" }}>{error}</p>}
        {status && <p role="status" className="inline-notice" style={{ marginTop: "0.5rem" }}>{status}</p>}
        <button type="submit" className="primary-button" style={{ marginTop: "1rem" }}>
          Submit building appearance for review
        </button>
      </fieldset>
    </form>
  );
}

function LootProposalForm({ venueId }: { venueId: string }) {
  const [title, setTitle] = useState("Discovery Treat Crate");
  const [description, setDescription] = useState("A hidden discovery treat for hungry explorers.");
  const [rarity, setRarity] = useState<LootLocationProposal["rarity"]>("common");
  const [claimRadius, setClaimRadius] = useState(25);
  const [cooldownHours, setCooldownHours] = useState(24);
  const [dailyLimit, setDailyLimit] = useState(10);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus(null);
    setError(null);

    const parsed = lootLocationProposalSchema.safeParse({
      id: crypto.randomUUID(),
      venueId,
      title,
      description,
      coordinates: {
        latitude: -37.8136,
        longitude: 144.9631,
      },
      claimRadiusMetres: claimRadius,
      cooldownHours,
      dailyClaimLimit: dailyLimit,
      rarity,
      status: "pending_review",
      submittedAt: new Date().toISOString(),
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Invalid loot proposal.");
      return;
    }

    setStatus("Proposed loot location submitted for administrator review.");
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: "1.5rem" }}>
      <fieldset>
        <legend>Propose an AR Loot Drop</legend>
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="loot-title">Loot drop title</label>
            <input
              id="loot-title"
              type="text"
              minLength={2}
              maxLength={80}
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="loot-rarity">Loot rarity</label>
            <select
              id="loot-rarity"
              value={rarity}
              onChange={e => setRarity(e.target.value as LootLocationProposal["rarity"])}
            >
              <option value="common">Common Treat</option>
              <option value="uncommon">Uncommon Delicacy</option>
              <option value="rare">Rare Chef Reserve</option>
              <option value="epic">Epic Epicurean Chest</option>
            </select>
          </div>
          <div className="form-field full-width">
            <label htmlFor="loot-desc">Description</label>
            <input
              id="loot-desc"
              type="text"
              minLength={5}
              maxLength={300}
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="loot-radius">Trigger radius (metres)</label>
            <input
              id="loot-radius"
              type="number"
              min={5}
              max={50}
              value={claimRadius}
              onChange={e => setClaimRadius(parseInt(e.target.value, 10) || 25)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="loot-cooldown">Cooldown (hours)</label>
            <input
              id="loot-cooldown"
              type="number"
              min={1}
              max={168}
              value={cooldownHours}
              onChange={e => setCooldownHours(parseInt(e.target.value, 10) || 24)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="loot-max-claims">Maximum daily claims</label>
            <input
              id="loot-max-claims"
              type="number"
              min={1}
              max={50}
              value={dailyLimit}
              onChange={e => setDailyLimit(parseInt(e.target.value, 10) || 10)}
            />
          </div>
        </div>
        {error && <p role="alert" className="field-error" style={{ color: "#d93829", marginTop: "0.5rem" }}>{error}</p>}
        {status && <p role="status" className="inline-notice" style={{ marginTop: "0.5rem" }}>{status}</p>}
        <button type="submit" className="secondary-button" style={{ marginTop: "1rem" }}>
          Submit loot drop for approval
        </button>
      </fieldset>
    </form>
  );
}

function QuestProposalForm({ venueId }: { venueId: string }) {
  const [title, setTitle] = useState("Taste Melbourne Culinary Trail");
  const [description, setDescription] = useState("Visit this venue and try a chef special dish to unlock exclusive rewards.");
  const [category, setCategory] = useState<RestaurantQuestProposal["category"]>("try_dish");
  const [rewardXp, setRewardXp] = useState(150);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus(null);
    setError(null);

    const parsed = restaurantQuestProposalSchema.safeParse({
      id: crypto.randomUUID(),
      venueId,
      title,
      description,
      category,
      rewardXp,
      status: "pending_review",
      submittedAt: new Date().toISOString(),
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Invalid quest proposal.");
      return;
    }

    setStatus("Proposed restaurant quest submitted for administrator review.");
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: "1.5rem" }}>
      <fieldset>
        <legend>Propose a Restaurant Quest</legend>
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="quest-title">Quest title</label>
            <input
              id="quest-title"
              type="text"
              minLength={2}
              maxLength={100}
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="quest-cat">Category</label>
            <select
              id="quest-cat"
              value={category}
              onChange={e => setCategory(e.target.value as RestaurantQuestProposal["category"])}
            >
              <option value="visit">Venue Visit Quest</option>
              <option value="try_dish">Signature Dish Discovery</option>
              <option value="feedback">Foodie Feedback & Review</option>
              <option value="social_story">Food Go Social Moment</option>
              <option value="promotion">Seasonal Celebration</option>
            </select>
          </div>
          <div className="form-field full-width">
            <label htmlFor="quest-desc">Description</label>
            <textarea
              id="quest-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="quest-xp">Reward XP (25 - 500)</label>
            <input
              id="quest-xp"
              type="number"
              min={25}
              max={500}
              value={rewardXp}
              onChange={e => setRewardXp(parseInt(e.target.value, 10) || 100)}
            />
          </div>
        </div>
        {error && <p role="alert" className="field-error" style={{ color: "#d93829", marginTop: "0.5rem" }}>{error}</p>}
        {status && <p role="status" className="inline-notice" style={{ marginTop: "0.5rem" }}>{status}</p>}
        <button type="submit" className="secondary-button" style={{ marginTop: "1rem" }}>
          Submit quest proposal
        </button>
      </fieldset>
    </form>
  );
}
