"use client";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Leaf,
  MapPin,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { CatalogueMode, CatalogueVenue } from "@/lib/catalogue-contracts";
import { useSavedDishes, useSavedVenues } from "@/lib/preferences";
import { VenueDirections } from "./venue-directions";

export function VenueDetail({ venue, mode }: { venue: CatalogueVenue; mode: CatalogueMode }) {
  const { saved, toggle } = useSavedVenues(mode);
  const { saved: savedDishes, toggle: toggleDish } = useSavedDishes(mode);
  const isSaved = saved.includes(venue.id);
  return (
    <>
      <Link href={mode === "demo" ? "/explore-preview" : "/"} className="back-link">
        <ArrowLeft size={16} />
        Back to discoveries
      </Link>
      <section className="venue-detail-hero">
        <Image
          src={venue.image}
          alt={venue.imageAlt}
          width={1000}
          height={800}
          priority
          className="venue-detail-image"
        />
        <div className="venue-detail-copy">
          <span className="eyebrow">A LITTLE NEIGHBOURHOOD DISCOVERY</span>
          <h1>{venue.name}</h1>
          <div className="venue-location">
            <MapPin size={15} />
            {venue.suburb}, {venue.state}
          </div>
          <p>{venue.description}</p>
          <div className="venue-detail-tags">
            <span>{venue.cuisine}</span>
            {venue.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
          <div className="venue-detail-actions">
            <button
              className="primary-button"
              onClick={() => toggle(venue.id)}
              aria-pressed={isSaved}
            >
              <Bookmark size={16} fill={isSaved ? "currentColor" : "none"} />
              {isSaved ? "Saved to your plans" : "Save for a good day"}
            </button>
            {mode === "demo" && <Link href="/quests" className="secondary-button">
              Find a food trail
              <ArrowRight size={16} />
            </Link>}
          </div>
          <VenueDirections venue={venue} />
          <p className="inline-notice">
            <ShieldCheck size={17} />
            {mode === "demo" ? "This is a fictional venue with illustrative photography. Bookings, offers and check-ins are not available."
              : "Published venue listing. The illustration is a placeholder. Bookings and verified check-ins are not connected."}
          </p>
        </div>
      </section>
      {mode === "supabase" ? <div className="detail-columns">
        <section className="content-panel"><span className="eyebrow">On the menu</span><h2>Available dishes</h2>
          {venue.dishes.length ? venue.dishes.map((dish) => <article key={dish.id} className="content-panel">
            <h3>{dish.name}</h3><p>{dish.description}</p>
            {dish.priceAudCents !== null && <p>{new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(dish.priceAudCents / 100)}</p>}
            <button className="secondary-button" onClick={() => toggleDish(dish.id)} aria-pressed={savedDishes.includes(dish.id)}>
              <Bookmark size={16} fill={savedDishes.includes(dish.id) ? "currentColor" : "none"} />
              {savedDishes.includes(dish.id) ? "Saved to try" : "Save dish to try"}
            </button>
          </article>) : <p>The venue has not added available menu items yet.</p>}
          <Link className="text-button" href="/food-dex">Save a dish to try <ArrowRight size={15} /></Link>
        </section>
        <section className="content-panel"><span className="eyebrow">Find the venue</span><h2>{venue.suburb}</h2>
          <p>{venue.address}, {venue.suburb}, {venue.state} {venue.postcode}</p>
          <p>Opening hours and venue photographs are not available yet. Confirm menu availability and dietary needs directly with the venue.</p>
        </section>
      </div> : <div className="detail-columns">
        <section className="content-panel">
          <span className="eyebrow">SOMETHING WORTH DISCOVERING</span>
          <h2>
            <Sparkles size={20} /> {venue.dish}
          </h2>
          <p>
            A signature dish idea for your future FoodDex. Saving this example
            venue adds it to your plans. A verified food discovery will need its
            own evidence when live check-ins are introduced.
          </p>
          <Link className="text-button" href="/food-dex">
            Explore your FoodDex
            <ArrowRight size={15} />
          </Link>
        </section>
        <section className="content-panel">
          <span className="eyebrow">GOOD TO KNOW</span>
          <h2>
            <Leaf size={20} /> A thoughtful little preview
          </h2>
          <p>
            The venue name, address and participation are examples. Live opening
            hours, menu prices, dietary information and availability will come
            from verified venue owners. Always confirm dietary needs with a real
            venue.
          </p>
        </section>
      </div>}
    </>
  );
}
