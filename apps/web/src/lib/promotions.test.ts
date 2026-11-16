import assert from "node:assert/strict";
import { test } from "node:test";
import type { CatalogueConfig } from "./catalogue";
import { loadPromotions } from "./promotions";

const config: CatalogueConfig = {
  mode: "supabase",
  configured: true,
  url: "https://abcdefghijklmnopqrst.supabase.co",
  key: "sb_publishable_public_key_for_tests",
};

const promotion = {
  id: "11111111-1111-4111-8111-111111111111",
  venueId: "22222222-2222-4222-8222-222222222222",
  venueSlug: "brunswick-kitchen",
  venueName: "Brunswick Kitchen",
  suburb: "Brunswick",
  title: "Weekday lunch",
  description: "A seasonal lunch menu.",
  startsAt: "2026-11-01T00:00:00+00:00",
  endsAt: "2026-12-01T12:30:00.123456+11:00",
};

test("the storefront reads its anonymous RPC and exposes only public promotion fields", async () => {
  let requestUrl = "";
  let headers = new Headers();
  let cache: RequestCache | undefined;
  const result = await loadPromotions(config, async (input, init) => {
    requestUrl = String(input);
    headers = new Headers(init?.headers);
    cache = init?.cache;
    return Response.json([{ ...promotion, privateContact: "internal" }]);
  });
  assert.equal(requestUrl, `${config.url}/rest/v1/rpc/food_go_active_promotions`);
  assert.equal(headers.get("apikey"), config.key);
  assert.equal(headers.has("cookie"), false);
  assert.equal(cache, "no-store");
  assert.deepEqual(result, { status: "ready", promotions: [promotion] });
});

test("an empty active promotion list is a successful public read", async () => {
  assert.deepEqual(await loadPromotions(config, async () => Response.json([])), { status: "ready", promotions: [] });
});

test("demo configuration, provider failures and malformed records cannot become live offers", async () => {
  const unavailable = { status: "unavailable", promotions: [] };
  let calls = 0;
  for (const mode of [{ mode: "demo" }, { mode: "supabase", configured: false }] as const) {
    assert.deepEqual(await loadPromotions(mode, async () => { calls++; return Response.json([promotion]); }), unavailable);
  }
  assert.equal(calls, 0);
  for (const fetcher of [
    async () => Response.json({ message: "internal detail" }, { status: 404 }),
    async () => Response.json([{ ...promotion, venueSlug: "places/other" }]),
    async () => Response.json([{ ...promotion, endsAt: "invalid" }]),
    async () => Response.json(Array(101).fill(promotion)),
  ]) {
    assert.deepEqual(await loadPromotions(config, fetcher), unavailable);
  }
});
