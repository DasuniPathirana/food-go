import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AU_STATES, VENUE_TYPES, venueSearchSchema, type VenueSearch } from "@food-go/domain";
import { venues as examples, type Venue } from "./fixtures";
import type { CatalogueState, CatalogueVenue } from "./catalogue-contracts";

type Environment = Record<string, string | undefined>;
export type CatalogueConfig =
  | { mode: "demo" }
  | { mode: "supabase"; configured: false }
  | { mode: "supabase"; configured: true; url: string; key: string };

function publicKey(value: string) {
  if (/^sb_publishable_[A-Za-z0-9_-]{16,}$/u.test(value)) return true;
  try {
    const parts = value.split(".");
    return parts.length === 3 && JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")).role === "anon";
  } catch { return false; }
}

/** Catalogue access deliberately does not depend on the account release flag. */
export function readCatalogueConfig(env: Environment): CatalogueConfig {
  if (!env.FOOD_GO_CATALOGUE_MODE || env.FOOD_GO_CATALOGUE_MODE === "demo") return { mode: "demo" };
  if (env.FOOD_GO_CATALOGUE_MODE !== "supabase") return { mode: "supabase", configured: false };
  try {
    const url = new URL(env.SUPABASE_URL || "");
    const local = env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    const hosted = url.protocol === "https:" && /^[a-z0-9]{20}\.supabase\.co$/u.test(url.hostname) && !url.port;
    const key = env.SUPABASE_PUBLISHABLE_KEY || "";
    if ((!hosted && !local) || url.username || url.password || url.search || url.hash || url.pathname !== "/" || !publicKey(key))
      return { mode: "supabase", configured: false };
    return { mode: "supabase", configured: true, url: url.origin, key };
  } catch { return { mode: "supabase", configured: false }; }
}

const dishSchema = z.object({
  id: z.uuid(), name: z.string().min(2).max(120), description: z.string().max(1000),
  price_aud_cents: z.number().int().min(0).max(1000000).nullable(),
});
const rowSchema = z.object({
  id: z.uuid(), slug: z.string().min(1).max(160).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/u),
  name: z.string().min(2).max(120), description: z.string().max(1000),
  venue_type: z.enum(VENUE_TYPES), cuisine: z.string().min(2).max(60),
  address: z.string().max(200), suburb: z.string().max(100), state: z.enum(AU_STATES),
  postcode: z.string().regex(/^\d{4}$/u), venue_dishes: z.array(dishSchema).max(200),
});

const publicColumns = "id,slug,name,description,venue_type,cuisine,address,suburb,state,postcode,venue_dishes(id,name,description,price_aud_cents)";
export const DEFAULT_CATALOGUE_LIMIT = 50;

/** Fictional mall shops for the illustrated preview only; never used by the public DTO. */
const arcadeExamples: Array<Venue & { building: NonNullable<CatalogueVenue["building"]> }> = [
  {
    id: "arcade-leaf-and-grain", name: "Leaf & Grain", suburb: "Example neighbourhood",
    address: "Fictional Garden Arcade, Ground floor, Shop G03", cuisine: "Seasonal bowls", type: "cafe",
    tags: ["Vegetarian", "Lunch"], dish: "Roasted vegetable bowl", image: "/images/brunch.jpg",
    imageAlt: "Example cafe food photograph", accent: "brunch",
    description: "A fictional cafe inside Garden Arcade, used to preview shops sharing one building.",
    building: { id: "garden-arcade", name: "Garden Arcade", level: "Ground floor", unit: "Shop G03" },
  },
  {
    id: "arcade-laneway-noodles", name: "Laneway Noodles", suburb: "Example neighbourhood",
    address: "Fictional Garden Arcade, Level 1, Shop L1-12", cuisine: "Noodles", type: "restaurant",
    tags: ["Lunch", "Dinner"], dish: "Vegetable noodle bowl", image: "/images/venue-placeholder.svg",
    imageAlt: "Food Go venue illustration. No venue photograph supplied.", accent: "generic",
    description: "A fictional upstairs noodle shop inside Garden Arcade. This is a demonstration listing.",
    building: { id: "garden-arcade", name: "Garden Arcade", level: "Level 1", unit: "Shop L1-12" },
  },
  {
    id: "arcade-cloud-patisserie", name: "Cloud Patisserie", suburb: "Example neighbourhood",
    address: "Fictional Garden Arcade, Ground floor, Shop G07", cuisine: "Patisserie", type: "cafe",
    tags: ["Coffee", "Bakery"], dish: "Almond croissant", image: "/images/coffee.jpg",
    imageAlt: "Example croissant and coffee photograph", accent: "coffee",
    description: "A fictional patisserie inside Garden Arcade, showing a separate shop in the same building.",
    building: { id: "garden-arcade", name: "Garden Arcade", level: "Ground floor", unit: "Shop G07" },
  },
];

