import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { hasVerifiedIdentity, phoneCodeRequestSchema, phoneCodeVerifySchema } from "./auth/contracts";

test("phone account inputs normalise AU mobiles and reject foreign numbers, privilege fields and nonnumeric codes", () => {
  for (const phone of ["0412345678", "+61412345678", "61412345678"])
    assert.equal(phoneCodeRequestSchema.parse({ phone }).phone, "61412345678");
  for (const phone of ["+447123456789", "0212345678", "04123456789", "0412 345 678"])
    assert.equal(phoneCodeRequestSchema.safeParse({ phone }).success, false);
  assert.equal(phoneCodeRequestSchema.safeParse({ phone: "0412345678", role: "owner" }).success, false);
  assert.equal(phoneCodeVerifySchema.parse({ phone: "0412345678", token: " 012345 " }).token, "012345");
  for (const token of ["12345", "12345678901", "12a456", 123456])
    assert.equal(phoneCodeVerifySchema.safeParse({ phone: "0412345678", token }).success, false);
});

test("explorer identities require confirmed email or a canonical verified AU mobile", () => {
  assert.equal(hasVerifiedIdentity({ email: "sam@example.com", email_confirmed_at: "2026-11-12" }), true);
  assert.equal(hasVerifiedIdentity({ phone: "61412345678", phone_confirmed_at: "2026-11-12" }), true);
  assert.equal(hasVerifiedIdentity({ phone: "+61412345678", phone_confirmed_at: "2026-11-12" }), true);
  assert.equal(hasVerifiedIdentity({ email: "sam@example.com", phone: "61412345678" }), false);
  assert.equal(hasVerifiedIdentity({ phone: "447123456789", phone_confirmed_at: "2026-11-12" }), false);
  assert.equal(hasVerifiedIdentity({ phone: "0412345678", phone_confirmed_at: "2026-11-12" }), false);
  assert.equal(hasVerifiedIdentity({}), false);
});

