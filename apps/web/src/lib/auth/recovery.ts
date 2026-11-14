import { createHmac, timingSafeEqual } from "node:crypto";

export const recoveryCookieName = "food-go-recovery";
const recoveryLifetimeSeconds = 10 * 60;
export const recoveryCookieLifetime = recoveryLifetimeSeconds;

export function createRecoveryPermission(
  userId: string,
  secret: string,
  now = Date.now(),
) {
  const payload = Buffer.from(
    JSON.stringify({ userId, expiresAt: now + recoveryLifetimeSeconds * 1000 }),
  ).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

export function canResetPassword(
  value: string | undefined,
  userId: string,
  secret: string,
  now = Date.now(),
) {
  if (!value || value.length > 1024) return false;
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra) return false;
  const expected = createHmac("sha256", secret).update(payload).digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(signature, "base64url");
  } catch {
    return false;
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return false;
  try {
    const data: unknown = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    return (
      typeof data === "object" &&
      data !== null &&
      "userId" in data &&
      "expiresAt" in data &&
      data.userId === userId &&
      typeof data.expiresAt === "number" &&
      Number.isFinite(data.expiresAt) &&
      data.expiresAt > now &&
      data.expiresAt <= now + recoveryLifetimeSeconds * 1000
    );
  } catch {
    return false;
  }
}
