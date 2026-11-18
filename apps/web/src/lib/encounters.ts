import { z } from "zod";
import { EXPLORATION_MAX_LATITUDE } from "@food-go/domain/exploration";
import type { ExplorerLocationFix } from "./explorer-location-motion";
import { mapDistance } from "./map-game";

const uuid = z.uuid();
const time = z.iso.datetime({ offset: true }).max(40);
const text = (minimum: number, maximum: number) => z.string().trim().min(minimum).max(maximum)
  .refine(value => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value), "Use readable text.");
export const encounterRaritySchema = z.enum(["common", "rare", "epic", "legendary"]);
export type EncounterRarity = z.infer<typeof encounterRaritySchema>;
export const encounterThemeSchema = z.enum(["cafe", "restaurant", "market"]);
export const encounterVenueSchema = z.strictObject({ id: uuid, name: text(1, 120), slug: z.string().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  coordinates: z.strictObject({ longitude: z.number().min(-180).max(180), latitude: z.number().min(-EXPLORATION_MAX_LATITUDE).max(EXPLORATION_MAX_LATITUDE) }) });
const boundedArray = <T extends z.ZodType>(item: T, maximum: number, minimum = 0) => z.custom<unknown[]>(value => Array.isArray(value) && value.length >= minimum && value.length <= maximum)
  .pipe(z.array(item).min(minimum).max(maximum));
export const encounterPoolItemSchema = z.strictObject({ id: uuid, kind: z.enum(["collectible", "offer"]), name: text(1, 120), description: text(1, 600),
  rarity: encounterRaritySchema, weight: z.int().min(1).max(1000), promotionId: uuid.nullable() })
  .refine(value => (value.kind === "offer") === (value.promotionId !== null), "Offer entries require their approved promotion.");
export const encounterCampaignSchema = z.strictObject({ id: uuid, venue: encounterVenueSchema, title: text(1, 90), description: text(1, 600),
  theme: encounterThemeSchema, state: z.enum(["draft", "pending", "published", "rejected", "withdrawn"]), version: time, startsAt: time, endsAt: time,
  radiusMetres: z.int().min(30).max(150), cooldownHours: z.int().min(24).max(168), maxClaims: z.int().min(1).max(10000), claimedCount: z.int().min(0).max(10000),
  offerValidityHours: z.int().min(1).max(168), pool: boundedArray(encounterPoolItemSchema, 8, 1) })
  .refine(value => Date.parse(value.endsAt) > Date.parse(value.startsAt) && value.claimedCount <= value.maxClaims)
  .refine(value => new Set(value.pool.map(item => item.id)).size === value.pool.length);
export const encounterSessionSchema = z.strictObject({ id: uuid, encounterId: uuid, venueId: uuid, title: text(1, 90),
  state: z.enum(["started", "awaiting_confirmation", "claimed", "cancelled", "expired", "unavailable"]), expiresAt: time, itemId: uuid.nullable() })
  .refine(value => value.state !== "claimed" || value.itemId !== null);
export const encounterInventoryItemSchema = z.strictObject({ id: uuid, sessionId: uuid, encounterId: uuid, venue: encounterVenueSchema,
  name: text(1, 120), description: text(1, 600), rarity: encounterRaritySchema, kind: z.enum(["collectible", "offer"]),
  state: z.enum(["collected", "available", "redeemed", "expired", "unavailable"]), claimedAt: time, expiresAt: time.nullable(), redeemedAt: time.nullable(), promotionId: uuid.nullable() })
  .refine(value => value.kind === "collectible" ? value.promotionId === null && value.expiresAt === null && value.redeemedAt === null && value.state === "collected"
    : value.promotionId !== null && value.expiresAt !== null && value.state !== "collected");