function demoVenues(): CatalogueVenue[] {
  return [...examples, ...arcadeExamples].map((venue) => ({
    ...venue, source: "demo", slug: venue.id, state: "VIC", postcode: "", dishes: [{
      id: `${venue.id}:signature`, name: venue.dish, description: "Fictional example dish.", priceAudCents: null,
    }],
  }));
}

function dto(row: z.infer<typeof rowSchema>): CatalogueVenue {
  return {
    id: row.id, source: "supabase", slug: row.slug, name: row.name, description: row.description,
    type: row.venue_type, cuisine: row.cuisine, address: row.address, suburb: row.suburb,
    state: row.state, postcode: row.postcode, tags: [], dish: row.venue_dishes[0]?.name || "",
    image: "/images/venue-placeholder.svg", imageAlt: "Food Go venue illustration. No venue photograph supplied.",
    accent: "generic", dishes: row.venue_dishes.map((dish) => ({
      id: dish.id, name: dish.name, description: dish.description, priceAudCents: dish.price_aud_cents,
    })),
  };
}

/** PostgREST quoted filter literal; wildcards supplied by a visitor remain literal. */
function searchPattern(value: string) {
  return `"%${value.replace(/[\\"%_]/gu, (character) => `\\${character}`)}%"`;
}

export function parseCatalogueSearch(url: URL) {
  const allowed = new Set(["q", "state", "venueType", "cuisine", "limit"]);
  if (url.search.length > 2048 || [...url.searchParams.keys()].some((key) => !allowed.has(key) || url.searchParams.getAll(key).length !== 1)) return null;
  const result = venueSearchSchema.safeParse({
    query: url.searchParams.get("q") ?? "", state: url.searchParams.get("state") ?? undefined,
    venueType: url.searchParams.get("venueType") ?? undefined, cuisine: url.searchParams.get("cuisine") ?? undefined,
    limit: url.searchParams.get("limit") ?? DEFAULT_CATALOGUE_LIMIT,
  });
  return result.success ? result.data : null;
}

/** Read-only anonymous client. No cookies, user session, or privileged key is attached. */
export async function loadCatalogue(
  config: CatalogueConfig,
  search: VenueSearch = { query: "", limit: DEFAULT_CATALOGUE_LIMIT },
  options: { fetch?: typeof fetch; venueKey?: string; saved?: { kind: "venue" | "dish"; ids: string[] } } = {},
): Promise<CatalogueState> {
  const unavailable: CatalogueState = { mode: config.mode, status: "unavailable", venues: [], hasMore: false };
  if (config.mode === "demo") {
    const data = demoVenues().filter((venue) =>
      (!options.venueKey || [venue.id, venue.slug].includes(options.venueKey)) &&
      (!search.state || venue.state === search.state) && (!search.venueType || venue.type === search.venueType) &&
      (!search.cuisine || venue.cuisine.toLowerCase().includes(search.cuisine.toLowerCase())) &&
      `${venue.name} ${venue.suburb} ${venue.cuisine} ${venue.dish} ${venue.building?.name || ""}`.toLowerCase().includes(search.query.toLowerCase()),
    );
    return { mode: "demo", status: "ready", venues: data.slice(0, search.limit), hasMore: data.length > search.limit };
  }
  if (!config.configured) return unavailable;
  if (options.saved && (!options.saved.ids.length || !z.array(z.uuid()).max(50).safeParse(options.saved.ids).success)) return unavailable;
  try {
    const client = createClient(config.url, config.key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => (options.fetch || fetch)(input, { ...init, cache: "no-store" }) },
    });
    let query = client.from("venues").select(options.saved?.kind === "dish" ? publicColumns.replace("venue_dishes(", "venue_dishes!inner(") : publicColumns)
      .eq("status", "published").not("ownership_verified_at", "is", null)
      .eq("venue_dishes.is_available", true).order("name").limit(search.limit + 1)
      .order("name", { referencedTable: "venue_dishes" }).limit(100, { referencedTable: "venue_dishes" });
    if (options.saved) query = query.in(options.saved.kind === "venue" ? "id" : "venue_dishes.id", options.saved.ids);
    if (options.venueKey) {
      const isId = z.uuid().safeParse(options.venueKey).success;
      query = query.eq(isId ? "id" : "slug", options.venueKey);
    }
    if (search.state) query = query.eq("state", search.state);
    if (search.venueType) query = query.eq("venue_type", search.venueType);
    if (search.cuisine) query = query.ilike("cuisine", `%${search.cuisine.replace(/[\\%_]/gu, (c) => `\\${c}`)}%`);
    if (search.query) query = query.or(["name", "suburb", "cuisine"].map((field) => `${field}.ilike.${searchPattern(search.query)}`).join(","));
    const { data, error } = await query.abortSignal(AbortSignal.timeout(8000));
    if (error) return unavailable;
    const parsed = z.array(rowSchema).max(search.limit + 1).safeParse(data);
    if (!parsed.success) return unavailable;
    return { mode: "supabase", status: "ready", venues: parsed.data.slice(0, search.limit).map(dto), hasMore: parsed.data.length > search.limit };
  } catch { return unavailable; }
}
