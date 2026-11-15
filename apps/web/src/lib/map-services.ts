import { z } from "zod";

type Environment = Record<string, string | undefined>;
export type MapCoordinate = [number, number];
export type MapSearchResult = { id: string; name: string; latitude: number; longitude: number; bounds?: [number, number, number, number] };
export type MapWalkingRoute = {
  geometry: { type: "LineString"; coordinates: MapCoordinate[] };
  distance: number;
  duration: number;
  attribution: string;
};
type Dependencies = {
  env: Environment;
  fetch?: typeof fetch;
  acquireLease(service: "geocoding" | "routing"): Promise<boolean>;
  now?: () => number;
};
const coordinate = z.tuple([z.number().finite().min(-180).max(180), z.number().finite().min(-90).max(90)]);
const routeGeometry = z.object({ type: z.literal("LineString"), coordinates: z.array(coordinate).min(2).max(10000) });
const routeSummary = z.object({ distance: z.number().finite().positive().max(50000), duration: z.number().finite().nonnegative().max(86400) });
const photon = z.object({ features: z.array(z.object({
  geometry: z.object({ type: z.literal("Point"), coordinates: coordinate }),
  properties: z.object({
    osm_id: z.union([z.number().int(), z.string().max(64)]).optional(), osm_type: z.string().max(32).optional(),
    name: z.string().max(250).optional(), street: z.string().max(250).optional(), housenumber: z.string().max(50).optional(),
    city: z.string().max(250).optional(), district: z.string().max(250).optional(), state: z.string().max(250).optional(),
    country: z.string().max(250).optional(), extent: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  }),
})).max(10) });
const userAgent = "FoodGo/1.0";

export function mapDistance(from: MapCoordinate, to: MapCoordinate) {
  const radians = Math.PI / 180;
  const latitude = (to[1] - from[1]) * radians, longitude = (to[0] - from[0]) * radians;
  const a = Math.sin(latitude / 2) ** 2 + Math.cos(from[1] * radians) * Math.cos(to[1] * radians) * Math.sin(longitude / 2) ** 2;
  return 6371008.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}
export function parseMapCoordinate(value: string | null): MapCoordinate | null {
  if (!value || value.length > 64 || !/^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/u.test(value)) return null;
  const parsed = coordinate.safeParse(value.split(",").map(Number));
  return parsed.success ? parsed.data : null;
}
function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: {
    "Cache-Control": "no-store", ...(status === 429 && { "Retry-After": "2" }),
  } });
}
const unavailable = () => json({ error: "Place search or walking routes are temporarily unavailable. Please try again shortly." }, 503);
const busy = () => json({ error: "Please wait a moment before searching or planning another walk." }, 429);
const noRoute = () => json({ error: "No walking route was found between these points. Choose a nearby street or footpath." }, 404);

function endpoint(source: string | undefined, fallback: string) {
  const url = new URL(source || fallback);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error("Invalid map service configuration");
  return url;
}
function identityHeaders(env: Environment): Record<string, string> {
  const origin = env.APP_ORIGIN;
  try {
    const url = new URL(origin || "");
    return { "User-Agent": `${userAgent} (+${url.origin})`, Referer: url.origin + "/", Accept: "application/json" };
  } catch { return { "User-Agent": userAgent, Accept: "application/json" }; }
}
async function boundedJson(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Map service returned no data");
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > 2000000) { await reader.cancel(); throw new Error("Map response too large"); }
      parts.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
}

