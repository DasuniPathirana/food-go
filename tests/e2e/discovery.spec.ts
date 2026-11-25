import { expect, test, type Page } from "@playwright/test";

async function fixture(page: Page) {
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.href === "https://tiles.openfreemap.org/styles/liberty") return route.fulfill({ json: {
      version: 8, sources: {}, layers: [{ id: "land", type: "background", paint: { "background-color": "#e5ead8" } }],
    } });
    if (url.pathname === "/atlas/melbourne-buildings.geojson") return route.fulfill({ json: { type: "FeatureCollection", features: [] } });
    return url.hostname === "127.0.0.1" ? route.fallback() : route.abort();
  });
  await page.goto("/"); await page.getByRole("button", { name: "Face north", exact: true }).waitFor();
}
// QA-only ref inspection; the production app exposes no location debug global.
async function fog(page: Page, action: "inspect" | "zoom-out" = "inspect") {
  return page.locator(".maplibregl-map").evaluate((element, action) => {
    const node = element as unknown as Record<string, unknown>;
    let fiber = node[Object.keys(node).find(key => key.startsWith("__reactFiber"))!] as any, map: any;
    for (; fiber && !map; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) {
      const value = hook.memoizedState?.current;
      if (value?.getSource && value.getCanvas?.() === element.querySelector("canvas.maplibregl-canvas")) map = value;
    }
    if (!map) throw new Error("Map ref unavailable");
    if (action === "zoom-out") map.jumpTo({ zoom: 6, pitch: 0 });
    const source = map.getSource("food-go-discovery-fog")?.serialize().data;
    const centre = map.project([144.9671462327242, -37.81681344435442]);
    return { features: source?.features?.length ?? 0,
      centreCovered: map.queryRenderedFeatures(centre, { layers: ["food-go-discovery-fog-fill"] }).length,
      paint: map.getPaintProperty("food-go-discovery-fog-fill", "fill-opacity") };
  }, action);
}

test("discovery fog has real geographic gaps and manual preview never contacts saving API", async ({ page }) => {
  let calls = 0; page.on("request", request => { if (new URL(request.url()).pathname === "/api/exploration") calls++; });
  await fixture(page);
  expect((await fog(page)).features).toBe(0);
  await page.locator('summary[aria-label="Game graphics settings"]').click();
  await page.getByRole("button", { name: "Discovery fog", exact: true }).click();
  await page.locator('summary[aria-label="Game graphics settings"]').click();
  await expect.poll(async () => (await fog(page)).features).toBeGreaterThan(0);
  await expect.poll(async () => (await fog(page)).centreCovered).toBe(0);
  expect((await fog(page)).paint).toBeLessThan(.5);
  await page.locator('summary[aria-label="Open game details and discovery settings"]').click();
  await page.locator("summary").filter({ hasText: "Area discovery" }).click();
  await expect(page.getByText(/of the visible grid explored/)).toBeVisible();
  await expect(page.getByText("Account saving is not enabled yet. You can explore with a session preview.")).toBeVisible();
  expect(calls).toBe(0);
  await page.getByRole("button", { name: "Hide discovery fog", exact: true }).click();
  await expect.poll(async () => (await fog(page)).features).toBe(0);
  expect(calls).toBe(0);
});

test("large views defer bounded fog and WebGL recovery preserves its preview", async ({ page }) => {
  await fixture(page);
  await page.locator('summary[aria-label="Open game details and discovery settings"]').click();
  await page.locator("summary").filter({ hasText: "Area discovery" }).click();
  await page.getByRole("button", { name: "Show discovery fog", exact: true }).click();
  await expect.poll(async () => (await fog(page)).features).toBeGreaterThan(0);
  await fog(page, "zoom-out");
  await expect(page.getByText(/Zoom in or use Overview to see discovery fog/)).toBeVisible();
  await expect.poll(async () => (await fog(page)).features).toBe(0);
  await page.locator("canvas.maplibregl-canvas").evaluate(canvas => {
    const context = (canvas as HTMLCanvasElement).getContext("webgl2");
    context?.getExtension("WEBGL_lose_context")?.loseContext();
  });
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.locator(".leaflet-discovery-fog-pane path").first()).toBeAttached();
  await expect(page.getByText(/of the visible grid explored/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear session preview", exact: true })).toBeEnabled();
  const attribution = page.locator(".leaflet-control-attribution");
  await expect(attribution).toBeVisible(); await expect(attribution).toContainText("OpenStreetMap");
});

test("saving remains closed and private when release flag is off", async ({ request }) => {
  for (const response of [await request.get("/api/exploration"), await request.post("/api/exploration", {
    data: { action: "observe", longitude: 144.9, latitude: -37.8, cells: ["wm18:1:2"], xp: 999 },
  })]) {
    expect(response.status()).toBe(503); expect(response.headers()["cache-control"]).toBe("no-store");
    const body = await response.json(); expect(body).toEqual({ error: "Saving exploration is not enabled yet. You can use a session preview." });
  }
});
