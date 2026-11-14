import "server-only";
import type { ZodType } from "zod";
import { isAllowedWriteOrigin } from "../request-guards";
import { readAuthConfig, type AuthConfig } from "./config";

export function authJson(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store", Pragma: "no-cache" },
  });
}

export type AuthRequest<T> =
  | { ok: true; config: AuthConfig; data: T }
  | { ok: false; response: Response };
export async function readAuthRequest<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<AuthRequest<T>> {
  if (
    !isAllowedWriteOrigin(
      request.headers.get("origin"),
      process.env.APP_ORIGIN,
      request.headers.get("sec-fetch-site"),
    )
  )
    return {
      ok: false,
      response: authJson(
        { error: "This request did not come from Food Go." },
        403,
      ),
    };
  const config = readAuthConfig(process.env);
  if (!config.configured)
    return {
      ok: false,
      response: authJson(
        {
          error:
            "Account services are not connected yet. You can continue browsing without an account.",
        },
        503,
      ),
    };
  const contentType = request.headers.get("content-type")?.split(";")[0].trim();
  if (contentType !== "application/json")
    return {
      ok: false,
      response: authJson({ error: "Send a JSON request." }, 415),
    };
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (
    !Number.isFinite(contentLength) ||
    contentLength < 0 ||
    contentLength > 4096
  )
    return {
      ok: false,
      response: authJson({ error: "This request is too large." }, 413),
    };
  const reader = request.body?.getReader();
  if (!reader)
    return {
      ok: false,
      response: authJson({ error: "Enter the required details." }, 400),
    };
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) {
        await reader.cancel();
        return {
          ok: false,
          response: authJson({ error: "This request is too large." }, 413),
        };
      }
      parts.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) {
      bytes.set(part, offset);
      offset += part.length;
    }
    const result = schema.safeParse(
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
    );
    if (!result.success)
      return {
        ok: false,
        response: authJson(
          {
            error: "Check the details you entered.",
            fields: Object.fromEntries(
              result.error.issues
                .filter((issue) => typeof issue.path[0] === "string")
                .map((issue) => [String(issue.path[0]), issue.message]),
            ),
          },
          400,
        ),
      };
    return { ok: true, config, data: result.data };
  } catch {
    return {
      ok: false,
      response: authJson({ error: "We could not read that request." }, 400),
    };
  } finally {
    reader.releaseLock();
  }
}
