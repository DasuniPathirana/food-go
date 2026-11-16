import assert from "node:assert/strict";
import test from "node:test";
import { customerAction, partnerAction, journeySchema } from "./journey";
import { registerSchema } from "./auth/contracts";

const id = "81000000-0000-4000-8000-000000000011";
test("customer actions accept explicit save state and evidence without client XP or identity", () => {
  const saved = { action: "save", kind: "venue", id, saved: true };
  assert.ok(customerAction.safeParse(saved).success);
  for (const input of [{ ...saved, userId: id }, { ...saved, points: 1000 }, { ...saved, saved: "true" },
    { action: "redeem", code: "location-only" }, { action: "account", accountType: "admin" }])
    assert.equal(customerAction.safeParse(input).success, false);
  assert.ok(customerAction.safeParse({ action: "redeem", code: "a".repeat(32) }).success);
});
test("restaurant mutations cannot publish or change another organisation", () => {
  assert.ok(partnerAction.safeParse({ action: "issue", venueId: id }).success);
  assert.ok(!partnerAction.safeParse({ action: "publish", venueId: id }).success);
  assert.ok(!partnerAction.safeParse({ action: "issue", venueId: id, organizationId: id }).success);
  assert.ok(!partnerAction.safeParse({ action: "dish", venueId: id, dishId: id, name: "Pasta",
    description: "", price: -100, available: true }).success);
});

test("owner promotions select either deal category while legacy submissions remain valid", () => {
  const offer = { action: "promo", venueId: id, id, title: "Lunch offer", description: "An individual meal offer.",
    startsAt: "2026-11-16T00:00:00Z", endsAt: "2026-11-17T00:00:00Z" };
  for (const kind of [undefined, "food", "restaurant"]) assert.ok(partnerAction.safeParse({ ...offer, ...(kind && { kind }) }).success);
  for (const kind of ["premium", true, null]) assert.equal(partnerAction.safeParse({ ...offer, kind }).success, false);
});
test("signup selects an explorer or business interface and rejects privileged roles", () => {
  const account = { displayName: "New explorer", email: "explorer@example.test", birthDate: "1990-01-01", password: "a sufficiently long password",
    acknowledgementVersion: "food-go-community-2026-11-15", acceptedAcknowledgement: true };
  assert.ok(registerSchema.safeParse({ ...account, accountType: "partner" }).success);
  assert.ok(registerSchema.safeParse({ ...account, accountType: "explorer" }).success);
  assert.ok(!registerSchema.safeParse({ ...account, accountType: "admin" }).success);
  assert.ok(!registerSchema.safeParse({ ...account, role: "admin" }).success);
});
test("collection state validates confirmed history and progression", () => {
  const data = { accountType: "explorer", displayName: "Customer", savedVenues: [], savedDishes: [],
    visits: [], discoveries: [], progress: { xp: 150, level: 1, nextLevelXp: 250, reachCount: 0, activity: [] } };
  assert.ok(journeySchema.safeParse(data).success);
  assert.ok(!journeySchema.safeParse({ ...data, progress: { ...data.progress, xp: -100 } }).success);
  assert.ok(!journeySchema.safeParse({ ...data, savedVenues: Array(101).fill(id) }).success);
});
