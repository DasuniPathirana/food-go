import { expect, test } from "@playwright/test";

// Control regressions run without map-provider or hosted account access.
// Real geographic rendering and device GPS need separate acceptance checks.
test.beforeEach(async ({ page }) => {
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    return url.hostname === "127.0.0.1" ? route.continue() : route.abort();
  });
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Geographic exploration", exact: true })).toBeVisible();
});

test("single game world graphics and accessible camera/avatar controls", async ({ page }) => {
  const graphics = page.locator('summary[aria-label="Game graphics settings"]');
  await graphics.click();
  await expect(page.getByText("Game world graphics", { exact: true })).toBeVisible();
  for (const name of ["3D world", "Low detail", "Discovery fog"])
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  for (const name of ["Streets", "Satellite", "Aerial"])
    await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(graphics).toBeFocused();
  await page.locator('summary[aria-label="Choose camera view"]').click();
  await page.getByRole("button", { name: "Third person view", exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem("food-go-explorer-view-v2"))).toBe("third");

  const avatar = page.getByRole("button", { name: "Locate explorer", exact: true });
  await avatar.focus();
  await page.keyboard.press("Shift+Enter");
  await expect(avatar).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("group", { name: "Avatar choices", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close avatar options", exact: true }).click();
  await expect(avatar).toHaveAttribute("aria-expanded", "false");
});

test("portrait hold previews and persists a cosmetic choice without requesting GPS", async ({ page }) => {
  await page.evaluate(() => {
    (window as unknown as { locationRequests: number }).locationRequests = 0;
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: {
      watchPosition() { (window as unknown as { locationRequests: number }).locationRequests++; return 1; }, clearWatch() {},
    } });
  });
  const avatar = page.getByRole("button", { name: "Locate explorer", exact: true });
  const box = (await avatar.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(620);
  await page.mouse.up();
  await expect(page.getByRole("group", { name: "Avatar choices" })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { locationRequests: number }).locationRequests)).toBe(0);
  await page.getByRole("button", { name: "Preview Trailblazer", exact: true }).click();
  await page.getByRole("button", { name: "Apply avatar", exact: true }).click();
  await expect(avatar).toHaveAttribute("data-avatar", "trailblazer");
  await expect(avatar).toBeFocused();
  await page.reload();
  await expect(avatar).toHaveAttribute("data-avatar", "trailblazer");
});

test("drag cancels the portrait hold, while a keyboard tap starts one location watch", async ({ page }) => {
  await page.evaluate(() => {
    const state = { requests: 0, clears: 0 };
    (window as unknown as { gpsTest: typeof state }).gpsTest = state;
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: {
      watchPosition(success: PositionCallback) {
        state.requests++;
        setTimeout(() => success({ timestamp: Date.now(), coords: { longitude: 144.967146, latitude: -37.816813, accuracy: 5, heading: null, speed: 0, altitude: null, altitudeAccuracy: null } } as GeolocationPosition), 10);
        return state.requests;
      }, clearWatch() { state.clears++; },
    } });
  });
  const avatar = page.getByRole("button", { name: "Locate explorer", exact: true });
  const box = (await avatar.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 20); await page.mouse.down();
  await page.mouse.move(box.x + 43, box.y + 20, { steps: 4 });
  await page.waitForTimeout(620); await page.mouse.up();
  await expect(avatar).toHaveAttribute("aria-expanded", "false");
  expect(await page.evaluate(() => (window as unknown as { gpsTest: { requests: number } }).gpsTest.requests)).toBe(0);
  await avatar.focus(); await page.keyboard.press("Enter");
  await expect(page.locator('[data-location-status="live"]')).toBeVisible();
  await avatar.click();
  expect(await page.evaluate(() => (window as unknown as { gpsTest: { requests: number } }).gpsTest.requests)).toBe(1);
  await page.getByText("Explorer actions and location", { exact: true }).click();
  await page.getByRole("button", { name: "Turn off live location", exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { gpsTest: { clears: number } }).gpsTest.clears)).toBe(1);
  await expect(page.locator('[data-location-status="manual"]')).toBeAttached();
});

test("denied location leaves manual exploration and a retry available", async ({ page }) => {
  await page.evaluate(() => Object.defineProperty(navigator, "geolocation", { configurable: true, value: {
    watchPosition(_success: PositionCallback, failure: PositionErrorCallback) { setTimeout(() => failure({ code: 1 } as GeolocationPositionError), 10); return 7; }, clearWatch() {},
  } }));
  await page.getByRole("button", { name: "Locate explorer", exact: true }).click();
  await expect(page.locator('[data-location-status="denied"]')).toBeVisible();
  await expect(page.getByText("Location permission was declined. Search for a place or choose a point on the map.", { exact: true })).toBeAttached();
  await expect(page.getByRole("button", { name: "Locate explorer", exact: true })).toBeEnabled();
});

for (const [code, status] of [[2, "unavailable"], [3, "error"]] as const) {
  test(`location ${status} retains a usable manual map`, async ({ page }) => {
    await page.evaluate(failureCode => Object.defineProperty(navigator, "geolocation", { configurable: true, value: {
      watchPosition(_success: PositionCallback, failure: PositionErrorCallback) { setTimeout(() => failure({ code: failureCode } as GeolocationPositionError), 10); return 7; }, clearWatch() {},
    } }), code);
    await page.getByRole("button", { name: "Locate explorer", exact: true }).click();
    await expect(page.locator(`[data-location-status="${status}"]`)).toBeVisible();
    await expect(page.getByRole("button", { name: "Locate explorer", exact: true })).toBeEnabled();
  });
}

