"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ArrowUpRight, Bookmark, BookOpen, CheckCircle2, Compass, MapPin, Store } from "lucide-react";
import { venueHref, type CatalogueState } from "@/lib/catalogue-contracts";
import { useSavedDishes, useSavedVenues } from "@/lib/preferences";
import { useSavedCatalogue } from "@/lib/saved-catalogue";
import { CatalogueStatus } from "./catalogue-status";
import { VenueCard } from "./venue-card";

export function FoodDex({ catalogue }: { catalogue: CatalogueState }) {
  const { saved, toggle } = useSavedDishes(catalogue.mode);
  const [view, setView] = useState<"discover" | "saved" | "verified">("discover");
  const { catalogue: savedCatalogue, loading } = useSavedCatalogue(catalogue, saved, "dish");
  const activeCatalogue = view === "saved" ? savedCatalogue : catalogue;
  const dishes = catalogue.venues.flatMap((venue) => venue.dishes.map((dish) => ({ venue, dish })));
  const savedDishes = savedCatalogue.venues.flatMap((venue) => venue.dishes.map((dish) => ({ venue, dish }))).filter(({ dish }) => saved.includes(dish.id));
  const visible = view === "saved" ? savedDishes : dishes;
  return <>
    <div className="page-intro"><div><div className="eyebrow">Your food collection</div>
      <h1>What would you like to try?</h1><p>Save a dish for your next meal. Verified discoveries will appear when dish confirmation is connected.</p></div>
      <Link className="secondary-button" href="/"><Compass size={17} /> Explore places <ArrowUpRight size={16} /></Link>
    </div>
    <CatalogueStatus catalogue={activeCatalogue} />
    {loading && <p role="status">Loading your available saved dishes…</p>}
    {activeCatalogue.status === "ready" && <>
      <div className="stat-grid" aria-label="Your food collection summary">
        <div className="stat-card"><BookOpen size={20} /><strong>0</strong><span>Verified dishes</span></div>
        <div className="stat-card"><Bookmark size={20} /><strong>{loading ? "…" : savedDishes.length}</strong><span>Available saved dishes</span></div>
        <div className="stat-card"><MapPin size={20} /><strong>0</strong><span>Cuisines experienced</span></div>
      </div>
      <p className="inline-notice">Dish saves are separate from saved venues and stay on this browser. Saving a dish does not mark it as eaten.</p>
      <section aria-labelledby="food-collection-title">
        <div className="section-heading"><h2 id="food-collection-title">Your food list</h2>
          <div className="view-toggle" aria-label="Food collection view">
            {(["discover", "saved", "verified"] as const).map((item) => <button key={item} className={view === item ? "selected" : ""}
              aria-pressed={view === item} onClick={() => setView(item)}>{item === "discover" ? "Discover" : item === "saved" ? `Saved (${savedDishes.length})` : "Verified"}</button>)}
          </div>
        </div>
        {view === "verified" ? <div className="empty-state"><CheckCircle2 size={32} /><h3>No verified dishes yet</h3>
          <p>Dish verification needs separate confirmation. Saving a dish or venue does not create a verified discovery.</p>
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
            <p>{dish.description}</p>
          </div>
        </article>)}</div> : <div className="empty-state"><Bookmark size={32} />
          <h3>{view === "saved" ? "Your food list is empty" : "No available dishes yet"}</h3>
          <p>{view === "saved" ? "Save a dish from Discover to keep it on this browser." : "Dishes will appear when published venues add available menu items."}</p>
          {view === "saved" && <button className="primary-button" onClick={() => setView("discover")}>Discover dishes <ArrowRight size={16} /></button>}
        </div>}
      </section>
      {view === "discover" && catalogue.hasMore && <p className="inline-notice">Discovery shows dishes from the first 50 venues. Your saved list loads available dishes independently.</p>}
    </>}
  </>;
}

export function VenueDex({ catalogue }: { catalogue: CatalogueState }) {
  const { saved, toggle } = useSavedVenues(catalogue.mode);
  const [view, setView] = useState<"saved" | "visited">("saved");
  const { catalogue: savedCatalogue, loading } = useSavedCatalogue(catalogue, saved, "venue");
  const activeCatalogue = view === "saved" ? savedCatalogue : catalogue;
  const savedVenues = savedCatalogue.venues;
  return <>
    <div className="page-intro"><div><div className="eyebrow">Your venue collection</div><h1>Places you want to go</h1>
      <p>Keep a list of places to visit. Verified visits will be recorded separately.</p></div>
      <Link className="secondary-button" href="/"><Compass size={17} />Explore places<ArrowUpRight size={16} /></Link>
    </div>
    <CatalogueStatus catalogue={activeCatalogue} />
    {loading && <p role="status">Loading your available saved places…</p>}
    {activeCatalogue.status === "ready" && <>
      <div className="stat-grid" aria-label="Your venue collection summary">
        <div className="stat-card"><Bookmark size={20} /><strong>{loading ? "…" : savedVenues.length}</strong><span>Available saved places</span></div>
        <div className="stat-card"><Store size={20} /><strong>0</strong><span>Verified visits</span></div>
        <div className="stat-card"><MapPin size={20} /><strong>0</strong><span>Neighbourhoods visited</span></div>
      </div>
      <p className="inline-notice">A saved place is a plan, not a visit. Saves stay on this browser and are separate from your dish wishlist.</p>
      <section aria-labelledby="venue-collection-title"><div className="section-heading"><h2 id="venue-collection-title">Your places</h2>
        <div className="view-toggle" aria-label="Venue collection view">
          <button className={view === "saved" ? "selected" : ""} aria-pressed={view === "saved"} onClick={() => setView("saved")}>Saved ({savedVenues.length})</button>
          <button className={view === "visited" ? "selected" : ""} aria-pressed={view === "visited"} onClick={() => setView("visited")}>Visited</button>
        </div></div>
        {view === "visited" ? <div className="empty-state"><Store size={32} /><h3>No verified visits yet</h3>
          <p>Verified visits will appear when secure check-ins are connected. Saving a place does not record a visit.</p>
          <Link className="primary-button" href="/">Find a place <ArrowRight size={16} /></Link>
        </div> : loading ? null : savedVenues.length ? <div className="venue-grid">{savedVenues.map((venue) =>
          <VenueCard key={venue.id} venue={venue} saved onSave={() => toggle(venue.id)} />,
        )}</div> : <div className="empty-state"><Bookmark size={32} /><h3>Save your first place</h3>
          <p>Tap the bookmark on a place that catches your eye. Available saved places will appear here.</p>
          <Link className="primary-button" href="/">Find your first favourite <ArrowRight size={16} /></Link>
        </div>}
      </section>
      {view === "saved" && !loading && !savedVenues.length && catalogue.venues.length > 0 && <section aria-label="Places to start with">
        <div className="section-heading"><h2>Places to start with</h2></div><div className="venue-grid">{catalogue.venues.slice(0, 3).map((venue) =>
          <VenueCard key={venue.id} venue={venue} saved={saved.includes(venue.id)} onSave={() => toggle(venue.id)} />,
        )}</div></section>}
    </>}
  </>;
}
