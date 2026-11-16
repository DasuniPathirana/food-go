import assert from "node:assert/strict";
import test from "node:test";
import { createMapServices, mapDistance, parseMapCoordinate } from "./map-services";

const routeRequest = () => new Request("https://food.example/api/map/route?from=144.9631,-37.8102&to=144.9661,-37.8122");
const geometry = { type: "LineString", coordinates: [[144.9631, -37.8102], [144.9632, -37.8109], [144.9661, -37.8122]] };
const route = { code: "Ok", routes: [{ geometry, distance: 420, duration: 310 }] };
const search = { features: [{ geometry: { type: "Point", coordinates: [144.9631, -37.8102] },
  properties: { osm_id: 123, osm_type: "N", name: "City library", city: "Melbourne", state: "Victoria", country: "Australia", extent: [144.96, -37.80, 144.97, -37.82], email: "private" } }] };

test("geocoding uses explicit bounded input and caches successful public results before requesting another lease", async () => {
  let leases = 0, calls = 0;
  const services = createMapServices({ env: { APP_ORIGIN: "https://food.example" }, acquireLease: async service => { assert.equal(service, "geocoding"); leases++; return true; },
    fetch: async (input, init) => {
      calls++;
      const url = new URL(String(input));
      assert.equal(url.origin, "https://photon.komoot.io");
      assert.equal(url.searchParams.get("q"), "Melbourne");
      assert.equal(url.searchParams.get("limit"), "6");
      assert.equal(init?.cache, "no-store");
      assert.match(new Headers(init?.headers).get("User-Agent") || "", /FoodGo.*food\.example/u);
      return Response.json(search);
    } });
  const first = await services.search(new Request("https://food.example/api/map/search?q=Melbourne"));
  assert.equal(first.status, 200);
  const body = await first.json();
  assert.deepEqual(body.results[0].bounds, [144.96, -37.82, 144.97, -37.80]);
  assert.equal(body.results[0].longitude, 144.9631);
  assert.equal(body.results[0].latitude, -37.8102);
  assert.ok(!JSON.stringify(body).includes("private"));
  assert.equal(first.headers.get("cache-control"), "no-store");
  assert.equal((await services.search(new Request("https://food.example/api/map/search?q=melbourne"))).status, 200);
  assert.equal(leases, 1);
  assert.equal(calls, 1);
  for (const suffix of ["?q=a", "?q=A&q=B", "?q=Melbourne&url=http://localhost", "?q=%00Melbourne"]) {
    assert.equal((await services.search(new Request("https://food.example/api/map/search" + suffix))).status, 400);
  }
  assert.equal(calls, 1);
});

test("pedestrian requests use the true foot graph, validated GeoJSON and a shared lease", async () => {
  let leases = 0, calls = 0;
  const services = createMapServices({ env: {}, acquireLease: async service => { assert.equal(service, "routing"); leases++; return true; },
    fetch: async input => {
      calls++;
      const url = new URL(String(input));
      assert.equal(url.origin, "https://routing.openstreetmap.de");
      assert.ok(url.pathname.startsWith("/routed-foot/route/v1/foot/"));
      assert.equal(url.searchParams.get("geometries"), "geojson");
      return Response.json(route);
    } });
  const response = await services.route(routeRequest());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.geometry, geometry);
  assert.equal(body.distance, 420);
  assert.equal(body.duration, 310);
  assert.match(body.attribution, /FOSSGIS.*OpenStreetMap/u);
  assert.equal((await services.route(routeRequest())).status, 200);
  assert.equal(leases, 1);
  assert.equal(calls, 1);
});

test("invalid, overlong and ambiguous walks never call a provider", async () => {
  let leases = 0;
  const services = createMapServices({ env: {}, acquireLease: async () => { leases++; return true; }, fetch: async () => { throw new Error("Should not fetch"); } });
  for (const suffix of ["?from=0,0&to=0,0", "?from=0,0&to=30,30", "?from=0,0&from=1,1&to=2,2",
    "?from=0,91&to=0,0", "?from=http://localhost&to=0,0", "?from=NaN,1&to=0,0"]) {
    assert.equal((await services.route(new Request("https://food.example/api/map/route" + suffix))).status, 400);
  }
  assert.equal(leases, 0);
  assert.equal(parseMapCoordinate("181,0"), null);
  assert.deepEqual(parseMapCoordinate("0,-45.25"), [0, -45.25]);
  assert.ok(mapDistance([144.9631, -37.8102], [144.9661, -37.8122]) > 100);
});

test("busy leases and upstream failures preserve clear states without revealing provider data", async () => {
  let calls = 0;
  const busy = createMapServices({ env: {}, acquireLease: async () => false, fetch: async () => { calls++; return Response.json(route); } });
  const result = await busy.route(routeRequest());
  assert.equal(result.status, 429);
  assert.equal(result.headers.get("retry-after"), "2");
  assert.equal(calls, 0);
  for (const payload of [{ code: "NoRoute", message: "private provider detail" }, { code: "Ok", routes: [{ ...route.routes[0], geometry: { ...geometry, coordinates: [[500, 0], [1, 1]] } }] }]) {
    const failed = createMapServices({ env: {}, acquireLease: async () => true, fetch: async () => Response.json(payload) });
    const response = await failed.route(routeRequest());
    assert.equal(response.status, 404);
    assert.doesNotMatch(await response.text(), /private provider detail/u);
  }
  const failedLease = createMapServices({ env: {}, acquireLease: async () => { throw new Error("Database password"); } });
  const response = await failedLease.route(routeRequest());
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /Database password/u);
});

test("configured openrouteservice uses foot-walking and keeps its server key out of responses", async () => {
  let leases = 0;
  const services = createMapServices({ env: { OPENROUTESERVICE_API_KEY: "test-key" }, acquireLease: async () => { leases++; return true; },
    fetch: async (input, init) => {
      assert.equal(String(input), "https://api.openrouteservice.org/v2/directions/foot-walking/geojson");
      assert.equal(new Headers(init?.headers).get("Authorization"), "test-key");
      assert.deepEqual(JSON.parse(String(init?.body)).coordinates, [[144.9631, -37.8102], [144.9661, -37.8122]]);
      return Response.json({ features: [{ geometry, properties: { summary: { distance: 420, duration: 310 } } }] });
    } });
  const response = await services.route(routeRequest());
  assert.equal(response.status, 200);
  assert.equal(leases, 0);
  assert.doesNotMatch(await response.text(), /test-key/u);
});
