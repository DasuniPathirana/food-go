"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ArrowUpRight, Bookmark, BookOpen, CheckCircle2, MapPin, Store, Utensils } from "lucide-react";
import { venueHref, type CatalogueState } from "@/lib/catalogue-contracts";
import { useSavedDishes, useSavedVenues } from "@/lib/preferences";
import { useSavedCatalogue } from "@/lib/saved-catalogue";
import { CatalogueStatus } from "./catalogue-status";
import { VenueCard } from "./venue-card";
import market from "./market-collections.module.css";
import { useJourney } from "./journey-provider";

export function FoodDex({ catalogue }: { catalogue: CatalogueState }) {
  const journey = useJourney();
  const discoveries = journey?.data?.discoveries ?? [];
  const { saved, toggle } = useSavedDishes(catalogue.mode);
  const [view, setView] = useState<"discover" | "saved" | "verified">("discover");
  const { catalogue: savedCatalogue, loading } = useSavedCatalogue(catalogue, saved, "dish");
  const activeCatalogue = view === "saved" ? savedCatalogue : catalogue;
  const dishes = catalogue.venues.flatMap((venue) => venue.dishes.map((dish) => ({ venue, dish })));
  const savedDishes = savedCatalogue.venues.flatMap((venue) => venue.dishes.map((dish) => ({ venue, dish }))).filter(({ dish }) => saved.includes(dish.id));
  const visible = view === "saved" ? savedDishes : dishes;
  return <div className={market.connected}>
    <header className={market.collectionHeader}><div>
      <h1>FoodDex</h1><p>Your dishes to try.</p></div>
      <span className={market.collectionSeal} aria-hidden="true"><Utensils size={31}/><BookOpen size={18}/></span>
    </header>
    {activeCatalogue.status !== "ready" && <CatalogueStatus catalogue={activeCatalogue} />}
    {loading && <p role="status">Loading your available saved dishes…</p>}
    {activeCatalogue.status === "ready" && <>
      <div className="stat-grid" aria-label="Your food collection summary">
        <div className="stat-card"><BookOpen size={20} /><strong>{discoveries.length}</strong><span>Verified dishes</span></div>
        <div className="stat-card"><Bookmark size={20} /><strong>{loading ? "…" : savedDishes.length}</strong><span>Available saved dishes</span></div>
        <div className="stat-card"><MapPin size={20} /><strong>{new Set(discoveries.map(d => d.cuisine)).size}</strong><span>Cuisines experienced</span></div>
      </div>
      <p className={market.collectionHint}><CheckCircle2 size={16}/>Collect the venue's dish code after trying it to verify your discovery.</p>
      <section aria-labelledby="food-collection-title">
        <div className="section-heading"><h2 id="food-collection-title">Your food list</h2>
          <div className="view-toggle" aria-label="Food collection view">
            {(["discover", "saved", "verified"] as const).map((item) => <button key={item} className={view === item ? "selected" : ""}
              aria-pressed={view === item} onClick={() => setView(item)}>{item === "discover" ? "Discover" : item === "saved" ? `Saved (${savedDishes.length})` : "Verified"}</button>)}
          </div>
        </div>
        {view === "verified" && discoveries.length > 0 ? <div className="venue-grid">{discoveries.map(d => <article className={market.verifiedEntry} key={d.id}>
          <CheckCircle2 size={24}/><h3>{d.name}</h3><p>{d.venue} · {d.cuisine}</p><small>Verified {new Date(d.at).toLocaleDateString("en-AU")}</small>
        </article>)}</div> : view === "verified" ? <div className="empty-state"><span className={market.emptyMark}><CheckCircle2 size={36} /></span><h3>No verified dishes yet</h3>
          <p>Ask the restaurant for a dish verification code after trying your meal.</p><Link href="/collect" className="primary-button">Collect a dish</Link>
          <button className="primary-button" onClick={() => setView("discover")}>Discover dishes <ArrowRight size={16} /></button>
        </div> : view === "saved" && loading ? null : visible.length ? <div className="venue-grid">{visible.map(({ venue, dish }) => <article className="venue-card collection-card" key={dish.id}>
          <div className="venue-image"><Link href={venueHref(venue)} tabIndex={-1} aria-hidden="true">
            <Image src={venue.image} alt={venue.imageAlt} width={600} height={380} sizes="(max-width:640px) 100vw, 33vw" /></Link>
            <span className="photo-label">{catalogue.mode === "demo" ? "Example dish" : "Menu item"}</span>
            <button className={`save-button ${saved.includes(dish.id) ? "is-saved" : ""}`} onClick={() => toggle(dish.id)}
              aria-label={`${saved.includes(dish.id) ? "Unsave" : "Save"} ${dish.name}`} aria-pressed={saved.includes(dish.id)}>
              <Bookmark size={18} fill={saved.includes(dish.id) ? "currentColor" : "none"} />
            </button>
          </div>
          <div className="venue-body"><div className="venue-type">{venue.cuisine}</div><h3><Link href={venueHref(venue)}>{dish.name}<ArrowUpRight size={18} /></Link></h3>
            <p className="venue-location"><MapPin size={13} />{venue.name}, {venue.suburb}</p>
            {dish.priceAudCents !== null && <p>{new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(dish.priceAudCents / 100)}</p>}
            <p className={market.singleLine} title={dish.description}>{dish.description}</p>
          </div>
        </article>)}</div> : <div className="empty-state"><span className={market.emptyMark}><Utensils size={36} /><Bookmark size={17}/></span>
          <h3>{view === "saved" ? "Your food list is empty" : "No available dishes yet"}</h3>
          <p>{view === "saved" ? "Save a dish from Discover to keep it in your account." : "Dishes appear when published venues add available menu items."}</p>
          {view === "saved" && <button className="primary-button" onClick={() => setView("discover")}>Discover dishes <ArrowRight size={16} /></button>}
        </div>}
      </section>
      {view === "discover" && catalogue.hasMore && <p className="inline-notice">Discovery shows dishes from the first 50 venues. Your saved list loads available dishes independently.</p>}
    </>}
  </div>;
}

