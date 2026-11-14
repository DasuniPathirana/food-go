import assert from "node:assert/strict";
import { test } from "node:test";
import { venueAreaMaps, venueDirections } from "./directions";

const venue = {
  source: "supabase" as const, name: "Bowl & Brew", address: "Shop 4, 12 King Street",
  suburb: "Melbourne", state: "VIC", postcode: "3000",
};

test("external directions use fixed HTTPS providers with one encoded destination and no supplied user location", () => {
  const links = venueDirections(venue);
  assert.ok(links);
  assert.equal(links.destination, "Bowl & Brew, Shop 4, 12 King Street, Melbourne, VIC 3000, Australia");
  const google = new URL(links.googleMaps);
  const apple = new URL(links.appleMaps);
  assert.equal(google.origin, "https://www.google.com");
  assert.equal(google.pathname, "/maps/dir/");
  assert.equal(google.searchParams.get("api"), "1");
  assert.equal(google.searchParams.get("destination"), links.destination);
  assert.equal(apple.origin, "https://maps.apple.com");
  assert.equal(apple.pathname, "/directions");
  assert.equal(apple.searchParams.get("destination"), links.destination);
  assert.deepEqual([...google.searchParams.keys()], ["api", "destination"]);
  assert.deepEqual([...apple.searchParams.keys()], ["destination"]);
});

test("fictional and incomplete addresses cannot become navigation destinations", () => {
  for (const change of [{ source: "demo" as const }, { address: " " }, { suburb: "" }, { name: "" }, { state: "other" }, { postcode: "300" }, { address: "12 King\nStreet" }]) {
    assert.equal(venueDirections({ ...venue, ...change }), null);
  }
  assert.equal(venueDirections({ ...venue, address: "a".repeat(201) }), null);
});

test("address characters cannot add provider parameters or change the destination host", () => {
  const links = venueDirections({ ...venue, name: "Lunch? &origin=elsewhere#" });
  assert.ok(links);
  const google = new URL(links.googleMaps);
  assert.equal(google.searchParams.has("origin"), false);
  assert.equal(google.hash, "");
  assert.match(google.searchParams.get("destination") || "", /^Lunch\? &origin=elsewhere#/u);
  assert.equal(new URL(links.appleMaps).searchParams.size, 1);
});

test("demo map links search only the real area and do not include a fictional venue or supplied origin", () => {
  const links = venueAreaMaps({ id: "finch-and-field", source: "demo", suburb: "Fitzroy", state: "VIC" });
  assert.ok(links);
  assert.equal(links.area, "Fitzroy, VIC");
  assert.equal(links.query, "Fitzroy, VIC, Australia");
  const google = new URL(links.googleMaps), apple = new URL(links.appleMaps);
  assert.equal(google.origin, "https://www.google.com");
  assert.equal(google.pathname, "/maps/search/");
  assert.deepEqual([...google.searchParams], [["api", "1"], ["query", links.query]]);
  assert.equal(apple.origin, "https://maps.apple.com");
  assert.equal(apple.pathname, "/search");
  assert.deepEqual([...apple.searchParams], [["query", links.query]]);
});

test("the three fictional arcade shops explicitly open Melbourne, never Example neighbourhood", () => {
  for (const id of ["arcade-leaf-and-grain", "arcade-laneway-noodles", "arcade-cloud-patisserie"]) {
    const links = venueAreaMaps({ id, source: "demo", suburb: "Example neighbourhood", state: "VIC" });
    assert.ok(links);
    assert.equal(links.query, "Melbourne, VIC, Australia");
    assert.equal(new URL(links.googleMaps).searchParams.get("query"), "Melbourne, VIC, Australia");
  }
  assert.equal(venueAreaMaps({ id: "unknown", source: "demo", suburb: "Example neighbourhood", state: "VIC" }), null);
});

test("area links reject incomplete or fictional localities and cannot replace published directions", () => {
  const example = { id: "finch-and-field", source: "demo" as const, suburb: "Fitzroy", state: "VIC" };
  for (const change of [{ source: "supabase" as const }, { suburb: "" }, { suburb: "a".repeat(101) }, { suburb: "Fictional suburb" }, { suburb: "Fitzroy\nMelbourne" }, { state: "other" }]) {
    assert.equal(venueAreaMaps({ ...example, ...change }), null);
  }
  const links = venueAreaMaps({ ...example, suburb: "Fitzroy? &origin=elsewhere#" });
  assert.ok(links);
  const google = new URL(links.googleMaps);
  assert.equal(google.searchParams.get("query"), "Fitzroy? &origin=elsewhere#, VIC, Australia");
  assert.deepEqual([...google.searchParams.keys()], ["api", "query"]);
  assert.equal(google.hash, "");
  assert.equal(new URL(links.appleMaps).searchParams.size, 1);
});
