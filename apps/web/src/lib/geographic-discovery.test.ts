import assert from "node:assert/strict";
import test from "node:test";
import { GeographicDiscoveryError, GeographicDiscoverySession, geographicDiscoveryActionSchema, geographicDiscoverySchema, requestGeographicDiscovery,
  type DiscoveryRequester, type GeographicDiscoveryCommand, type GeographicDiscoveryInput, type GeographicDiscoveryResponse } from "./geographic-discovery";

const recordingId = "11111111-1111-4111-8111-111111111111", oldRecordingId = "22222222-2222-4222-8222-222222222222";
const saved = "wm18:1:2" as const;
const dto = (value: Partial<GeographicDiscoveryResponse> = {}): GeographicDiscoveryResponse => ({ ok: true, version: 1, enabled: true, consented: true,
  recordingId, cells: [], observation: null, rewardEligible: false, ...value });
const off = () => dto({ enabled: false, recordingId: null });
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
type Call = { method: "GET" | "POST"; body: GeographicDiscoveryCommand | undefined; signal: AbortSignal; resolve: (value: GeographicDiscoveryResponse) => void; reject: (error: unknown) => void };

function harness() {
  let now = 1_800_000_000_000, nextTimer = 0, nextId = 0;
  const timers = new Map<number, { at: number; callback: () => void }>(), calls: Call[] = [];
  const request: DiscoveryRequester = (method, body, signal) => new Promise((resolve, reject) => calls.push({ method, body, signal, resolve, reject }));
  const session = new GeographicDiscoverySession({ request, now: () => now, requestId: () => `00000000-0000-4000-8000-${String(++nextId).padStart(12, "0")}`,
    schedule(callback, delay) { const id = ++nextTimer; timers.set(id, { at: now + delay, callback }); return id; }, cancel(id) { timers.delete(id as number); } });
  const fix = (value: Partial<NonNullable<GeographicDiscoveryInput["fix"]>> = {}) => ({ longitude: 144.967146, latitude: -37.816813, accuracy: 5, timestamp: now, ...value });
  let input: GeographicDiscoveryInput = { signedIn: true, available: true, accountKey: "account-a", mode: "live", liveReady: true, fix: fix() };
  session.activate(); session.configure(input);
  return { session, calls, fix, now: () => now,
    configure(value: Partial<GeographicDiscoveryInput> = {}) { input = { ...input, ...value }; session.configure(input); },
    async reply(index: number, value = dto()) { calls[index].resolve(value); await settle(); },
    async reject(index: number, error: unknown = new Error("provider diagnostic that must not appear in UI")) { calls[index].reject(error); await settle(); },
    async tick(milliseconds: number) {
      const target = now + milliseconds;
      while (true) {
        const due = [...timers].filter(([, value]) => value.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        now = due[1].at; timers.delete(due[0]); due[1].callback(); await settle();
      }
      now = target; await settle();
    },
  };
}
type Harness = ReturnType<typeof harness>;
async function consent(h: Harness) {
  await h.reply(0, dto({ cells: [saved], recordingId: oldRecordingId }));
  h.session.setRecording(true); await h.reply(h.calls.length - 1, dto());
}
async function sendFix(h: Harness, elapsed = 1) { await h.tick(elapsed); h.configure({ fix: h.fix() }); }
const buffers = (session: GeographicDiscoverySession) => session as unknown as { latest: unknown; pending: unknown; recordingId: string | null };

test("shared API contracts reject reward claims, extra coordinates and malformed or unbound observations", () => {
  assert.equal(geographicDiscoverySchema.safeParse(dto()).success, true);
  for (const value of [{ ...dto(), rewardEligible: true }, { ...dto(), cells: [saved, saved] }, { ...dto(), recordingId: "not-a-uuid" },
    { ...dto(), observation: { accepted: true, reason: "travel" } }, { ...dto(), longitude: 1 }]) assert.equal(geographicDiscoverySchema.safeParse(value).success, false);
  const valid = { action: "observe", requestId: recordingId, recordingId, longitude: 144.9, latitude: -37.8, accuracy: 5, timestamp: 1_800_000_000_000 };
  assert.equal(geographicDiscoveryActionSchema.safeParse(valid).success, true);
  for (const value of [{ ...valid, recordingId: undefined }, { ...valid, heading: 12 }, { ...valid, latitude: 90 }, { ...valid, timestamp: 0 },
    { ...valid, timestamp: 4102444800001 }, { ...valid, accuracy: -1 }, { action: "clear", cells: [saved] }, { action: "consent", version: 2, enabled: true }]) {
    assert.equal(geographicDiscoveryActionSchema.safeParse(value).success, false);
  }
});

test("saved enabled settings never resume local recording or upload a location", async () => {
  const h = harness(); await h.reply(0, dto({ cells: [saved], recordingId: oldRecordingId }));
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0].method, "GET");
  assert.equal(h.session.getSnapshot().recording, false); assert.equal(h.session.getSnapshot().requested, false);
  assert.equal(h.session.getSnapshot().recordedCount, 1); assert.equal(buffers(h.session).latest, null); assert.equal(buffers(h.session).recordingId, null);
  await sendFix(h, 6001); assert.equal(h.calls.length, 1);
  h.session.deactivate();
});

