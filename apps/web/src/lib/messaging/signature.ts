import { createHmac, timingSafeEqual } from "node:crypto";

export const hookToleranceSeconds = 300;

/** Standard Webhooks v1: HMAC-SHA256 over ID.timestamp.raw-payload bytes. */
export function verifySmsHook(
  body: string,
  headers: Headers,
  signingKey: Buffer,
  now = Date.now(),
): string | null {
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signatures = headers.get("webhook-signature");
  if (
    !id ||
    !/^[A-Za-z0-9_-]{1,128}$/u.test(id) ||
    !timestamp ||
    !/^\d{1,12}$/u.test(timestamp) ||
    !signatures ||
    signatures.length > 2048
  )
    return null;
  const seconds = Number(timestamp);
  if (Math.abs(now / 1000 - seconds) > hookToleranceSeconds) return null;
  const expected = createHmac("sha256", signingKey)
    .update(`${id}.${timestamp}.${body}`, "utf8")
    .digest();
  for (const candidate of signatures.split(" ")) {
    const match = /^v1,([A-Za-z0-9+/]{43}=)$/u.exec(candidate);
    if (!match) continue;
    const actual = Buffer.from(match[1], "base64");
    if (
      actual.length === expected.length &&
      timingSafeEqual(actual, expected)
    )
      return id;
  }
  return null;
}
