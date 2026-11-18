import assert from "node:assert/strict";
import test from "node:test";
import { encounterCommandSchema, encounterInventoryItemSchema, encounterPublicSchema, encounterSnapshotSchema, encounterProximity,
  type EncounterInput, type EncounterSnapshot, type EncounterCommand } from "./encounters";
import { EncounterClient, EncounterRequestError, requestEncounterAccount, requestVenueEncounters } from "./encounter-client";

const ids = { venue: "a1000000-0000-4000-8000-000000000001", other: "a1000000-0000-4000-8000-000000000002", campaign: "a2000000-0000-4000-8000-000000000001",
  session: "a3000000-0000-4000-8000-000000000001", item: "a4000000-0000-4000-8000-000000000001", pool: "a5000000-0000-4000-8000-000000000001", promotion: "a6000000-0000-4000-8000-000000000001" };
const serverTime = "2026-11-17T10:00:00Z", expires = "2026-11-17T10:02:00Z", proof = "a".repeat(32);
const venue = { id: ids.venue, name: "Fixture restaurant", slug: "fixture-restaurant", coordinates: { longitude: 144.96, latitude: -37.81 } };
const collectible = { id: ids.item, sessionId: ids.session, encounterId: ids.campaign, venue, name: "Fixture keepsake", description: "A digital test keepsake.", rarity: "rare" as const,
  kind: "collectible" as const, state: "collected" as const, claimedAt: serverTime, expiresAt: null, redeemedAt: null, promotionId: null };
const result = (action: EncounterCommand["action"], value: Partial<NonNullable<EncounterSnapshot["result"]>> = {}) => ({ action, sessionId: null, itemId: null, code: null, codeExpiresAt: null, replayed: false, error: null, ...value });
const snapshot = (value: Partial<EncounterSnapshot> = {}): EncounterSnapshot => ({ ok: true, version: 1, serverTime, inventory: [], sessions: [], managedVenues: [], campaigns: [], operator: false, result: null, ...value });
const campaign = { id: ids.campaign, venue, title: "A test encounter", description: "An explicit browser fixture.", theme: "cafe", state: "published", version: serverTime,
  startsAt: "2026-11-17T09:00:00Z", endsAt: "2026-11-18T09:00:00Z", radiusMetres: 60, cooldownHours: 24, maxClaims: 10, claimedCount: 1, offerValidityHours: 24,
  pool: [{ id: ids.pool, kind: "collectible", name: "Fixture keepsake", description: "A digital test keepsake.", rarity: "rare", weight: 100, promotionId: null }] };

test("encounter commands reject client authority and invented offer terms", () => {
  const claim = { action: "claim", requestId: ids.item, sessionId: ids.session, code: ` ${proof.toUpperCase()} ` };
  assert.equal(encounterCommandSchema.parse(claim).action, "claim");
  const parsed = encounterCommandSchema.parse(claim); if (parsed.action === "claim") assert.equal(parsed.code, proof);
  for (const authority of [{ userId: ids.other }, { itemId: ids.item }, { rarity: "legendary" }, { xp: 999 }, { distance: 0 }, { verified: true }, { stock: 100 }])
    assert.equal(encounterCommandSchema.safeParse({ ...claim, ...authority }).success, false);
  const create = { action: "create", requestId: ids.item, encounterId: ids.campaign, venueId: ids.venue, title: "Fixture campaign", description: "A test pool.", theme: "restaurant",
    radiusMetres: 60, cooldownHours: 24, startsAt: serverTime, endsAt: "2026-11-18T10:00:00Z", maxClaims: 10, offerValidityHours: 24,
    pool: [{ id: ids.pool, kind: "offer", promotionId: ids.promotion, rarity: "common", weight: 10 }] };
  assert.equal(encounterCommandSchema.safeParse(create).success, true);
  for (const changed of [{ ...create, pool: [{ ...create.pool[0], name: "Invented discount" }] }, { ...create, pool: new Array(9).fill(create.pool[0]) },
    { ...create, pool: [create.pool[0], create.pool[0]] }, { ...create, startsAt: "2026-11-17T10:00:00" }, { ...create, endsAt: "2027-11-17T10:00:00Z" }])
    assert.equal(encounterCommandSchema.safeParse(changed).success, false);
});

