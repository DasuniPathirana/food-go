export type AuthConfig = {
  configured: true;
  origin: string;
  supabaseUrl: string;
  publishableKey: string;
  cookieSecret: string;
  secureCookies: boolean;
};
export type DisabledAuthConfig = { configured: false };

function isLoopback(hostname: string) {
  return (
    hostname === "127.0.0.1" || hostname === "localhost" || hostname === "[::1]"
  );
}

function isPublicProjectKey(key: string) {
  if (/^sb_publishable_[A-Za-z0-9_-]{16,}$/u.test(key)) return true;
  // Legacy anonymous keys are accepted, but service-role JWTs are never accepted.
  try {
    const parts = key.split(".");
    if (parts.length !== 3) return false;
    const claims: unknown = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    );
    return (
      typeof claims === "object" &&
      claims !== null &&
      "role" in claims &&
      claims.role === "anon"
    );
  } catch {
    return false;
  }
}

/** Invalid or incomplete configuration disables identity without disclosing values. */
export function readAuthConfig(
  env: Record<string, string | undefined>,
): AuthConfig | DisabledAuthConfig {
  if (env.FOOD_GO_AUTH_ENABLED !== "true") return { configured: false };
  const production = env.NODE_ENV === "production";
  // An explicit release gate prevents staging setup from accidentally opening accounts.
  if (production && env.FOOD_GO_AUTH_PRODUCTION_READY !== "true")
    return { configured: false };
  const source = env.SUPABASE_URL;
  const key = env.SUPABASE_PUBLISHABLE_KEY;
  const secret = env.FOOD_GO_AUTH_COOKIE_SECRET;
  const appOrigin = env.APP_ORIGIN;
  if (
    !source ||
    !key ||
    !secret ||
    secret.length < 43 ||
    secret === key ||
    secret === source ||
    !appOrigin ||
    !isPublicProjectKey(key)
  )
    return { configured: false };
  try {
    const provider = new URL(source);
    const origin = new URL(appOrigin);
    const hostedProvider =
      provider.protocol === "https:" &&
      /^[a-z0-9]{20}\.supabase\.co$/u.test(provider.hostname) &&
      !provider.port;
    const localProvider =
      !production &&
      provider.protocol === "http:" &&
      isLoopback(provider.hostname);
    const validOrigin =
      (origin.protocol === "https:" ||
        (!production &&
          origin.protocol === "http:" &&
          isLoopback(origin.hostname))) &&
      origin.origin === appOrigin;
    if (
      (!hostedProvider && !localProvider) ||
      !validOrigin ||
      provider.username ||
      provider.password ||
      provider.search ||
      provider.hash ||
      (provider.pathname !== "/" && provider.pathname !== "")
    )
      return { configured: false };
    return {
      configured: true,
      origin: origin.origin,
      supabaseUrl: provider.origin,
      publishableKey: key,
      cookieSecret: secret,
      secureCookies: production || origin.protocol === "https:",
    };
  } catch {
    return { configured: false };
  }
}
