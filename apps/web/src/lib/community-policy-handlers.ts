import { z } from "zod";
import { readAuthConfig, type AuthConfig } from "./auth/config";
import { isAllowedWriteOrigin } from "./request-guards";
import { runBounded } from "./community-handlers";
import { COMMUNITY_POLICY_VERSION, communityPolicyAcceptSchema, communityPolicyStatusSchema, type CommunityPolicyAcceptance } from "./community-policy";

export type CommunityPolicyProvider = {
  getUser(): Promise<{ identityConfirmed: boolean } | null>;
  status(): Promise<unknown>;
  accept(input: CommunityPolicyAcceptance): Promise<unknown>;
};
type Dependencies = {
  env: Record<string, string | undefined>;
  getProvider(config: AuthConfig, signal: AbortSignal): Promise<CommunityPolicyProvider>;
};
export class CommunityPolicyError extends Error {
  constructor(public readonly code: "identity" | "stale" | "invalid" | "unavailable") { super(code); }
}
export function policyJson(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store", Pragma: "no-cache" } });
}
function policyFailure(error?: unknown) {
  const code = error instanceof CommunityPolicyError ? error.code : "unavailable";
  if (code === "identity") return policyJson({ error: "Sign in with a verified account to review your acknowledgement." }, 403);
  if (code === "stale") return policyJson({ error: "The acknowledgement has changed. Reload and review the current version.", code: "acknowledgement_changed" }, 409);
  if (code === "invalid") return policyJson({ error: "Tick the acknowledgement box before continuing." }, 400);
  return policyJson({ error: "Your acknowledgement could not be confirmed. Please try again shortly." }, 503);
}
const acceptanceInput = z.strictObject({ version: z.string().min(1).max(80), accepted: z.literal(true) });
async function readAcceptance(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json")
    return { response: policyJson({ error: "Send a JSON request." }, 415) };
  const length = Number(request.headers.get("content-length") ?? 0);
  if (!Number.isSafeInteger(length) || length < 0 || length > 4096)
    return { response: policyJson({ error: "This request is too large." }, 413) };
  const reader = request.body?.getReader();
  if (!reader) return { response: policyFailure(new CommunityPolicyError("invalid")) };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("body deadline")), 5000); });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), timeout]);
      if (done) break;
      size += value.byteLength;
      if (size > 4096) { void reader.cancel().catch(() => {}); return { response: policyJson({ error: "This request is too large." }, 413) }; }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const parsed = acceptanceInput.safeParse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
    if (!parsed.success) return { response: policyFailure(new CommunityPolicyError("invalid")) };
    if (parsed.data.version !== COMMUNITY_POLICY_VERSION) return { response: policyFailure(new CommunityPolicyError("stale")) };
    return { data: communityPolicyAcceptSchema.parse(parsed.data) };
  } catch {
    void reader.cancel().catch(() => {});
    return { response: policyJson({ error: "We could not read that acknowledgement. Please try again." }, 400) };
  } finally {
    if (timer) clearTimeout(timer);
    try { reader.releaseLock(); } catch { /* A cancelled pending read releases asynchronously. */ }
  }
}
export function createCommunityPolicyHandlers(deps: Dependencies) {
  async function perform(input?: CommunityPolicyAcceptance) {
    const config = readAuthConfig(deps.env);
    if (!config.configured) return policyJson({ error: "Account services are unavailable. You can continue browsing." }, 503);
    try {
      return await runBounded(async signal => {
        const provider = await deps.getProvider(config, signal);
        signal.throwIfAborted();
        if (!(await provider.getUser())?.identityConfirmed)
          return policyJson({ error: "Sign in with a verified account to review your acknowledgement." }, 401);
        signal.throwIfAborted();
        const result = await (input ? provider.accept(input) : provider.status());
        signal.throwIfAborted();
        const parsed = communityPolicyStatusSchema.safeParse(result);
        if (!parsed.success || (input && parsed.data.acceptedAt === null)) throw new CommunityPolicyError("unavailable");
        return policyJson(parsed.data);
      }, 10000);
    } catch (error) { return policyFailure(error); }
  }
  return {
    async GET(request: Request) {
      if (new URL(request.url).search) return policyJson({ error: "Acknowledgement status has no query parameters." }, 400);
      return perform();
    },
    async POST(request: Request) {
      if (!isAllowedWriteOrigin(request.headers.get("origin"), deps.env.APP_ORIGIN, request.headers.get("sec-fetch-site")))
        return policyJson({ error: "This request did not come from Food Go." }, 403);
      if (new URL(request.url).search) return policyJson({ error: "Acknowledgement does not accept query parameters." }, 400);
      if (!readAuthConfig(deps.env).configured) return policyJson({ error: "Account services are unavailable. You can continue browsing." }, 503);
      const input = await readAcceptance(request);
      if (input.response) return input.response;
      return perform(input.data);
    },
  };
}
