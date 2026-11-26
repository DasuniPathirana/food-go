import { z } from "zod";
import { readAuthConfig } from "./auth/config";

export const sections = [
  "analytics",
  "venues",
  "buildings",
  "malls",
  "loots",
  "promotions",
  "quests",
  "posts",
  "comments",
  "reports",
  "audit",
] as const;

export const sectionSchema = z.enum(sections);
export type OperatorSection = z.infer<typeof sectionSchema>;

const reason = z.string().trim().min(3).max(240);
const version = z.iso.datetime({ offset: true });
const shortText = (minimum: number, maximum: number) => z.string().trim().min(minimum).max(maximum);
const timestamp = z.iso.datetime({ offset: true });
const promoKind = z.enum(["food", "restaurant", "cafe"]);
const mediaUrl = z.string().trim().max(500).regex(/^(\/api\/media\/[0-9a-f-]{36}|https?:\/\/[^\s]+)$/iu);

const decisionBase = { id: z.uuid(), requestId: z.uuid(), reason, version };

export const operatorActionSchema = z
  .discriminatedUnion("action", [
    z.strictObject({ ...decisionBase, action: z.literal("venue.verify") }),
    z.strictObject({ ...decisionBase, action: z.literal("venue.revoke") }),
    z.strictObject({ ...decisionBase, action: z.literal("venue.publish") }),
    z.strictObject({ ...decisionBase, action: z.literal("venue.suspend") }),
    z.strictObject({
      ...decisionBase,
      action: z.literal("venue.locate"),
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    }),
    z.strictObject({ id: z.uuid(), requestId: z.uuid(), reason, version: z.string().min(1).max(120).optional(), action: z.literal("building.approve") }),
    z.strictObject({ id: z.uuid(), requestId: z.uuid(), reason, version: z.string().min(1).max(120).optional(), action: z.literal("building.reject") }),
    z.strictObject({
      id: z.uuid(),
      requestId: z.uuid(),
      reason,
      version: z.string().min(1).max(120).optional(),
      action: z.literal("mall.upsert"),
      name: shortText(2, 120),
      address: shortText(5, 200),
      suburb: shortText(2, 100).optional(),
      postcode: z.string().regex(/^[0-9]{4}$/).optional(),
      latitude: z.number().min(-38.05).max(-37.65),
      longitude: z.number().min(144.8).max(145.15),
      entranceDescription: shortText(2, 180).optional(),
      modelPreset: z.enum(["city-mall", "arcade-heritage", "urban-precinct", "skyline-complex"]).optional(),
    }),
    z.strictObject({ id: z.uuid(), requestId: z.uuid(), reason, version: z.string().min(1).max(120).optional(), action: z.literal("mall.publish") }),
    z.strictObject({ id: z.uuid(), requestId: z.uuid(), reason, version: z.string().min(1).max(120).optional(), action: z.literal("mall.suspend") }),
    z.strictObject({
      id: z.uuid(),
      requestId: z.uuid(),
      reason,
      version: z.string().min(1).max(120).optional(),
      action: z.literal("reward.upsert"),
      title: shortText(2, 90),
      description: shortText(2, 600),
      grabMode: z.enum(["map_grab", "ar_grab"]).optional(),
      rewardKind: z.enum(["collectible", "offer", "xp_coins"]).optional(),
      modelStyle: z.enum(["golden_crystal", "mystery_ring", "reward_crate", "dish_trophy", "star_chest"]).optional(),
      rarity: z.enum(["common", "rare", "epic", "legendary"]).optional(),
      visibilityMode: z.enum(["always_visible", "proximity_reveal", "scheduled_drop"]).optional(),
      xpReward: z.number().int().min(10).max(1000),
      coinReward: z.number().int().min(0).max(1000),
      latitude: z.number().min(-38.05).max(-37.65),
      longitude: z.number().min(144.8).max(145.15),
      radiusMetres: z.number().int().min(20).max(250).optional(),
      cooldownHours: z.number().int().min(0).max(720).optional(),
      maxClaims: z.number().int().min(1).max(100000).optional(),
      startsAt: timestamp.optional(),
      endsAt: timestamp.optional(),
    }),
    z.strictObject({ id: z.uuid(), requestId: z.uuid(), reason, version: z.string().min(1).max(120).optional(), action: z.literal("loot.approve") }),
    z.strictObject({ id: z.uuid(), requestId: z.uuid(), reason, version: z.string().min(1).max(120).optional(), action: z.literal("loot.reject") }),
    z.strictObject({ id: z.uuid(), requestId: z.uuid(), reason, version: z.string().min(1).max(120).optional(), action: z.literal("loot.withdraw") }),
    z.strictObject({
      id: z.uuid(),
      requestId: z.uuid(),
      reason,
      action: z.literal("promo.create"),
      venueId: z.uuid(),
      title: shortText(2, 90),
      description: shortText(2, 400),
      startsAt: timestamp,
      endsAt: timestamp,
      kind: promoKind.optional(),
      badgeText: shortText(1, 40).optional(),
      imageUrl: mediaUrl.optional(),
    }),
    z.strictObject({
      ...decisionBase,
      action: z.literal("promo.edit"),
      venueId: z.uuid(),
      title: shortText(2, 90),
      description: shortText(2, 400),
      startsAt: timestamp,
      endsAt: timestamp,
      kind: promoKind.optional(),
      badgeText: shortText(1, 40).optional(),
      imageUrl: mediaUrl.optional(),
    }),
    z.strictObject({ ...decisionBase, action: z.literal("promo.publish") }),
    z.strictObject({ ...decisionBase, action: z.literal("promo.withdraw") }),
    z.strictObject({ id: z.uuid(), requestId: z.uuid(), reason, version: z.enum(["pending", "published"]), action: z.literal("post.publish") }),
    z.strictObject({ id: z.uuid(), requestId: z.uuid(), reason, version: z.enum(["pending", "published"]), action: z.literal("post.remove") }),
    z.strictObject({ id: z.uuid(), requestId: z.uuid(), reason, version: z.enum(["pending", "published"]), action: z.literal("comment.publish") }),
    z.strictObject({ id: z.uuid(), requestId: z.uuid(), reason, version: z.enum(["pending", "published"]), action: z.literal("comment.remove") }),
    z.strictObject({ id: z.uuid(), requestId: z.uuid(), reason, version: z.string().regex(/^[a-f0-9]{32}$/), action: z.literal("report.dismiss") }),
    z.strictObject({ id: z.uuid(), requestId: z.uuid(), reason, version: z.string().regex(/^[a-f0-9]{32}$/), action: z.literal("report.remove") }),
  ])
  .refine(
    v => !("startsAt" in v && "endsAt" in v && v.startsAt && v.endsAt) || Date.parse(v.endsAt) > Date.parse(v.startsAt),
    "End date must be after start date."
  );

