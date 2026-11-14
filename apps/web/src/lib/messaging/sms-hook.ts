import { createHash } from "node:crypto";
import { readSmsConfig } from "./config";
import { verifySmsHook } from "./signature";
import { australianMobile } from "../phone-number";
export { australianMobile } from "../phone-number";

const providerUrl = "https://api.mobilemessage.com.au/v1/messages";
const maximumBodyBytes = 32768;
const providerTimeoutMs = 3000;

function errorResponse(status: number, message: string) {
  return Response.json(
    { error: { http_code: status, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

class BodyReadError extends Error {
  constructor(public status: number) {
    super("Request body could not be read.");
  }
}

/** Count actual streamed bytes, including when content-length is absent or false. */
async function boundedText(
  body: ReadableStream<Uint8Array> | null,
  maximum: number,
  timeoutMs: number,
): Promise<string> {
  if (!body) throw new BodyReadError(400);
  const reader = body.getReader();
  const parts: Uint8Array[] = [];
  let length = 0;
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    void reader.cancel().catch(() => {});
  }, timeoutMs);
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (timedOut) throw new BodyReadError(408);
      if (done) break;
      length += value.byteLength;
      if (length > maximum) {
        void reader.cancel().catch(() => {});
        throw new BodyReadError(413);
      }
      parts.push(value);
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(
      Buffer.concat(parts, length),
    );
  } finally {
    clearTimeout(timeout);
    reader.releaseLock();
  }
}

function smsPayload(body: string): { phone: string; otp: string } | null {
  try {
    const value: unknown = JSON.parse(body);
    if (!value || typeof value !== "object") return null;
    const { user, sms } = value as Record<string, unknown>;
    if (!user || typeof user !== "object" || !sms || typeof sms !== "object")
      return null;
    const phone = australianMobile((user as Record<string, unknown>).phone);
    const otp = (sms as Record<string, unknown>).otp;
    if (!phone || typeof otp !== "string" || !/^\d{6,10}$/u.test(otp))
      return null;
    return { phone, otp };
  } catch {
    return null;
  }
}

type HookDependencies = {
  env: Record<string, string | undefined>;
  fetch?: typeof fetch;
  now?: () => number;
};

/** Only the server webhook route uses this handler; all test sends use fake fetch. */
export async function handleSmsHook(request: Request, dependencies: HookDependencies) {
  const config = readSmsConfig(dependencies.env);
  if (!config) return errorResponse(503, "SMS delivery is not connected.");
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json")
    return errorResponse(415, "A JSON request is required.");
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (!Number.isFinite(declaredLength) || declaredLength < 0 || declaredLength > maximumBodyBytes)
    return errorResponse(413, "This request is too large.");

  let body: string;
  try {
    body = await boundedText(request.body, maximumBodyBytes, 1000);
  } catch (error) {
    return errorResponse(error instanceof BodyReadError ? error.status : 400, "This request could not be read.");
  }
  const eventId = verifySmsHook(body, request.headers, config.signingKey, dependencies.now?.());
  if (!eventId) return errorResponse(401, "The webhook signature could not be verified.");
  const payload = smsPayload(body);
  if (!payload) return errorResponse(400, "The SMS request is not supported.");

  // The signed event ID remains stable across delivery retries. The provider
  // deduplicates this key for 24 hours, including concurrent and timeout retries.
  const idempotencyKey = `food-go-sms-${createHash("sha256").update(eventId).digest("hex")}`;
  const providerBody = JSON.stringify({
    messages: [{
      to: payload.phone,
      message: `Your Food Go verification code is ${payload.otp}. Do not share this code.`,
      sender: config.sender,
      custom_ref: idempotencyKey,
    }],
    max_parts: 1,
    enable_unicode: false,
    ignore_unsubscribes: false,
    shorten_urls: false,
  });
  try {
    const result = await (dependencies.fetch ?? fetch)(providerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${config.username}:${config.password}`).toString("base64")}`,
        "Idempotency-Key": idempotencyKey,
      },
      body: providerBody,
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(providerTimeoutMs),
    });
    if (!result.ok) {
      void result.body?.cancel().catch(() => {});
      return errorResponse(503, "SMS delivery is temporarily unavailable.");
    }
    const resultText = await boundedText(result.body, maximumBodyBytes, providerTimeoutMs);
    const data: unknown = JSON.parse(resultText);
    const results = data && typeof data === "object" && "results" in data ? data.results : null;
    if (
      !data || typeof data !== "object" || !("status" in data) || data.status !== "complete" ||
      !Array.isArray(results) || results.length !== 1 ||
      !results[0] || typeof results[0] !== "object" ||
      results[0].status !== "success" || typeof results[0].message_id !== "string" ||
      !/^[0-9a-f-]{36}$/iu.test(results[0].message_id) ||
      results[0].to !== payload.phone
    )
      return errorResponse(503, "SMS delivery is temporarily unavailable.");
    // Supabase's Send SMS Hook contract takes an empty HTTP 200 as success.
    return new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch {
    // Neither provider bodies nor exceptions (which may contain OTPs) are logged.
    return errorResponse(503, "SMS delivery is temporarily unavailable.");
  }
}