test("strict encounter DTOs do not admit codes in claim results, duplicate inventory or transferable collectibles", () => {
  assert.equal(encounterSnapshotSchema.safeParse(snapshot({ inventory: [collectible] })).success, true);
  assert.equal(encounterSnapshotSchema.safeParse(snapshot({ inventory: [collectible, collectible] })).success, false);
  assert.equal(encounterSnapshotSchema.safeParse(snapshot({ result: result("claim", { code: proof, codeExpiresAt: expires }) })).success, false);
  assert.equal(encounterInventoryItemSchema.safeParse({ ...collectible, expiresAt: expires }).success, false);
  assert.equal(encounterInventoryItemSchema.safeParse({ ...collectible, state: "available", promotionId: ids.promotion }).success, false);
  assert.equal(encounterSnapshotSchema.safeParse({ ...snapshot(), userId: ids.other }).success, false);
  assert.equal(encounterPublicSchema.safeParse({ ok: true, version: 1, serverTime, encounters: [{ ...campaign, state: "pending" }] }).success, false);
  assert.equal(encounterPublicSchema.safeParse({ ok: true, version: 1, serverTime, encounters: new Array(4).fill(campaign) }).success, false);
});

test("cosmetic proximity requires a fresh accurate fix and accounts for its uncertainty", () => {
  const now = Date.now(), point = venue.coordinates;
  const fix = { ...point, accuracy: 5, timestamp: now };
  assert.equal(encounterProximity(fix, point, 60, now)?.nearby, true);
  assert.equal(encounterProximity({ ...fix, accuracy: 36 }, point, 60, now), null);
  assert.equal(encounterProximity({ ...fix, timestamp: now - 15001 }, point, 60, now), null);
  assert.equal(encounterProximity({ ...fix, timestamp: now + 3001 }, point, 60, now), null);
  assert.equal(encounterProximity({ ...fix, latitude: Number.NaN }, point, 60, now), null);
  assert.equal(encounterProximity(null, point, 60, now), null);
  assert.equal(encounterProximity({ ...fix, accuracy: 35, latitude: point.latitude + .0003 }, point, 60, now)?.nearby, false);
});

test("public transport identifies the explicit shop without location or account authority", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetcher: typeof fetch = async (url, init) => { calls.push({ url: String(url), init }); return Response.json({ ok: true, version: 1, serverTime, encounters: [campaign] }); };
  await requestVenueEncounters(ids.venue, new AbortController().signal, fetcher);
  assert.equal(calls.length, 1); assert.equal(calls[0].url, `/api/encounters?venueId=${ids.venue}`);
  assert.equal(calls[0].init?.body, undefined); assert.equal(calls[0].init?.credentials, "same-origin"); assert.equal(calls[0].init?.cache, "no-store");
  await assert.rejects(requestVenueEncounters("bad", new AbortController().signal, fetcher), EncounterRequestError);
  assert.equal(calls.length, 1);
  const another: typeof fetch = async () => Response.json({ ok: true, version: 1, serverTime, encounters: [{ ...campaign, venue: { ...venue, id: ids.other } }] });
  await assert.rejects(requestVenueEncounters(ids.venue, new AbortController().signal, another), EncounterRequestError);
});

test("account transport uses static POST JSON, validates the bounded response and never reflects remote details", async () => {
  let request: { url: string; init?: RequestInit } | undefined;
  const command: EncounterCommand = { action: "claim", requestId: ids.item, sessionId: ids.session, code: proof };
  const fetcher: typeof fetch = async (url, init) => { request = { url: String(url), init }; return Response.json(snapshot({ inventory: [collectible], result: result("claim", { sessionId: ids.session, itemId: ids.item }) })); };
  await requestEncounterAccount(command, new AbortController().signal, fetcher);
  assert.equal(request?.url, "/api/encounters"); assert.equal(request?.init?.method, "POST");
  assert.deepEqual(JSON.parse(String(request?.init?.body)), command); assert.equal(request?.init?.credentials, "same-origin");
  assert.equal(request?.url.includes(proof), false);
  const refused: typeof fetch = async () => Response.json({ error: "private provider details and raw code" }, { status: 503 });
  await assert.rejects(requestEncounterAccount(command, new AbortController().signal, refused), error => error instanceof EncounterRequestError && error.uncertain && !error.message.includes("private"));
  const wrong: typeof fetch = async () => Response.json({ ...snapshot(), preciseLocation: venue.coordinates });
  await assert.rejects(requestEncounterAccount(command, new AbortController().signal, wrong), EncounterRequestError);
});

