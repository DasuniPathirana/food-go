import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCatalogue, parseCatalogueSearch, readCatalogueConfig, type CatalogueConfig } from "./catalogue";
import { venueHref } from "./catalogue-contracts";

const config: CatalogueConfig = {
  mode: "supabase", configured: true,
  url: "https://abcdefghijklmnopqrst.supabase.co", key: "sb_publishable_example_public_key_for_tests",
};
const row = {
  id: "11111111-1111-4111-8111-111111111111", slug: "a-real-place", name: "A real place",
  description: "Owner supplied description.", venue_type: "restaurant", cuisine: "Italian",
  address: "123 Example Road", suburb: "Richmond", state: "VIC", postcode: "3121",
  venue_dishes: [{ id: "22222222-2222-4222-8222-222222222222", name: "Seasonal pasta", description: "A menu item.", price_aud_cents: 2400 }],
};

test("catalogue defaults to isolated demo mode and connected mode fails closed with invalid keys or URLs", () => {
  assert.deepEqual(readCatalogueConfig({}), { mode: "demo" });
  const env = { FOOD_GO_CATALOGUE_MODE: "supabase", SUPABASE_URL: config.url, SUPABASE_PUBLISHABLE_KEY: config.key };
  assert.deepEqual(readCatalogueConfig({ ...env, FOOD_GO_AUTH_ENABLED: "false" }), config);
  for (const value of ["https://example.com", `${config.url}/auth/v1`, `${config.url}?key=value`, "http://abcdefghijklmnopqrst.supabase.co"]) {
    assert.deepEqual(readCatalogueConfig({ ...env, SUPABASE_URL: value }), { mode: "supabase", configured: false });
  }
  const privileged = ["test", Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url"), "test"].join(".");
  assert.deepEqual(readCatalogueConfig({ ...env, SUPABASE_PUBLISHABLE_KEY: privileged }), { mode: "supabase", configured: false });
  assert.deepEqual(readCatalogueConfig({ ...env, FOOD_GO_CATALOGUE_MODE: "typo" }), { mode: "supabase", configured: false });
});

test("catalogue API search rejects ambiguous and unbounded parameters", () => {
  for (const query of ["?q=a&q=b", "?limit=2&limit=3", "?status=draft", "?limit=0", "?limit=51", "?state=other", "?q=%00", `?q=${"x".repeat(101)}`]) {
    assert.equal(parseCatalogueSearch(new URL(`https://food.example/api/venues${query}`)), null, query);
  }
  assert.deepEqual(parseCatalogueSearch(new URL("https://food.example/api/venues?q=Italian&state=VIC&venueType=restaurant&limit=2")), {
    query: "Italian", state: "VIC", venueType: "restaurant", cuisine: undefined, limit: 2,
  });
});

test("public SDK query enforces publication and ownership, selects no contacts, and returns only a safe DTO", async () => {
  let requestUrl = new URL(config.url);
  let cache: RequestCache | undefined;
  const fetcher: typeof fetch = async (input, init) => {
    requestUrl = new URL(String(input)); cache = init?.cache;
    return Response.json([{ ...row, organization_id: "never-return", email: "private@example.test" }]);
  };
  const result = await loadCatalogue(config, { query: 'a,(b)"%_', state: "VIC", venueType: "restaurant", limit: 2 }, { fetch: fetcher });
  assert.equal(requestUrl.searchParams.get("status"), "eq.published");
  assert.equal(requestUrl.searchParams.get("ownership_verified_at"), "not.is.null");
  assert.equal(requestUrl.searchParams.get("venue_dishes.is_available"), "eq.true");
  assert.equal(requestUrl.searchParams.get("venue_dishes.limit"), "100");
  assert.equal(requestUrl.searchParams.get("limit"), "3");
  assert.equal(requestUrl.searchParams.get("state"), "eq.VIC");
  assert.equal(requestUrl.searchParams.get("venue_type"), "eq.restaurant");
  assert.match(requestUrl.searchParams.get("or") || "", /\\"\\%\\_/u);
  assert.doesNotMatch(requestUrl.searchParams.get("select") || "", /\*|contact|email|phone|organization/u);
  assert.equal(cache, "no-store");
  assert.equal(result.status, "ready");
  assert.equal(result.venues[0]?.image, "/images/venue-placeholder.svg");
  assert.equal(result.venues[0]?.dishes[0]?.priceAudCents, 2400);
  assert.doesNotMatch(JSON.stringify(result), /never-return|private@example/u);
});

test("connected failures, malformed rows, and missing schema never fall back to fixtures", async () => {
  for (const fetcher of [
    async () => Response.json({ code: "PGRST205", message: "provider detail" }, { status: 404 }),
    async () => Response.json([{ ...row, venue_type: "invalid" }]),
    async () => { throw new Error("network detail"); },
  ]) {
    const result = await loadCatalogue(config, undefined, { fetch: fetcher });
    assert.deepEqual(result, { mode: "supabase", status: "unavailable", venues: [], hasMore: false });
    assert.doesNotMatch(JSON.stringify(result), /provider detail|network detail|Finch/u);
  }
  const empty = await loadCatalogue(config, undefined, { fetch: async () => Response.json([]) });
  assert.deepEqual(empty, { mode: "supabase", status: "ready", venues: [], hasMore: false });
});

test("detail queries use a bounded exact slug or UUID match and result limits are honest", async () => {
  let params = new URLSearchParams();
  const result = await loadCatalogue(config, { query: "", limit: 1 }, {
    venueKey: row.slug, fetch: async (input) => { params = new URL(String(input)).searchParams; return Response.json([row, { ...row, id: "33333333-3333-4333-8333-333333333333", slug: "another-place" }]); },
  });
  assert.equal(params.get("slug"), "eq.a-real-place");
  assert.equal(result.venues.length, 1);
  assert.equal(result.hasMore, true);
  await loadCatalogue(config, { query: "", limit: 1 }, { venueKey: row.id, fetch: async (input) => { params = new URL(String(input)).searchParams; return Response.json([]); } });
  assert.equal(params.get("id"), `eq.${row.id}`);
});

test("demo dish identifiers are independent from venue favourites", async () => {
  const result = await loadCatalogue({ mode: "demo" });
  assert.equal(result.venues.length, 6);
  assert.ok(result.venues.every((venue) => venue.dishes.every((dish) => dish.id !== venue.id)));
  const example = result.venues[0];
  assert.ok(example);
  assert.equal(venueHref(example), `/explore-preview/venues/${example.slug}`);
  assert.equal(venueHref({ ...example, source: "supabase" }), `/venues/${example.slug}`);
});

test("saved lookups remain anonymous public reads and dish IDs filter the parent join", async () => {
  let params = new URLSearchParams();
  const savedDish = row.venue_dishes[0].id;
  const result = await loadCatalogue(config, undefined, { saved: { kind: "dish", ids: [savedDish] }, fetch: async (input) => {
    params = new URL(String(input)).searchParams;
    return Response.json([row]);
  } });
  assert.equal(result.status, "ready");
  assert.equal(params.get("venue_dishes.id"), `in.(${savedDish})`);
  assert.match(params.get("select") || "", /venue_dishes!inner/u);
  assert.equal(params.get("status"), "eq.published");
  assert.equal(params.get("ownership_verified_at"), "not.is.null");
  let called = false;
  const invalid = await loadCatalogue(config, undefined, { saved: { kind: "venue", ids: ["bad-id"] }, fetch: async () => { called = true; return Response.json([]); } });
  assert.equal(invalid.status, "unavailable");
  assert.equal(called, false);
});
