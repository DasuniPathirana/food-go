import type { CatalogueVenue } from "./catalogue-contracts";

export type IllustratedMapStop = {
  id: string;
  name: string;
  position: { x: number; y: number };
  venues: CatalogueVenue[];
  isBuilding: boolean;
};

const individualPositions: Readonly<Record<string, { x: number; y: number }>> = {
  "finch-and-field": { x: 67, y: 34 },
  "ciao-carlton": { x: 34, y: 21 },
  "small-hours": { x: 21, y: 60 },
};
const arcadeShopIds = new Set([
  "arcade-leaf-and-grain", "arcade-laneway-noodles", "arcade-cloud-patisserie",
]);

/** Explicit preview geography only. Connected records and unknown fixtures have no illustrated position. */
export function illustratedMapStops(venues: readonly CatalogueVenue[]): IllustratedMapStop[] {
  const stops: IllustratedMapStop[] = [];
  const seen = new Set<string>();
  let arcade: IllustratedMapStop | undefined;
  for (const venue of venues) {
    if (venue.source !== "demo" || seen.has(venue.id)) continue;
    if (venue.building) {
      if (venue.building.id !== "garden-arcade" || !arcadeShopIds.has(venue.id)) continue;
      if (!arcade) {
        arcade = { id: "garden-arcade", name: "Garden Arcade", position: { x: 77, y: 72 }, venues: [], isBuilding: true };
        stops.push(arcade);
      }
      arcade.venues.push(venue);
    } else {
      if (!Object.hasOwn(individualPositions, venue.id)) continue;
      const position = individualPositions[venue.id]!;
      stops.push({ id: venue.id, name: venue.name, position: { ...position }, venues: [venue], isBuilding: false });
    }
    seen.add(venue.id);
  }
  return stops;
}
