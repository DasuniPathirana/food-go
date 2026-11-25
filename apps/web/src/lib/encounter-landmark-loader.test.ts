import assert from "node:assert/strict";
import test from "node:test";
import { EncounterLandmarkLoader } from "./encounter-landmark-loader";
import type { EncounterPublic } from "./encounters";

const id = (value: number) => `11111111-1111-4111-8111-${String(value).padStart(12, "0")}`;
type Call = { venueId: string; at: number; signal: AbortSignal; resolve: (value: EncounterPublic) => void; reject: (reason: unknown) => void };
const settle = async () => { for (let turn = 0; turn < 8; turn++) await Promise.resolve(); };
function harness() {
  let now = 1_800_000_000_000, timerId = 0;
  const calls: Call[] = [], timers = new Map<number, { at: number; callback: () => void }>();
  const loader = new EncounterLandmarkLoader({
    request: (venueId, signal) => new Promise((resolve, reject) => calls.push({ venueId, at: now, signal, resolve, reject })),
    now: () => now,
    schedule(callback, delay) { const timer = ++timerId; timers.set(timer, { at: now + delay, callback }); return timer; },
    cancel(timer) { timers.delete(timer as number); },
  });
  loader.activate();
  return { loader, calls, now: () => now,
    advance(milliseconds: number) {
      const end = now + milliseconds;
      while (true) {
        const next = [...timers.entries()].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        now = next[1].at; timers.delete(next[0]); next[1].callback();
      }
      now = end;
    },
    response(venueId = id(1), endsIn = 120000): EncounterPublic {
      return { ok: true, version: 1, serverTime: new Date(now).toISOString(), encounters: [{ id: id(100),
        venue: { id: venueId, name: "Fixture kitchen", slug: "fixture-kitchen", coordinates: { longitude: 144.96, latitude: -37.81 } },
        title: "Fixture encounter", description: "A public test pool.", theme: "cafe", state: "published", version: new Date(now).toISOString(),
        startsAt: new Date(now - 1000).toISOString(), endsAt: new Date(now + endsIn).toISOString(), radiusMetres: 60, cooldownHours: 24,
        maxClaims: 10, claimedCount: 0, offerValidityHours: 24,
        pool: [{ id: id(200), kind: "collectible", name: "Fixture token", description: "A test collectible.", rarity: "common", weight: 1, promotionId: null }] }] };
    },
  };
}

test("a response slower than the five-second poll remains pending and can light its venue", async () => {
  const h = harness(); h.loader.configure(true, [id(1)]);
  assert.equal(h.calls.length, 1);
  h.advance(5000); h.loader.configure(true, [id(1)]);
  assert.equal(h.calls[0].signal.aborted, false); assert.equal(h.calls.length, 1);
  h.advance(2500); h.calls[0].resolve(h.response()); await settle();
  assert.equal(h.loader.getSnapshot().length, 1);
  assert.equal(h.loader.getSnapshot()[0].campaigns[0].venue.id, id(1));
  assert.equal(h.loader.getSnapshot()[0].loadedAt, h.now());
  assert.equal(h.loader.getSnapshot()[0].expiresAt, h.now() + 60000);
  h.loader.deactivate();
});

test("candidate replacement aborts the old key and ignores late responses without bypassing six-second pacing", async () => {
  const h = harness(); h.loader.configure(true, [id(1)]);
  h.advance(1000); h.loader.configure(true, [id(2)]);
  assert.equal(h.calls[0].signal.aborted, true); assert.equal(h.calls.length, 1);
  h.calls[0].resolve(h.response(id(1))); await settle(); assert.deepEqual(h.loader.getSnapshot(), []);
  h.advance(4000); h.loader.configure(true, [id(2)]); assert.equal(h.calls.length, 1);
  h.advance(1000); assert.equal(h.calls.length, 2); assert.equal(h.calls[1].venueId, id(2));
  assert.equal(h.calls[1].at - h.calls[0].at, 6000);
  h.calls[1].resolve(h.response(id(2))); await settle();
  assert.deepEqual(h.loader.getSnapshot().map(record => record.venueId), [id(2)]); h.loader.deactivate();
});

