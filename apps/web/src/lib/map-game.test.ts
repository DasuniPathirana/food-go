import assert from "node:assert/strict";
import test from "node:test";
import { mapDistance, parseStreetRoute, prepareWalk, validMapPoint, walkPosition } from "./map-game";

test("street walking follows routed corners and preserves the route endpoints", () => {
  const route = prepareWalk({ type: "LineString", coordinates: [[144.96,-37.81],[144.961,-37.81],[144.961,-37.809]] });
  assert.ok(route);
  const cornerDistance = mapDistance({ longitude:144.96,latitude:-37.81 }, { longitude:144.961,latitude:-37.81 });
  const corner = walkPosition(route, cornerDistance);
  assert.ok(Math.abs(corner.point.longitude - 144.961) < 0.0000001);
  assert.ok(Math.abs(corner.point.latitude + 37.81) < 0.0000001);
  assert.ok(Math.abs(walkPosition(route, route.distance * 3).point.latitude + 37.809) < 0.0000001);
  assert.ok(Math.abs(walkPosition(route, -100).point.longitude - 144.96) < 0.0000001);
});
test("geographic distance and movement take the short antimeridian crossing", () => {
  const route = prepareWalk({ type: "LineString", coordinates: [[179.999,0],[-179.999,0]] });
  assert.ok(route && route.distance > 220 && route.distance < 225);
  assert.ok(Math.abs(Math.abs(walkPosition(route, route.distance / 2).point.longitude) - 180) < 0.00001);
  assert.equal(validMapPoint({ longitude:0,latitude:0 }), true);
  assert.equal(validMapPoint({ longitude:Infinity,latitude:0 }), false);
});
test("routing requires a valid bounded provider polyline and never invents a direct path", () => {
  const route = { geometry: { type:"LineString",coordinates:[[0,0],[0,0.01]] },distance:1112,duration:794,attribution:"Street provider" };
  assert.ok(parseStreetRoute(route));
  for (const malformed of [null, {}, { ...route, distance:Infinity }, { ...route, geometry:{ type:"LineString",coordinates:[[0,0]] } },
    { ...route, geometry:{ type:"LineString",coordinates:[[0,0],[181,1]] } }]) assert.equal(parseStreetRoute(malformed), null);
  assert.equal(prepareWalk({ type:"LineString",coordinates:[[0,0],[0,0]] }), null);
});
