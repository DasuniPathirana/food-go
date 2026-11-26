import { z } from "zod";
import { authJson, readAuthRequest } from "@/lib/auth/http";
import { journeyClient, journeyFailure } from "@/lib/journey-server";

const claimSchema = z.strictObject({
  lootId: z.uuid(),
  latitude: z.number().min(-38.05).max(-37.65),
  longitude: z.number().min(144.8).max(145.15),
  arScanConfirmed: z.boolean().optional(),
});

export async function POST(request: Request) {
  const input = await readAuthRequest(request, claimSchema);
  if (!input.ok) return input.response;
  try {
    const session = await journeyClient();
    if (session.response) return session.response;
    const { data, error } = await session.client
      .rpc("food_go_claim_world_loot", { p_action: input.data })
      .abortSignal(AbortSignal.timeout(10000));
    if (error) {
      if (error.code === "FG409" || error.code === "42501" || error.code === "22023" || error.code === "FG429") {
        return authJson({ error: error.message }, error.code === "42501" ? 403 : error.code === "FG429" ? 429 : error.code === "22023" ? 400 : 409);
      }
      return journeyFailure(error.code);
    }
    return authJson(data);
  } catch {
    return journeyFailure();
  }
}
