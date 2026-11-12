import assert from "node:assert/strict";
import { test } from "node:test";
import { checkSupabase } from "./check-supabase.mjs";

// Synthetic fixtures only. This suite never loads a local environment file and
// every check receives a mocked fetch rather than the global network client.
const projectUrl = "https://abcdefghijklmnopqrst.supabase.co";
const publicKey = "sb_publishable_unit_test_not_a_project_key";
const fixtureEnv = {
  NODE_ENV: "production",
  FOOD_GO_AUTH_ENABLED: "false",
  FOOD_GO_AUTH_PRODUCTION_READY: "false",
  SUPABASE_URL: projectUrl,
  SUPABASE_PUBLISHABLE_KEY: publicKey,
  FOOD_GO_AUTH_COOKIE_SECRET: "unit-test-cookie-fixture".padEnd(43, "_"),
  APP_ORIGIN: "https://food-go.example",
};
const remoteCanary = "REMOTE_BODY_MUST_NEVER_REACH_THE_REPORT";
const validSettings = {
  external: { email: true },
  mailer_autoconfirm: false,
  disable_signup: false,
};
const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

function mockFetch(responses) {
  const calls = [];
  const fetchImpl = async (input, options = {}) => {
    const url = new URL(
      typeof input === "string" || input instanceof URL ? input : input.url,
    );
    calls.push({
      url,
      method:
        options.method ?? (input instanceof Request ? input.method : "GET"),
      redirect: options.redirect,
      signal: options.signal,
      headers: new Headers(
        options.headers ?? (input instanceof Request ? input.headers : {}),
      ),
    });
    const response = responses[calls.length - 1];
    if (response instanceof Error) throw response;
    if (!response) throw new Error("Unexpected mocked request");
    return response;
  };
  return { calls, fetchImpl };
}

function assertSanitized(report) {
  const output = JSON.stringify(report);
  for (const value of [
    remoteCanary,
    publicKey,
    fixtureEnv.FOOD_GO_AUTH_COOKIE_SECRET,
  ])
    assert.equal(output.includes(value), false);
  assert.equal(report.productionReady, false);
}

test("connection check uses only bounded catalogue reads and never account or write actions", async () => {
  const { calls, fetchImpl } = mockFetch([
    jsonResponse({ ...validSettings, extra: remoteCanary }),
    // Even if a provider unexpectedly returns rows for limit=0, no row data is emitted.
    jsonResponse([{ id: remoteCanary, contact: remoteCanary }]),
  ]);
  const report = await checkSupabase(fixtureEnv, fetchImpl);
  assert.equal(report.connection, "connected");
  assert.equal(report.authSettings, "readable");
  assert.equal(report.venueCatalogue, "readable");
  assert.equal(report.emailPasswordEnabled, true);
  assert.equal(report.emailConfirmationRequired, true);
  assert.equal(report.publicSignupEnabled, true);
  assert.equal(report.applicationAccountsEnabled, false);
  assert.equal(calls.length, 2);
  assert.deepEqual(
    calls.map(({ url }) => url.pathname),
    ["/auth/v1/settings", "/rest/v1/venues"],
  );
  for (const call of calls) {
    assert.equal(call.url.origin, projectUrl);
    assert.equal(call.method, "GET");
    assert.equal(call.redirect, "error");
    assert.equal(call.signal instanceof AbortSignal, true);
    assert.equal(call.headers.get("apikey"), publicKey);
  }
  assert.equal(calls[1].url.searchParams.get("select"), "id");
  assert.equal(calls[1].url.searchParams.get("limit"), "0");
  assertSanitized(report);
});

test("invalid configuration makes no network request", async () => {
  const { calls, fetchImpl } = mockFetch([]);
  const report = await checkSupabase(
    { ...fixtureEnv, SUPABASE_URL: "https://other.example" },
    fetchImpl,
  );
  assert.deepEqual(report, {
    connection: "invalid_configuration",
    productionReady: false,
  });
  assert.equal(calls.length, 0);
  assertSanitized(report);
});

test("rejected keys and provider HTTP failures emit categories without their response bodies", async () => {
  for (const [status, connection] of [
    [401, "key_rejected"],
    [403, "key_rejected"],
    [503, "provider_error"],
  ]) {
    const { calls, fetchImpl } = mockFetch([
      jsonResponse({ message: remoteCanary }, status),
    ]);
    const report = await checkSupabase(fixtureEnv, fetchImpl);
    assert.equal(report.connection, connection);
    assert.equal(report.authSettings, "unavailable");
    assert.equal(report.venueCatalogue, "not_checked");
    assert.equal(calls.length, 1);
    assertSanitized(report);
  }
});

test("malformed account settings cannot be reported as a readable connection", async () => {
  for (const response of [
    jsonResponse(null),
    jsonResponse([]),
    jsonResponse(remoteCanary),
    new Response(remoteCanary),
  ]) {
    const { calls, fetchImpl } = mockFetch([response]);
    const report = await checkSupabase(fixtureEnv, fetchImpl);
    assert.equal(report.connection, "provider_error");
    assert.equal(report.authSettings, "invalid_response");
    assert.equal(report.venueCatalogue, "not_checked");
    assert.equal(calls.length, 1);
    assertSanitized(report);
  }
});

test("unknown setting values stay unknown and cannot be copied into the output", async () => {
  const { fetchImpl } = mockFetch([
    jsonResponse({
      external: { email: remoteCanary },
      mailer_autoconfirm: remoteCanary,
      disable_signup: remoteCanary,
    }),
    jsonResponse([]),
  ]);
  const report = await checkSupabase(fixtureEnv, fetchImpl);
  assert.equal(report.emailPasswordEnabled, null);
  assert.equal(report.emailConfirmationRequired, null);
  assert.equal(report.publicSignupEnabled, null);
  assertSanitized(report);
});

test("catalogue error codes classify missing schema and denied access without raw error details", async () => {
  for (const [code, status, expected] of [
    ["PGRST205", 404, "schema_not_ready"],
    ["42P01", 400, "schema_not_ready"],
    ["42501", 400, "access_denied"],
    ["ANY", 401, "access_denied"],
    ["ANY", 403, "access_denied"],
    ["UNRECOGNISED", 500, "check_failed"],
  ]) {
    const { calls, fetchImpl } = mockFetch([
      jsonResponse(validSettings),
      jsonResponse(
        {
          code,
          message: remoteCanary,
          details: remoteCanary,
          hint: remoteCanary,
        },
        status,
      ),
    ]);
    const report = await checkSupabase(fixtureEnv, fetchImpl);
    assert.equal(report.connection, "connected");
    assert.equal(report.venueCatalogue, expected);
    assert.equal(calls.length, 2);
    assertSanitized(report);
  }
});

test("connection exceptions never reveal their message or request credentials", async () => {
  const { calls, fetchImpl } = mockFetch([
    new Error(`${remoteCanary} ${publicKey}`),
  ]);
  const report = await checkSupabase(fixtureEnv, fetchImpl);
  assert.equal(report.connection, "unreachable");
  assert.equal(report.venueCatalogue, "not_checked");
  assert.equal(calls.length, 1);
  assertSanitized(report);
});

test("catalogue exceptions preserve the readable settings result without leaking raw errors", async () => {
  const { fetchImpl } = mockFetch([
    jsonResponse(validSettings),
    new Error(`${remoteCanary} ${publicKey}`),
  ]);
  const report = await checkSupabase(fixtureEnv, fetchImpl);
  assert.equal(report.connection, "connected");
  assert.equal(report.authSettings, "readable");
  assert.equal(report.venueCatalogue, "check_failed");
  assertSanitized(report);
});
