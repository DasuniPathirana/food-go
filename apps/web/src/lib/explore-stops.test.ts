import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCatalogue } from "./catalogue";
import { filterCatalogue, venueHref } from "./catalogue-contracts";
import { illustratedMapStops } from "./explore-stops";

test("three separate mall shops share one illustrated building marker with floor and unit details", async () => {
  const { venues } = await loadCatalogue({ mode: "demo" });
  const stops = illustratedMapStops(venues);
  assert.equal(stops.length, 4);
  assert.deepEqual(stops.slice(0, 3).map(({ id, position, isBuilding }) => ({ id, position, isBuilding })), [
    { id: "finch-and-field", position: { x: 67, y: 34 }, isBuilding: false },
    { id: "ciao-carlton", position: { x: 34, y: 21 }, isBuilding: false },
    { id: "small-hours", position: { x: 21, y: 60 }, isBuilding: false },
  ]);
  const mall = stops.find(({ id }) => id === "garden-arcade");
  assert.ok(mall?.isBuilding);
  assert.equal(mall.venues.length, 3);
  assert.equal(new Set(mall.venues.map(({ id }) => id)).size, 3);
  assert.deepEqual(mall.venues.map(({ building }) => [building?.level, building?.unit]), [
    ["Ground floor", "Shop G03"], ["Level 1", "Shop L1-12"], ["Ground floor", "Shop G07"],
  ]);
  for (const shop of mall.venues) {
    const detail = await loadCatalogue({ mode: "demo" }, { query: "", limit: 1 }, { venueKey: shop.slug });
    assert.equal(detail.venues[0]?.id, shop.id);
    assert.equal(venueHref(shop), `/explore-preview/venues/${shop.slug}`);
  }
});

test("searching a mall or one shop preserves building grouping and does not mutate input", async () => {
  const { venues } = await loadCatalogue({ mode: "demo" });
  assert.equal(filterCatalogue(venues, "Garden Arcade", "All discoveries").length, 3);
  const searched = await loadCatalogue({ mode: "demo" }, { query: "Garden Arcade", limit: 50 });
  assert.equal(searched.venues.length, 3);
  const filtered = filterCatalogue(venues, "Laneway", "Restaurants");
  const before = JSON.stringify(filtered);
  const stops = illustratedMapStops(filtered);
  assert.equal(stops.length, 1);
  assert.equal(stops[0]?.id, "garden-arcade");
  assert.equal(stops[0]?.isBuilding, true);
  assert.equal(stops[0]?.venues[0]?.name, "Laneway Noodles");
  assert.equal(JSON.stringify(filtered), before);
});

test("illustrated positions fail closed for public data, unknown shops and unrecognised buildings", async () => {
  const { venues } = await loadCatalogue({ mode: "demo" });
  const original = venues[0]!;
  const mallShop = venues.find(({ building }) => building)!;
  const forged = [
    { ...original, source: "supabase" as const },
    { ...mallShop, source: "supabase" as const },
    { ...original, id: "unknown-venue" },
    { ...original, id: "constructor" },
    { ...original, id: "__proto__" },
    { ...mallShop, id: "unknown-shop" },
    { ...mallShop, building: { ...mallShop.building!, id: "unknown-building" } },
    { ...original, building: { ...mallShop.building! } },
    { ...mallShop, building: undefined },
  ];
  assert.deepEqual(illustratedMapStops(forged), []);
  const renamed = { ...mallShop, name: "A different shop display name", building: { ...mallShop.building!, name: "A different building display name" } };
  assert.equal(illustratedMapStops([renamed])[0]?.id, "garden-arcade");
  assert.equal(illustratedMapStops([renamed])[0]?.name, "Garden Arcade");
  const deduplicated = illustratedMapStops([original, original, mallShop, mallShop]);
  assert.equal(deduplicated.length, 2);
  assert.equal(deduplicated[1]?.venues.length, 1);
});
