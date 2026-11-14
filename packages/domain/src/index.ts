import { z } from "zod";

export const AU_STATES = [
  "ACT",
  "NSW",
  "NT",
  "QLD",
  "SA",
  "TAS",
  "VIC",
  "WA",
] as const;
export const VENUE_TYPES = ["restaurant", "cafe", "market"] as const;

// Reject control characters while allowing legitimate accents and punctuation.
// HTML is still untrusted text and must be escaped by every rendering client.
const readableText = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, `${label} needs at least ${min} characters.`)
    .max(max, `${label} must be ${max} characters or fewer.`)
    .refine(
      (value) => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(value),
      `${label} contains unsupported characters.`,
    );

export const venueDraftSchema = z.strictObject({
  name: readableText("Venue name", 2, 120),
  email: z
    .string()
    .trim()
    .max(254)
    .toLowerCase()
    .pipe(z.email("Enter a valid business email.")),
  phone: z
    .string()
    .trim()
    .min(8, "Enter a business phone number.")
    .max(24)
    .regex(
      /^\+?[0-9 ()-]+$/,
      "Use numbers, spaces, brackets and an optional leading +.",
    )
    .refine((value) => {
      const digits = value.replace(/\D/g, "");
      return digits.length >= 8 && digits.length <= 15;
    }, "Enter a phone number containing 8 to 15 digits."),
  address: readableText("Street address", 5, 200),
  suburb: readableText("Suburb", 2, 100),
  state: z.enum(AU_STATES, "Choose an Australian state or territory."),
  postcode: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "Enter a four-digit Australian postcode."),
  cuisine: readableText("Cuisine", 2, 60),
  venueType: z.enum(VENUE_TYPES, "Choose a venue type."),
  description: readableText("Description", 20, 1000),
  gameEnabled: z.boolean().default(true),
  acceptedTerms: z.literal(
    true,
    "Confirm that you are authorised to manage this venue and accept the terms.",
  ),
});

export type VenueDraft = z.infer<typeof venueDraftSchema>;

export const venueSearchSchema = z.strictObject({
  query: readableText("Search", 0, 100).default(""),
  state: z.enum(AU_STATES).optional(),
  venueType: z.enum(VENUE_TYPES).optional(),
  cuisine: readableText("Cuisine", 0, 60).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type VenueSearch = z.infer<typeof venueSearchSchema>;
