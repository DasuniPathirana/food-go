import { z } from "zod";
import { publicCatalogueClient, type CatalogueConfig } from "./catalogue";

const promotionSchema = z.object({
  id: z.uuid(),
  venueId: z.uuid(),
  venueSlug: z.string().max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  venueName: z.string().min(2).max(120),
  venueType: z.string().max(40).nullish(),
  suburb: z.string().max(100),
  venueImage: z.string().max(500).nullish(),
  venueBuildingPreset: z.string().max(60).nullish(),
  venueLatitude: z.number().nullish(),
  venueLongitude: z.number().nullish(),
  title: z.string().min(2).max(90),
  description: z.string().min(2).max(400),
  kind: z.enum(["food", "restaurant", "cafe"]).default("restaurant"),
  badgeText: z.string().max(40).nullish(),
  imageUrl: z.string().max(500).nullish(),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
});
export type PublicPromotion = z.infer<typeof promotionSchema>;
export type PromotionResult = { status: "ready" | "unavailable"; promotions: PublicPromotion[] };

export async function loadPromotions(config: CatalogueConfig, fetcher?: typeof fetch): Promise<PromotionResult> {
  const unavailable: PromotionResult = { status: "unavailable", promotions: [] };
  if (config.mode !== "supabase" || !config.configured) return unavailable;
  try {
    const { data, error } = await publicCatalogueClient(config, fetcher)
      .rpc("food_go_active_promotions")
      .abortSignal(AbortSignal.timeout(8000));
    if (error) return unavailable;
    const parsed = z.array(promotionSchema).max(100).safeParse(data);
    if (!parsed.success) return unavailable;
    return { status: "ready", promotions: parsed.data };
  } catch {
    return unavailable;
  }
}
