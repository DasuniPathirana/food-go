"use client";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Bookmark, MapPin, Utensils } from "lucide-react";
import { venueHref, type CatalogueVenue } from "@/lib/catalogue-contracts";

export function VenueCard({
  venue,
  saved,
  onSave,
}: {
  venue: CatalogueVenue;
  saved: boolean;
  onSave: () => void;
}) {
  return (
    <article className="venue-card">
      <div className="venue-image">
        <Link href={venueHref(venue)} tabIndex={-1} aria-hidden="true">
          <Image
            src={venue.image}
            alt={venue.imageAlt}
            width={600}
            height={380}
            sizes="(max-width: 640px) 100vw, (max-width: 1100px) 45vw, 30vw"
          />
        </Link>
        <span className="photo-label">{venue.tags[0] || (venue.type === "market" ? "Food market" : venue.type === "cafe" ? "Cafe" : "Restaurant")}</span>
        <button
          className={`save-button ${saved ? "is-saved" : ""}`}
          onClick={onSave}
          aria-label={`${saved ? "Unsave" : "Save"} ${venue.name}`}
          aria-pressed={saved}
        >
          <Bookmark size={18} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="venue-body">
        <div className="venue-type">
          {venue.cuisine}
        </div>
        <h3>
          <Link href={venueHref(venue)}>
            {venue.name}
            <ArrowUpRight size={18} />
          </Link>
        </h3>
        <p className="venue-location">
          <MapPin size={13} />
          {venue.suburb}, {venue.state}
        </p>
        <div className="venue-dish">
          <span>
            <Utensils size={14} />
            {venue.dish || "Menu details to come"}
          </span>
          <ArrowUpRight size={15} />
        </div>
      </div>
    </article>
  );
}