/** Public community services are paced by a shared database lease across server instances. */
export function createMapServices(dependencies: Dependencies) {
  const fetcher = dependencies.fetch || fetch;
  const now = dependencies.now || Date.now;
  const searchCache = new Map<string, { expires: number; results: MapSearchResult[] }>();
  const routeCache = new Map<string, { expires: number; route: MapWalkingRoute }>();
  function remember<T>(cache: Map<string, T>, key: string, value: T) {
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    cache.set(key, value);
  }
  async function request(url: URL, init?: RequestInit) {
    return fetcher(url, { ...init, cache: "no-store", redirect: "error",
      signal: AbortSignal.timeout(12000), headers: { ...identityHeaders(dependencies.env), ...init?.headers } });
  }
  return {
    async search(requestInput: Request) {
      const params = new URL(requestInput.url).searchParams;
      const query = params.get("q")?.trim() || "";
      if ([...params.keys()].length !== 1 || !params.has("q") || query.length < 2 || query.length > 120 ||
        /[\u0000-\u001f\u007f]/u.test(query)) return json({ error: "Enter a place name between 2 and 120 characters." }, 400);
      const key = query.toLocaleLowerCase("en-AU");
      const cached = searchCache.get(key);
      if (cached && cached.expires > now()) return json({ results: cached.results, attribution: "Place search by Photon using OpenStreetMap data" });
      try {
        const url = endpoint(dependencies.env.FOOD_GO_PHOTON_ENDPOINT, "https://photon.komoot.io/api/");
        const isPublic = url.origin === "https://photon.komoot.io";
        if (isPublic && !await dependencies.acquireLease("geocoding")) return busy();
        url.search = new URLSearchParams({ q: query, limit: "6", lang: "en" }).toString();
        const response = await request(url);
        if (response.status === 429) return busy();
        if (!response.ok) return unavailable();
        const parsed = photon.safeParse(await boundedJson(response));
        if (!parsed.success) return unavailable();
        const results = parsed.data.features.slice(0, 6).map((feature, index): MapSearchResult => {
          const p = feature.properties, [longitude, latitude] = feature.geometry.coordinates;
          const street = [p.housenumber, p.street].filter(Boolean).join(" ");
          const pieces = [p.name || street, p.city || p.district, p.state, p.country].filter((value): value is string => !!value);
          const name = [...new Set(pieces)].join(", ").slice(0, 500) || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
          const extent = p.extent;
          const bounds = extent && extent.every(Number.isFinite) && extent[0] >= -180 && extent[2] <= 180 &&
            extent[3] >= -90 && extent[1] <= 90 && extent[0] <= extent[2] && extent[3] <= extent[1]
            ? [extent[0], extent[3], extent[2], extent[1]] as [number, number, number, number] : undefined;
          return { id: `osm-${p.osm_type || "place"}-${p.osm_id || index}-${longitude}-${latitude}`, name, longitude, latitude, ...(bounds && { bounds }) };
        });
        remember(searchCache, key, { results, expires: now() + 300000 });
        return json({ results, attribution: "Place search by Photon using OpenStreetMap data" });
      } catch { return unavailable(); }
    },
    async route(requestInput: Request) {
      const params = new URL(requestInput.url).searchParams;
      const from = parseMapCoordinate(params.get("from")), to = parseMapCoordinate(params.get("to"));
      if ([...params.keys()].length !== 2 || !params.has("from") || !params.has("to") || !from || !to)
        return json({ error: "Choose valid start and destination coordinates." }, 400);
      const direct = mapDistance(from, to);
      if (direct < 1 || direct > 20000) return json({ error: "Choose a walking destination between 1 metre and 20 kilometres away." }, 400);
      const key = [...from, ...to].map(value => value.toFixed(6)).join(",");
      const cached = routeCache.get(key);
      if (cached && cached.expires > now()) return json(cached.route);
      try {
        let route: MapWalkingRoute;
        const orsKey = dependencies.env.OPENROUTESERVICE_API_KEY?.trim();
        if (orsKey) {
          const response = await request(new URL("https://api.openrouteservice.org/v2/directions/foot-walking/geojson"), {
            method: "POST", headers: { Authorization: orsKey, "Content-Type": "application/json" },
            body: JSON.stringify({ coordinates: [from, to], instructions: false }),
          });
          if (response.status === 429) return busy();
          if (response.status === 400 || response.status === 404) return noRoute();
          if (!response.ok) return unavailable();
          const parsed = z.object({ features: z.array(z.object({
            geometry: routeGeometry, properties: z.object({ summary: routeSummary }),
          })).min(1).max(3) }).safeParse(await boundedJson(response));
          if (!parsed.success) return noRoute();
          const feature = parsed.data.features[0];
          route = { geometry: feature.geometry, ...feature.properties.summary, attribution: "openrouteservice | OpenStreetMap contributors" };
        } else {
          const url = endpoint(dependencies.env.FOOD_GO_FOOT_ROUTER_ENDPOINT, "https://routing.openstreetmap.de/routed-foot/route/v1/foot/");
          const isPublic = url.origin === "https://routing.openstreetmap.de";
          if (isPublic && !await dependencies.acquireLease("routing")) return busy();
          url.pathname = url.pathname.replace(/\/?$/u, "/") + from.join(",") + ";" + to.join(",");
          url.search = new URLSearchParams({ overview: "full", geometries: "geojson", steps: "false", alternatives: "false" }).toString();
          const response = await request(url);
          if (response.status === 429) return busy();
          if (response.status === 400 || response.status === 404) return noRoute();
          if (!response.ok) return unavailable();
          const parsed = z.object({ code: z.literal("Ok"), routes: z.array(routeSummary.extend({ geometry: routeGeometry })).min(1).max(3) })
            .safeParse(await boundedJson(response));
          if (!parsed.success) return noRoute();
          const result = parsed.data.routes[0];
          route = { geometry: result.geometry, distance: result.distance, duration: result.duration,
            attribution: "Walking route by FOSSGIS using OpenStreetMap data" };
        }
        remember(routeCache, key, { route, expires: now() + 300000 });
        return json(route);
      } catch { return unavailable(); }
    },
  };
}
