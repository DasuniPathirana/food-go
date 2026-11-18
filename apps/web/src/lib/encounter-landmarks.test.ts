import assert from "node:assert/strict";
import test from "node:test";
import { encounterLandmarkSignals, nearbyEncounterCandidates } from "./encounter-landmarks";
import type { CatalogueVenue } from "./catalogue-contracts";
import type { EncounterCampaign } from "./encounters";

const now = 1_800_000_000_000;
const id = (value: number) => `11111111-1111-4111-8111-${String(value).padStart(12, "0")}`;
const point = { longitude: 144.967146, latitude: -37.816813 }, fix = { ...point, accuracy: 8, timestamp: now };
const venue = (value: number, metres = 0): CatalogueVenue => ({ id: id(value), name: `Fixture shop ${value}`, source: "supabase", slug: `fixture-${value}`,
  suburb: "Melbourne", address: "Fixture address", cuisine: "Coffee", description: "A test listing", type: "cafe", state: "VIC", postcode: "3000",
  dishes: [], tags: [], image: "/images/venue-placeholder.svg", imageAlt: "Test", accent: "generic", dish: "",
  coordinates: { longitude: point.longitude, latitude: point.latitude + metres / 111320 } });
const campaign = (value: number): EncounterCampaign => ({ id: id(100 + value), venue: { id: id(value), name: `Fixture shop ${value}`, slug: `fixture-${value}`, coordinates: point },
  title: "Fixture pool", description: "A test pool", theme: "cafe", state: "published", version: new Date(now).toISOString(), startsAt: new Date(now - 1000).toISOString(),
  endsAt: new Date(now + 60000).toISOString(), radiusMetres: 30, cooldownHours: 24, maxClaims: 10, claimedCount: 0, offerValidityHours: 24,
  pool: [{ id: id(200 + value), kind: "collectible", name: "Test badge", description: "A test collectible", rarity: "common", weight: 1, promotionId: null }] });

test("nearby hints require a fresh accurate device fix and ignore fictional or unpositioned venues", () => {
  const published = venue(1);
  for (const input of [null, { ...fix, accuracy: 36 }, { ...fix, timestamp: now - 15001 }, { ...fix, timestamp: now + 3001 }])
    assert.deepEqual(nearbyEncounterCandidates([published], input, now), []);
  assert.deepEqual(nearbyEncounterCandidates([{ ...published, source: "demo" }, { ...venue(2), coordinates: undefined }], fix, now), []);
  assert.equal(nearbyEncounterCandidates([published], fix, now).length, 1);
});
test("candidate work and request IDs are bounded while co-located shops retain separate identities", () => {
  const sameBuilding = [venue(3), venue(1), venue(2), venue(4)];
  assert.deepEqual(nearbyEncounterCandidates(sameBuilding, fix, now).map(item => item.venueId), [id(1), id(2), id(3)]);
  assert.equal(nearbyEncounterCandidates([venue(1, 400)], fix, now).length, 0);
  assert.equal(nearbyEncounterCandidates([{ ...venue(1), id: "-".repeat(36) }], fix, now).length, 0);
  assert.equal(nearbyEncounterCandidates([...Array.from({ length: 200 }, (_, i) => venue(i + 1, 500)), venue(300)], fix, now).length, 0);
});
test("only unexpired matching approved pools can light a venue marker", () => {
  const record = { venueId: id(1), loadedAt: now, expiresAt: now + 60000, campaigns: [campaign(1)] };
  assert.deepEqual(encounterLandmarkSignals([record], fix, now).signals, { [id(1)]: "nearby" });
  for (const entry of [{ ...record, expiresAt: now }, { ...record, campaigns: [campaign(2)] },
    { ...record, campaigns: [{ ...campaign(1), state: "pending" as const }] }, { ...record, campaigns: [{ ...campaign(1), claimedCount: 10 }] }])
    assert.deepEqual(encounterLandmarkSignals([entry], fix, now).signals, {});
  assert.deepEqual(encounterLandmarkSignals([record], { ...fix, timestamp: now - 15001 }, now).nearby, []);
});
test("uncertainty is conservative and one mall shop cannot signal a different shop's reward", () => {
  const other = { ...fix, latitude: fix.latitude + 25 / 111320 };
  const records = [{ venueId: id(1), loadedAt: now, expiresAt: now + 60000, campaigns: [campaign(1)] }];
  const outside = encounterLandmarkSignals(records, other, now);
  assert.deepEqual(outside.signals, { [id(1)]: "available" }); assert.equal(outside.nearby.length, 0);
  assert.equal(outside.signals[id(2)], undefined);
  const inside = encounterLandmarkSignals(records, { ...other, accuracy: 1 }, now);
  assert.deepEqual(inside.nearby, [{ venueId: id(1), name: "Fixture shop 1" }]);
});
