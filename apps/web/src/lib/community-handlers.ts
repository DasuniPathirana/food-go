import { communityFeedSchema, communityWriteResultSchema, communityWriteSchema, parseCommunityQuery, type CommunityFeed, type CommunityQuery, type CommunityWrite } from "./community";
import { readAuthConfig, type AuthConfig } from "./auth/config";
import { readCatalogueConfig } from "./catalogue";
import { isAllowedWriteOrigin } from "./request-guards";

export type CommunityReadConfig = { url: string; key: string };
export type CommunityProvider = {
  getUser(): Promise<{ identityConfirmed: boolean } | null>;
  feed(query: CommunityQuery): Promise<unknown>;
  write(action: CommunityWrite): Promise<unknown>;
};
type Dependencies = {
  env: Record<string, string | undefined>;
  getProvider(config: CommunityReadConfig, authConfig?: AuthConfig, signal?: AbortSignal): Promise<CommunityProvider>;
};
export const emptyCommunity = (status: CommunityFeed["status"]): CommunityFeed => ({ status, posts: [], viewer: null, nextCursor: null });
export function readCommunityConfig(env: Record<string, string | undefined>): CommunityReadConfig | null {
  if (env.FOOD_GO_COMMUNITY_ENABLED !== "true") return null;
  const config = readCatalogueConfig({ ...env, FOOD_GO_CATALOGUE_MODE: "supabase" });
  return config.mode === "supabase" && config.configured ? { url: config.url, key: config.key } : null;
}
export function communityJson(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store", Pragma: "no-cache" } });
}
export class CommunityProviderError extends Error {
  constructor(public readonly code: "invalid" | "identity" | "limit" | "retry" | "missing" | "unavailable") { super(code); }
}
function failure(error: unknown) {
  const code = error instanceof CommunityProviderError ? error.code : "unavailable";
  const responses = {
    invalid: [400, "Check the post or comment details."], identity: [401, "Sign in with a verified account to take part."],
    limit: [429, "You have reached today's posting limit. Try again tomorrow."],
    retry: [409, "That submission key belongs to different text. Start a new submission."],
    missing: [404, "That post or profile is not available."], unavailable: [503, "The community is temporarily unavailable. Try again shortly."],
  } as const;
  return { status: responses[code][0], error: responses[code][1] };
}
export async function runBounded<T>(operation: (signal: AbortSignal) => Promise<T>, milliseconds: number): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<never>((_, reject) => { timer = setTimeout(() => {
    controller.abort(); reject(new CommunityProviderError("unavailable"));
  }, milliseconds); });
  try { return await Promise.race([operation(controller.signal), limit]); }
  finally { if (timer) clearTimeout(timer); }
}
async function readBody(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json")
    return { response: communityJson({ error: "Send a JSON request." }, 415) };
  const length = Number(request.headers.get("content-length") ?? 0);
  if (!Number.isSafeInteger(length) || length < 0 || length > 16384)
    return { response: communityJson({ error: "This request is too large." }, 413) };
  const reader = request.body?.getReader();
  if (!reader) return { response: communityJson({ error: "Enter your post or comment." }, 400) };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("body deadline")), 5000); });
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), timeout]);
      if (done) break;
      size += value.byteLength;
      if (size > 16384) { void reader.cancel().catch(() => {}); return { response: communityJson({ error: "This request is too large." }, 413) }; }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const parsed = communityWriteSchema.safeParse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
    if (!parsed.success) return { response: communityJson({ error: "Check your post or comment. Keep text within the displayed limit." }, 400) };
    return { data: parsed.data };
  } catch {
    void reader.cancel().catch(() => {});
    return { response: communityJson({ error: "We could not read that request. Try again." }, 400) };
  } finally {
    if (timer) clearTimeout(timer);
    try { reader.releaseLock(); } catch { /* Cancellation releases pending reads asynchronously. */ }
  }
}
export function createCommunityHandlers(deps: Dependencies) {
  return {
    async GET(request: Request) {
      const query = parseCommunityQuery(new URL(request.url));
      if (!query) return communityJson({ ...emptyCommunity("unavailable"), error: "Choose a valid feed or wall." }, 400);
      const config = readCommunityConfig(deps.env);
      if (!config) return communityJson(emptyCommunity("disabled"));
      try {
        return await runBounded(async signal => {
          const auth = readAuthConfig(deps.env);
          const provider = await deps.getProvider(config, auth.configured ? auth : undefined, signal);
          signal.throwIfAborted();
          if (query.wall === "me" && !(await provider.getUser())?.identityConfirmed)
            return communityJson({ ...emptyCommunity("ready"), error: "Sign in to open your wall." }, 401);
          signal.throwIfAborted();
          const parsed = communityFeedSchema.safeParse(await provider.feed(query));
          if (!parsed.success || parsed.data.status !== "ready") throw new CommunityProviderError("unavailable");
          return communityJson(parsed.data);
        }, 14000);
      } catch (error) {
        const result = failure(error);
        return communityJson({ ...emptyCommunity("unavailable"), error: result.error }, result.status);
      }
    },
    async POST(request: Request) {
      if (!isAllowedWriteOrigin(request.headers.get("origin"), deps.env.APP_ORIGIN, request.headers.get("sec-fetch-site")))
        return communityJson({ error: "This request did not come from Food Go." }, 403);
      const config = readCommunityConfig(deps.env);
      const auth = readAuthConfig(deps.env);
      if (!config || !auth.configured) return communityJson({ error: "Community posting is not enabled yet. You can still browse or try the separate example feed." }, 503);
      const body = await readBody(request);
      if (body.response) return body.response;
      try {
        return await runBounded(async signal => {
          const provider = await deps.getProvider(config, auth, signal);
          signal.throwIfAborted();
          if (!(await provider.getUser())?.identityConfirmed) return communityJson({ error: "Sign in with a verified account to take part." }, 401);
          signal.throwIfAborted();
          const result = communityWriteResultSchema.safeParse(await provider.write(body.data));
          if (!result.success || (["create", "comment"].includes(body.data.action) && (!result.data.id || !result.data.status)))
            throw new CommunityProviderError("unavailable");
          return communityJson(result.data, ["create", "comment"].includes(body.data.action) ? 202 : 200);
        }, 9000);
      } catch (error) {
        const result = failure(error);
        return communityJson({ error: result.error }, result.status);
      }
    },
  };
}
