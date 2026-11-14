import { z } from "zod";
import { readAuthConfig } from "../auth/config";

export function readPartnerConfig(env: Record<string, string | undefined>) {
  if (env.FOOD_GO_PARTNER_ENABLED !== "true") return { configured: false } as const;
  return readAuthConfig(env);
}

export const partnerVenueSchema = z.object({
  id: z.uuid(),
  name: z.string().min(2).max(120),
  suburb: z.string().min(2).max(100),
  state: z.enum(["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"]),
  status: z.enum(["draft", "pending", "published", "suspended"]),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  ownershipVerified: z.boolean(),
});
export type PartnerVenue = z.infer<typeof partnerVenueSchema>;

/** A verified phone authenticates the account, never restaurant ownership. */
export function hasConfirmedPartnerIdentity(user: {
  email_confirmed_at?: string | null;
  phone_confirmed_at?: string | null;
  phone?: string | null;
}) {
  return Boolean(user.email_confirmed_at ||
    (user.phone_confirmed_at && /^\+?614\d{8}$/u.test(user.phone ?? "")));
}

export function mapPartnerVenue(row: Record<string, unknown>): PartnerVenue {
  return partnerVenueSchema.parse({
    id: row.id, name: row.name, suburb: row.suburb, state: row.state, status: row.status,
    createdAt: row.created_at, updatedAt: row.updated_at,
    ownershipVerified: typeof row.ownership_verified_at === "string",
  });
}

export type PartnerErrorCode = "duplicate" | "limit" | "idempotency" | "unauthorised" | "invalid" | "unavailable";
export class PartnerProviderError extends Error {
  constructor(public readonly code: PartnerErrorCode) { super("Partner request failed."); }
}

export function partnerError(error: unknown) {
  const code = error instanceof PartnerProviderError ? error.code : "unavailable";
  const errors: Record<PartnerErrorCode, { status: number; error: string }> = {
    duplicate: { status: 409, error: "This venue is already in your partner listings. Open your listings to continue." },
    limit: { status: 429, error: "You have reached the limit of five venue listings. Contact Food Go before adding another." },
    idempotency: { status: 409, error: "This submission has already been used with different details. Start a fresh submission." },
    unauthorised: { status: 401, error: "Sign in with a verified account to manage venues." },
    invalid: { status: 400, error: "Check the venue details and try again." },
    unavailable: { status: 503, error: "Venue services are unavailable. Please try again shortly." },
  };
  return errors[code];
}
