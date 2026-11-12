import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { readAuthConfig } from "../apps/web/src/lib/auth/config.ts";

/** Read-only connection check. Never signs in, sends email or changes records. */
export async function checkSupabase(env, fetchImpl = fetch) {
  // Inspect the connection without opening the application's account routes.
  const config = readAuthConfig({
    ...env,
    NODE_ENV: "development",
    FOOD_GO_AUTH_ENABLED: "true",
  });
  if (!config.configured)
    return { connection: "invalid_configuration", productionReady: false };

  const report = {
    checkedAt: new Date().toISOString(),
    projectHost: new URL(config.supabaseUrl).hostname,
    connection: "unreachable",
    authSettings: "not_checked",
    emailPasswordEnabled: null,
    emailConfirmationRequired: null,
    publicSignupEnabled: null,
    venueCatalogue: "not_checked",
    applicationAccountsEnabled: readAuthConfig(env).configured,
    productionReady: false,
  };
  const readOnlyFetch = (input, options = {}) => {
    const target = new URL(
      typeof input === "string" || input instanceof URL ? input : input.url,
    );
    const method = (
      options.method ?? (input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    if (
      target.origin !== config.supabaseUrl ||
      !["GET", "HEAD"].includes(method)
    )
      throw new Error(
        "Connection checks allow only reads to the configured project.",
      );
    return fetchImpl(input, {
      ...options,
      redirect: "error",
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(15000)])
        : AbortSignal.timeout(15000),
    });
  };

  try {
    const response = await readOnlyFetch(
      `${config.supabaseUrl}/auth/v1/settings`,
      {
        headers: { apikey: config.publishableKey, Accept: "application/json" },
      },
    );
    if (!response.ok) {
      report.connection = [401, 403].includes(response.status)
        ? "key_rejected"
        : "provider_error";
      report.authSettings = "unavailable";
      return report;
    }
    let settings;
    try {
      settings = await response.json();
      if (
        settings === null ||
        typeof settings !== "object" ||
        Array.isArray(settings)
      )
        throw new Error("Invalid settings response.");
    } catch {
      report.connection = "provider_error";
      report.authSettings = "invalid_response";
      return report;
    }
    report.connection = "connected";
    report.authSettings = "readable";
    report.emailPasswordEnabled =
      typeof settings.external?.email === "boolean"
        ? settings.external.email
        : null;
    report.emailConfirmationRequired =
      typeof settings.mailer_autoconfirm === "boolean"
        ? !settings.mailer_autoconfirm
        : null;
    report.publicSignupEnabled =
      typeof settings.disable_signup === "boolean"
        ? !settings.disable_signup
        : null;

    const client = createClient(config.supabaseUrl, config.publishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: { fetch: readOnlyFetch },
    });
    // A zero-row request checks the SDK path without retrieving venue records.
    const { error, status } = await client.from("venues").select("id").limit(0);
    if (!error) report.venueCatalogue = "readable";
    else if (error.code === "PGRST205" || error.code === "42P01")
      report.venueCatalogue = "schema_not_ready";
    else if (status === 401 || status === 403 || error.code === "42501")
      report.venueCatalogue = "access_denied";
    else report.venueCatalogue = "check_failed";
  } catch {
    // Never print raw SDK/provider errors, request headers or environment values.
    if (report.connection === "connected")
      report.venueCatalogue = "check_failed";
  }
  return report;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const localEnv = fileURLToPath(
    new URL("../apps/web/.env.local", import.meta.url),
  );
  if (existsSync(localEnv)) process.loadEnvFile(localEnv);
  const report = await checkSupabase(process.env);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.connection !== "connected" || report.venueCatalogue !== "readable")
    process.exitCode = 1;
}
