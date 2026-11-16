import { z } from "zod";

export const sections = ["venues", "promotions", "posts", "comments", "reports", "audit"] as const;
export const sectionSchema = z.enum(sections);
export type OperatorSection = z.infer<typeof sectionSchema>;
const dateTime = z.iso.datetime({ offset: true });
const textField = (min: number, max: number) => z.string().trim().min(min).max(max);
const changeFields = { id: z.uuid(), requestId: z.uuid(), reason: textField(3, 240) };
const dated = { ...changeFields, version: dateTime };
const offer = { venueId: z.uuid(), title: textField(2, 90), description: textField(2, 400), startsAt: dateTime, endsAt: dateTime };
export const operatorActionSchema = z.discriminatedUnion("action", [
  z.strictObject({ ...dated, action: z.enum(["venue.verify","venue.publish","venue.suspend","venue.revoke","promo.publish","promo.withdraw"]) }),
  z.strictObject({ ...dated, action: z.literal("venue.locate"), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) }),
  z.strictObject({ ...changeFields, action: z.literal("promo.create"), ...offer }),
  z.strictObject({ ...dated, action: z.literal("promo.edit"), ...offer }),
  z.strictObject({ ...changeFields, action: z.enum(["post.publish","post.remove","comment.publish","comment.remove"]), version: z.enum(["pending","published"]) }),
  z.strictObject({ ...changeFields, action: z.enum(["report.dismiss","report.remove"]), version: z.string().regex(/^[a-f0-9]{32}$/u) }),
]).refine(change => !("startsAt" in change) || Date.parse(change.endsAt) > Date.parse(change.startsAt), "End must follow start.");

export const operatorRowSchema = z.object({
  id: z.uuid(), name: z.string(), detail: z.string(), state: z.string(), version: z.string().optional(),
  verified: z.boolean().optional(), venueId: z.uuid().optional(), venueName: z.string().optional(),
  startsAt: dateTime.optional(), endsAt: dateTime.optional(), at: dateTime.optional(),
  actor: z.uuid().optional(), organisation: z.string().optional(), context: z.string().optional(),
  contactEmail: z.string().nullable().optional(), contactPhone: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(), longitude: z.number().nullable().optional(),
});
export type OperatorRow = z.infer<typeof operatorRowSchema>;
export const queueSchema = z.object({ items: z.array(operatorRowSchema).max(20), hasMore: z.boolean() });

export function operatorError(code?: string) {
  if (code === "42501") return { status: 403, error: "An authorised independent operator with a verified authenticator session is required." };
  if (code === "FG404") return { status: 404, error: "This item is no longer available. Refresh the queue." };
  if (code === "FG409" || code === "23505") return { status: 409, error: "The decision could not be applied to the current record. Refresh the queue and review its status." };
  if (["22023","22P02","22007","22008","23514"].includes(code ?? "")) return { status: 400, error: "Check the decision details and dates." };
  return { status: 503, error: "Operator services are unavailable. Try again shortly." };
}