test("explicit opt-in needs a consent acknowledgement and a newer original GPS fix, including clock skew", async () => {
  const h = harness(); await h.reply(0, dto());
  const before = h.fix({ timestamp: h.now() + 2000 }); h.configure({ fix: before });
  h.session.setRecording(true);
  assert.equal(h.session.getSnapshot().requested, true); assert.equal(h.session.getSnapshot().recording, false);
  h.configure({ fix: before }); assert.equal(h.calls.length, 2);
  await h.reply(1, dto()); h.configure({ fix: before }); assert.equal(h.calls.length, 2);
  await h.tick(2001); h.configure({ fix: h.fix() });
  assert.equal(h.calls.length, 3); assert.equal(h.calls[2].body?.action, "observe");
  if (h.calls[2].body?.action !== "observe") throw new Error("Expected observation");
  assert.equal(h.calls[2].body.recordingId, recordingId); assert.notEqual(h.calls[2].body.recordingId, oldRecordingId);
  h.session.deactivate();
});

test("off invalidates late consent/read responses and stops uploads before remote acknowledgement", async () => {
  const h = harness(); h.session.setRecording(true); h.session.setRecording(false);
  assert.equal(h.session.getSnapshot().requested, false); assert.equal(h.session.getSnapshot().recording, false);
  assert.equal(buffers(h.session).pending, null); assert.equal(buffers(h.session).latest, null); assert.equal(buffers(h.session).recordingId, null);
  await h.reply(1, dto({ cells: [saved] })); await h.reply(0, dto({ cells: [saved] }));
  await sendFix(h); assert.equal(h.calls.length, 3); assert.equal(h.session.getSnapshot().recordedCount, 0); assert.equal(buffers(h.session).latest, null);
  await h.reply(2, off()); assert.equal(h.session.getSnapshot().recording, false);
  h.session.deactivate();
});

test("observation retries keep their exact request ID and coordinates, and failed attempts are throttled", async () => {
  const h = harness(); await consent(h); await sendFix(h);
  const first = h.calls[2].body; assert.equal(first?.action, "observe");
  await h.reject(2); await sendFix(h, 1000);
  assert.equal(h.calls.length, 3, "New fixes cannot silently retry a network failure");
  h.session.retry(); await h.tick(4999); assert.equal(h.calls.length, 3);
  await h.tick(1); assert.equal(h.calls.length, 4); assert.deepEqual(h.calls[3].body, first);
  assert.ok(!JSON.stringify(h.session.getSnapshot()).includes("144.967146"));
  assert.ok(!h.session.getSnapshot().error?.includes("provider diagnostic"));
  await h.reply(3, dto({ observation: { accepted: true, reason: null }, cells: [saved] }));
  h.session.deactivate();
});

test("precise retries expire without new GPS events, and expired backlog is never uploaded", async () => {
  const h = harness(); await consent(h); await sendFix(h); await h.reject(2);
  await h.tick(15001);
  assert.equal(buffers(h.session).pending, null); assert.equal(buffers(h.session).latest, null);
  h.session.retry(); assert.equal(h.calls.length, 3);
  await sendFix(h); assert.equal(h.calls.length, 4);
  if (h.calls[2].body?.action !== "observe" || h.calls[3].body?.action !== "observe") throw new Error("Expected observations");
  assert.notEqual(h.calls[2].body.requestId, h.calls[3].body.requestId);
  h.session.deactivate();
});

