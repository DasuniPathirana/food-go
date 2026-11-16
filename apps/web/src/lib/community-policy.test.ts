import assert from "node:assert/strict";
import test from "node:test";
import { COMMUNITY_POLICY_VERSION, communityPolicyAcceptSchema } from "./community-policy";
import { CommunityPolicyError, createCommunityPolicyHandlers, type CommunityPolicyProvider } from "./community-policy-handlers";
import { CommunityProviderError, createCommunityHandlers } from "./community-handlers";

const origin = "http://localhost:3000";
const env = {
  NODE_ENV: "test", APP_ORIGIN: origin, FOOD_GO_AUTH_ENABLED: "true", FOOD_GO_COMMUNITY_ENABLED: "false",
  FOOD_GO_AUTH_COOKIE_SECRET: "p".repeat(48), SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_public_policy_test_key",
};
const receipt = { version: COMMUNITY_POLICY_VERSION, acceptedAt: "2026-11-15T12:00:00+00:00" };
const acceptance = { version: COMMUNITY_POLICY_VERSION, accepted: true };
function request(value: unknown, headers: Record<string, string> = {}) {
  return new Request(origin + "/api/community/policy", { method: "POST", headers: { origin, "content-type": "application/json", ...headers }, body: JSON.stringify(value) });
}
function setup(overrides: Partial<CommunityPolicyProvider> = {}, environment = env) {
  let writes = 0, reads = 0, providers = 0;
  const provider: CommunityPolicyProvider = {
    async getUser() { return { identityConfirmed: true }; },
    async status() { reads++; return { version: COMMUNITY_POLICY_VERSION, acceptedAt: null }; },
    async accept(input) { writes++; assert.deepEqual(input, acceptance); return receipt; },
    ...overrides,
  };
  return { handlers: createCommunityPolicyHandlers({ env: environment, async getProvider() { providers++; return provider; } }),
    get writes() { return writes; }, get reads() { return reads; }, get providers() { return providers; } };
}

test("acknowledgement status is a read-only account operation independent from Feed activation", async () => {
  const app = setup();
  const result = await app.handlers.GET(new Request(origin + "/api/community/policy"));
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { version: COMMUNITY_POLICY_VERSION, acceptedAt: null });
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.equal(app.reads, 1); assert.equal(app.writes, 0);
  assert.equal((await app.handlers.GET(new Request(origin + "/api/community/policy?userId=another"))).status, 400);
  assert.equal(app.reads, 1);
});

test("acceptance requires an explicit current-version choice and cannot assign an identity or audit time", async () => {
  const app = setup();
  for (const input of [{}, { ...acceptance, accepted: false }, { ...acceptance, accepted: "true" },
    { ...acceptance, userId: "another-user" }, { ...acceptance, acceptedAt: receipt.acceptedAt }, { accepted: true }]) {
    assert.equal((await app.handlers.POST(request(input))).status, 400);
    assert.equal(communityPolicyAcceptSchema.safeParse(input).success, false);
  }
  const stale = await app.handlers.POST(request({ ...acceptance, version: "old" }));
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).code, "acknowledgement_changed");
  assert.equal(app.providers, 0); assert.equal(app.writes, 0);
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await app.handlers.POST(request(acceptance));
    assert.equal(result.status, 200); assert.deepEqual(await result.json(), receipt);
    assert.equal(result.headers.get("cache-control"), "no-store");
  }
  assert.equal(app.writes, 2);
});

test("acceptance origin and actual streamed body bounds are checked before creating a provider", async () => {
  const app = setup();
  const blockedOrigins: Record<string, string>[] = [{ origin: "https://attacker.example" }, { origin: "" }, { "sec-fetch-site": "cross-site" }];
  for (const headers of blockedOrigins)
    assert.equal((await app.handlers.POST(request(acceptance, headers))).status, 403);
  assert.equal((await app.handlers.POST(request(acceptance, { "content-type": "text/plain" }))).status, 415);
  assert.equal((await app.handlers.POST(request(acceptance, { "content-length": "4097" }))).status, 413);
  assert.equal((await app.handlers.POST(request(acceptance, { "content-length": "NaN" }))).status, 413);
  const stream = new ReadableStream<Uint8Array>({ start(controller) {
    controller.enqueue(new TextEncoder().encode('{"version":"' + "x".repeat(4200))); controller.close();
  } });
  const streamed = new Request(origin + "/api/community/policy", {
    method: "POST", headers: { origin, "content-type": "application/json", "content-length": "1" }, body: stream, duplex: "half",
  } as RequestInit);
  assert.equal((await app.handlers.POST(streamed)).status, 413);
  assert.equal(app.providers, 0);
});

test("disabled or unverified accounts cannot read or write policy receipts", async () => {
  const disabled = setup({}, { ...env, FOOD_GO_AUTH_ENABLED: "false" });
  assert.equal((await disabled.handlers.GET(new Request(origin + "/api/community/policy"))).status, 503);
  assert.equal((await disabled.handlers.POST(request(acceptance))).status, 503);
  assert.equal(disabled.providers, 0);
  for (const identity of [null, { identityConfirmed: false }]) {
    const app = setup({ async getUser() { return identity; } });
    assert.equal((await app.handlers.GET(new Request(origin + "/api/community/policy"))).status, 401);
    assert.equal((await app.handlers.POST(request(acceptance))).status, 401);
    assert.equal(app.reads, 0); assert.equal(app.writes, 0);
  }
});

test("missing migrations, invalid receipts and provider diagnostics fail closed without disclosing details", async () => {
  for (const code of ["identity", "stale", "invalid", "unavailable"] as const) {
    const app = setup({ async accept() { throw new CommunityPolicyError(code); } });
    const expected = { identity: 403, stale: 409, invalid: 400, unavailable: 503 };
    assert.equal((await app.handlers.POST(request(acceptance))).status, expected[code]);
  }
  for (const value of [null, { ...receipt, version: "unknown" }, { version: COMMUNITY_POLICY_VERSION, acceptedAt: "yesterday" }]) {
    const app = setup({ async status() { return value; } });
    assert.equal((await app.handlers.GET(new Request(origin + "/api/community/policy"))).status, 503);
  }
  const empty = setup({ async accept() { return { version: COMMUNITY_POLICY_VERSION, acceptedAt: null }; } });
  assert.equal((await empty.handlers.POST(request(acceptance))).status, 503);
  const broken = setup({ async accept() { throw new Error("Database password and private SQL details"); } });
  assert.doesNotMatch(await (await broken.handlers.POST(request(acceptance))).text(), /password|SQL|Database/u);
  const filtered = setup({ async status() { return { ...receipt, user_id: "private", email: "private@example.invalid" }; } });
  assert.deepEqual(await (await filtered.handlers.GET(new Request(origin + "/api/community/policy"))).json(), receipt);
});

test("database consent rejection reaches social clients as an actionable 403 response", async () => {
  const app = createCommunityHandlers({ env: { ...env, FOOD_GO_COMMUNITY_ENABLED: "true" }, async getProvider() {
    return { async getUser() { return { identityConfirmed: true }; }, async feed() { return null; },
      async write() { throw new CommunityProviderError("acknowledgement"); } };
  } });
  const result = await app.POST(new Request(origin + "/api/community", { method: "POST", headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ action: "like", postId: "95100000-0000-4000-8000-000000000001", liked: true }) }));
  assert.equal(result.status, 403);
  assert.equal((await result.json()).code, "acknowledgement_required");
});