export type OperatorAction = z.infer<typeof operatorActionSchema>;

export const queueRowSchema = z.object({
  id: z.uuid(),
  name: z.string().max(180),
  detail: z.string().max(1200).optional(),
  state: z.string().max(80),
  version: z.string().max(120).optional(),
  verified: z.boolean().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  organisation: z.string().max(160).nullable().optional(),
  contactEmail: z.string().max(260).nullable().optional(),
  contactPhone: z.string().max(60).nullable().optional(),
  venueId: z.uuid().nullable().optional(),
  venueName: z.string().max(160).nullable().optional(),
  kind: z.string().max(40).nullable().optional(),
  badgeText: z.string().max(60).nullable().optional(),
  source: z.string().max(40).nullable().optional(),
  grabMode: z.string().max(40).nullable().optional(),
  rewardKind: z.string().max(40).nullable().optional(),
  modelStyle: z.string().max(60).nullable().optional(),
  rarity: z.string().max(40).nullable().optional(),
  visibilityMode: z.string().max(40).nullable().optional(),
  xpReward: z.number().int().nullable().optional(),
  coinReward: z.number().int().nullable().optional(),
  radiusMetres: z.number().int().nullable().optional(),
  claimedCount: z.number().int().nullable().optional(),
  maxClaims: z.number().int().nullable().optional(),
  proposedLatitude: z.number().nullable().optional(),
  proposedLongitude: z.number().nullable().optional(),
  proposedPreset: z.string().max(60).nullable().optional(),
  proposedAccent: z.string().max(20).nullable().optional(),
  proposedSignage: z.string().max(60).nullable().optional(),
  proposedMallId: z.uuid().nullable().optional(),
  proposedFloor: z.string().max(30).nullable().optional(),
  proposedUnit: z.string().max(50).nullable().optional(),
  buildingPreset: z.string().max(60).nullable().optional(),
  mallId: z.uuid().nullable().optional(),
  mallFloor: z.string().max(30).nullable().optional(),
  mallUnit: z.string().max(50).nullable().optional(),
  modelPreset: z.string().max(60).nullable().optional(),
  startsAt: z.iso.datetime({ offset: true }).optional(),
  endsAt: z.iso.datetime({ offset: true }).optional(),
  context: z.string().max(300).optional(),
  actor: z.string().max(80).nullable().optional(),
  at: z.iso.datetime({ offset: true }).optional(),
});
export type OperatorRow = z.infer<typeof queueRowSchema>;

export const queueSchema = z.object({
  items: z.array(queueRowSchema).max(200),
  hasMore: z.boolean(),
});

export function readOperatorConfig(env: Record<string, string | undefined>) {
  return readAuthConfig(env);
}

export function operatorError(code: string) {
  if (code === "42501") return { status: 403, error: "Verified operator authenticator access required." };
  if (code === "FG404") return { status: 404, error: "Record is no longer available." };
  if (code === "FG409") return { status: 409, error: "Record changed before this review was saved. Refresh and check again." };
  if (["22023", "22P02", "23514", "23505"].includes(code)) return { status: 400, error: "Review details were invalid." };
  return { status: 503, error: "Operator service is temporarily unavailable." };
}
