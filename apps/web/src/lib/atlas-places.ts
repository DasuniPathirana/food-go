import { venueHref, type CatalogueVenue } from "./catalogue-contracts";

export type AtlasDestination = {
  id: string;
  name: string;
  area: string;
  longitude: number;
  latitude: number;
  href?: string;
  image?: string;
  kind?: CatalogueVenue["type"] | "building";
  shopCount?: number;
  buildingId?: string;
  buildingName?: string;
};
type Position = Pick<AtlasDestination, "longitude" | "latitude">;

export function geographicPoint(point: Position | undefined): point is Position {
  return !!point && Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180
    && Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 90;
}

export function atlasStops(landmarks: readonly AtlasDestination[], venues: readonly CatalogueVenue[]) {
  const groups = new Map<string, AtlasDestination[]>();
  const destinations: AtlasDestination[] = [...landmarks];
  for (const venue of venues) {
    if (venue.source !== "supabase" || !geographicPoint(venue.coordinates)) continue;
    destinations.push({
      ...venue.coordinates, id: venue.id, name: venue.name, href: venueHref(venue),
      image: venue.image, kind: venue.type, shopCount: 1,
      ...(venue.building && { buildingId: venue.building.id, buildingName: venue.building.name }),
      area: venue.building ? [venue.building.name, venue.building.level, venue.building.unit].filter(Boolean).join(" · ") : venue.suburb,
    });
  }
  for (const destination of destinations) {
    const key = destination.buildingId ? `building:${destination.buildingId}` : `coordinate:${destination.latitude},${destination.longitude}`;
    const members = groups.get(key);
    if (members) members.push(destination);
    else groups.set(key, [destination]);
  }
  return Array.from(groups.values(), (members) => {
    const shopCount = members.reduce((total, member) => total + (member.shopCount || 0), 0);
    return {
      ...members[0], name: members.length === 1 ? members[0].name : members[0].buildingName || `${members.length} places here`, members,
      ...(shopCount ? { shopCount } : {}),
      ...(shopCount > 1 ? { kind: "building" as const, image: undefined } : {}),
    };
  });
}

export function pointDirections(point: Position) {
  if (!geographicPoint(point)) return null;
  const coordinate = `${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}`;
  return {
    coordinate,
    google: `https://www.google.com/maps/dir/?${new URLSearchParams({ api: "1", destination: coordinate })}`,
    apple: `https://maps.apple.com/directions?${new URLSearchParams({ destination: coordinate })}`,
  };
}