test("phone OTP actions exercise origin, configuration, provider rejection and verified-session boundaries without live sends", () => {
  const result = spawnSync(process.execPath, [
    "--conditions=react-server", "--import=tsx", "--input-type=module", "--eval",
    `
      import assert from "node:assert/strict";
      import { requestPhoneCode, verifyPhoneCode } from ${JSON.stringify(new URL("./auth/actions.ts", import.meta.url).href)};
      let calls = 0;
      let signOuts = 0;
      let otpError = null;
      let requestError = null;
      let confirmedPhone = true;
      let returnedPhone = "61412345678";
      const factory = async () => {
        calls++;
        return { auth: {
          signInWithOtp: async (input) => {
            assert.deepEqual(input, { phone: "61412345678", options: { channel: "sms", shouldCreateUser: true } });
            return { error: requestError };
          },
          verifyOtp: async (input) => {
            assert.deepEqual(input, { phone: "61412345678", token: "012345", type: "sms" });
            return { data: { session: otpError ? null : { access_token: "fake-session-only-for-test" } }, error: otpError };
          },
          getUser: async () => ({ data: { user: { id: "user-one", phone: returnedPhone, phone_confirmed_at: confirmedPhone ? "2026-11-12" : undefined } }, error: null }),
          signOut: async ({ scope }) => { assert.equal(scope, "local"); signOuts++; return { error: null }; },
        } };
      };
      const request = (payload, headers = {}) => new Request("http://127.0.0.1:3000/api/auth/phone/request", {
        method: "POST", headers: { origin: "http://127.0.0.1:3000", "content-type": "application/json", ...headers }, body: JSON.stringify(payload),
      });
      const phone = { phone: "0412345678" };
      const code = { ...phone, token: "012345" };
      process.env.FOOD_GO_PHONE_AUTH_ENABLED = "false";
      assert.equal((await requestPhoneCode(request(phone), factory)).status, 503);
      assert.equal((await verifyPhoneCode(request(code), factory)).status, 503);
      process.env.FOOD_GO_PHONE_AUTH_ENABLED = "true";
      process.env.FOOD_GO_AUTH_ENABLED = "false";
      assert.equal((await requestPhoneCode(request(phone), factory)).status, 503);
      process.env.FOOD_GO_AUTH_ENABLED = "true";
      assert.equal((await requestPhoneCode(request(phone, { origin: "https://attacker.example" }), factory)).status, 403);
      assert.equal((await verifyPhoneCode(request(code, { "sec-fetch-site": "cross-site" }), factory)).status, 403);
      assert.equal((await requestPhoneCode(request({ phone: "+447123456789" }), factory)).status, 400);
      assert.equal((await verifyPhoneCode(request({ ...phone, token: "not-a-code" }), factory)).status, 400);
      assert.equal(calls, 0);
      process.env.NODE_ENV = "production";
      assert.equal((await requestPhoneCode(request(phone), factory)).status, 503);
      process.env.NODE_ENV = "development";
      const sent = await requestPhoneCode(request(phone), factory);
      assert.equal(sent.status, 200);
      assert.equal(sent.headers.get("cache-control"), "no-store");
      const sentBody = await sent.json();
      assert.equal(sentBody.retryAfter, 60);
      requestError = { status: 400, message: "Provider details 0412345678" };
      const concealed = await requestPhoneCode(request(phone), factory);
      assert.equal(concealed.status, 200);
      assert.deepEqual(await concealed.json(), sentBody);
      requestError = { status: 403, code: "user_banned", message: "Private account details" };
      const privateAccount = await requestPhoneCode(request(phone), factory);
      assert.equal(privateAccount.status, 200);
      assert.deepEqual(await privateAccount.json(), sentBody);
      for (const providerCode of ["phone_provider_disabled", "sms_send_failed", "hook_timeout", "captcha_failed"]) {
        requestError = { status: 400, code: providerCode, message: "Provider details 0412345678" };
        const unavailable = await requestPhoneCode(request(phone), factory);
        assert.equal(unavailable.status, 503);
        assert.doesNotMatch(await unavailable.text(), /Provider|0412345678/);
      }
      requestError = { status: 429, message: "Provider details 0412345678" };
      const limited = await requestPhoneCode(request(phone), factory);
      assert.equal(limited.status, 429);
      assert.equal(limited.headers.get("Retry-After"), "60");
      assert.doesNotMatch(await limited.text(), /Provider|0412345678/);
      requestError = { status: 500, message: "Provider details 0412345678" };
      assert.equal((await requestPhoneCode(request(phone), factory)).status, 503);
      const verified = await verifyPhoneCode(request(code), factory);
      assert.equal(verified.status, 200);
      assert.deepEqual(await verified.json(), { redirectTo: "/profile" });
      assert.equal(verified.headers.get("cache-control"), "no-store");
      otpError = { status: 400, message: "Wrong/replayed code 012345 for 0412345678" };
      const rejected = await verifyPhoneCode(request(code), factory);
      assert.equal(rejected.status, 400);
      assert.doesNotMatch(await rejected.text(), /012345|0412345678|replayed/);
      otpError = { status: 403, code: "otp_expired", message: "Expired 012345" };
      assert.equal((await verifyPhoneCode(request(code), factory)).status, 400);
      otpError = null;
      confirmedPhone = false;
      assert.equal((await verifyPhoneCode(request(code), factory)).status, 400);
      confirmedPhone = true;
      returnedPhone = "61487654321";
      assert.equal((await verifyPhoneCode(request(code), factory)).status, 400);
      assert.equal(signOuts, 2);
    `,
  ], {
    cwd: process.cwd(), encoding: "utf8", timeout: 30000,
    env: {
      SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP,
      NODE_PATH: join(dirname(createRequire(import.meta.url).resolve("next/package.json")), "dist", "compiled"),
      NODE_ENV: "development", APP_ORIGIN: "http://127.0.0.1:3000",
      FOOD_GO_AUTH_ENABLED: "true", FOOD_GO_AUTH_PRODUCTION_READY: "false",
      FOOD_GO_AUTH_COOKIE_SECRET: "A".repeat(43),
      SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abcdefghijklmnopqrst",
    },
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
});
