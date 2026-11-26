import "server-only";
import { z } from "zod";
import { publicCatalogueClient, readCatalogueConfig } from "./catalogue";
import { readAuthConfig } from "./auth/config";
import { createAuthClient } from "./auth/server";
import {
  mallDirectorySchema,
  venueAppearanceSchema,
  worldLootClaimSchema,
  worldLootSchema,
  type LiveMall,
  type VenueAppearance,
  type WorldLoot,
  type WorldLootClaim,
} from "./world-data";

export async function loadLiveMalls(): Promise<LiveMall[]> {
  const config = readCatalogueConfig(process.env);
  if (config.mode !== "supabase" || !config.configured) return [];
  try {
    const { data, error } = await publicCatalogueClient(config)
      .rpc("food_go_malls")
      .abortSignal(AbortSignal.timeout(8000));
    if (error) return [];
    const parsed = z.array(mallDirectorySchema).safeParse(data);
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export async function loadWorldLoots(): Promise<{
  serverNow: string | null;
  loots: WorldLoot[];
  myClaims: WorldLootClaim[];
}> {
  const empty = { serverNow: null, loots: [], myClaims: [] };
  const config = readCatalogueConfig(process.env);
  if (config.mode !== "supabase" || !config.configured) return empty;
  try {
    const authConfig = readAuthConfig(process.env);
    let client = publicCatalogueClient(config);
    if (authConfig.configured) {
      try {
        const authClient = await createAuthClient(authConfig);
        const { data: userRes } = await authClient.auth.getUser();
        if (userRes?.user) client = authClient;
      } catch {
        // Fallback cleanly to anonymous public read
      }
    }
    const { data, error } = await client.rpc("food_go_world_loots").abortSignal(AbortSignal.timeout(8000));
    if (error || !data || typeof data !== "object") return empty;
    const raw = data as { serverNow?: unknown; loots?: unknown; myClaims?: unknown };
    const loots = z.array(worldLootSchema).safeParse(raw.loots ?? []);
    const claims = z.array(worldLootClaimSchema).safeParse(raw.myClaims ?? []);
    return {
      serverNow: typeof raw.serverNow === "string" ? raw.serverNow : null,
      loots: loots.success ? loots.data : [],
      myClaims: claims.success ? claims.data : [],
    };
  } catch {
    return empty;
  }
}

export async function loadVenueAppearances(): Promise<Record<string, VenueAppearance>> {
  const config = readCatalogueConfig(process.env);
  if (config.mode !== "supabase" || !config.configured) return {};
  try {
    const { data, error } = await publicCatalogueClient(config)
      .from("venues")
      .select(
        "id,cover_image_url,building_preset,building_accent_colour,building_signage,mall_id,mall_floor,mall_unit,reservations_enabled,reservation_notes"
      )
      .eq("status", "published")
      .not("ownership_verified_at", "is", null)
      .limit(200)
      .abortSignal(AbortSignal.timeout(8000));
    if (error || !Array.isArray(data)) return {};
    const out: Record<string, VenueAppearance> = {};
    for (const row of data) {
      const parsed = venueAppearanceSchema.safeParse({
        id: row.id,
        coverImageUrl: row.cover_image_url ?? null,
        buildingPreset: row.building_preset ?? "isometric-cafe",
        buildingAccentColour: row.building_accent_colour ?? "#00c49a",
        buildingSignage: row.building_signage ?? null,
        mallId: row.mall_id ?? null,
        mallFloor: row.mall_floor ?? null,
        mallUnit: row.mall_unit ?? null,
        reservationsEnabled: row.reservations_enabled ?? true,
        reservationNotes: row.reservation_notes ?? null,
      });
      if (parsed.success) out[parsed.data.id] = parsed.data;
    }
    return out;
  } catch {
    return {};
  }
}
