export type MobileCatalogueConfig =
  | { mode: "demo" }
  | { mode: "api"; configured: false }
  | { mode: "api"; configured: true; origin: string };
export type PublicDish = { id: string; name: string; description: string; priceAudCents: number | null };
export type PublicVenue = {
  id: string; slug: string; name: string; description: string;
  type: "cafe" | "restaurant" | "market"; cuisine: string;
  address: string; suburb: string; state: string; postcode: string; dishes: PublicDish[];
};
export type MobileCatalogue = { venues: PublicVenue[]; hasMore: boolean };

/** Values in EXPO_PUBLIC variables ship with the app. They must never contain credentials. */
export function readMobileCatalogueConfig(env: { mode?: string; origin?: string }, development: boolean): MobileCatalogueConfig {
  if (!env.mode || env.mode === "demo") return { mode: "demo" };
  if (env.mode !== "api") return { mode: "api", configured: false };
  try {
    const url = new URL(env.origin || "");
    const local = development && url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if ((!local && url.protocol !== "https:") || url.origin !== env.origin || url.username || url.password || url.search || url.hash)
      return { mode: "api", configured: false };
    return { mode: "api", configured: true, origin: url.origin };
  } catch { return { mode: "api", configured: false }; }
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const states = ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"];
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid catalogue");
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number, min = 0): string {
  if (typeof value !== "string" || value.length < min || value.length > max) throw new Error("Invalid catalogue");
  return value;
}
function identifier(value: unknown): string {
  const id = text(value, 36, 36);
  if (!uuid.test(id)) throw new Error("Invalid catalogue");
  return id;
}
function dish(value: unknown): PublicDish {
  const row = record(value);
  const price = row.priceAudCents;
  if (price !== null && (typeof price !== "number" || !Number.isInteger(price) || price < 0 || price > 1000000)) throw new Error("Invalid catalogue");
  return { id: identifier(row.id), name: text(row.name, 120, 2), description: text(row.description, 1000), priceAudCents: price as number | null };
}
function venue(value: unknown): PublicVenue {
  const row = record(value);
  if (!["cafe", "restaurant", "market"].includes(String(row.type)) || !states.includes(String(row.state)) ||
    !Array.isArray(row.dishes) || row.dishes.length > 100) throw new Error("Invalid catalogue");
  const slug = text(row.slug, 160, 1);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/u.test(slug)) throw new Error("Invalid catalogue");
  const postcode = text(row.postcode, 4, 4);
  if (!/^\d{4}$/u.test(postcode)) throw new Error("Invalid catalogue");
  return {
    id: identifier(row.id), slug, name: text(row.name, 120, 2), description: text(row.description, 1000),
    type: row.type as PublicVenue["type"], cuisine: text(row.cuisine, 60, 2),
    address: text(row.address, 200), suburb: text(row.suburb, 100), state: String(row.state), postcode,
    dishes: row.dishes.map(dish),
  };
}

/** Accept the connected public DTO only. Demo results and provider errors never become real venues. */
export function parseMobileCatalogue(value: unknown): MobileCatalogue {
  const body = record(value);
  if (body.mode !== "supabase" || body.status !== "ready" || !Array.isArray(body.data) || body.data.length > 50 || typeof body.hasMore !== "boolean") throw new Error("Invalid catalogue");
  return { venues: body.data.map(venue), hasMore: body.hasMore };
}

export async function fetchMobileCatalogue(
  config: MobileCatalogueConfig,
  search: { query?: string; type?: string } = {},
  options: { fetch?: typeof fetch; signal?: AbortSignal } = {},
): Promise<MobileCatalogue> {
  if (config.mode !== "api" || !config.configured) throw new Error("Catalogue unavailable");
  const query = (search.query || "").trim();
  if (query.length > 100 || /[\u0000-\u001F\u007F]/u.test(query) || (search.type && !["cafe", "restaurant", "market"].includes(search.type))) throw new Error("Invalid search");
  const params = new URLSearchParams({ q: query, limit: "50" });
  if (search.type) params.set("venueType", search.type);
  const response = await (options.fetch || fetch)(`${config.origin}/api/venues?${params}`, {
    method: "GET", credentials: "omit", signal: options.signal, headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("Catalogue unavailable");
  return parseMobileCatalogue(await response.json());
}
