import { expect, test, type Page } from "@playwright/test";

const explorer = { longitude: 144.9671462327242, latitude: -37.81681344435442 };
const style = { version: 8, sources: {}, layers: [{ id: "land", type: "background", paint: { "background-color": "#e5ead8" } }] };
const empty = { type: "FeatureCollection", features: [] };

async function fixture(page: Page, buildings: object = empty) {
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.href === "https://tiles.openfreemap.org/styles/liberty") return route.fulfill({ json: style });
    if (url.pathname === "/atlas/melbourne-buildings.geojson") return route.fulfill({ json: buildings });
    return url.hostname === "127.0.0.1" ? route.fallback() : route.abort();
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Face north", exact: true }).waitFor();
}

// Test-only inspection of the map ref. Application code exposes no debug
// global or precise-location data attributes. Assertions use public map APIs.
async function camera(page: Page) {
  const state = await page.locator(".maplibregl-map").evaluate(element => {
    const node = element as unknown as Record<string, unknown>;
    // React's hook implementation is deliberately confined to this QA helper.
    let fiber = node[Object.keys(node).find(key => key.startsWith("__reactFiber"))!] as any;
    let map: any;
    for (; fiber && !map; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) {
      const value = hook.memoizedState?.current;
      if (typeof value?.getCenter === "function" && value.getCanvas?.() === element.querySelector("canvas.maplibregl-canvas")) map = value;
    }
    if (!map) throw new Error("Geographic map ref unavailable to the test inspector");
    return { centre: { longitude: map.getCenter().lng, latitude: map.getCenter().lat }, zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing(),
      fieldOfView: map.getVerticalFieldOfView(), height: map.getCanvas().clientHeight, ground: map.getCenterElevation() };
  });
  // Invert the renderer's documented Mercator projection, using its installed
  // earth radius. This measures the physical eye, not the look-ahead centre.
  const radians = Math.PI / 180, centreX = (state.centre.longitude + 180) / 360;
  const centreY = (1 - Math.log(Math.tan(Math.PI / 4 + state.centre.latitude * radians / 2)) / Math.PI) / 2;
  const distance = .5 * state.height / Math.tan(state.fieldOfView * radians / 2) / (512 * 2 ** state.zoom);
  const horizontal = distance * Math.sin(state.pitch * radians);
  return { ...state, eye: {
    longitude: (centreX - Math.sin(state.bearing * radians) * horizontal) * 360 - 180,
    latitude: Math.atan(Math.sinh(Math.PI * (1 - 2 * (centreY + Math.cos(state.bearing * radians) * horizontal)))) / radians,
    altitude: state.ground + distance * Math.cos(state.pitch * radians) * 2 * Math.PI * 6371008.8 * Math.cos(state.centre.latitude * radians),
  } };
}
async function choose(page: Page, name: string) {
  await page.locator('summary[aria-label="Choose camera view"]').click();
  await page.getByRole("button", { name, exact: true }).click();
  if (name === "First person view") await expect(page.locator("canvas.maplibregl-canvas")).toHaveAttribute("aria-label", /^Street view/);
}
function sameEye(a: Awaited<ReturnType<typeof camera>>, b: Awaited<ReturnType<typeof camera>>) {
  expect(Math.abs(a.eye.longitude - b.eye.longitude)).toBeLessThan(.0000001);
  expect(Math.abs(a.eye.latitude - b.eye.latitude)).toBeLessThan(.0000001);
  expect(Math.abs(a.eye.altitude - b.eye.altitude)).toBeLessThan(.002);
}

test("drag, keyboard, optical zoom and pinch retain the actual 1.7 metre eye", async ({ page, context, isMobile }) => {
  await fixture(page); await choose(page, "First person view");
  const before = await camera(page);
  expect(before.eye.altitude).toBeCloseTo(1.7, 3);
  const bounds = (await page.locator("canvas.maplibregl-canvas").boundingBox())!;
  const x = bounds.x + bounds.width * .4, y = bounds.y + bounds.height * .45;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 70, y + 20, { steps: 8 }); await page.mouse.up();
  const dragged = await camera(page); sameEye(before, dragged); expect(Math.abs(dragged.bearing - before.bearing)).toBeGreaterThan(5);
  await expect(page.locator('[data-selected="false"]')).toBeVisible();
  await page.getByRole("button", { name: "Zoom in on geographic map", exact: true }).click();
  const zoomed = await camera(page); sameEye(before, zoomed); expect(zoomed.fieldOfView).toBeLessThan(before.fieldOfView);
  const canvas = page.locator("canvas.maplibregl-canvas"); await canvas.focus(); await page.keyboard.press("ArrowLeft");
  sameEye(before, await camera(page));
  if (isMobile) {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x - 35, y, id: 1 }, { x: x + 35, y, id: 2 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x - 60, y, id: 1 }, { x: x + 60, y, id: 2 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await cdp.detach();
  } else { await page.mouse.move(x, y); await page.mouse.wheel(0, 100); }
  sameEye(before, await camera(page));
  await expect(page.locator('[data-selected="false"]')).toBeVisible();
  await page.getByRole("button", { name: "Overhead view", exact: true }).click();
  expect((await camera(page)).pitch).toBe(44);
  // Normal geographic panning returns after the eye controller is removed.
  const overview = await camera(page);
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 90, y, { steps: 8 }); await page.mouse.up();
  expect((await camera(page)).centre.longitude).not.toBe(overview.centre.longitude);
});