test("hiding or disabling live mode aborts pending hints and late callbacks cannot restore them", async () => {
  const h = harness(); h.loader.configure(true, [id(1)]);
  h.loader.configure(false, [], true); assert.equal(h.calls[0].signal.aborted, true);
  h.calls[0].resolve(h.response()); await settle(); assert.deepEqual(h.loader.getSnapshot(), []);
  h.advance(6000); h.loader.configure(true, [id(1)]);
  h.calls[1].resolve(h.response()); await settle(); assert.equal(h.loader.getSnapshot().length, 1);
  h.loader.configure(false, [], true); assert.deepEqual(h.loader.getSnapshot(), []);
  h.advance(6000); h.loader.configure(true, [id(2)]);
  h.loader.configure(false, []); assert.equal(h.calls[2].signal.aborted, true);
  h.calls[2].resolve(h.response(id(2))); await settle(); assert.deepEqual(h.loader.getSnapshot(), []);
  h.loader.deactivate();
});

test("cache expiry uses sixty seconds for success and fifteen seconds for failures", async () => {
  const h = harness(); h.loader.configure(true, [id(1)]);
  h.calls[0].resolve(h.response()); await settle();
  h.advance(59000); h.loader.configure(true, [id(1)]); assert.equal(h.calls.length, 1);
  h.advance(1000); h.loader.configure(true, [id(1)]); assert.equal(h.calls.length, 2);
  h.calls[1].reject(new Error("Fixture network failure")); await settle();
  const failed = h.loader.getSnapshot()[0]; assert.deepEqual(failed.campaigns, []); assert.equal(failed.expiresAt, h.now() + 15000);
  h.advance(14000); h.loader.configure(true, [id(1)]); assert.equal(h.calls.length, 2);
  h.advance(1000); h.loader.configure(true, [id(1)]); assert.equal(h.calls.length, 3); h.loader.deactivate();
});

test("batches and cache stay bounded while unchanged candidate ordering preserves in-flight work", async () => {
  const h = harness(); h.loader.configure(true, [id(3), id(1), id(2), id(4)]);
  assert.equal(h.calls.length, 3); assert.deepEqual(h.calls.map(call => call.venueId), [id(1), id(2), id(3)]);
  h.loader.configure(true, [id(1), id(2), id(3)]);
  assert.ok(h.calls.every(call => !call.signal.aborted));
  for (const call of h.calls) call.resolve({ ...h.response(), encounters: [] }); await settle();
  for (let batch = 1; batch <= 17; batch++) {
    h.advance(6000);
    const ids = [id(batch * 3 + 1), id(batch * 3 + 2), id(batch * 3 + 3)];
    const before: number = h.calls.length; h.loader.configure(true, ids);
    assert.equal(h.calls.length - before, 3);
    for (const call of h.calls.slice(before)) call.resolve({ ...h.response(), encounters: [] }); await settle();
    assert.ok(h.loader.getSnapshot().length <= 50);
  }
  assert.equal(h.loader.getSnapshot().length, 50); assert.equal(h.loader.getSnapshot().some(record => record.venueId === id(1)), false);
  h.loader.deactivate();
});

test("unmount cancels a queued batch and campaign end can shorten the success cache", async () => {
  const h = harness(); h.loader.configure(true, [id(1)]);
  h.calls[0].resolve(h.response(id(1), 20000)); await settle();
  assert.equal(h.loader.getSnapshot()[0].expiresAt, h.now() + 20000);
  h.advance(1000); h.loader.configure(true, [id(2)]); h.loader.deactivate();
  h.advance(60000); assert.equal(h.calls.length, 1); assert.deepEqual(h.loader.getSnapshot(), []);
  h.loader.configure(true, [id(3)]); assert.equal(h.calls.length, 1);
});
