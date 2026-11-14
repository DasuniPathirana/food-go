"use client";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Search } from "lucide-react";
import Link from "next/link";
import { AU_STATES } from "@food-go/domain";
import type { CatalogueState } from "@/lib/catalogue-contracts";
import { useSavedVenues } from "@/lib/preferences";
import { CatalogueStatus } from "./catalogue-status";
import { AdventureMap, AdventureVenueSheet } from "./adventure-map";
import mapStyles from "./adventure-map.module.css";

export function ConnectedDiscovery({ catalogue }: { catalogue: CatalogueState }) {
  const [result, setResult] = useState(catalogue);
  const [query, setQuery] = useState("");
  const [state, setState] = useState("");
  const [type, setType] = useState("");
  const [pending, setPending] = useState(false);
  const { saved, toggle } = useSavedVenues("supabase");
  useEffect(() => setResult(catalogue), [catalogue]);
  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    try {
      const params = new URLSearchParams({ q: query, limit: "50" });
      if (state) params.set("state", state);
      if (type) params.set("venueType", type);
      const response = await fetch(`/api/venues?${params}`, { signal: AbortSignal.timeout(15000), cache: "no-store" });
      const body = await response.json();
      if (!response.ok || body.mode !== "supabase" || body.status !== "ready" || !Array.isArray(body.data)) throw new Error("unavailable");
      setResult({ mode: "supabase", status: "ready", venues: body.data, hasMore: body.hasMore === true });
    } catch {
      setResult({ mode: "supabase", status: "unavailable", venues: [], hasMore: false });
    } finally { setPending(false); }
  }
  const overlay = <>
    <section className="discovery-intro"><div>
      <p className="edition-label">Your neighbourhood food guide</p>
      <h1>Where are we eating?</h1>
      <p>Discover published venues around Australia and save a few for later.</p>
    </div></section>
    <section className="discovery-controls" aria-label="Find a place">
      <form className="search-bar" onSubmit={search}>
        <label className="discovery-search"><Search size={20} />
          <input aria-label="Search venue names, suburbs or cuisines" type="search" maxLength={100} value={query}
            onChange={(event) => setQuery(event.target.value)} placeholder="Search a place, suburb or cuisine" />
        </label>
        <label className="city-field"><span>State</span>
          <select aria-label="State or territory" value={state} onChange={(event) => setState(event.target.value)}>
            <option value="">All Australia</option>{AU_STATES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="city-field"><span>Type</span>
          <select aria-label="Venue type" value={type} onChange={(event) => setType(event.target.value)}>
            <option value="">All places</option><option value="cafe">Cafes</option><option value="restaurant">Restaurants</option><option value="market">Food markets</option>
          </select>
        </label>
        <button className="primary-button" type="submit" disabled={pending}>{pending ? "Searching…" : "Search"}</button>
      </form>
    </section>
    </>;
  const sheet = pending ? <div className={mapStyles.sheetEmpty} role="status"><h2>Finding places…</h2><p>The illustrated playground stays open while published results load.</p></div>
    : result.status === "unavailable" ? <div className={mapStyles.sheetEmpty}><h2>Places are temporarily unavailable</h2><p>Try the search again shortly. This illustrated preview does not substitute venues.</p></div>
    : result.venues.length ? <AdventureVenueSheet venues={result.venues} saved={saved} onSave={toggle} title="Published places to explore" />
    : <div className={mapStyles.sheetEmpty}><h2>No published places found</h2><p>Try another suburb, cuisine or state. Venues appear after ownership and listing approval.</p></div>;
  return <>
    <AdventureMap overlay={overlay} sheet={sheet} resultsLabel={pending ? "Finding places…" : result.status === "unavailable" ? "Places unavailable" : `Published places (${result.venues.length})`} />
    <div className={mapStyles.searchStatus}>
      <Link href="/demo" className="primary-button">Play the full adventure demo <ArrowRight size={16} /></Link>
      <CatalogueStatus catalogue={result} />
    </div>
    {result.hasMore && <p className="inline-notice">Showing the first 50 matching places. Add a suburb, cuisine or state to narrow your search.</p>}
  </>;
}
