"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { workspaceSchema, type Workspace } from "@/lib/journey";

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
