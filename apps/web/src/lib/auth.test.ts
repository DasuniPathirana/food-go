import { test } from "node:test";
import assert from "node:assert/strict";
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
  NODE_ENV: "development",
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