test("offline opt-out stops locally and can retry only the non-location account choice", async () => {
  const h = harness(); await consent(h); await sendFix(h); h.session.setOnline(false); h.session.setRecording(false);
  assert.equal(h.session.getSnapshot().recording, false); assert.equal(buffers(h.session).pending, null); assert.equal(buffers(h.session).latest, null);
  await h.reply(2, dto({ observation: { accepted: true, reason: null } })); assert.equal(h.session.getSnapshot().recording, false);
  await sendFix(h, 6001); assert.equal(h.calls.length, 3);
  h.session.setOnline(true); assert.equal(h.calls.length, 3); h.session.retry();
  assert.deepEqual(h.calls[3].body, { action: "consent", version: 1, enabled: false });
  await h.reply(3, off()); h.session.deactivate();
});

test("hide, unmount and account replacement clear raw buffers and reject late responses", async () => {
  const h = harness(); await consent(h); await sendFix(h); h.session.setVisible(false);
  h.configure({ fix: h.fix({ timestamp: h.now() + 1 }) });
  assert.equal(buffers(h.session).latest, null); assert.equal(buffers(h.session).pending, null); assert.equal(buffers(h.session).recordingId, null);
  await h.reply(2, dto({ cells: ["wm18:8:8"], observation: { accepted: true, reason: null } }));
  assert.equal(h.session.getSnapshot().recording, false); assert.equal(h.session.getSnapshot().recordedCount, 0);
  h.session.setVisible(true); await h.reply(3, dto({ cells: [saved] }));
  assert.equal(h.session.getSnapshot().recording, false);
  h.configure({ accountKey: "account-b", fix: null });
  assert.equal(h.session.getSnapshot().recordedCount, 0); assert.equal(h.session.getSnapshot().sessionCount, 0);
  h.session.deactivate(); await h.reply(4, dto({ cells: [saved] }));
  assert.equal(h.session.getSnapshot().recordedCount, 0); assert.equal(buffers(h.session).latest, null);
  // Reusable activation also covers React Strict Mode's setup/cleanup replay.
  h.session.activate(); h.configure({ accountKey: "account-c", fix: null });
  assert.equal(h.calls.length, 6); assert.equal(h.session.getSnapshot().requested, false); h.session.deactivate();
});

test("manual preview and unsaved device areas remain separate and never become an uploaded cell list", async () => {
  const h = harness(); await h.reply(0, dto()); h.session.toggle();
  h.configure({ mode: "manual", liveReady: false, fix: null, previewPoint: { longitude: 10, latitude: 10 } });
  const manual = [...h.session.getSnapshot().visibleCells]; assert.ok(manual.length > 0);
  h.session.clearPreview(); assert.equal(h.session.getSnapshot().sessionCount, 0);
  h.configure(); assert.equal(h.session.getSnapshot().sessionCount, 0, "Unchanged preview area must stay cleared");
  h.configure({ mode: "live", liveReady: true, fix: h.fix(), previewPoint: null });
  assert.ok(h.session.getSnapshot().sessionCount > 0); assert.equal(h.calls.length, 1);
  h.session.setRecording(true); await h.reply(1, dto()); assert.equal(h.calls.length, 2);
  await sendFix(h); const command = h.calls[2].body;
  assert.equal(command?.action, "observe"); assert.ok(!("cells" in command!));
  assert.equal(h.session.getSnapshot().recordedCount, 0);
  await h.reply(2, dto({ cells: [saved], observation: { accepted: true, reason: null } }));
  assert.equal(h.session.getSnapshot().recordedCount, 1); assert.deepEqual(h.session.getSnapshot().visibleCells.includes(saved), true);
  h.session.deactivate();
});

test("clear-saved cannot be repopulated by earlier GET or observe responses and reports unconfirmed deletion", async () => {
  const h = harness(); h.session.clearSaved();
  await h.reply(0, dto({ cells: [saved] })); assert.equal(h.session.getSnapshot().recordedCount, 0);
  await h.reject(1); assert.match(h.session.getSnapshot().message, /Deletion has not been confirmed/u);
  h.session.retry(); await h.reply(2, off()); assert.equal(h.session.getSnapshot().recordedCount, 0);
  h.session.setRecording(true); await h.reply(3, dto()); await sendFix(h); h.session.clearSaved();
  await h.reply(4, dto({ cells: [saved], observation: { accepted: true, reason: null } }));
  assert.equal(h.session.getSnapshot().recordedCount, 0); await h.reply(5, off());
  assert.equal(h.session.getSnapshot().requested, false); h.session.deactivate();
});

