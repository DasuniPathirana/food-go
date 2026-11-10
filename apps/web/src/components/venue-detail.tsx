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
import type { Venue } from "@/lib/fixtures";
import { useSavedVenues } from "@/lib/preferences";

export function VenueDetail({ venue }: { venue: Venue }) {
  const { saved, toggle } = useSavedVenues();
  const isSaved = saved.includes(venue.id);
  return (
    <>
      <Link href="/" className="back-link">
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
            {venue.suburb}, VIC
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
            <Link href="/quests" className="secondary-button">
              Find a food trail
              <ArrowRight size={16} />
            </Link>
          </div>
          <p className="inline-notice">
            <ShieldCheck size={17} />
            This is a fictional venue with illustrative photography. Bookings,
            offers and check-ins are not available.
          </p>
        </div>
      </section>
      <div className="detail-columns">
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
      </div>
    </>
  );
}
