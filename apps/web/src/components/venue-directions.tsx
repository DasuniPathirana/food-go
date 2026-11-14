import { ArrowUpRight, Navigation } from "lucide-react";
import type { CatalogueVenue } from "@/lib/catalogue-contracts";
import { venueAreaMaps, venueDirections } from "@/lib/directions";

export function VenueDirections({ venue }: { venue: CatalogueVenue }) {
  const links = venueDirections(venue);
  if (!links) {
    const area = venueAreaMaps(venue);
    if (!area) return <p className="directions-note">{venue.source === "demo"
      ? "This example place has no real location. Choose a published venue for directions."
      : "Directions will be available when the venue supplies a complete address."}</p>;

    return <div className="venue-directions">
      <p className="directions-note">{venue.name} is fictional. Open the real {area.area} area instead.</p>
      <div className="directions-actions" aria-label={`Open ${area.area} in another map`}>
        <a className="primary-button" href={area.googleMaps} target="_blank" rel="noopener noreferrer"><Navigation size={16} />Open area in Google Maps<ArrowUpRight size={15} /></a>
        <a className="secondary-button" href={area.appleMaps} target="_blank" rel="noopener noreferrer">Open area in Apple Maps<ArrowUpRight size={15} /></a>
      </div>
    </div>;
  }

  return <div className="venue-directions">
    <div className="directions-actions" aria-label={`Get directions to ${venue.name}`}>
      <a className="primary-button" href={links.googleMaps} target="_blank" rel="noopener noreferrer"><Navigation size={16} />Google Maps<ArrowUpRight size={15} /></a>
      <a className="secondary-button" href={links.appleMaps} target="_blank" rel="noopener noreferrer">Apple Maps<ArrowUpRight size={15} /></a>
    </div>
    <p className="directions-note">Opens your chosen map in a new tab or app. Check the destination before setting off.</p>
  </div>;
}