test("streaming transport cancels oversized or aborted public responses before parsing", async () => {
  let cancelled = false;
  const oversized: typeof fetch = async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(256 * 1024 + 1)); }, cancel() { cancelled = true; } }));
  await assert.rejects(requestVenueEncounters(ids.venue, new AbortController().signal, oversized), EncounterRequestError); assert.equal(cancelled, true);
  const controller = new AbortController(); let wasCancelled = false;
  const stalled: typeof fetch = async () => new Response(new ReadableStream({ cancel() { wasCancelled = true; } }));
  const pending = requestVenueEncounters(ids.venue, controller.signal, stalled); controller.abort();
  await assert.rejects(pending, EncounterRequestError); assert.equal(wasCancelled, true);
});

type Call = { command: EncounterCommand | undefined; signal: AbortSignal; resolve: (value: EncounterSnapshot) => void; reject: (error: unknown) => void };
function harness(config = { signedIn: true, enabled: true, accountKey: "account-a", scope: ids.venue }) {
  let nextId = 0; const calls: Call[] = [];
  const client = new EncounterClient((command, signal) => new Promise((resolve, reject) => calls.push({ command, signal, resolve, reject })),
    () => `b1000000-0000-4000-8000-${String(++nextId).padStart(12, "0")}`);
  client.activate(); client.configure(config);
  return { client, calls, config, async initial() { calls[0]?.resolve(snapshot()); await new Promise<void>(resolve => queueMicrotask(resolve)); } };
}

test("disabled or signed-out encounter sessions make no account requests", () => {
  for (const config of [{ signedIn: false, enabled: true }, { signedIn: true, enabled: false }]) {
    const h = harness({ ...config, accountKey: "account-a", scope: ids.venue });
    assert.equal(h.calls.length, 0); void h.client.act({ action: "start", encounterId: ids.campaign }); assert.equal(h.calls.length, 0); h.client.deactivate();
  }
});

test("an unknown claim retries its original UUID and opens only its acknowledged inventory item", async () => {
  const h = harness(); await h.initial();
  const input: EncounterInput = { action: "claim", sessionId: ids.session, code: proof };
  const first = h.client.act(input); h.calls[1].reject(new EncounterRequestError("unavailable", true)); await first;
  assert.equal(h.client.getSnapshot().unconfirmed, true); assert.equal(h.client.getSnapshot().acknowledgedItemId, null);
  const denied = await h.client.act({ action: "start", encounterId: ids.campaign }); assert.equal(denied, null); assert.equal(h.calls.length, 2);
  const retry = h.client.retry(); assert.deepEqual(h.calls[2].command, h.calls[1].command);
  h.calls[2].resolve(snapshot({ inventory: [collectible], result: result("claim", { sessionId: ids.session, itemId: ids.item, replayed: true }) })); await retry;
  assert.equal(h.client.getSnapshot().acknowledgedItemId, ids.item); assert.equal(h.client.getSnapshot().unconfirmed, false);
  h.client.deactivate();
});

test("HTTP200 semantic rejection never celebrates, preserves no code and stops automatic retry", async () => {
  const h = harness(); await h.initial();
  const pending = h.client.act({ action: "claim", sessionId: ids.session, code: proof });
  h.calls[1].resolve(snapshot({ result: result("claim", { error: { code: "invalid", message: "The confirmation code is unavailable." } }) }));
  assert.equal(await pending, null); assert.equal(h.client.getSnapshot().acknowledgedItemId, null);
  assert.equal(h.client.getSnapshot().canRetry, false); assert.equal(h.client.getSnapshot().issued, null);
  assert.equal(h.client.getSnapshot().error, "The confirmation code is unavailable."); h.client.deactivate();
});

test("hiding Explore aborts requests, discards the retry code and ignores a late accepted result", async () => {
  const h = harness(); await h.initial(); const action = h.client.act({ action: "claim", sessionId: ids.session, code: proof });
  h.client.setVisible(false); assert.equal(h.calls[1].signal.aborted, true);
  h.calls[1].resolve(snapshot({ inventory: [collectible], result: result("claim", { sessionId: ids.session, itemId: ids.item }) })); assert.equal(await action, null);
  assert.equal(h.client.getSnapshot().acknowledgedItemId, null); assert.equal(h.client.getSnapshot().data?.inventory.length, 0); assert.equal(h.client.getSnapshot().canRetry, false);
  const internal = h.client as unknown as { pending: unknown }; assert.equal(internal.pending, null);
  h.client.deactivate();
});

