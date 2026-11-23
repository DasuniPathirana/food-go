import test from "node:test";
import assert from "node:assert/strict";
import {
  buildingCustomizationSchema,
  lootLocationProposalSchema,
  restaurantQuestProposalSchema,
  validateBuildingPlacementTolerance,
} from "./restaurant-building";

test("buildingCustomizationSchema validates valid customization requests", () => {
  const validRequest = {
    id: "a0000000-0000-4000-8000-000000000001",
    venueId: "b0000000-0000-4000-8000-000000000002",
    buildingId: "melbourne-bld-104",
    palette: "heritage-brick" as const,
    roofStyle: "terrace-garden" as const,
    lightingStyle: "warm-amber" as const,
    signage: {
      text: "The Rustic Hearth",
      color: "#d97736",
      illuminated: true,
    },
    location: {
      latitude: -37.8105,
      longitude: 144.9628,
      floorLevel: "Ground Floor",
      unitIdentifier: "Shop 4A",
    },
    status: "pending_review" as const,
    submittedAt: "2026-11-23T10:00:00.000Z",
  };

  const parsed = buildingCustomizationSchema.parse(validRequest);
  assert.equal(parsed.palette, "heritage-brick");
  assert.equal(parsed.status, "pending_review");
});

test("buildingCustomizationSchema rejects invalid color format and out-of-range coordinates", () => {
  assert.throws(() => {
    buildingCustomizationSchema.parse({
      id: "a0000000-0000-4000-8000-000000000001",
      venueId: "b0000000-0000-4000-8000-000000000002",
      buildingId: "melbourne-bld-104",
      palette: "heritage-brick",
      roofStyle: "terrace-garden",
      lightingStyle: "warm-amber",
      signage: { text: "Invalid", color: "red", illuminated: true },
      location: { latitude: -37.81, longitude: 144.96, floorLevel: "1", unitIdentifier: "A" },
      status: "pending_review",
      submittedAt: "2026-11-23T10:00:00.000Z",
    });
  });
});

test("validateBuildingPlacementTolerance prevents arbitrary relocation beyond 60m", () => {
  const venue = { longitude: 144.9628, latitude: -37.8105 };
  
  // 15 metres away (e.g. entrance adjustment) -> valid
  const close = { longitude: 144.9629, latitude: -37.8106 };
  const closeResult = validateBuildingPlacementTolerance(venue, close);
  assert.equal(closeResult.valid, true);
  assert.ok(closeResult.distanceMetres < 60);

  // 350 metres away -> rejected
  const far = { longitude: 144.9665, latitude: -37.8130 };
  const farResult = validateBuildingPlacementTolerance(venue, far);
  assert.equal(farResult.valid, false);
  assert.ok(farResult.distanceMetres > 60);
});

test("lootLocationProposalSchema validates proposed rewards within constraints", () => {
  const proposal = {
    id: "c0000000-0000-4000-8000-000000000003",
    venueId: "b0000000-0000-4000-8000-000000000002",
    title: "Artisanal Coffee Token",
    description: "Discover a secret token hidden near the courtyard entrance.",
    coordinates: { longitude: 144.9630, latitude: -37.8107 },
    claimRadiusMetres: 20,
    cooldownHours: 24,
    dailyClaimLimit: 15,
    rarity: "uncommon" as const,
    status: "pending_review" as const,
    submittedAt: "2026-11-23T10:00:00.000Z",
  };

  const parsed = lootLocationProposalSchema.parse(proposal);
  assert.equal(parsed.claimRadiusMetres, 20);
  assert.equal(parsed.rarity, "uncommon");
});

test("restaurantQuestProposalSchema enforces quest bounds and valid categories", () => {
  const quest = {
    id: "d0000000-0000-4000-8000-000000000004",
    venueId: "b0000000-0000-4000-8000-000000000002",
    title: "Taste the Melbourne Magic",
    description: "Try our signature slow-drip cold brew and share a food thought.",
    category: "try_dish" as const,
    rewardXp: 150,
    status: "pending_review" as const,
    submittedAt: "2026-11-23T10:00:00.000Z",
  };

  const parsed = restaurantQuestProposalSchema.parse(quest);
  assert.equal(parsed.rewardXp, 150);
  assert.equal(parsed.category, "try_dish");
});
