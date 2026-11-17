import assert from "node:assert/strict";
import test from "node:test";
import { searchBrowserMapPlaces } from "./browser-map-search";

const feature = { id: "municipality.colombo", place_name: "Colombo, Sri Lanka", geometry: { type: "Point", coordinates: [79.8612, 6.9271] },
  bbox: [79.8, 6.8, 79.95, 7.05], properties: { private: "private diagnostic" } };

test("browser geocoding uses the allowed browser origin, explicit search and a safe attributed DTO", async () => {
  const result = await searchBrowserMapPlaces(" Colombo / Fort & cafés ", " public&test-key ", undefined, async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://api.maptiler.com");
    assert.equal(url.pathname, "/geocoding/Colombo%20%2F%20Fort%20%26%20caf%C3%A9s.json");
    assert.equal(url.searchParams.get("key"), "public&test-key");
    assert.equal(url.searchParams.get("limit"), "6");
    assert.equal(url.searchParams.get("language"), "en");
    assert.equal(url.searchParams.get("autocomplete"), "false");
    assert.equal(init?.method, "GET");
    assert.equal(init?.credentials, "omit");
    assert.equal(init?.mode, "cors");
    assert.equal(init?.redirect, "error");
    assert.equal(init?.cache, "no-store");
    assert.deepEqual([...new Headers(init?.headers)], [["accept", "application/json"]]);
    assert.ok(init?.signal instanceof AbortSignal);
    return Response.json({ features: [feature], attribution: "untrusted provider detail" });
  });
  assert.deepEqual(result.results, [{ id: "maptiler-municipality.colombo-79.8612-6.9271", name: "Colombo, Sri Lanka",
    longitude: 79.8612, latitude: 6.9271, bounds: [79.8, 6.8, 79.95, 7.05] }]);
  assert.equal(result.attribution, "Place search by MapTiler | OpenStreetMap contributors");
  assert.doesNotMatch(JSON.stringify(result), /public&test-key|private|untrusted/u);
});

test("invalid queries and key configuration never request a provider", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => { calls++; return Response.json({ features: [] }); };
  for (const query of ["a", " ", "x".repeat(121), "Colombo\u0000Fort"]) {
    await assert.rejects(searchBrowserMapPlaces(query, "test-key", undefined, fetcher), /between 2 and 120/u);
  }
  for (const key of ["", " ", "private-key\u0000", "x".repeat(513)]) {
    await assert.rejects(searchBrowserMapPlaces("Colombo", key, undefined, fetcher), /temporarily unavailable/u);
  }
  assert.equal(calls, 0);
});

test("quota, origin restrictions and network failures expose only safe messages without falling back", async () => {
  for (const status of [429, 403, 401, 500]) {
    let calls = 0;
    await assert.rejects(searchBrowserMapPlaces("Colombo", "private-test-key", undefined, async () => {
      calls++; return Response.json({ message: "private-test-key, provider diagnostic" }, { status });
    }), error => {
      assert.ok(error instanceof Error);
      assert.doesNotMatch(error.message, /private-test-key|provider diagnostic/u);
      assert.match(error.message, status === 429 ? /Wait a moment/u : status === 403 ? /this website/u : /temporarily unavailable/u);
      return true;
    });
    assert.equal(calls, 1);
  }
  await assert.rejects(searchBrowserMapPlaces("Colombo", "test-key", undefined,
    async () => { throw new Error("https://api.maptiler.com?key=private-test-key provider diagnostic"); }), error => {
    assert.ok(error instanceof Error);
    assert.doesNotMatch(error.message, /private-test-key|provider diagnostic|https/u);
    return true;
  });
});

test("malformed points, names, identifiers and feature counts are rejected; optional bounds stay geographic", async () => {
  for (const payload of [null, { features: [{ ...feature, geometry: { type: "LineString", coordinates: [[1, 2], [3, 4]] } }] },
    { features: [{ ...feature, geometry: { type: "Point", coordinates: [79, 91] } }] },
    { features: [{ ...feature, place_name: " " }] }, { features: [{ ...feature, place_name: "x".repeat(501) }] },
    { features: [{ ...feature, id: "x".repeat(201) }] }, { features: [{ ...feature, bbox: [1, 2] }] },
    { features: new Array(7).fill(feature) }]) {
    await assert.rejects(searchBrowserMapPlaces("Colombo", "test-key", undefined,
      async () => Response.json(payload)), /temporarily unavailable/u);
  }
  const result = await searchBrowserMapPlaces("Colombo", "test-key", undefined,
    async () => Response.json({ features: [{ ...feature, bbox: [190, 4, 200, 9] }] }));
  assert.ok(!("bounds" in result.results[0]));
  await assert.rejects(searchBrowserMapPlaces("Colombo", "test-key", undefined,
    async () => new Response("private malformed JSON")), /temporarily unavailable/u);
});

test("streaming responses are capped at two megabytes and cancelled before parsing", async () => {
  for (const declared of [false, true]) {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) { controller.enqueue(new Uint8Array(1_000_001)); },
      cancel() { cancelled = true; },
    });
    await assert.rejects(searchBrowserMapPlaces("Colombo", "test-key", undefined,
      async () => new Response(body, { headers: declared ? { "content-length": "2000001" } : {} })), /temporarily unavailable/u);
    assert.equal(cancelled, true);
  }
});

test("cancellation stops the browser request and body without reflecting the abort reason", async () => {
  const already = new AbortController();
  already.abort(new Error("private caller reason"));
  await assert.rejects(searchBrowserMapPlaces("Colombo", "test-key", already.signal,
    async () => { throw new Error("Must not fetch"); }), error => error instanceof DOMException && error.name === "AbortError" && !error.message.includes("private"));

  const controller = new AbortController();
  let cancelledBody = false;
  let fetched: () => void = () => {};
  const started = new Promise<void>(resolve => { fetched = resolve; });
  let fetchSignal: AbortSignal | null | undefined;
  const pending = searchBrowserMapPlaces("Colombo", "test-key", controller.signal, async (_input, init) => {
    fetchSignal = init?.signal;
    const body = new ReadableStream<Uint8Array>({ pull() { fetched(); }, cancel() { cancelledBody = true; } });
    return new Response(body);
  });
  await started;
  controller.abort("private caller reason");
  await assert.rejects(pending, error => error instanceof DOMException && error.name === "AbortError" && !error.message.includes("private"));
  assert.equal(fetchSignal?.aborted, true);
  assert.equal(cancelledBody, true);
});
