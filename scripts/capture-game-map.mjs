import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

// Real provider rendering, separate from the deterministic offline UI suite.
// Start a local server first. Never accepts an external application origin.
const origin = process.env.FOOD_GO_CHECK_ORIGIN || "http://127.0.0.1:3000";
assert.ok(["127.0.0.1", "localhost"].includes(new URL(origin).hostname));
const browser = await chromium.launch({ headless: true });
const evidence = { capturedAt: new Date().toISOString(), runtime: await browser.version(), runtimeErrors: [], viewports: [] };
try {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce", isMobile: viewport.width < 500, hasTouch: viewport.width < 500 });
    const page = await context.newPage();
    page.on("pageerror", error => evidence.runtimeErrors.push(error.message));
    await page.goto(origin);
    await page.getByRole("button", { name: "Face north", exact: true }).waitFor({ timeout: 45000 });
    await page.waitForTimeout(1500);
    const canvas = await page.locator("canvas.maplibregl-canvas").elementHandle();
    const label = viewport.width < 500 ? "phone" : "desktop";
    await page.screenshot({ path: `docs/screenshots/23-after-${label}.png` });
    const bounds = await page.locator("[data-camera]").boundingBox();
    const snapshot = { viewport, bounds, horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), cameras: [], fallbackRecovered: false };
    for (const [name, mode] of [["Third person view", "third"], ["Close third person view", "close"], ["First person view", "first"]]) {
      await page.locator('summary[aria-label="Choose camera view"]').click();
      await page.getByRole("button", { name, exact: true }).click();
      await page.waitForTimeout(900);
      assert.equal(await page.locator("[data-camera]").getAttribute("data-camera"), mode);
      const retained = await canvas.evaluate(node => node.isConnected && node === document.querySelector("canvas.maplibregl-canvas"));
      assert.ok(retained, "Changing camera must retain the geographic canvas");
      snapshot.cameras.push({ mode, sameGeographicCanvas: retained });
      if (label === "phone") await page.screenshot({ path: `docs/screenshots/23-camera-${mode}-phone.png` });
    }
    await page.getByRole("button", { name: "Overhead view", exact: true }).click();
    await page.getByRole("button", { name: "Explore full map", exact: true }).click();
    assert.ok(await canvas.evaluate(node => node.isConnected && node === document.querySelector("canvas.maplibregl-canvas")));
    await page.keyboard.press("Escape");

    const lost = await canvas.evaluate(node => {
      const gl = node.getContext("webgl2") || node.getContext("webgl");
      const extension = gl?.getExtension("WEBGL_lose_context");
      extension?.loseContext(); return !!extension;
    });
    if (lost) {
      await page.getByRole("button", { name: "Retry 3D", exact: true }).waitFor();
      await page.locator(".leaflet-container").waitFor();
      if (label === "phone") await page.screenshot({ path: "docs/screenshots/23-fallback-phone.png" });
      await page.getByRole("button", { name: "Retry 3D", exact: true }).click();
      await page.getByRole("button", { name: "Face north", exact: true }).waitFor({ timeout: 45000 });
      snapshot.fallbackRecovered = true;
    }
    await page.getByRole("button", { name: "Locate explorer", exact: true }).focus();
    await page.keyboard.press("Shift+Enter");
    await page.getByRole("group", { name: "Avatar choices", exact: true }).waitFor();
    if (label === "phone") await page.screenshot({ path: "docs/screenshots/23-wardrobe-phone.png" });
    await page.getByRole("button", { name: "Close avatar options", exact: true }).click();
    evidence.viewports.push(snapshot);
    await context.close();
  }
  assert.deepEqual(evidence.runtimeErrors, []);
  console.log(JSON.stringify(evidence, null, 2));
  await writeFile("docs/screenshots/23-browser-evidence.json", JSON.stringify(evidence, null, 2) + "\n");
} finally { await browser.close(); }
