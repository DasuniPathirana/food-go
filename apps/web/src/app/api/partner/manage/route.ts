import { z } from "zod";
import { authJson, readAuthRequest } from "@/lib/auth/http";
import { journeyClient, journeyFailure } from "@/lib/journey-server";

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const timestamp = z.iso.datetime({ offset: true });
const mediaUrl = z.string().trim().max(500).regex(/^(\/api\/media\/[0-9a-f-]{36}|https?:\/\/[^\s]+)$/iu);

const manageSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("read"), venueId: z.uuid() }),
  z.strictObject({ action: z.literal("submit"), venueId: z.uuid(), version: z.string().min(1) }),
  z.strictObject({
    action: z.literal("details"),
    venueId: z.uuid(),
    version: z.string().min(1),
    name: text(2, 120),
    description: z.string().max(1000),
    venueType: z.enum(["restaurant", "cafe", "market", "bakery", "food_truck"]).optional(),
    cuisine: text(2, 60),
    address: text(5, 200),
    suburb: text(2, 100),
    state: z.enum(["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"]),
    postcode: z.string().regex(/^[0-9]{4}$/),
    gameEnabled: z.boolean(),
  }),
  z.strictObject({
    action: z.literal("building"),
    venueId: z.uuid(),
    latitude: z.number().min(-38.05).max(-37.65).optional(),
    longitude: z.number().min(144.8).max(145.15).optional(),
    mallId: z.uuid().nullable().optional(),
    floor: z.string().trim().max(24).nullable().optional(),
    unit: z.string().trim().max(40).nullable().optional(),
    buildingPreset: z.enum(["isometric-cafe", "japanese-bakery", "kyoto-restaurant", "stylized-food-truck", "city-bistro", "mall-unit"]),
    accentColour: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    signage: z.string().trim().max(40).nullable().optional(),
  }),
  z.strictObject({
    action: z.literal("media"),
    venueId: z.uuid(),
    coverImageUrl: mediaUrl.nullable(),
  }),
  z.strictObject({
    action: z.literal("dish"),
    venueId: z.uuid(),
    dishId: z.uuid(),
    version: z.string().optional(),
    name: text(2, 120),
    description: z.string().max(1000).default(""),
    price: z.number().int().min(0).max(1000000),
    available: z.boolean(),
    imageUrl: mediaUrl.nullish(),
  }),
  z.strictObject({ action: z.literal("issue"), venueId: z.uuid(), dishId: z.uuid().nullable().optional() }),
  z.strictObject({
    action: z.literal("promo"),
    venueId: z.uuid(),
    id: z.uuid(),
    title: text(2, 90),
    description: text(2, 400),
    startsAt: timestamp,
    endsAt: timestamp,
    kind: z.enum(["food", "restaurant", "cafe"]).default("restaurant"),
    badgeText: text(1, 40).optional(),
    imageUrl: mediaUrl.nullish(),
  }),
  z.strictObject({
    action: z.literal("lootCreate"),
    venueId: z.uuid(),
    id: z.uuid().optional(),
    title: text(2, 90),
    description: text(2, 600),
    grabMode: z.enum(["map_grab", "ar_grab"]),
    rewardKind: z.enum(["collectible", "offer", "xp_coins"]),
    modelStyle: z.enum(["golden_crystal", "mystery_ring", "reward_crate", "dish_trophy", "star_chest"]).optional(),
    rarity: z.enum(["common", "rare", "epic", "legendary"]).optional(),
    xpReward: z.number().int().min(25).max(300).optional(),
    coinReward: z.number().int().min(0).max(200).optional(),
    promotionId: z.uuid().nullish(),
    latitude: z.number().min(-38.05).max(-37.65).optional(),
    longitude: z.number().min(144.8).max(145.15).optional(),
    radiusMetres: z.number().int().min(25).max(150).optional(),
    cooldownHours: z.number().int().min(0).max(168).optional(),
    maxClaims: z.number().int().min(1).max(5000).optional(),
    mallFloor: z.string().trim().max(24).nullish(),
    startsAt: timestamp.optional(),
    endsAt: timestamp.optional(),
  }),
  z.strictObject({
    action: z.literal("lootWithdraw"),
    venueId: z.uuid(),
    lootId: z.uuid(),
  }),
]);

export async function GET(request: Request) {
  const venueId = new URL(request.url).searchParams.get("venueId");
  if (!venueId || !z.uuid().safeParse(venueId).success) {
    return authJson({ error: "Choose a venue listing." }, 400);
  }
  try {
    const session = await journeyClient();
    if (session.response) return session.response;
    const { data, error } = await session.client
      .rpc("food_go_partner_workspace", { p_action: { action: "read", venueId } })
      .abortSignal(AbortSignal.timeout(10000));
    if (error) return journeyFailure(error.code);
    return authJson(data);
  } catch {
    return journeyFailure();
  }
}

export async function POST(request: Request) {
  const input = await readAuthRequest(request, manageSchema, 16384);
  if (!input.ok) return input.response;
  try {
    const session = await journeyClient();
    if (session.response) return session.response;
    const { data, error } = await session.client
      .rpc("food_go_partner_workspace", { p_action: input.data })
      .abortSignal(AbortSignal.timeout(10000));
    if (error) return journeyFailure(error.code);
    return authJson(data);
  } catch {
    return journeyFailure();
  }
}