export function VenueDex({ catalogue }: { catalogue: CatalogueState }) {
  const journey = useJourney();
  const visits = journey?.data?.visits ?? [];
  const { saved, toggle } = useSavedVenues(catalogue.mode);
  const [view, setView] = useState<"saved" | "visited">("saved");
  const { catalogue: savedCatalogue, loading } = useSavedCatalogue(catalogue, saved, "venue");
  const activeCatalogue = view === "saved" ? savedCatalogue : catalogue;
  const savedVenues = savedCatalogue.venues;
  return <div className={market.connected}>
    <header className={market.collectionHeader}><div><h1>VenueDex</h1>
      <p>Your places to visit.</p></div><span className={`${market.collectionSeal} ${market.venueSeal}`} aria-hidden="true"><Store size={31}/><Bookmark size={18}/></span>
    </header>
    {activeCatalogue.status !== "ready" && <CatalogueStatus catalogue={activeCatalogue} />}
    {loading && <p role="status">Loading your available saved places…</p>}
    {activeCatalogue.status === "ready" && <>
      <div className="stat-grid" aria-label="Your venue collection summary">
        <div className="stat-card"><Bookmark size={20} /><strong>{loading ? "…" : savedVenues.length}</strong><span>Available saved places</span></div>
        <div className="stat-card"><Store size={20} /><strong>{visits.length}</strong><span>Verified visits</span></div>
        <div className="stat-card"><MapPin size={20} /><strong>{new Set(visits.map(v => v.suburb)).size}</strong><span>Neighbourhoods visited</span></div>
      </div>
      <p className={market.collectionHint}><CheckCircle2 size={16}/>Ask the venue for its visit QR to collect a verified visit.</p>
      <section aria-labelledby="venue-collection-title"><div className="section-heading"><h2 id="venue-collection-title">Your places</h2>
        <div className="view-toggle" aria-label="Venue collection view">
          <button className={view === "saved" ? "selected" : ""} aria-pressed={view === "saved"} onClick={() => setView("saved")}>Saved ({savedVenues.length})</button>
          <button className={view === "visited" ? "selected" : ""} aria-pressed={view === "visited"} onClick={() => setView("visited")}>Visited</button>
        </div></div>
        {view === "visited" && visits.length > 0 ? <div className="venue-grid">{visits.map(v => <article className={market.verifiedEntry} key={v.id}><Store size={24}/>
          <h3><Link href={"/venues/" + v.id}>{v.name}</Link></h3><p>{v.suburb}</p><small>Verified {new Date(v.at).toLocaleDateString("en-AU")}</small></article>)}</div> :
          view === "visited" ? <div className="empty-state"><span className={market.emptyMark}><Store size={36} /></span><h3>No verified visits yet</h3>
          <p>Ask the venue for its visit QR when you arrive.</p><Link href="/collect" className="primary-button">Collect a visit</Link>
        </div> : loading ? null : savedVenues.length ? <div className="venue-grid">{savedVenues.map((venue) =>
          <VenueCard key={venue.id} venue={venue} saved onSave={() => toggle(venue.id)} />,
        )}</div> : <div className="empty-state"><span className={market.emptyMark}><Store size={36}/><Bookmark size={17}/></span><h3>Save your first place</h3>
          <p>Tap the bookmark on a place that catches your eye. Available saved places will appear here.</p>
        </div>}
      </section>
      {view === "saved" && !loading && !savedVenues.length && catalogue.venues.length > 0 && <section aria-label="Places to start with">
        <div className="section-heading"><h2>Places to start with</h2></div><div className="venue-grid">{catalogue.venues.slice(0, 3).map((venue) =>
          <VenueCard key={venue.id} venue={venue} saved={saved.includes(venue.id)} onSave={() => toggle(venue.id)} />,
        )}</div></section>}
    </>}
  </div>;
}
