import { createAuthClient } from "@/lib/auth/server";
import { hasVerifiedIdentity } from "@/lib/auth/contracts";
import { createGameProfileHandler } from "@/lib/game-profile";

export const GET = createGameProfileHandler({
  env: process.env,
  async read(config, signal) {
    const client = await createAuthClient(config);
    const { data, error } = await client.auth.getUser();
    signal.throwIfAborted();
    if (error || !data.user || !hasVerifiedIdentity(data.user)) return { verified: false };
    const result = await client.rpc("food_go_game_profile").abortSignal(signal);
    if (result.error) throw new Error("Progress temporarily unavailable");
    return { verified: true, profile: result.data };
  },
});
