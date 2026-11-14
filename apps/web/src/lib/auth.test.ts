import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { readAuthConfig } from "./auth/config";
import {
  safeAuthDestination,
  registerSchema,
  signInSchema,
  publicAuthError,
} from "./auth/contracts";
import { createRecoveryPermission, canResetPassword } from "./auth/recovery";

const staging = {
  FOOD_GO_AUTH_ENABLED: "true",
  NODE_ENV: "development" as const,
  APP_ORIGIN: "http://127.0.0.1:3000",
  SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abcdefghijklmnopqrst",
  FOOD_GO_AUTH_COOKIE_SECRET: "A".repeat(43),
};
test("identity configuration fails closed and refuses privileged or unexpected endpoints", () => {
  assert.equal(readAuthConfig({}).configured, false);
  assert.equal(readAuthConfig(staging).configured, true);
  assert.equal(
    readAuthConfig({ ...staging, FOOD_GO_AUTH_ENABLED: "false" }).configured,
    false,
  );
  assert.equal(
    readAuthConfig({
      ...staging,
      SUPABASE_PUBLISHABLE_KEY: "sb_secret_not-a-client-key",
    }).configured,
    false,
  );
  assert.equal(
    readAuthConfig({ ...staging, SUPABASE_URL: "https://attacker.example" })
      .configured,
    false,
  );
  assert.equal(
    readAuthConfig({ ...staging, APP_ORIGIN: "http://attacker.example" })
      .configured,
    false,
  );
  assert.equal(
    readAuthConfig({ ...staging, FOOD_GO_AUTH_COOKIE_SECRET: "short" })
      .configured,
    false,
  );
  assert.equal(
    readAuthConfig({ ...staging, NODE_ENV: "production" }).configured,
    false,
  );
  assert.equal(
    readAuthConfig({
      ...staging,
      NODE_ENV: "production",
      FOOD_GO_AUTH_PRODUCTION_READY: "true",
      APP_ORIGIN: "https://foodgo.example",
    }).configured,
    true,
  );
});

test("identity configuration rejects ambiguous provider URLs and exact-origin mistakes", () => {
  for (const supabaseUrl of [
    "http://abcdefghijklmnopqrst.supabase.co",
    "https://abcdefghijklmnopqrst.supabase.co:8443",
    "https://abcdefghijklmnopqrst.supabase.co.attacker.example",
    "https://name:password@abcdefghijklmnopqrst.supabase.co",
    "https://abcdefghijklmnopqrst.supabase.co/auth/v1",
    "https://abcdefghijklmnopqrst.supabase.co?next=example",
    "https://abcdefghijklmnopqrst.supabase.co#settings",
    "file:///etc/passwd",
  ]) {
    assert.equal(
      readAuthConfig({ ...staging, SUPABASE_URL: supabaseUrl }).configured,
      false,
      supabaseUrl,
    );
  }
  for (const origin of [
    "http://127.0.0.1:3000/",
    "http://127.0.0.1:3000/auth",
    "http://127.0.0.1:3000?next=example",
    "https://name:password@foodgo.example",
  ]) {
    assert.equal(
      readAuthConfig({ ...staging, APP_ORIGIN: origin }).configured,
      false,
      origin,
    );
  }
});

test("private loopback testing cannot enable an HTTP production provider", () => {
  const local = {
    ...staging,
    SUPABASE_URL: "http://127.0.0.1:54321",
  };
  const development = readAuthConfig(local);
  assert.equal(development.configured, true);
  if (development.configured) assert.equal(development.secureCookies, false);
  assert.equal(
    readAuthConfig({
      ...local,
      NODE_ENV: "production",
      FOOD_GO_AUTH_PRODUCTION_READY: "true",
      APP_ORIGIN: "https://foodgo.example",
    }).configured,
    false,
  );
  const hosted = readAuthConfig({
    ...staging,
    NODE_ENV: "production",
    FOOD_GO_AUTH_PRODUCTION_READY: "true",
    APP_ORIGIN: "https://foodgo.example",
  });
  assert.equal(hosted.configured, true);
  if (hosted.configured) assert.equal(hosted.secureCookies, true);
});