test("account and venue replacement invalidate old inventory and cannot reuse another session's retry", async () => {
  const h = harness(); await h.initial(); const action = h.client.act({ action: "claim", sessionId: ids.session, code: proof });
  h.client.configure({ ...h.config, accountKey: "account-b", scope: ids.other });
  assert.equal(h.calls[1].signal.aborted, true); assert.equal(h.client.getSnapshot().data, null); assert.equal(h.client.getSnapshot().canRetry, false);
  h.calls[1].resolve(snapshot({ inventory: [collectible], result: result("claim", { sessionId: ids.session, itemId: ids.item }) })); await action;
  assert.equal(h.client.getSnapshot().data, null); h.calls[2].resolve(snapshot()); await new Promise<void>(resolve => queueMicrotask(resolve));
  assert.equal(h.client.getSnapshot().data?.inventory.length, 0); h.client.deactivate();
});

test("issued codes stay outside saved snapshot data and clear on hide or an expired response", async () => {
  const h = harness(); await h.initial(); const issuing = h.client.act({ action: "issue", sessionId: ids.session });
  h.calls[1].resolve(snapshot({ result: result("issue", { sessionId: ids.session, code: proof, codeExpiresAt: expires }) })); await issuing;
  assert.equal(h.client.getSnapshot().issued?.code, proof); assert.equal(h.client.getSnapshot().data?.result?.code, null);
  h.client.setVisible(false); assert.equal(h.client.getSnapshot().issued, null); h.client.deactivate();
  const expired = harness(); await expired.initial(); const action = expired.client.act({ action: "issue", sessionId: ids.session });
  expired.calls[1].resolve(snapshot({ result: result("issue", { sessionId: ids.session, code: proof, codeExpiresAt: serverTime }) })); await action;
  await new Promise(resolve => setTimeout(resolve, 5)); assert.equal(expired.client.getSnapshot().issued, null); expired.client.deactivate();
});

test("code issuance replay does not invent a replacement or preserve a stale code", async () => {
  const h = harness(); await h.initial(); const issuing = h.client.act({ action: "issue", sessionId: ids.session });
  h.calls[1].resolve(snapshot({ result: result("issue", { sessionId: ids.session, replayed: true }) })); await issuing;
  assert.equal(h.client.getSnapshot().issued, null); assert.match(h.client.getSnapshot().message, /Generate a replacement/u); h.client.deactivate();
});

test("known account denial clears private data and unmount ignores late loads", async () => {
  const h = harness(); await h.initial(); const action = h.client.act({ action: "start", encounterId: ids.campaign });
  h.calls[1].reject(new EncounterRequestError("account")); await action;
  assert.equal(h.client.getSnapshot().data, null); assert.equal(h.client.getSnapshot().canRetry, false);
  const refresh = h.client.refresh(); h.client.deactivate(); assert.equal(h.calls[2].signal.aborted, true);
  h.calls[2].resolve(snapshot({ inventory: [collectible] })); await refresh; assert.equal(h.client.getSnapshot().data, null);
});

test("a success label cannot open a missing item or bind another encounter's session", async () => {
  const h = harness(); await h.initial();
  const claim = h.client.act({ action: "claim", sessionId: ids.session, code: proof });
  h.calls[1].resolve(snapshot({ result: result("claim", { sessionId: ids.session, itemId: ids.item }) }));
  assert.equal(await claim, null); assert.equal(h.client.getSnapshot().acknowledgedItemId, null); assert.equal(h.client.getSnapshot().unconfirmed, true);
  h.client.deactivate();
  const other = harness(); await other.initial();
  const start = other.client.act({ action: "start", encounterId: ids.campaign });
  other.calls[1].resolve(snapshot({ result: result("start", { sessionId: ids.session }), sessions: [{ id: ids.session, encounterId: ids.other, venueId: ids.other, title: "Other test encounter", state: "started", expiresAt: expires, itemId: null }] }));
  assert.equal(await start, null); assert.equal(other.client.getSnapshot().unconfirmed, true); other.client.deactivate();
});
