import "server-only";
import { cache } from "react";
import { loadCatalogue, readCatalogueConfig } from "./catalogue";
import { loadPromotions } from "./promotions";
import type { VenueSearch } from "@food-go/domain";

export function getCatalogueMode() { return readCatalogueConfig(process.env).mode; }
export function searchPublicCatalogue(search: VenueSearch) { return loadCatalogue(readCatalogueConfig(process.env), search); }
export function getSavedPublicCatalogue(kind: "venue" | "dish", ids: string[]) {
  return loadCatalogue(readCatalogueConfig(process.env), { query: "", limit: 50 }, { saved: { kind, ids } });
}

export const getCatalogue = cache(async () => loadCatalogue(readCatalogueConfig(process.env)));
export const getPromotions = cache(async () => loadPromotions(readCatalogueConfig(process.env)));
export const getRestaurants = cache(async () => {
  const config = readCatalogueConfig(process.env);
  // Only explicit demo pages display fictional businesses and offers.
  if (config.mode === "demo") return { mode: "supabase", status: "unavailable", venues: [], hasMore: false } as const;
  return loadCatalogue(config, { query: "", venueType: "restaurant", limit: 50 });
});
export const getCatalogueVenue = cache(async (key: string) => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(key) || key.length > 160)
    return { mode: readCatalogueConfig(process.env).mode, status: "ready", venues: [], hasMore: false } as const;
  return loadCatalogue(readCatalogueConfig(process.env), { query: "", limit: 1 }, { venueKey: key });
});
