import { z } from "zod";

export const BUILDING_PALETTES = [
  "heritage-brick",
  "modern-glass",
  "warm-timber",
  "petrol-slate",
  "golden-sandstone",
  "terracotta-clay",
] as const;
export type BuildingPalette = typeof BUILDING_PALETTES[number];

export const BUILDING_ROOF_STYLES = [
  "terrace-garden",
  "solar-canopy",
  "lantern-pavilion",
  "skylight-atrium",
  "classic-mansard",
] as const;
export type BuildingRoofStyle = typeof BUILDING_ROOF_STYLES[number];

export const BUILDING_LIGHTING_STYLES = [
  "warm-amber",
  "cool-white",
  "neon-gold",
  "subtle-lantern",
] as const;
export type BuildingLightingStyle = typeof BUILDING_LIGHTING_STYLES[number];

export const REVIEW_STATUSES = [
  "draft",
  "pending_review",
  "approved",
  "rejected",
  "changes_requested",
] as const;
export type ReviewStatus = typeof REVIEW_STATUSES[number];

export const buildingCustomizationSchema = z.strictObject({
  id: z.string().uuid(),
  venueId: z.string().uuid(),
  buildingId: z.string().min(1).max(64),
  palette: z.enum(BUILDING_PALETTES),
  roofStyle: z.enum(BUILDING_ROOF_STYLES),
  lightingStyle: z.enum(BUILDING_LIGHTING_STYLES),
  signage: z.strictObject({
    text: z.string().trim().min(2).max(40),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-character hex color code."),
    illuminated: z.boolean().default(true),
  }),
  location: z.strictObject({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    floorLevel: z.string().trim().min(1).max(30),
    unitIdentifier: z.string().trim().min(1).max(30),
  }),
  status: z.enum(REVIEW_STATUSES).default("pending_review"),
  reviewerNotes: z.string().max(500).optional(),
  submittedAt: z.string().datetime(),
  reviewedAt: z.string().datetime().optional(),
});
export type BuildingCustomization = z.infer<typeof buildingCustomizationSchema>;

export const lootLocationProposalSchema = z.strictObject({
  id: z.string().uuid(),
  venueId: z.string().uuid(),
  title: z.string().trim().min(2).max(80),
  description: z.string().trim().min(5).max(300),
  coordinates: z.strictObject({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  claimRadiusMetres: z.number().min(5).max(50).default(25),
  cooldownHours: z.number().int().min(1).max(168).default(24),
  dailyClaimLimit: z.number().int().min(1).max(50).default(10),
  rarity: z.enum(["common", "uncommon", "rare", "epic"]).default("common"),
  status: z.enum(REVIEW_STATUSES).default("pending_review"),
  reviewerNotes: z.string().max(500).optional(),
  submittedAt: z.string().datetime(),
  reviewedAt: z.string().datetime().optional(),
});
export type LootLocationProposal = z.infer<typeof lootLocationProposalSchema>;

export const restaurantQuestProposalSchema = z.strictObject({
  id: z.string().uuid(),
  venueId: z.string().uuid(),
  title: z.string().trim().min(2).max(100),
  description: z.string().trim().min(10).max(500),
  category: z.enum(["visit", "try_dish", "feedback", "social_story", "promotion"]),
  rewardXp: z.number().int().min(25).max(500),
  dishId: z.string().uuid().optional(),
  status: z.enum(REVIEW_STATUSES).default("pending_review"),
  reviewerNotes: z.string().max(500).optional(),
  submittedAt: z.string().datetime(),
  reviewedAt: z.string().datetime().optional(),
});
export type RestaurantQuestProposal = z.infer<typeof restaurantQuestProposalSchema>;

/**
 * Validates that the proposed building position does not arbitrarily deviate from
 * the verified venue coordinates (maximum allowed tolerance is 60 metres, e.g. for entrance adjustment).
 */
export function validateBuildingPlacementTolerance(
  venueCoordinates: { longitude: number; latitude: number },
  proposedCoordinates: { longitude: number; latitude: number },
  maxDeviationMetres = 60
): { valid: boolean; distanceMetres: number } {
  const R = 6371000;
  const dLat = (proposedCoordinates.latitude - venueCoordinates.latitude) * Math.PI / 180;
  const dLon = (proposedCoordinates.longitude - venueCoordinates.longitude) * Math.PI / 180;
  const lat1 = venueCoordinates.latitude * Math.PI / 180;
  const lat2 = proposedCoordinates.latitude * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const distanceMetres = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return {
    valid: distanceMetres <= maxDeviationMetres,
    distanceMetres: Math.round(distanceMetres * 10) / 10,
  };
}
