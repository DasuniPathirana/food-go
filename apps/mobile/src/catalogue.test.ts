import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchMobileCatalogue, parseMobileCatalogue, readMobileCatalogueConfig } from "./catalogue";

const config = readMobileCatalogueConfig({ mode: "api", origin: "https://food.example" }, false);
const row = {
  id: "11111111-1111-4111-8111-111111111111", slug: "public-place", name: "Public place", description: "Public description",
  type: "cafe", cuisine: "Australian", address: "100 Public Road", suburb: "Richmond", state: "VIC", postcode: "3121",
  dishes: [{ id: "22222222-2222-4222-8222-222222222222", name: "Lunch dish", description: "Menu description", priceAudCents: 1500 }],
};
const body = (data: unknown[]) => ({ mode: "supabase", status: "ready", data, hasMore: false });

test("mobile catalogue is demo by default and accepts only exact HTTPS or development loopback origins", () => {
  assert.deepEqual(readMobileCatalogueConfig({}, false), { mode: "demo" });
  assert.deepEqual(config, { mode: "api", configured: true, origin: "https://food.example" });
  assert.deepEqual(readMobileCatalogueConfig({ mode: "api", origin: "http://127.0.0.1:3000" }, true), { mode: "api", configured: true, origin: "http://127.0.0.1:3000" });
  for (const origin of ["http://food.example", "http://127.0.0.1:3000", "https://food.example/", "https://food.example/path", "https://user:password@food.example", "https://food.example?key=value"]) {
    assert.deepEqual(readMobileCatalogueConfig({ mode: "api", origin }, false), { mode: "api", configured: false });
  }
});
test("mobile parser preserves canonical independent venue/dish IDs and drops unexpected private fields", () => {
  const result = parseMobileCatalogue(body([{ ...row, email: "private@example.test", organization_id: "private" }]));
  assert.equal(result.venues[0]?.id, row.id);
  assert.equal(result.venues[0]?.dishes[0]?.id, row.dishes[0]?.id);
  assert.doesNotMatch(JSON.stringify(result), /private/u);
  assert.deepEqual(parseMobileCatalogue(body([])), { venues: [], hasMore: false });
});
test("demo, invalid records and unbounded mobile responses are rejected without fixture fallback", () => {
  for (const value of [{ ...body([]), mode: "demo" }, { ...body([]), status: "unavailable" }, body([{ ...row, id: "demo-slug" }]), body([{ ...row, dishes: [{ ...row.dishes[0], priceAudCents: -1 }] }]), body(Array(51).fill(row))]) {
    assert.throws(() => parseMobileCatalogue(value));
  }
});
test("mobile fetch uses only anonymous GET and bounded server search", async () => {
  let requested = "";
  let options: RequestInit | undefined;
  const result = await fetchMobileCatalogue(config, { query: " Italian ", type: "restaurant" }, { fetch: async (input, init) => { requested = String(input); options = init; return Response.json(body([row])); } });
  const url = new URL(requested);
  assert.equal(url.origin, "https://food.example");
  assert.equal(url.searchParams.get("limit"), "50");
  assert.equal(url.searchParams.get("q"), "Italian");
  assert.equal(url.searchParams.get("venueType"), "restaurant");
  assert.equal(options?.method, "GET");
  assert.equal(options?.credentials, "omit");
  assert.equal(result.venues.length, 1);
});
test("mobile failures remain unavailable and invalid configuration performs no request", async () => {
  await assert.rejects(fetchMobileCatalogue(config, {}, { fetch: async () => Response.json({}, { status: 503 }) }));
  let called = false;
  await assert.rejects(fetchMobileCatalogue({ mode: "api", configured: false }, {}, { fetch: async () => { called = true; return Response.json(body([])); } }));
  assert.equal(called, false);
});
