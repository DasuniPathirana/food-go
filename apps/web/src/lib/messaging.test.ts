import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { readSmsConfig, decodeHookSecret } from "./messaging/config";
import { verifySmsHook } from "./messaging/signature";
import { australianMobile, handleSmsHook } from "./messaging/sms-hook";

const key = Buffer.alloc(32, 19);
const now = 1794432000000;
const env = {
  FOOD_GO_SMS_ENABLED: "true",
  SUPABASE_SMS_HOOK_SECRET: `v1,whsec_${key.toString("base64")}`,
  MOBILE_MESSAGE_API_USERNAME: "test-api-user",
  MOBILE_MESSAGE_API_PASSWORD: "test-api-password",
  MOBILE_MESSAGE_SENDER_ID: "Food Go",
};
const body = JSON.stringify({ user: { phone: "+61412345678" }, sms: { otp: "123456" } });
function signedHeaders(payload = body, id = "msg_test-one", timestamp = String(now / 1000)) {
  return {
    "content-type": "application/json",
    "webhook-id": id,
    "webhook-timestamp": timestamp,
    "webhook-signature": `v1,${createHmac("sha256", key).update(`${id}.${timestamp}.${payload}`).digest("base64")}`,
  };
}
function request(payload = body, headers = signedHeaders(payload)) {
  return new Request("https://foodgo.example/api/webhooks/supabase/sms", {
    method: "POST", headers, body: payload,
  });
}
function acceptedResponse(phone = "61412345678") {
  return Response.json({
    status: "complete",
    results: [{ to: phone, status: "success", message_id: "123e4567-e89b-12d3-a456-426614174000" }],
  });
}
const neverFetch: typeof fetch = async () => { throw new Error("No provider request was expected."); };

test("SMS configuration requires explicit activation and complete server credentials", () => {
  assert.equal(readSmsConfig({}), null);
  assert.equal(readSmsConfig({ ...env, FOOD_GO_SMS_ENABLED: "false" }), null);
  for (const name of Object.keys(env))
    assert.equal(readSmsConfig({ ...env, [name]: "" }), null, name);
  assert.equal(readSmsConfig({ ...env, MOBILE_MESSAGE_API_USERNAME: "bad:name" }), null);
  assert.equal(readSmsConfig({ ...env, MOBILE_MESSAGE_SENDER_ID: "Food Go\n" }), null);
  assert.equal(decodeHookSecret("whsec_short"), null);
  assert.deepEqual(decodeHookSecret(`whsec_${key.toString("base64")}`), key);
  assert.ok(readSmsConfig(env));
});

test("SMS webhook signatures authenticate exact raw payload, event ID and fresh timestamp", () => {
  const headers = new Headers(signedHeaders());
  assert.equal(verifySmsHook(body, headers, key, now), "msg_test-one");
  assert.equal(verifySmsHook(`${body} `, headers, key, now), null);
  headers.set("webhook-id", "msg_changed");
  assert.equal(verifySmsHook(body, headers, key, now), null);
  for (const seconds of [-301, 301]) {
    const stale = new Headers(signedHeaders(body, "msg_test-one", String(now / 1000 + seconds)));
    assert.equal(verifySmsHook(body, stale, key, now), null);
  }
  for (const name of ["webhook-id", "webhook-timestamp", "webhook-signature"]) {
    const missing = new Headers(signedHeaders());
    missing.delete(name);
    assert.equal(verifySmsHook(body, missing, key, now), null);
  }
  const rotated = new Headers(signedHeaders());
  rotated.set("webhook-signature", `v1,${Buffer.alloc(32).toString("base64")} ${rotated.get("webhook-signature")}`);
  assert.equal(verifySmsHook(body, rotated, key, now), "msg_test-one");
});

test("unsigned, stale and oversized streamed SMS requests never contact the provider", async () => {
  assert.equal((await handleSmsHook(request(body, { "content-type": "application/json" } as ReturnType<typeof signedHeaders>), { env, fetch: neverFetch, now: () => now })).status, 401);
  const old = signedHeaders(body, "msg_test-one", String(now / 1000 - 301));
  assert.equal((await handleSmsHook(request(body, old), { env, fetch: neverFetch, now: () => now })).status, 401);
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new Uint8Array(32769)); },
    cancel() { cancelled = true; },
  });
  const oversized = new Request("https://foodgo.example/api/webhooks/supabase/sms", {
    method: "POST", headers: { ...signedHeaders(), "content-length": "1" }, body: stream, duplex: "half",
  } as RequestInit);
  assert.equal((await handleSmsHook(oversized, { env, fetch: neverFetch, now: () => now })).status, 413);
  assert.equal(cancelled, true);
});

