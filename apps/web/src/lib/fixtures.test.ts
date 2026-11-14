import { test } from "node:test";
import assert from "node:assert/strict";
import { filterVenues } from "./fixtures";

test("search matches cuisines, suburbs and dish names without changing fixtures", () => {
  assert.equal(
    filterVenues("  ITALIAN ", "All discoveries")[0]?.id,
    "ciao-carlton",
  );
  assert.equal(filterVenues("Fitzroy", "Cafes").length, 1);
  assert.equal(filterVenues("margherita", "All discoveries").length, 1);
});
test("filters combine and unsupported cities never show misleading local results", () => {
  assert.equal(filterVenues("pizza", "Cafes").length, 0);
  assert.equal(filterVenues("", "Restaurants").length, 1);
  assert.equal(filterVenues("", "All discoveries", "Sydney").length, 0);
  assert.equal(filterVenues("<script>", "All discoveries").length, 0);
});
