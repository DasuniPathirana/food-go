import { z } from "zod";
import { venueDraftSchema, type VenueDraft } from "@food-go/domain";
import type { AuthConfig } from "../auth/config";
import { isAllowedWriteOrigin } from "../request-guards";
import { partnerError, readPartnerConfig, type PartnerVenue } from "./contracts";

export type PartnerProvider = {
  getUser(): Promise<{ id: string; identityConfirmed: boolean } | null>;
  listVenues(userId: string): Promise<PartnerVenue[]>;
  createDraft(draft: VenueDraft, requestId: string): Promise<PartnerVenue>;
};
type Dependencies = {
  env: Record<string, string | undefined>;
  getProvider(config: AuthConfig): Promise<PartnerProvider>;
};
export function partnerJson(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store", Pragma: "no-cache" } });
}
function unavailable() {
  return partnerJson({ error: "Venue services are not enabled yet. You can still preview a venue draft." }, 503);
}

async function readBody(request: Request) {
  const type = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (type !== "application/json") return { response: partnerJson({ error: "Send a JSON request." }, 415) };
  const length = Number(request.headers.get("content-length") ?? 0);
  if (!Number.isSafeInteger(length) || length < 0 || length > 16384)
    return { response: partnerJson({ error: "This request is too large." }, 413) };
  const reader = request.body?.getReader();
  if (!reader) return { response: partnerJson({ error: "Enter the venue details." }, 400) };
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16384) {
        await reader.cancel();
        return { response: partnerJson({ error: "This request is too large." }, 413) };
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const parsed = venueDraftSchema.safeParse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
    if (!parsed.success) return { response: partnerJson({
      error: "Check the highlighted venue details.",
      fields: Object.fromEntries(parsed.error.issues.filter(issue => typeof issue.path[0] === "string")
        .map(issue => [String(issue.path[0]), issue.message])),
    }, 400) };
    return { data: parsed.data };
  } catch {
    return { response: partnerJson({ error: "We could not read that request." }, 400) };
  } finally { reader.releaseLock(); }
}

export function createPartnerHandlers(deps: Dependencies) {
  return {
    async GET() {
      const config = readPartnerConfig(deps.env);
      if (!config.configured) return unavailable();
      try {
        const provider = await deps.getProvider(config);
        const user = await provider.getUser();
        if (!user?.identityConfirmed) return partnerJson({ error: "Sign in with a verified account to manage venues." }, 401);
        return partnerJson({ data: await provider.listVenues(user.id) });
      } catch (error) {
        const failure = partnerError(error);
        return partnerJson({ error: failure.error }, failure.status);
      }
    },
    async POST(request: Request) {
      if (!isAllowedWriteOrigin(request.headers.get("origin"), deps.env.APP_ORIGIN, request.headers.get("sec-fetch-site")))
        return partnerJson({ error: "This request did not come from Food Go." }, 403);
      const config = readPartnerConfig(deps.env);
      if (!config.configured) return unavailable();
      const id = z.uuid().safeParse(request.headers.get("idempotency-key"));
      if (!id.success) return partnerJson({ error: "Start a new venue submission and try again." }, 400);
      const body = await readBody(request);
      if (body.response) return body.response;
      try {
        const provider = await deps.getProvider(config);
        const user = await provider.getUser();
        if (!user?.identityConfirmed) return partnerJson({ error: "Sign in with a verified account to save a venue." }, 401);
        return partnerJson({ data: await provider.createDraft(body.data, id.data) }, 201);
      } catch (error) {
        const failure = partnerError(error);
        return partnerJson({ error: failure.error }, failure.status);
      }
    },
  };
}