test("connected auth request guards reject untrusted and oversized streamed writes", () => {
  // Exercise the server-only module under its supported React server condition.
  // Fake provider settings allow request validation without making provider calls.
  const result = spawnSync(
    process.execPath,
    [
      "--conditions=react-server",
      "--import=tsx",
      "--input-type=module",
      "--eval",
      `
        import assert from "node:assert/strict";
        import { readAuthRequest } from ${JSON.stringify(new URL("./auth/http.ts", import.meta.url).href)};
        import { signInSchema } from ${JSON.stringify(new URL("./auth/contracts.ts", import.meta.url).href)};
        const validBody = JSON.stringify({ email: " sam@example.com ", password: " keep these spaces " });
        const makeRequest = (body = validBody, headers = {}) => new Request("http://127.0.0.1:3000/api/auth/sign-in", {
          method: "POST",
          headers: { origin: "http://127.0.0.1:3000", "content-type": "application/json", ...headers },
          body,
          duplex: "half",
        });
        async function rejected(request, status) {
          const result = await readAuthRequest(request, signInSchema);
          assert.equal(result.ok, false);
          assert.equal(result.response.status, status);
          assert.equal(result.response.headers.get("cache-control"), "no-store");
        }
        await rejected(makeRequest(validBody, { origin: "https://attacker.example" }), 403);
        await rejected(makeRequest(validBody, { "sec-fetch-site": "cross-site" }), 403);
        await rejected(makeRequest(validBody, { "content-type": "text/plain" }), 415);
        await rejected(makeRequest(validBody, { "content-length": "4097" }), 413);
        await rejected(makeRequest("{invalid-json"), 400);
        await rejected(makeRequest(new Uint8Array([255])), 400);
        await rejected(makeRequest(JSON.stringify({ email: "sam@example.com", password: "some password", role: "admin" })), 400);
        let cancelled = false;
        const oversized = new ReadableStream({
          start(controller) { controller.enqueue(new Uint8Array(4097)); },
          cancel() { cancelled = true; },
        });
        await rejected(makeRequest(oversized, { "content-length": "1" }), 413);
        assert.equal(cancelled, true);
        const accepted = await readAuthRequest(makeRequest(), signInSchema);
        assert.equal(accepted.ok, true);
        assert.equal(accepted.data.email, "sam@example.com");
        assert.equal(accepted.data.password, " keep these spaces ");
      `,
    ],
    {
      cwd: process.cwd(),
      env: {
        SystemRoot: process.env.SystemRoot,
        TEMP: process.env.TEMP,
        // Next resolves this marker to its bundled copy in application builds.
        NODE_PATH: join(
          dirname(createRequire(import.meta.url).resolve("next/package.json")),
          "dist",
          "compiled",
        ),
        ...staging,
      },
      encoding: "utf8",
      timeout: 20000,
    },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
});
test("callbacks only redirect to explicitly supported local destinations", () => {
  for (const value of [
    "https://attacker.example",
    "//attacker.example",
    "/\\attacker.example",
    "/profile?next=https://attacker.example",
    "/%2f%2fattacker.example",
    "javascript:alert(1)",
    undefined,
  ])
    assert.equal(safeAuthDestination(value), "/profile");
  assert.equal(
    safeAuthDestination("/partner/onboarding"),
    "/partner/onboarding",
  );
  assert.equal(
    safeAuthDestination("/auth/reset-password"),
    "/auth/reset-password",
  );
});
test("account input cannot assign roles and password whitespace is preserved", () => {
  const valid = {
    displayName: "  Sam Lee  ",
    email: " SAM@EXAMPLE.COM ",
    password: "a quiet Sunday morning",
  };
  assert.equal(registerSchema.parse(valid).displayName, "Sam Lee");
  assert.equal(registerSchema.parse(valid).email, "sam@example.com");
  assert.equal(
    registerSchema.safeParse({ ...valid, role: "admin" }).success,
    false,
  );
  assert.equal(
    registerSchema.safeParse({ ...valid, password: "short" }).success,
    false,
  );
  assert.equal(
    registerSchema.safeParse({ ...valid, password: "界".repeat(25) }).success,
    false,
  );
  assert.equal(
    registerSchema.safeParse({
      ...valid,
      password: String.fromCodePoint(0x1f331).repeat(6),
    }).success,
    false,
  );
  assert.equal(
    signInSchema.parse({ email: valid.email, password: " keep these spaces " })
      .password,
    " keep these spaces ",
  );
});
test("password recovery permission is signed, short-lived and bound to one user", () => {
  const now = 1700000000000;
  const token = createRecoveryPermission(
    "user-a",
    staging.FOOD_GO_AUTH_COOKIE_SECRET,
    now,
  );
  assert.equal(
    canResetPassword(token, "user-a", staging.FOOD_GO_AUTH_COOKIE_SECRET, now),
    true,
  );
  assert.equal(
    canResetPassword(token, "user-b", staging.FOOD_GO_AUTH_COOKIE_SECRET, now),
    false,
  );
  assert.equal(
    canResetPassword(token, "user-a", "different-secret", now),
    false,
  );
  assert.equal(
    canResetPassword(
      `${token}changed`,
      "user-a",
      staging.FOOD_GO_AUTH_COOKIE_SECRET,
      now,
    ),
    false,
  );
  assert.equal(
    canResetPassword(
      token,
      "user-a",
      staging.FOOD_GO_AUTH_COOKIE_SECRET,
      now + 600001,
    ),
    false,
  );
  assert.equal(
    canResetPassword(
      undefined,
      "user-a",
      staging.FOOD_GO_AUTH_COOKIE_SECRET,
      now,
    ),
    false,
  );
});
test("public auth errors do not disclose provider account details", () => {
  assert.equal(publicAuthError(429).status, 429);
  assert.equal(publicAuthError(500).status, 503);
  assert.equal(publicAuthError(401).message, publicAuthError(422).message);
});