test("a rotated or unauthorised recording session drops its old precise retry envelope", async () => {
  const h = harness(); await consent(h); await sendFix(h);
  await h.reject(2, new GeographicDiscoveryError("account"));
  assert.equal(h.session.getSnapshot().recording, false); assert.equal(buffers(h.session).pending, null); assert.equal(buffers(h.session).recordingId, null);
  h.session.retry(); assert.equal(h.calls[3].method, "GET"); assert.equal(h.calls[3].body, undefined);
  await h.reply(3, dto({ recordingId: oldRecordingId })); assert.equal(h.session.getSnapshot().recording, false);
  h.session.deactivate();
});

test("hiding a pending delete retains only its non-location retry intent", async () => {
  const h = harness(); await h.reply(0, dto({ cells: [saved] }));
  h.session.clearSaved(); h.session.setVisible(false); await h.reply(1, off());
  assert.equal(h.session.getSnapshot().recordedCount, 0); assert.match(h.session.getSnapshot().error!, /Deletion has not been confirmed/u);
  h.session.setVisible(true); assert.equal(h.calls.length, 2, "A read cannot repopulate an unconfirmed deletion");
  h.session.retry(); assert.deepEqual(h.calls[2].body, { action: "clear" });
  await h.reply(2, off()); h.session.deactivate();
});

test("signed-out or disabled account services never request persisted discoveries", () => {
  let requests = 0;
  const session = new GeographicDiscoverySession({ request: async () => { requests++; return dto(); } });
  session.activate();
  session.configure({ signedIn: false, available: true, mode: "manual", liveReady: false, fix: null });
  session.configure({ signedIn: true, available: false, accountKey: "account-a", mode: "manual", liveReady: false, fix: null });
  assert.equal(requests, 0); session.setRecording(true); assert.equal(requests, 0); assert.equal(session.getSnapshot().requested, false);
  session.deactivate();
});

test("the visible union is capped without copying session preview cells into persisted history", async () => {
  const h = harness();
  const full = Array.from({ length: 4096 }, (_, x) => `wm18:${x}:0` as const);
  await h.reply(0, dto({ cells: full })); h.session.toggle();
  h.configure({ mode: "manual", liveReady: false, fix: null, previewPoint: { longitude: 144.967146, latitude: -37.816813 } });
  assert.equal(h.session.getSnapshot().visibleCells.length, 4096); assert.equal(h.session.getSnapshot().recordedCount, 4096);
  assert.equal(h.session.getSnapshot().sessionCount, 0); assert.match(h.session.getSnapshot().message, /preview is full/u);
  assert.equal(h.calls.length, 1); h.session.deactivate();
});

test("transport uses one static same-origin endpoint with POST bodies and rejects oversized or malformed responses", async () => {
  const controller = new AbortController(); let calls = 0;
  const command = { action: "observe", requestId: oldRecordingId, recordingId, longitude: 144.967146, latitude: -37.816813, accuracy: 5, timestamp: 1_800_000_000_000 } as const;
  const response = await requestGeographicDiscovery("POST", command, controller.signal, async (url, init) => {
    calls++; assert.equal(url, "/api/exploration"); assert.equal(init?.method, "POST"); assert.equal(init?.credentials, "same-origin");
    assert.equal(init?.cache, "no-store"); assert.deepEqual(JSON.parse(init?.body as string), command);
    return new Response(JSON.stringify(dto({ observation: { accepted: true, reason: null } })));
  });
  assert.equal(calls, 1); assert.equal(response.rewardEligible, false);
  await assert.rejects(requestGeographicDiscovery("GET", undefined, controller.signal, async () => new Response("x".repeat(128 * 1024 + 1))), error => error instanceof GeographicDiscoveryError && error.code === "response");
  await assert.rejects(requestGeographicDiscovery("GET", undefined, controller.signal, async () => new Response("not json")), error => error instanceof GeographicDiscoveryError && error.code === "response");
  await assert.rejects(requestGeographicDiscovery("GET", undefined, controller.signal, async () => new Response("private provider detail", { status: 403 })), error => error instanceof GeographicDiscoveryError && error.code === "account" && !error.message.includes("private"));
});
