import test from "node:test";
import assert from "node:assert/strict";
import {
  MELBOURNE_CENTRAL_MALL,
  QV_VILLAGE_MALL,
  getMallById,
  getAllMalls,
  getMallByCoordinate,
  getMallShopsByFloor,
  getMallQuestsByFloor,
  getMallCollectiblesByFloor,
  registerMall,
  type MallData,
} from "./mall";

test("pre-configured malls validate schema and have complete floor layouts", () => {
  const malls = getAllMalls();
  assert.ok(malls.length >= 2);

  const mc = getMallById("melbourne-central");
  assert.ok(mc);
  assert.equal(mc.name, "Melbourne Central");
  assert.ok(mc.floors.length >= 4);
  assert.ok(mc.shops.length >= 5);
  assert.ok(mc.quests.length >= 1);
  assert.ok(mc.collectibles.length >= 1);

  const qv = getMallById("qv-village");
  assert.ok(qv);
  assert.equal(qv.name, "QV Village");
  assert.ok(qv.floors.length >= 3);
});

test("getMallShopsByFloor returns only shops for the requested floor", () => {
  const lgShops = getMallShopsByFloor("melbourne-central", "lg");
  assert.ok(lgShops.length >= 2);
  for (const shop of lgShops) {
    assert.equal(shop.floorId, "lg");
    assert.equal(shop.mallId, "melbourne-central");
  }

  const l2Shops = getMallShopsByFloor("melbourne-central", "l2");
  assert.ok(l2Shops.length >= 2);
  for (const shop of l2Shops) {
    assert.equal(shop.floorId, "l2");
  }
});

test("getMallQuestsByFloor and getMallCollectiblesByFloor filter by floor correctly", () => {
  const gQuests = getMallQuestsByFloor("melbourne-central", "g");
  assert.equal(gQuests.length, 1);
  assert.equal(gQuests[0].title, "Shot Tower Discovery");

  const l3Collectibles = getMallCollectiblesByFloor("melbourne-central", "l3");
  assert.equal(l3Collectibles.length, 1);
  assert.equal(l3Collectibles[0].name, "Starlight Neon Badge");
});

test("getMallByCoordinate resolves coordinate proximity correctly", () => {
  // Proximity to Melbourne Central
  const mc = getMallByCoordinate({ longitude: 144.9628, latitude: -37.8105 }, 100);
  assert.ok(mc);
  assert.equal(mc.id, "melbourne-central");

  // Far coordinate does not match
  const none = getMallByCoordinate({ longitude: 144.95, latitude: -37.81 }, 100);
  assert.equal(none, null);
});

test("registerMall allows adding new extensible malls", () => {
  const customMall: MallData = {
    id: "emporium-melbourne",
    name: "Emporium Melbourne",
    suburb: "Melbourne CBD",
    state: "VIC",
    coordinates: { longitude: 144.9644, latitude: -37.8122 },
    entrance: {
      description: "Lonsdale Street pedestrian bridge entrance",
      streetName: "Lonsdale St",
    },
    floors: [
      { id: "lg", name: "Lower Ground - Cafe Court", level: -1 },
      { id: "g", name: "Ground Floor", level: 0 },
    ],
    shops: [
      { id: "emp-lg-01", mallId: "emporium-melbourne", floorId: "lg", unitNumber: "LG-22", name: "Matcha Paradise", category: "cafe" },
    ],
    quests: [],
    collectibles: [],
  };

  registerMall(customMall);
  const retrieved = getMallById("emporium-melbourne");
  assert.ok(retrieved);
  assert.equal(retrieved.name, "Emporium Melbourne");
});
