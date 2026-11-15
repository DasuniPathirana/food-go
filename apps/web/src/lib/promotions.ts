import { z } from "zod";
import { publicCatalogueClient, type CatalogueConfig } from "./catalogue";

const promotionSchema = z.object({
  id: z.uuid(), venueId: z.uuid(),
  venueSlug: z.string().max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  venueName: z.string().min(1).max(120), suburb: z.string().max(100),
  title: z.string().min(2).max(90), description: z.string().min(2).max(400),
  startsAt: z.iso.datetime({ offset: true }), endsAt: z.iso.datetime({ offset: true }),
});
export type PublicPromotion = z.infer<typeof promotionSchema>;
export type PromotionResult = { status: "ready" | "unavailable"; promotions: PublicPromotion[] };

export async function loadPromotions(config: CatalogueConfig, fetcher?: typeof fetch): Promise<PromotionResult> {
  const unavailable: PromotionResult = { status: "unavailable", promotions: [] };
  if (config.mode !== "supabase" || !config.configured) return unavailable;
  try {
    const { data, error } = await publicCatalogueClient(config, fetcher)
      .rpc("food_go_active_promotions").abortSignal(AbortSignal.timeout(8000));
    if (error) return unavailable;
    const parsed = z.array(promotionSchema).max(100).safeParse(data);
    if (!parsed.success) return unavailable;
    return { status: "ready", promotions: parsed.data };
  } catch { return unavailable; }
}