test("a street tap remains one route request after looking around", async ({ page }) => {
  let routes = 0;
  await page.route("**/api/map/route?**", route => { routes++; return route.fulfill({ status: 503, json: { error: "Test routing unavailable" } }); });
  await fixture(page); await choose(page, "First person view");
  const box = (await page.locator("canvas.maplibregl-canvas").boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('[data-selected="true"]')).toBeVisible();
  await expect.poll(() => routes).toBe(1);
});

test("loaded building footprints shorten the follow boom without relocating the explorer", async ({ page }) => {
  const point = (x: number, y: number) => [explorer.longitude + x / (111320 * Math.cos(explorer.latitude * Math.PI / 180)), explorer.latitude + y / 111320];
  // A full survey can return thousands of distant shapes before this nearby
  // wall. Clearance must filter geographically before applying its work cap.
  const distant = Array.from({ length: 3000 }, (_, index) => {
    const x = 120 + index % 40 * 2, y = 120 + Math.floor(index / 40) * 2;
    return { type: "Feature", properties: { height: 10, min_height: 0 }, geometry: {
      type: "Polygon", coordinates: [[point(x, y), point(x + 1, y), point(x + 1, y + 1), point(x, y + 1), point(x, y)]],
    } };
  });
  const buildings = { type: "FeatureCollection", features: [...distant, { type: "Feature", properties: { height: 20, min_height: 0 }, geometry: {
    type: "Polygon", coordinates: [[point(1.7, -8), point(3.5, -8), point(3.5, -5.5), point(1.7, -5.5), point(1.7, -8)]],
  } }] };
  await fixture(page, buildings);
  const sourceCount = await page.locator(".maplibregl-map").evaluate((element, explorer) => {
    const node = element as unknown as Record<string, unknown>;
    let fiber = node[Object.keys(node).find(key => key.startsWith("__reactFiber"))!] as any, map: any;
    for (; fiber && !map; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) {
      const value = hook.memoizedState?.current;
      if (value?.querySourceFeatures && value.getCanvas?.() === element.querySelector("canvas.maplibregl-canvas")) map = value;
    }
    if (!map) throw new Error("Map ref unavailable");
    const query = map.querySourceFeatures.bind(map);
    const count = query("food-go-city-buildings").length;
    // Source result ordering has no proximity guarantee. Exercise a valid
    // distant-first order using actual loaded features and real filter results.
    map.querySourceFeatures = (source: string, options: unknown) => {
      const features = query(source, options);
      const distance = (feature: any) => {
        const point = feature.geometry.coordinates[0][0];
        return (point[0] - explorer.longitude) ** 2 + (point[1] - explorer.latitude) ** 2;
      };
      return source === "food-go-city-buildings" ? features.sort((a: any, b: any) => distance(b) - distance(a)) : features;
    };
    return count;
  }, explorer);
  expect(sourceCount).toBeGreaterThan(2500);
  await choose(page, "Third person view");
  await expect(page.getByText("Camera moved closer for building clearance.", { exact: true })).toBeVisible();
  const pose = await camera(page);
  const boom = Math.hypot((pose.eye.longitude - explorer.longitude) * 111320 * Math.cos(explorer.latitude * Math.PI / 180), (pose.eye.latitude - explorer.latitude) * 111320);
  expect(boom).toBeGreaterThan(2); expect(boom).toBeLessThan(10);
  await page.getByRole("button", { name: "Overhead view", exact: true }).click(); await choose(page, "First person view");
  const eye = (await camera(page)).eye;
  expect(eye.longitude).toBeCloseTo(explorer.longitude, 7); expect(eye.latitude).toBeCloseTo(explorer.latitude, 7);
});

test("a saved follow view starts successfully before building tiles are ready", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("food-go-explorer-view-v2", "third"));
  await fixture(page);
  await expect(page.locator('[data-camera="third"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry 3D", exact: true })).toHaveCount(0);
});

test("device compass requires a tap, accepts absolute samples and yields to touch look", async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).compassRequests = 0;
    Object.defineProperty(DeviceOrientationEvent, "requestPermission", { configurable: true, value: async () => { (window as any).compassRequests++; return "granted"; } });
  });
  await fixture(page); await choose(page, "First person view");
  expect(await page.evaluate(() => (window as any).compassRequests)).toBe(0);
  await page.locator('summary[aria-label="Choose camera view"]').click(); await page.getByRole("button", { name: "Device compass", exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new DeviceOrientationEvent("deviceorientationabsolute", { alpha: 90, beta: 90, gamma: 0, absolute: true })));
  await expect(page.locator('summary[aria-label="Choose camera view"]')).toContainText("Compass");
  await expect(page.locator('button[aria-label="Device compass"]')).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => (window as any).compassRequests)).toBe(1);
  const oriented = await camera(page); expect(Math.abs(oriented.bearing + 90)).toBeLessThan(.1);
  await page.keyboard.press("Escape");
  const box = (await page.locator("canvas.maplibregl-canvas").boundingBox())!;
  await page.mouse.move(box.x + box.width * .4, box.y + box.height * .4); await page.mouse.down();
  await page.mouse.move(box.x + box.width * .4 + 40, box.y + box.height * .4, { steps: 6 }); await page.mouse.up();
  const touched = await camera(page); sameEye(oriented, touched);
  expect(Math.abs(touched.bearing - oriented.bearing)).toBeLessThan(20);
  await page.locator('summary[aria-label="Choose camera view"]').click();
  await expect(page.getByRole("button", { name: "Device compass", exact: true })).toHaveAttribute("aria-pressed", "false");
});
