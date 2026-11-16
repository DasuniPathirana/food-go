import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { handleEmailHook, readEmailHookConfig } from "./messaging/email-hook";

const signingKey = Buffer.alloc(32, 9), now = 1_800_000_000_000;
const origin = "https://food.example", project = "https://abcdefghijklmnopqrst.supabase.co";
const env = { FOOD_GO_EMAIL_ENABLED: "true", SUPABASE_EMAIL_HOOK_SECRET: "v1,whsec_" + signingKey.toString("base64"),
  BREVO_API_KEY: "test-brevo-key-for-stubbed-requests", EMAIL_SENDER_NAME: "Food Go", EMAIL_SENDER_ADDRESS: "sender@example.com",
  APP_ORIGIN: origin, SUPABASE_URL: project, NODE_ENV: "production" };
const currentHash = "current_hash_1234567890", nextHash = "new_address_hash_1234567890";
function payload(action = "signup", overrides: Record<string, unknown> = {}, userOverrides: Record<string, unknown> = {}) {
  return { user: { email: "explorer@example.com", ...userOverrides }, email_data: { email_action_type: action,
    token_hash: currentHash, token_hash_new: "", token: "123456", token_new: "", site_url: origin,
    redirect_to: origin + "/auth/callback?next=" + (action === "recovery" ? "/auth/reset-password" : "/profile"), ...overrides } };
}
function signed(value: unknown, options: { id?: string; seconds?: number; changedBody?: string; headers?: Record<string, string> } = {}) {
  const body = JSON.stringify(value), id = options.id || "msg_email_test", timestamp = String(options.seconds ?? now / 1000);
  return new Request(origin + "/api/webhooks/supabase/email", { method: "POST", headers: {
    "content-type": "application/json", "webhook-id": id, "webhook-timestamp": timestamp,
    "webhook-signature": "v1," + createHmac("sha256", signingKey).update(`${id}.${timestamp}.${body}`).digest("base64"), ...options.headers,
  }, body: options.changedBody ?? body });
}
const accepted = () => Response.json({ messageIds: ["<stub-message@example.com>"] }, { status: 201 });
async function run(value: unknown, fetcher: typeof fetch = async () => accepted()) {
  return handleEmailHook(signed(value), { env, now: () => now, fetch: fetcher });
}

test("email transport stays closed for incomplete or untrusted configuration", async () => {
  assert.ok(readEmailHookConfig(env));
  for (const changed of [{ FOOD_GO_EMAIL_ENABLED: "false" }, { SUPABASE_EMAIL_HOOK_SECRET: "invalid" },
    { BREVO_API_KEY: "" }, { BREVO_API_KEY: "unsafe\nheader-that-is-long-enough" }, { EMAIL_SENDER_ADDRESS: "invalid" },
    { EMAIL_SENDER_NAME: "Food Go\nInjected" }, { APP_ORIGIN: origin + "/path" }, { APP_ORIGIN: "http://food.example" },
    { SUPABASE_URL: "https://evil.example" }, { SUPABASE_URL: project + "/other" }]) {
    let called = false;
    const result = await handleEmailHook(signed(payload()), { env: { ...env, ...changed }, now: () => now,
      fetch: async () => { called = true; return accepted(); } });
    assert.equal(result.status, 503); assert.equal(called, false);
  }
});

test("signature covers the exact body and timestamp before any send", async () => {
  for (const request of [signed(payload(), { changedBody: JSON.stringify(payload("recovery")) }),
    signed(payload(), { seconds: now / 1000 - 301 }), signed(payload(), { seconds: now / 1000 + 301 }),
    signed(payload(), { headers: { "webhook-signature": "v1,invalid" } }),
    signed(payload(), { headers: { "webhook-id": "unsafe.id" } })]) {
    let calls = 0;
    const result = await handleEmailHook(request, { env, now: () => now, fetch: async () => { calls++; return accepted(); } });
    assert.equal(result.status, 401); assert.equal(calls, 0);
  }
  assert.equal((await handleEmailHook(signed(payload(), { headers: { "content-type": "text/plain" } }), { env })).status, 415);
  assert.equal((await handleEmailHook(signed(payload(), { headers: { "content-length": "32769" } }), { env })).status, 413);
  assert.equal((await run({ padding: "x".repeat(32769) })).status, 413);
  assert.equal((await run(null)).status, 400);
});

test("signup sends one fixed-provider batch with a bounded PKCE-compatible Supabase verify link", async () => {
  const response = await run(payload(), async (input, init) => {
    assert.equal(String(input), "https://api.brevo.com/v3/smtp/email");
    assert.equal(init?.method, "POST"); assert.equal(init?.redirect, "error"); assert.equal(init?.cache, "no-store");
    assert.equal(new Headers(init?.headers).get("api-key"), env.BREVO_API_KEY);
    assert.ok(init?.signal instanceof AbortSignal);
    const body = JSON.parse(String(init?.body));
    assert.deepEqual(body.sender, { name: "Food Go", email: "sender@example.com" });
    assert.equal(body.messageVersions.length, 1);
    assert.deepEqual(body.messageVersions[0].to, [{ email: "explorer@example.com" }]);
    assert.match(body.headers.idempotencyKey, /^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u);
    const url = new URL(body.messageVersions[0].textContent.split("\n\n")[2]);
    assert.equal(url.origin, project); assert.equal(url.pathname, "/auth/v1/verify");
    assert.equal(url.searchParams.get("token"), currentHash); assert.equal(url.searchParams.get("type"), "signup");
    assert.equal(url.searchParams.get("redirect_to"), origin + "/auth/callback?next=/profile");
    assert.doesNotMatch(body.messageVersions[0].htmlContent, /&redirect_to=/u);
    return accepted();
  });
  assert.equal(response.status, 200); assert.equal(await response.text(), "");
});