test("SMS delivery accepts only Australian mobile destinations and bounded numeric OTPs", async () => {
  for (const number of ["+61412345678", "61412345678", "0412345678"])
    assert.equal(australianMobile(number), "61412345678");
  for (const number of ["+447123456789", "+61212345678", "6141234567", "614123456789", " 0412345678", "0412 345 678", null])
    assert.equal(australianMobile(number), null);
  for (const invalid of [
    { user: { phone: "+447123456789" }, sms: { otp: "123456" } },
    { user: { phone: "+61412345678" }, sms: { otp: "123456 hello" } },
    { user: { phone: "+61412345678" }, sms: { otp: 123456 } },
    { user: {}, sms: {} },
  ]) {
    const payload = JSON.stringify(invalid);
    assert.equal((await handleSmsHook(request(payload), { env, fetch: neverFetch, now: () => now })).status, 400);
  }
});

test("authenticated SMS hook uses a fixed provider, Basic auth and an empty Supabase success", async () => {
  let requests = 0;
  const fakeFetch: typeof fetch = async (url, init) => {
    requests++;
    assert.equal(url, "https://api.mobilemessage.com.au/v1/messages");
    assert.equal(init?.method, "POST");
    assert.equal(init?.redirect, "error");
    assert.equal(init?.cache, "no-store");
    assert.ok(init?.signal);
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("Authorization"), `Basic ${Buffer.from("test-api-user:test-api-password").toString("base64")}`);
    assert.match(headers.get("Idempotency-Key") ?? "", /^food-go-sms-[a-f0-9]{64}$/u);
    const sent = JSON.parse(String(init?.body));
    assert.equal(sent.messages.length, 1);
    assert.equal(sent.messages[0].to, "61412345678");
    assert.equal(sent.messages[0].sender, "Food Go");
    assert.equal(sent.messages[0].custom_ref, headers.get("Idempotency-Key"));
    assert.equal(sent.messages[0].message, "Your Food Go verification code is 123456. Do not share this code.");
    assert.equal(sent.max_parts, 1);
    assert.equal(sent.ignore_unsubscribes, false);
    return acceptedResponse();
  };
  const response = await handleSmsHook(request(), { env, fetch: fakeFetch, now: () => now });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(await response.text(), "");
  assert.equal(requests, 1);
});

test("SMS hook retry keeps provider idempotency across attempts and does not resend accepted messages", async () => {
  const accepted = new Map<string, string>();
  let sends = 0;
  const fakeFetch: typeof fetch = async (_url, init) => {
    const id = new Headers(init?.headers).get("Idempotency-Key")!;
    const payload = String(init?.body);
    if (accepted.has(id)) {
      if (accepted.get(id) !== payload) return Response.json({ error: "Changed request" }, { status: 422 });
    } else {
      accepted.set(id, payload);
      sends++;
    }
    return acceptedResponse();
  };
  for (const seconds of [0, 30]) {
    const headers = signedHeaders(body, "msg_stable", String(now / 1000 + seconds));
    assert.equal((await handleSmsHook(request(body, headers), { env, fetch: fakeFetch, now: () => now + seconds * 1000 })).status, 200);
  }
  const changed = JSON.stringify({ user: { phone: "+61412345678" }, sms: { otp: "654321" } });
  assert.equal((await handleSmsHook(request(changed, signedHeaders(changed, "msg_stable")), { env, fetch: fakeFetch, now: () => now })).status, 503);
  assert.equal(sends, 1);
  assert.equal((await handleSmsHook(request(body, signedHeaders(body, "msg_stable")), { env, fetch: neverFetch, now: () => now + 301000 })).status, 401);
});

test("SMS hook checks per-message acceptance and hides provider failures and recipient details", async () => {
  const failures: Array<() => Response | Promise<Response>> = [
    () => Response.json({ error: "123456 +61412345678 test-api-password" }, { status: 401 }),
    () => Response.json({ status: "complete", results: [{ status: "blocked", error: "123456 +61412345678" }] }),
    () => Response.json({ status: "complete", results: [] }),
    () => acceptedResponse("61487654321"),
    () => new Response("not JSON"),
    () => { throw new Error("123456 +61412345678 test-api-password"); },
  ];
  for (const failure of failures) {
    const fakeFetch: typeof fetch = async () => failure();
    const response = await handleSmsHook(request(), { env, fetch: fakeFetch, now: () => now });
    assert.equal(response.status, 503);
    const text = await response.text();
    assert.doesNotMatch(text, /123456|61412345678|test-api-password/u);
    assert.deepEqual(JSON.parse(text), { error: { http_code: 503, message: "SMS delivery is temporarily unavailable." } });
  }
});

test("SMS provider request aborts rather than waiting beyond the hook delivery budget", async () => {
  let aborted = false;
  const fakeFetch: typeof fetch = async (_url, init) => new Promise((_resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Signal did not abort")), 4000);
    init?.signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      aborted = true;
      reject(new Error("Provider timed out"));
    }, { once: true });
  });
  const response = await handleSmsHook(request(), { env, fetch: fakeFetch, now: () => now });
  assert.equal(response.status, 503);
  assert.equal(aborted, true);
});