const inputPoolItem = z.discriminatedUnion("kind", [
  z.strictObject({ id: uuid, kind: z.literal("collectible"), name: text(2, 80), description: text(2, 300), rarity: encounterRaritySchema, weight: z.int().min(1).max(1000) }),
  z.strictObject({ id: uuid, kind: z.literal("offer"), promotionId: uuid, rarity: encounterRaritySchema, weight: z.int().min(1).max(1000) }),
]);
const request = { requestId: uuid };
const code = z.string().trim().toLowerCase().regex(/^[a-f0-9]{32}$/u, "Enter the 32-character code.");
export const encounterCommandSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("create"), ...request, encounterId: uuid, venueId: uuid, title: text(2, 90), description: text(2, 600), theme: encounterThemeSchema,
    radiusMetres: z.int().min(30).max(150), cooldownHours: z.int().min(24).max(168), startsAt: time, endsAt: time, maxClaims: z.int().min(1).max(10000),
    offerValidityHours: z.int().min(1).max(168), pool: boundedArray(inputPoolItem, 8, 1) })
    .refine(value => { const duration = Date.parse(value.endsAt) - Date.parse(value.startsAt); return duration > 0 && duration <= 90 * 86400000; }, "Use a schedule of up to 90 days.")
    .refine(value => new Set(value.pool.map(item => item.id)).size === value.pool.length, "Pool entry identifiers must be unique."),
  z.strictObject({ action: z.literal("submit"), ...request, encounterId: uuid, version: time }),
  z.strictObject({ action: z.literal("review"), ...request, encounterId: uuid, version: time, decision: z.enum(["approve", "reject", "withdraw"]), reason: text(5, 400) }),
  z.strictObject({ action: z.literal("start"), ...request, encounterId: uuid }),
  z.strictObject({ action: z.literal("cancel"), ...request, sessionId: uuid }),
  z.strictObject({ action: z.literal("issue"), ...request, sessionId: uuid }),
  z.strictObject({ action: z.literal("claim"), ...request, sessionId: uuid, code }),
  z.strictObject({ action: z.literal("prepareRedemption"), ...request, itemId: uuid }),
  z.strictObject({ action: z.literal("redeem"), ...request, code }),
]);
export const encounterResultSchema = z.strictObject({ action: z.enum(["create", "submit", "review", "start", "cancel", "issue", "claim", "prepareRedemption", "redeem"]),
  sessionId: uuid.nullable(), itemId: uuid.nullable(), code: z.string().regex(/^[a-f0-9]{32}$/u).nullable(), codeExpiresAt: time.nullable(), replayed: z.boolean(),
  error: z.strictObject({ code: z.enum(["invalid", "missing", "ineligible", "limit", "changed"]), message: text(1, 300) }).nullable() })
  .refine(value => value.code === null || (!value.error && ["issue", "prepareRedemption"].includes(value.action) && value.codeExpiresAt !== null))
  .refine(value => !!value.error || !["start", "cancel", "issue", "claim"].includes(value.action) || value.sessionId !== null)
  .refine(value => !!value.error || !["claim", "prepareRedemption", "redeem"].includes(value.action) || value.itemId !== null);
export const encounterPublicSchema = z.strictObject({ ok: z.literal(true), version: z.literal(1), serverTime: time, encounters: boundedArray(encounterCampaignSchema, 3) })
  .refine(value => value.encounters.every(campaign => campaign.state === "published"), "Only published encounters are public.")
  .refine(value => new Set(value.encounters.map(campaign => campaign.id)).size === value.encounters.length);
export const encounterSnapshotSchema = z.strictObject({ ok: z.literal(true), version: z.literal(1), serverTime: time,
  inventory: boundedArray(encounterInventoryItemSchema, 500), sessions: boundedArray(encounterSessionSchema, 3), managedVenues: boundedArray(encounterVenueSchema, 50),
  campaigns: boundedArray(encounterCampaignSchema, 100), operator: z.boolean(), result: encounterResultSchema.nullable() })
  .refine(value => [value.inventory, value.sessions, value.managedVenues, value.campaigns].every(rows => new Set(rows.map(row => row.id)).size === rows.length))
  .refine(value => !value.result || value.result.action !== "claim" || !!value.result.error
    || value.inventory.some(item => item.id === value.result!.itemId && item.sessionId === value.result!.sessionId));
export type EncounterCommand = z.infer<typeof encounterCommandSchema>;
export type EncounterAction = EncounterCommand["action"];
export type EncounterInput = EncounterCommand extends infer Command ? Command extends { requestId: string } ? Omit<Command, "requestId"> : never : never;
export type EncounterCampaign = z.infer<typeof encounterCampaignSchema>;
export type EncounterSession = z.infer<typeof encounterSessionSchema>;
export type EncounterInventoryItem = z.infer<typeof encounterInventoryItemSchema>;
export type EncounterSnapshot = z.infer<typeof encounterSnapshotSchema>;
export type EncounterPublic = z.infer<typeof encounterPublicSchema>;

export const rarityLabel: Record<EncounterRarity, string> = { common: "Common", rare: "Rare", epic: "Epic", legendary: "Legendary" };
export function encounterProximity(fix: ExplorerLocationFix | null, point: { longitude: number; latitude: number }, radius: number, now: number) {
  if (!fix || !Number.isFinite(now) || !Number.isFinite(fix.timestamp) || !Number.isFinite(fix.accuracy) || fix.accuracy < 0 || fix.accuracy > 35
    || now - fix.timestamp > 15000 || fix.timestamp - now > 3000 || !Number.isFinite(fix.longitude) || !Number.isFinite(fix.latitude)
    || Math.abs(fix.longitude) > 180 || Math.abs(fix.latitude) > 90) return null;
  const distance = mapDistance(fix, point);
  return Number.isFinite(distance) ? { distance, nearby: distance + fix.accuracy <= radius } : null;
}