test("recovery links retain the exact reset callback; external or wrong-action redirects fail closed", async () => {
  const result = await run(payload("recovery"), async (_input, init) => {
    const body = JSON.parse(String(init?.body)), text = body.messageVersions[0].textContent;
    const url = new URL(text.split("\n\n")[2]);
    assert.equal(url.searchParams.get("type"), "recovery");
    assert.equal(url.searchParams.get("redirect_to"), origin + "/auth/callback?next=/auth/reset-password");
    return accepted();
  });
  assert.equal(result.status, 200);
  for (const changed of [{ redirect_to: "https://evil.example/auth/callback?next=/profile" },
    { redirect_to: origin + "/auth/callback?next=/profile&extra=1" }, { redirect_to: origin + "/auth/callback?next=/profile#fragment" },
    { redirect_to: origin + "/auth/callback?next=/auth/reset-password" }, { site_url: "https://evil.example" },
    { token_hash: "<unsafe>" }]) {
    let calls = 0;
    assert.equal((await run(payload("signup", changed), async () => { calls++; return accepted(); })).status, 400);
    assert.equal(calls, 0);
  }
});

test("secure email changes map reversed hash names to the correct recipients in one batch", async () => {
  const result = await run(payload("email_change", { token_hash: nextHash, token_hash_new: currentHash, token_new: "654321" },
    { new_email: "new@example.com" }), async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.messageVersions.length, 2);
    const [current, next] = body.messageVersions;
    assert.equal(current.to[0].email, "explorer@example.com"); assert.equal(next.to[0].email, "new@example.com");
    assert.equal(new URL(current.textContent.split("\n\n")[2]).searchParams.get("token"), currentHash);
    assert.equal(new URL(next.textContent.split("\n\n")[2]).searchParams.get("token"), nextHash);
    return Response.json({ messageIds: ["<current@example.com>", "<next@example.com>"] }, { status: 201 });
  });
  assert.equal(result.status, 200);
  assert.equal((await run(payload("email_change", {}, { new_email: "new@example.com" }), async (_input, init) => {
    assert.equal(JSON.parse(String(init?.body)).messageVersions[0].to[0].email, "new@example.com"); return accepted();
  })).status, 200);
  assert.equal((await run(payload("email_change"))).status, 400);
});

test("reauthentication codes and security notices do not manufacture verification URLs", async () => {
  for (const action of ["reauthentication", "password_changed_notification"]) {
    assert.equal((await run(payload(action), async (_input, init) => {
      const body = JSON.parse(String(init?.body));
      assert.doesNotMatch(body.htmlContent, /auth\/v1\/verify/u);
      if (action === "reauthentication") assert.match(body.textContent, /123456/u);
      else assert.doesNotMatch(body.textContent, /123456/u);
      return accepted();
    })).status, 200);
  }
  assert.equal((await run(payload("reauthentication", { token: "invalid" }))).status, 400);
  assert.equal((await run(payload("unknown"))).status, 400);
});

test("uncertain-send retries retain one provider UUID and accept only explicit idempotency duplicates", async () => {
  const keys: string[] = [], bodies: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await run(payload(), async (_input, init) => {
      bodies.push(String(init?.body)); keys.push(JSON.parse(String(init?.body)).headers.idempotencyKey);
      if (attempt === 0) throw new Error("private API key, token and recipient details");
      return Response.json({ code: "duplicate_parameter", message: "Email for the idempotency key has already been processed" }, { status: 400 });
    });
    assert.equal(result.status, attempt === 0 ? 503 : 200);
    assert.doesNotMatch(await result.text(), /private API|recipient details|explorer@example|123456/u);
  }
  assert.equal(keys[0], keys[1]); assert.equal(bodies[0], bodies[1]);
  assert.equal((await run(payload(), async () => Response.json({ code: "duplicate_parameter", message: "Another duplicate field" }, { status: 400 }))).status, 503);
});

test("provider errors, malformed replies and incomplete batches never expose diagnostics or report success", async () => {
  for (const provider of [Response.json({ code: "unauthorized", message: "private credential" }, { status: 401 }),
    Response.json({ messageIds: [] }, { status: 201 }), Response.json({ messageIds: ["one", "two"] }, { status: 201 }),
    new Response("private malformed reply", { status: 201 }), new Response("x".repeat(32769), { status: 201 })]) {
    const result = await run(payload(), async () => provider);
    assert.equal(result.status, 503); assert.doesNotMatch(await result.text(), /private|credential|explorer@example|123456/u);
  }
});
