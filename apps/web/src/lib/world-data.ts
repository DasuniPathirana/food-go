import { z } from "zod";

export const buildingPresetSchema = z.enum([
  "isometric-cafe",
  "japanese-bakery",
  "kyoto-restaurant",
  "stylized-food-truck",
  "city-bistro",
  "mall-unit",
]);
export type BuildingPreset = z.infer<typeof buildingPresetSchema>;

export const BUILDING_PRESET_LABELS: Record<BuildingPreset, { label: string; worldAsset?: string; summary: string }> = {
  "isometric-cafe": {
    label: "Isometric Corner Cafe",
    worldAsset: "isometricCafe",
    summary: "Two-storey espresso terrace with outdoor awning and patio tables",
  },
  "japanese-bakery": {
    label: "Artisan Bakery House",
    worldAsset: "japaneseBakery",
    summary: "Warm brick bakehouse with window display and striped awning",
  },
  "kyoto-restaurant": {
    label: "Signature Restaurant Pavilion",
    worldAsset: "kyotoRestaurant",
    summary: "Full-service timber and lantern dining building",
  },
  "stylized-food-truck": {
    label: "Street Food Truck",
    worldAsset: "stylizedFoodTruck",
    summary: "Mobile serving window for pop-ups and market pitches",
  },
  "city-bistro": {
    label: "CBD Laneway Bistro",
    worldAsset: "kyotoRestaurant",
    summary: "Crisp metropolitan dining facade fitted to street blocks",
  },
  "mall-unit": {
    label: "Inside Shopping Mall",
    summary: "Hosted inside an approved multi-floor shopping centre",
  },
};

export const mallFloorSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  description: z.string().default(""),
});

export const mallShopSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  venueType: z.string(),
  cuisine: z.string(),
  floor: z.string(),
  unit: z.string(),
  buildingPreset: z.string(),
  coverImageUrl: z.string().nullable().optional(),
  reservationsEnabled: z.boolean().optional(),
});

export const mallDirectorySchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  address: z.string(),
  suburb: z.string(),
  state: z.string(),
  postcode: z.string(),
  coordinates: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }),
  entranceDescription: z.string(),
  modelPreset: z.string(),
  floors: z.array(mallFloorSchema),
  shopCount: z.number().int().nonnegative(),
  shops: z.array(mallShopSchema),
});
export type LiveMall = z.infer<typeof mallDirectorySchema>;

export const worldLootSchema = z.object({
  id: z.uuid(),
  source: z.enum(["restaurant", "game_admin"]),
  venueId: z.uuid().nullable(),
  venueName: z.string().nullable(),
  venueSlug: z.string().nullable(),
  mallId: z.uuid().nullable(),
  mallFloor: z.string().nullable(),
  title: z.string(),
  description: z.string(),
  grabMode: z.enum(["map_grab", "ar_grab"]),
  rewardKind: z.enum(["collectible", "offer", "xp_coins"]),
  modelStyle: z.enum(["golden_crystal", "mystery_ring", "reward_crate", "dish_trophy", "star_chest"]),
  rarity: z.enum(["common", "rare", "epic", "legendary"]),
  visibilityMode: z.enum(["always_visible", "proximity_reveal", "scheduled_drop"]),
  xpReward: z.number().int(),
  coinReward: z.number().int(),
  promotionId: z.uuid().nullable(),
  coordinates: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }),
  radiusMetres: z.number().int(),
  cooldownHours: z.number().int(),
  remainingClaims: z.number().int(),
  endsAt: z.iso.datetime({ offset: true }),
  lastClaimedAt: z.iso.datetime({ offset: true }).nullable(),
  nextAvailableAt: z.iso.datetime({ offset: true }).nullable(),
  claimedOnce: z.boolean(),
  eligibleNow: z.boolean(),
});
export type WorldLoot = z.infer<typeof worldLootSchema>;

export const worldLootClaimSchema = z.object({
  id: z.uuid(),
  lootId: z.uuid(),
  title: z.string(),
  source: z.enum(["restaurant", "game_admin"]),
  grabMode: z.enum(["map_grab", "ar_grab"]),
  rewardKind: z.enum(["collectible", "offer", "xp_coins"]),
  rarity: z.enum(["common", "rare", "epic", "legendary"]),
  xpAwarded: z.number().int(),
  coinsAwarded: z.number().int(),
  claimCode: z.string().nullable(),
  venueName: z.string().nullable(),
  claimedAt: z.iso.datetime({ offset: true }),
});
export type WorldLootClaim = z.infer<typeof worldLootClaimSchema>;

export const venueAppearanceSchema = z.object({
  id: z.uuid(),
  coverImageUrl: z.string().nullable(),
  buildingPreset: buildingPresetSchema,
  buildingAccentColour: z.string(),
  buildingSignage: z.string().nullable(),
  mallId: z.uuid().nullable(),
  mallFloor: z.string().nullable(),
  mallUnit: z.string().nullable(),
  reservationsEnabled: z.boolean(),
  reservationNotes: z.string().nullable(),
});
export type VenueAppearance = z.infer<typeof venueAppearanceSchema>;

export const reservationSchema = z.object({
  id: z.uuid(),
  venueId: z.uuid().optional(),
  venueName: z.string().optional(),
  venueSlug: z.string().optional(),
  suburb: z.string().optional(),
  reservedFor: z.iso.datetime({ offset: true }),
  partySize: z.number().int().min(1).max(20),
  guestName: z.string(),
  guestContact: z.string().nullable().optional(),
  notes: z.string().nullable(),
  status: z.enum(["pending", "approved", "declined", "cancelled", "completed"]),
  decisionNote: z.string().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
});
export type ReservationRecord = z.infer<typeof reservationSchema>;