test("weak GPS stays explicit and hiding Explore stops the watch and ignores late callbacks", async ({ page }) => {
  await page.evaluate(() => {
    const state = { clears: 0, send: (_accuracy: number) => {} };
    (window as unknown as { gpsSignal: typeof state }).gpsSignal = state;
    let stamp = Date.now();
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: {
      watchPosition(success: PositionCallback) {
        state.send = accuracy => success({ timestamp: ++stamp, coords: { longitude: 144.967146, latitude: -37.816813, accuracy, heading: null, speed: 0, altitude: null, altitudeAccuracy: null } } as GeolocationPosition);
        setTimeout(() => state.send(150), 10); return 7;
      }, clearWatch() { state.clears++; },
    } });
  });
  await page.getByRole("button", { name: "Locate explorer", exact: true }).click();
  await expect(page.locator('[data-location-status="weak"]')).toBeVisible();
  await page.evaluate(() => (window as unknown as { gpsSignal: { send: (accuracy: number) => void } }).gpsSignal.send(5));
  await expect(page.locator('[data-location-status="live"]')).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator('[data-location-status="paused"]')).toBeAttached();
  expect(await page.evaluate(() => (window as unknown as { gpsSignal: { clears: number } }).gpsSignal.clears)).toBe(1);
  await page.evaluate(() => (window as unknown as { gpsSignal: { send: (accuracy: number) => void } }).gpsSignal.send(5));
  await expect(page.locator('[data-location-status="paused"]')).toBeAttached();
});

test("map fills the first screen and core HUD targets stay accessible", async ({ page, isMobile }) => {
  const stage = page.locator('[data-selected="false"]');
  const box = (await stage.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.height / viewport.height).toBeGreaterThan(.7);
  expect(box.width).toBe(viewport.width);
  if (isMobile) {
    const navigation = (await page.getByRole("navigation", { name: "Mobile navigation", exact: true }).boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(navigation.y + 1);
  }
  for (const name of ["Locate explorer", "Overhead view"]) {
    const target = (await page.getByRole("button", { name, exact: true }).boundingBox())!;
    expect(target.width).toBeGreaterThanOrEqual(44); expect(target.height).toBeGreaterThanOrEqual(44);
  }
  const camera = (await page.locator('summary[aria-label="Choose camera view"]').boundingBox())!;
  expect(camera.width).toBeGreaterThanOrEqual(44); expect(camera.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("all camera profiles are reachable from the thumb control and the selection persists", async ({ page }) => {
  for (const [label, value] of [["Third person view", "third"], ["Close third person view", "close"], ["First person view", "first"]]) {
    await page.locator('summary[aria-label="Choose camera view"]').click();
    await page.getByRole("button", { name: label, exact: true }).click();
    expect(await page.evaluate(() => localStorage.getItem("food-go-explorer-view-v2"))).toBe(value);
    await expect(page.locator('summary[aria-label="Choose camera view"]')).toBeVisible();
  }
  await page.reload();
  expect(await page.evaluate(() => localStorage.getItem("food-go-explorer-view-v2"))).toBe("first");
  await page.getByRole("button", { name: "Overhead view", exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem("food-go-explorer-view-v2"))).toBe("overhead");
});

test("navigation keeps Explore centred and pages fit the viewport", async ({ page, isMobile }) => {
  const navigation = page.getByRole("navigation", { name: isMobile ? "Mobile navigation" : "Main navigation", exact: true });
  await expect(navigation.getByRole("link")).toHaveText(["Feed", "Quests", "Explore", "Deals", "Outback"]);
  await expect(navigation.getByRole("link", { name: "Explore", exact: true })).toHaveAttribute("aria-current", "page");
  const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  expect(await fits()).toBe(true);
  await navigation.getByRole("link", { name: "Deals", exact: true }).click();
  await expect(page).toHaveURL(/\/deals$/);
  await expect(page.getByRole("heading", { name: "Food Deals", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: /Restaurant Deals/ }).click();
  await expect(page.getByRole("heading", { name: "Restaurant Deals", exact: true })).toBeVisible();
  expect(await fits()).toBe(true);
});

test("demo discovery opens a local chest without contacting real reward endpoints", async ({ page }) => {
  const calls: string[] = [];
  page.on("request", request => {
    if (/\/api\/(?:encounters|inventory|claims|rewards)/.test(new URL(request.url()).pathname))
      calls.push(request.url());
  });
  await page.goto("/?world-demo=1");
  const demo = page.getByRole("button", { name: "Inspect the non-redeemable Food Go treasure demonstration" });
  await expect(demo).toBeVisible();
  await demo.click();
  await expect(page.getByRole("region", { name: "Food Go demonstration chest" })).toBeVisible();
  await page.getByRole("button", { name: "Open chest", exact: true }).click();
  await expect(page.getByText("A secret discovery!", { exact: true })).toBeVisible();
  await expect(page.getByText(/No inventory, offers or XP awarded/)).toBeVisible();
  expect(calls).toEqual([]);
});

test("guided client tour reaches city park and treasure without claiming real rewards", async ({ page }) => {
  const claims: string[] = [];
  page.on("request", request => {
    if (request.method() !== "GET" && /\/api\/(?:encounters|inventory|claims|rewards)/.test(new URL(request.url()).pathname))
      claims.push(request.url());
  });
  await page.goto("/?world-demo=1");
  const tour = page.getByRole("button", { name: "Open demo tour" });
  await expect(tour).toBeVisible();
  await tour.click();
  await page.getByRole("button", { name: /Park discovery/ }).click();
  await expect(tour).toBeVisible();
  await tour.click();
  await page.getByRole("button", { name: /Treasure encounter/ }).click();
  await expect(page.getByRole("region", { name: "Food Go demonstration chest" })).toBeVisible();
  await expect(page.getByText(/Visual demonstration only/)).toBeVisible();
  expect(claims).toEqual([]);
});
