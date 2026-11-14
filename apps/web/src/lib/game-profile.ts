import { z } from "zod";
import { readAuthConfig, type AuthConfig } from "./auth/config";
import { runBounded } from "./community-handlers";

export const gameProfileSchema = z.object({
  xp: z.number().int().nonnegative(), level: z.number().int().positive(), nextLevelXp: z.number().int().positive(),
  reachCount: z.number().int().nonnegative(),
  activity: z.array(z.object({ kind: z.enum(["post", "comment", "like", "reach"]), points: z.number().int().positive().max(25), at: z.iso.datetime({ offset: true }) })).max(12),
});
export type GameProfile = z.infer<typeof gameProfileSchema>;
export function createGameProfileHandler(deps: {
  env: Record<string, string | undefined>;
  read(config: AuthConfig, signal: AbortSignal): Promise<{ verified: boolean; profile?: unknown }>;
}) {
  return async function GET() {
    const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store", Pragma: "no-cache" } });
    const config = readAuthConfig(deps.env);
    if (!config.configured || deps.env.FOOD_GO_COMMUNITY_ENABLED !== "true") return json({ status: "disabled" }, 503);
    try {
      return await runBounded(async signal => {
        const result = await deps.read(config, signal);
        if (!result.verified) return json({ status: "signed-out" }, 401);
        const parsed = gameProfileSchema.safeParse(result.profile);
        return parsed.success ? json({ status: "ready", ...parsed.data }) : json({ status: "unavailable" }, 503);
      }, 12000);
    } catch { return json({ status: "unavailable" }, 503); }
  };
}
