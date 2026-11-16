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
  assert.equal(groups.at(-1)?.shopCount, 2);
  assert.equal(groups.at(-1)?.kind, "building");
  assert.equal(groups.at(-1)?.image, undefined);
  assert.deepEqual(groups.at(-1)?.members.map(item => item.href), ["/venues/first", "/venues/second"]);
  assert.equal(groups.at(-1)?.members[0].image, example.image);
  assert.equal(groups.at(-1)?.members[0].kind, example.type);
  assert.ok(groups.slice(0, -1).every(group => !group.shopCount));
});

test("published shops in one building share its name and first coordinate while retaining their unit directory", async () => {
  const [example] = (await loadCatalogue({ mode: "demo" })).venues;
  const firstCoordinate = { latitude: -37.81, longitude: 144.961 };
  const building = { id: "garden-arcade", name: "Garden Arcade", level: "Ground", unit: "01" };
  const groups = atlasStops([], [
    { ...example, id: "first", slug: "first", source: "supabase", coordinates: firstCoordinate, building },
    { ...example, id: "second", slug: "second", source: "supabase", coordinates: { latitude: -37.8101, longitude: 144.9611 },
      building: { ...building, level: "Level 1", unit: "12" } },
    { ...example, id: "other-building", slug: "other", source: "supabase", coordinates: firstCoordinate,
      building: { ...building, id: "another-arcade", name: "Another Arcade" } },
    { ...example, id: "street-shop", slug: "street", source: "supabase", coordinates: firstCoordinate },
  ]);
  assert.equal(groups.length, 3);
  assert.equal(groups[0].name, "Garden Arcade");
  assert.equal(groups[0].kind, "building");
  assert.equal(groups[0].shopCount, 2);
  assert.equal(groups[0].latitude, firstCoordinate.latitude);
  assert.equal(groups[0].longitude, firstCoordinate.longitude);
  assert.deepEqual(groups[0].members.map(member => [member.id, member.area]), [
    ["first", "Garden Arcade · Ground · 01"], ["second", "Garden Arcade · Level 1 · 12"],
  ]);
  assert.deepEqual(groups.slice(1).map(group => group.members[0].id), ["other-building", "street-shop"]);
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
