import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { authJson, readAuthRequest } from "@/lib/auth/http";
import { readCatalogueConfig } from "@/lib/catalogue";
import { journeyClient, journeyFailure } from "@/lib/journey-server";
import { encounterCommandSchema, encounterPublicSchema, encounterSnapshotSchema } from "@/lib/encounters";

const unavailable = () => authJson({ error: "Restaurant encounters are not enabled yet. Explore and verified discoveries remain available." }, 503);
async function accountAction(action: unknown = { action: "read" }, signal?: AbortSignal) {
  try {
    const session = await journeyClient();
    if (session.response) return session.response;
    const result = await session.client.rpc("food_go_encounter_journey", { p_action: action })
      .abortSignal(signal ? AbortSignal.any([signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000));
    if (result.error) return journeyFailure(result.error.code);
    const parsed = encounterSnapshotSchema.safeParse(result.data);
    return parsed.success ? authJson(parsed.data) : journeyFailure();
  } catch { return journeyFailure(); }
}
export async function GET(request: Request) {
  if (process.env.FOOD_GO_ENCOUNTERS_ENABLED !== "true") return unavailable();
  const params = new URL(request.url).searchParams;
  if (!params.size) return accountAction(undefined, request.signal);
  const venue = z.uuid().transform(value => value.toLowerCase()).safeParse(params.get("venueId"));
  if (params.size !== 1 || !venue.success) return authJson({ error: "Choose one published venue." }, 400);
  const config = readCatalogueConfig(process.env);
  if (config.mode !== "supabase" || !config.configured) return journeyFailure();
  try {
    // Public reads use no account cookies and no privileged provider key.
    const client = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) } });
    const result = await client.rpc("food_go_venue_encounters", { p_venue: venue.data })
      .abortSignal(AbortSignal.any([request.signal, AbortSignal.timeout(10000)]));
    if (result.error) return journeyFailure(result.error.code);
    const parsed = encounterPublicSchema.safeParse(result.data);
    return parsed.success && parsed.data.encounters.every(campaign => campaign.venue.id === venue.data) ? authJson(parsed.data) : journeyFailure();
  } catch { return journeyFailure(); }
}
export async function POST(request: Request) {
  if (process.env.FOOD_GO_ENCOUNTERS_ENABLED !== "true") return unavailable();
  const input = await readAuthRequest(request, encounterCommandSchema, 16384);
  return input.ok ? accountAction(input.data, request.signal) : input.response;
}
