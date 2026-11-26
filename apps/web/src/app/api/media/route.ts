import { z } from "zod";
import { authJson } from "@/lib/auth/http";
import { readAuthConfig } from "@/lib/auth/config";
import { isAllowedWriteOrigin } from "@/lib/request-guards";
import { journeyClient, journeyFailure } from "@/lib/journey-server";

const uploadSchema = z.strictObject({
  scope: z.enum(["community", "venue", "dish", "promotion"]),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  base64: z.string().min(32).max(1400000),
});

const MAX_UPLOAD_BYTES = 1_500_000;

export async function POST(request: Request) {
  if (!isAllowedWriteOrigin(request.headers.get("origin"), process.env.APP_ORIGIN, request.headers.get("sec-fetch-site"))) {
    return authJson({ error: "This request did not come from Food Go." }, 403);
  }
  if (!readAuthConfig(process.env).configured) {
    return authJson({ error: "Account services are unavailable." }, 503);
  }
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    return authJson({ error: "Send a JSON request." }, 415);
  }
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (!Number.isFinite(declaredLength) || declaredLength < 0 || declaredLength > MAX_UPLOAD_BYTES) {
    return authJson({ error: "Image payload exceeds 1.5 MB limit." }, 413);
  }
  const reader = request.body?.getReader();
  if (!reader) return authJson({ error: "Select an image to upload." }, 400);

  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_UPLOAD_BYTES) {
        void reader.cancel().catch(() => {});
        return authJson({ error: "Image payload exceeds 1.5 MB limit." }, 413);
      }
      parts.push(value);
    }
    const buffer = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) {
      buffer.set(part, offset);
      offset += part.byteLength;
    }
    const parsed = uploadSchema.safeParse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer)));
    if (!parsed.success) {
      return authJson({ error: "Use a JPEG, PNG or WebP image under 950 KB." }, 400);
    }
    const session = await journeyClient();
    if (session.response) return session.response;
    const { data, error } = await session.client
      .rpc("food_go_upload_media", {
        p_scope: parsed.data.scope,
        p_content_type: parsed.data.contentType,
        p_base64: parsed.data.base64,
      })
      .abortSignal(AbortSignal.timeout(12000));
    if (error) return journeyFailure(error.code);
    return authJson(data, 201);
  } catch {
    return journeyFailure();
  } finally {
    try { reader.releaseLock(); } catch {}
  }
}
