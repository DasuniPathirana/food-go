import type { CatalogueVenue } from "./catalogue-contracts";
import type { ExplorerLocationFix } from "./explorer-location-motion";
import { encounterProximity, type EncounterCampaign } from "./encounters";

export type EncounterSignal = "available" | "nearby";
export type EncounterLandmarkRecord = { venueId: string; loadedAt: number; expiresAt: number; campaigns: readonly EncounterCampaign[] };

/** Candidate IDs only. Nothing here can establish arrival or reward eligibility. */
export function nearbyEncounterCandidates(venues: readonly CatalogueVenue[], fix: ExplorerLocationFix | null, now: number) {
  if (!fix || !encounterProximity(fix, fix, 350, now)) return [];
  return venues.slice(0, 200).flatMap(venue => {
    if (venue.source !== "supabase" || !venue.coordinates || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu.test(venue.id)) return [];
    const proximity = encounterProximity(fix, venue.coordinates, 350, now);
    return proximity && proximity.distance <= 350 ? [{ venueId: venue.id, name: venue.name, distance: proximity.distance }] : [];
  }).sort((a, b) => a.distance - b.distance || a.venueId.localeCompare(b.venueId)).slice(0, 3);
}
export function encounterLandmarkSignals(records: readonly EncounterLandmarkRecord[], fix: ExplorerLocationFix | null, now: number) {
  const signals: Record<string, EncounterSignal> = {}, nearby: { venueId: string; name: string }[] = [];
  if (!fix || !encounterProximity(fix, fix, 350, now)) return { signals, nearby };
  for (const record of records.slice(0, 50)) {
    if (!Number.isFinite(record.expiresAt) || now >= record.expiresAt) continue;
    const active = record.campaigns.filter(campaign => campaign.venue.id === record.venueId && campaign.state === "published" && campaign.claimedCount < campaign.maxClaims);
    if (!active.length) continue;
    signals[record.venueId] = active.some(campaign => encounterProximity(fix, campaign.venue.coordinates, campaign.radiusMetres, now)?.nearby) ? "nearby" : "available";
    if (signals[record.venueId] === "nearby") nearby.push({ venueId: record.venueId, name: active[0].venue.name });
  }
  return { signals, nearby: nearby.slice(0, 3) };
}
