import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createAuthClient } from "./auth/server";
import { hasVerifiedIdentity } from "./auth/contracts";
import { readAuthConfig } from "./auth/config";
import { communityFeedSchema, type CommunityFeed, type CommunityQuery } from "./community";
import { CommunityProviderError, createCommunityHandlers, emptyCommunity, readCommunityConfig, runBounded, type CommunityProvider, type CommunityReadConfig } from "./community-handlers";
import type { AuthConfig } from "./auth/config";

async function getProvider(config: CommunityReadConfig, authConfig?: AuthConfig, signal?: AbortSignal): Promise<CommunityProvider> {
  const anonymous = createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000), cache: "no-store" }) },
  });
  const authenticated = authConfig ? await createAuthClient(authConfig) : null;
  const user = authenticated ? await authenticated.auth.getUser().then(({ data, error }) => !error && data.user && hasVerifiedIdentity(data.user) ? { identityConfirmed: true } : null).catch(() => null) : null;
  signal?.throwIfAborted();
  // Invalid or unverified cookies never reach the read RPC. Public reads use a stateless client.
  const client = user && authenticated ? authenticated : anonymous;
  return {
    async getUser() { return user; },
    async feed(query) {
      const { data, error } = await client.rpc("food_go_community_feed_v2", {
        p_wall: query.wall, p_post: query.post || null, p_cursor: query.cursor || null, p_comments_cursor: query.commentsCursor || null,
      }).abortSignal(signal || AbortSignal.timeout(10000));
      if (error) throw new CommunityProviderError(error.code === "22023" ? "invalid" : error.code === "42501" ? "identity" : "unavailable");
      return data;
    },
    async write(action) {
      if (!user || !authenticated) throw new CommunityProviderError("identity");
      const { data, error } = await authenticated.rpc(action.action === "view" ? "food_go_record_post_view" : "food_go_community_write", action.action === "view" ? { p_post: action.postId } : { p_action: action }).abortSignal(signal || AbortSignal.timeout(10000));
      if (error) {
        const codes = { FC002: "limit", FC003: "retry", FC004: "missing", "42501": "identity", "22023": "invalid", "23514": "invalid" } as const;
        throw new CommunityProviderError(codes[error.code as keyof typeof codes] ?? "unavailable");
      }
      return data;
    },
  };
}
const handlers = createCommunityHandlers({ env: process.env, getProvider });
export const GET = handlers.GET;
export const POST = handlers.POST;

/** Server component read with the same runtime validation and safe disabled state as the API. */
export async function getCommunityFeed(query: CommunityQuery = { wall: "public" }): Promise<CommunityFeed> {
  const config = readCommunityConfig(process.env);
  if (!config) return emptyCommunity("disabled");
  try {
    return await runBounded(async signal => {
      const auth = readAuthConfig(process.env);
      const provider = await getProvider(config, auth.configured ? auth : undefined, signal);
      const result = communityFeedSchema.safeParse(await provider.feed(query));
      return result.success && result.data.status === "ready" ? result.data : emptyCommunity("unavailable");
    }, 14000);
  } catch { return emptyCommunity("unavailable"); }
}
