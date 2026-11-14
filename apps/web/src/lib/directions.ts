import type { CatalogueVenue } from "./catalogue-contracts";

type DirectionsVenue = Pick<CatalogueVenue, "source" | "name" | "address" | "suburb" | "state" | "postcode">;
const states = new Set(["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"]);

function text(value: string, max: number) {
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= max && !/[\u0000-\u001f\u007f]/u.test(value) ? trimmed : null;
}

/** Public listing addresses only. Providers resolve the address; this does not verify its coordinates. */
export function venueDirections(venue: DirectionsVenue) {
  if (venue.source !== "supabase") return null;
  const name = text(venue.name, 120);
  const address = text(venue.address, 200);
  const suburb = text(venue.suburb, 100);
  const state = venue.state.trim();
  const postcode = venue.postcode.trim();
  if (!name || !address || !suburb || !states.has(state) || !/^\d{4}$/u.test(postcode)) return null;

  const destination = `${name}, ${address}, ${suburb}, ${state} ${postcode}, Australia`;
  const google = new URL("https://www.google.com/maps/dir/");
  google.searchParams.set("api", "1");
  google.searchParams.set("destination", destination);
  const apple = new URL("https://maps.apple.com/directions");
  apple.searchParams.set("destination", destination);
  return { destination, googleMaps: google.href, appleMaps: apple.href };
}

const arcadeExampleIds = new Set(["arcade-leaf-and-grain", "arcade-laneway-noodles", "arcade-cloud-patisserie"]);

/** Demo places can open a real area search, never a fictional venue address or scene coordinate. */
export function venueAreaMaps(venue: Pick<CatalogueVenue, "id" | "source" | "suburb" | "state">) {
  if (venue.source !== "demo") return null;
  const suppliedSuburb = text(venue.suburb, 100);
  const state = venue.state.trim();
  // Garden Arcade is an invented building in the Melbourne playground, not a real suburb.
  const suburb = suppliedSuburb === "Example neighbourhood" && state === "VIC" && arcadeExampleIds.has(venue.id)
    ? "Melbourne" : suppliedSuburb;
  if (!suburb || !states.has(state) || /\b(example|fictional)\b/iu.test(suburb)) return null;

  const area = `${suburb}, ${state}`;
  const query = `${area}, Australia`;
  const google = new URL("https://www.google.com/maps/search/");
  google.searchParams.set("api", "1");
  google.searchParams.set("query", query);
  const apple = new URL("https://maps.apple.com/search");
  apple.searchParams.set("query", query);
  return { area, query, googleMaps: google.href, appleMaps: apple.href };
}
