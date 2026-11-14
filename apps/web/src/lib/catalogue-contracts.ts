import type { Venue } from "./fixtures";

export type CatalogueMode = "demo" | "supabase";
export type CatalogueDish = {
  id: string;
  name: string;
  description: string;
  priceAudCents: number | null;
};
/** Public presentation data only. Private contacts and organisation records never leave the server. */
export type CatalogueVenue = Venue & {
  source: CatalogueMode;
  slug: string;
  state: string;
  postcode: string;
  dishes: CatalogueDish[];
  building?: { id: string; name: string; level: string; unit: string };
};
export type CatalogueState = {
  mode: CatalogueMode;
  status: "ready" | "unavailable";
  venues: CatalogueVenue[];
  hasMore: boolean;
};

export function venueHref(venue: CatalogueVenue) {
  const prefix = venue.source === "demo" ? "/explore-preview/venues" : "/venues";
  return `${prefix}/${encodeURIComponent(venue.slug)}`;
}

export function filterCatalogue(
  venues: CatalogueVenue[], query: string, category: string, state?: string,
) {
  const needle = query.trim().toLocaleLowerCase("en-AU");
  return venues.filter((venue) =>
    (!state || venue.state === state) &&
    `${venue.name} ${venue.suburb} ${venue.cuisine} ${venue.tags.join(" ")} ${venue.dishes.map((dish) => dish.name).join(" ")} ${venue.building?.name || ""}`
      .toLocaleLowerCase("en-AU").includes(needle) &&
    (category === "All discoveries" ||
      (category === "Cafes" && venue.type === "cafe") ||
      (category === "Restaurants" && venue.type === "restaurant") ||
      (category === "Food markets" && venue.type === "market") ||
      (category === "Vegetarian" && venue.tags.includes("Vegetarian"))),
  );
}
