import { z } from "zod";
import { gameProfileSchema } from "./game-profile";

export const accountTypeSchema = z.enum(["explorer", "partner"]);
export const customerAction = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("save"), kind: z.enum(["venue","dish"]), id: z.uuid(), saved: z.boolean() }),
  z.strictObject({ action: z.literal("redeem"), code: z.string().trim().toLowerCase().regex(/^[a-f0-9]{32}$/u) }),
  z.strictObject({ action: z.literal("account"), accountType: accountTypeSchema }),
]);
const time = z.iso.datetime({ offset: true });
export const journeySchema = z.object({
  progress: gameProfileSchema,
  accountType: accountTypeSchema, displayName: z.string(),
  savedVenues: z.array(z.uuid()).max(100), savedDishes: z.array(z.uuid()).max(100),
  visits: z.array(z.object({ id: z.uuid(), name: z.string(), suburb: z.string(), at: time })).max(500),
  discoveries: z.array(z.object({ id: z.uuid(), name: z.string(), venue: z.string(), cuisine: z.string(), at: time })).max(500),
});
export type Journey = z.infer<typeof journeySchema>;
export const partnerAction = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("submit"), venueId: z.uuid(), version: time }),
  z.strictObject({ action: z.literal("details"), venueId: z.uuid(), version: time, name: z.string().trim().min(2).max(120),
    description: z.string().max(1000), cuisine: z.string().trim().min(2).max(60), address: z.string().trim().min(5).max(200),
    suburb: z.string().trim().min(2).max(100), state: z.enum(["ACT","NSW","NT","QLD","SA","TAS","VIC","WA"]),
    postcode: z.string().regex(/^\d{4}$/u), gameEnabled: z.boolean() }),
  z.strictObject({ action: z.literal("dish"), venueId: z.uuid(), dishId: z.uuid(), version: time.optional(),
    name: z.string().trim().min(2).max(120), description: z.string().max(1000),
    price: z.number().int().min(0).max(1000000), available: z.boolean() }),
  z.strictObject({ action: z.literal("issue"), venueId: z.uuid(), dishId: z.uuid().optional() }),
  z.strictObject({ action: z.literal("promo"), venueId: z.uuid(), id: z.uuid(), title: z.string().trim().min(2).max(90),
    description: z.string().trim().min(2).max(400), startsAt: time, endsAt: time }),
]);
export const workspaceSchema = z.object({
  venue: z.object({ id: z.uuid(), name: z.string(), description: z.string(), cuisine: z.string(), address: z.string(),
    suburb: z.string(), state: z.string(), postcode: z.string(), status: z.enum(["draft","pending","published","suspended"]),
    ownership_verified_at: z.string().nullable(), game_enabled: z.boolean(), updated_at: time }),
  dishes: z.array(z.object({ id: z.uuid(), name: z.string(), description: z.string(), price_aud_cents: z.number().nullable(),
    is_available: z.boolean(), updated_at: time })).max(100),
  promotions: z.array(z.object({ id: z.uuid(), title: z.string(), status: z.string(), ends_at: time })).max(100),
  visits: z.number().int().nonnegative(), discoveries: z.number().int().nonnegative(),
});
export type Workspace = z.infer<typeof workspaceSchema>;
