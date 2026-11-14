import assert from "node:assert/strict";
import { test } from "node:test";
import { createPartnerHandlers, type PartnerProvider } from "./partner/handlers";
import { hasConfirmedPartnerIdentity, mapPartnerVenue, PartnerProviderError, readPartnerConfig } from "./partner/contracts";

const env = {
  NODE_ENV: "development", FOOD_GO_AUTH_ENABLED: "true", FOOD_GO_PARTNER_ENABLED: "true",
  APP_ORIGIN: "http://127.0.0.1:3000", SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abcdefghijklmnopqrst", FOOD_GO_AUTH_COOKIE_SECRET: "A".repeat(43),
};
const requestId = "81000000-0000-4000-8000-000000000001";
const draft = {
  name: "Example Partner", email: "business@example.invalid", phone: "+61 3 9000 0000",
  address: "12 Example Street", suburb: "Melbourne", state: "VIC", postcode: "3000",
  cuisine: "Australian", venueType: "cafe", description: "A neighbourhood cafe with seasonal food and coffee.",
  gameEnabled: true, acceptedTerms: true,
};
const venue = {
  id: "91000000-0000-4000-8000-000000000001", name: draft.name, suburb: draft.suburb,
  state: "VIC" as const, status: "draft" as const, createdAt: "2026-11-12T00:00:00Z",
  updatedAt: "2026-11-12T00:00:00Z", ownershipVerified: false,
};
const provider: PartnerProvider = {
  async getUser() { return { id: "confirmed-user", identityConfirmed: true }; },
  async listVenues() { return [venue]; },
  async createDraft() { return venue; },
};
function handlers(overrides: Partial<PartnerProvider> = {}, config = env) {
  return createPartnerHandlers({ env: config, async getProvider() { return { ...provider, ...overrides }; } });
}
function request(body: BodyInit = JSON.stringify(draft), headers: Record<string, string> = {}) {
  return new Request(`${env.APP_ORIGIN}/api/partner/venues`, { method: "POST", body,
    headers: { origin: env.APP_ORIGIN, "content-type": "application/json", "idempotency-key": requestId, ...headers },
    ...{ duplex: "half" },
  });
}

test("partner creation stays closed unless both partner and identity services are enabled", async () => {
  assert.equal(readPartnerConfig({ ...env, FOOD_GO_PARTNER_ENABLED: "false" }).configured, false);
  assert.equal(readPartnerConfig({ ...env, FOOD_GO_AUTH_ENABLED: "false" }).configured, false);
  const result = await handlers({}, { ...env, FOOD_GO_PARTNER_ENABLED: "false" }).POST(request());
  assert.equal(result.status, 503);
  assert.equal(result.headers.get("cache-control"), "no-store");
});

test("partner writes reject foreign origins, authority fields, malformed JSON and missing retry keys before provider calls", async () => {
  let calls = 0;
  const api = createPartnerHandlers({ env, async getProvider() { calls++; return provider; } });
  for (const [input, status] of [
    [request(undefined, { origin: "https://attacker.example" }), 403],
    [request(undefined, { "sec-fetch-site": "cross-site" }), 403],
    [request(undefined, { "content-type": "text/plain" }), 415],
    [request(undefined, { "idempotency-key": "not-a-uuid" }), 400],
    [request("{invalid"), 400],
    [request(new Uint8Array([255])), 400],
    [request(JSON.stringify({ ...draft, status: "published" })), 400],
  ] as const) assert.equal((await api.POST(input)).status, status);
  assert.equal(calls, 0);
});

test("streamed partner writes enforce their byte limit even with a false content length", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new Uint8Array(16385)); },
    cancel() { cancelled = true; },
  });
  assert.equal((await handlers().POST(request(body, { "content-length": "1" }))).status, 413);
  assert.equal(cancelled, true);
});

test("anonymous and unconfirmed accounts cannot list or create partner venues", async () => {
  for (const user of [null, { id: "not-confirmed", identityConfirmed: false }]) {
    const api = handlers({ async getUser() { return user; }, async createDraft() { assert.fail("Write must be denied"); } });
    assert.equal((await api.GET()).status, 401);
    assert.equal((await api.POST(request())).status, 401);
  }
});

test("partner handlers use server-verified identity and preserve the submission key", async () => {
  let capturedId: string | undefined;
  let listedId: string | undefined;
  const api = handlers({
    async listVenues(userId) { listedId = userId; return [venue]; },
    async createDraft(input, id) { capturedId = id; assert.equal(input.email, draft.email); return venue; },
  });
  assert.deepEqual(await (await api.GET()).json(), { data: [venue] });
  assert.equal(listedId, "confirmed-user");
  const response = await api.POST(request());
  assert.equal(response.status, 201);
  assert.equal(capturedId, requestId);
  assert.deepEqual(await response.json(), { data: venue });
});

test("provider failures map to safe statuses without leaking database diagnostics", async () => {
  for (const [code, status] of [["duplicate",409], ["idempotency",409], ["limit",429], ["unavailable",503]] as const) {
    const response = await handlers({ async createDraft() { throw new PartnerProviderError(code); } }).POST(request());
    assert.equal(response.status, status);
  }
  const response = await handlers({ async createDraft() { throw new Error("private database token diagnostic"); } }).POST(request());
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /token|diagnostic/);
});

test("partner summaries omit contact and organisation records and reject malformed rows", () => {
  const result = mapPartnerVenue({ id: venue.id, name: venue.name, suburb: venue.suburb, state: venue.state,
    status: venue.status, created_at: venue.createdAt, updated_at: venue.updatedAt, ownership_verified_at: null,
    email: "private@example.invalid", organization_id: "private-id",
  });
  assert.deepEqual(result, venue);
  assert.throws(() => mapPartnerVenue({ id: "invalid" }));
});

test("partner identity accepts confirmed email or verified Australian mobile and rejects unverified or foreign phones", () => {
  assert.equal(hasConfirmedPartnerIdentity({ email_confirmed_at: "2026-11-12T00:00:00Z" }), true);
  for (const phone of ["61412345678", "+61412345678"])
    assert.equal(hasConfirmedPartnerIdentity({ phone, phone_confirmed_at: "2026-11-12T00:00:00Z" }), true);
  for (const user of [{ phone: "61412345678" }, { phone: "447123456789", phone_confirmed_at: "2026-11-12T00:00:00Z" }, {}])
    assert.equal(hasConfirmedPartnerIdentity(user), false);
});
