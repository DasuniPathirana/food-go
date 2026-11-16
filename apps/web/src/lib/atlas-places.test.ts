import assert from "node:assert/strict";
import { test } from "node:test";
import { atlasStops, pointDirections } from "./atlas-places";
import { loadCatalogue } from "./catalogue";
import { ATLAS_PLACES } from "./melbourne-atlas";

test("real map skips demo venues even when they carry coordinates and groups co-located published shops", async () => {
  const [example] = (await loadCatalogue({ mode: "demo" })).venues;
  const coordinates = { latitude: -37.81, longitude: 144.961 };
  const source = "supabase" as const;
  const groups = atlasStops(ATLAS_PLACES, [
    { ...example, coordinates },
    { ...example, id: "first", source, coordinates, slug: "first" },
    { ...example, id: "second", source, coordinates, slug: "second" },
    { ...example, id: "not-located", source },
  ]);
  assert.equal(groups.length, ATLAS_PLACES.length + 1);
  assert.equal(groups.at(-1)?.name, "2 places here");
  assert.deepEqual(groups.at(-1)?.members.map(item => item.href), ["/venues/first", "/venues/second"]);
});

test("both directions providers receive latitude then longitude for any valid map pin", () => {
  const links = pointDirections({ latitude: -37.81, longitude: 144.961 });
  assert.ok(links);
  for (const href of [links.google, links.apple]) {
    assert.equal(new URL(href).searchParams.get("destination"), "-37.810000,144.961000");
  }
  assert.equal(pointDirections({ latitude: NaN, longitude: 0 }), null);
  assert.equal(pointDirections({ latitude: 12, longitude: 200 }), null);
});
