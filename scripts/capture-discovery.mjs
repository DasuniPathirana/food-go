import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

// Real-provider evidence only. There are deliberately no request mocks, GPS
// permissions, signed-in fixtures or application debug globals in this script.
const supplied = new URL(process.env.FOOD_GO_CHECK_ORIGIN || "http://127.0.0.1:3200");
assert.ok(["http:", "https:"].includes(supplied.protocol) && ["127.0.0.1", "localhost", "[::1]"].includes(supplied.hostname), "Capture requires a loopback HTTP origin");
assert.ok(!supplied.username && !supplied.password && supplied.pathname === "/" && !supplied.search && !supplied.hash, "Supply an origin without credentials, a path or query");
const origin = supplied.origin;
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const screenshots = resolve(root, "docs/screenshots"), artifacts = resolve(root, "artifacts");
await Promise.all([mkdir(screenshots, { recursive: true }), mkdir(artifacts, { recursive: true })]);
// Public demo starting point, never a device fix.
const publicPoint = { longitude: 144.9671462327242, latitude: -37.81681344435442 };
const evidence = { capturedAt: new Date().toISOString(), origin, runtime: "", providersMocked: false,
  deviceLocationRequested: false, runtimeErrors: [], viewports: [] };
const browser = await chromium.launch({ headless: true });
evidence.runtime = await browser.version();

// React internals are confined to this QA inspector. Once found, inspection
// uses the actual renderer's public APIs, including its rendered fog geometry.
async function inspect(page) {
  const state = await page.locator(".maplibregl-map").evaluate((element, point) => {
    let fiber = element[Object.keys(element).find(key => key.startsWith("__reactFiber"))], map;
    for (; fiber && !map; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) {
      const value = hook.memoizedState?.current;
      if (typeof value?.getCenter === "function" && value.getCanvas?.() === element.querySelector("canvas.maplibregl-canvas")) map = value;
    }
    if (!map) throw new Error("Geographic map ref unavailable to QA inspector");
    const fogLayer = "food-go-discovery-fog-fill", data = map.getSource("food-go-discovery-fog")?.serialize().data;
    const size = 262144, x = Math.floor((point.longitude + 180) / 360 * size);
    const y = Math.floor((1 - Math.asinh(Math.tan(point.latitude * Math.PI / 180)) / Math.PI) / 2 * size);
    const cellCentre = [(x + .5) / size * 360 - 180, Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + .5) / size))) * 180 / Math.PI];
    const at = map.project(cellCentre), canvas = map.getCanvas();
    return { centre: { longitude: map.getCenter().lng, latitude: map.getCenter().lat }, zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing(),
      fieldOfView: map.getVerticalFieldOfView(), height: canvas.clientHeight, ground: map.getCenterElevation(), loaded: map.loaded(), tilesLoaded: map.areTilesLoaded(),
      fog: { features: data?.features?.length ?? 0, renderedFeatures: map.getLayer(fogLayer) ? map.queryRenderedFeatures({ layers: [fogLayer] }).length : 0,
        sourceLoaded: map.getSource("food-go-discovery-fog") ? map.isSourceLoaded("food-go-discovery-fog") : false,
        initialCell: `wm18:${x}:${y}`, initialCellOnScreen: at.x >= 0 && at.y >= 0 && at.x <= canvas.clientWidth && at.y <= canvas.clientHeight,
        initialCellCovered: map.getLayer(fogLayer) ? map.queryRenderedFeatures(at, { layers: [fogLayer] }).length : null,
        opacity: map.getLayer(fogLayer) ? map.getPaintProperty(fogLayer, "fill-opacity") : null },
      sourceFeatures: (map.getStyle()?.layers ?? []).filter(layer => layer.id === "food-go-city-buildings" || layer.id === "food-go-world-buildings").map(layer => {
        try {
          const options = { ...(layer["source-layer"] ? { sourceLayer: layer["source-layer"] } : {}) };
          const nearby = ["<=", ["distance", { type: "Point", coordinates: [point.longitude, point.latitude] }], 75];
          return { layer: layer.id, count: map.querySourceFeatures(layer.source, { ...options, ...(layer.filter ? { filter: layer.filter } : {}) }).length,
            nearbyWithin75Metres: map.querySourceFeatures(layer.source, { ...options, filter: layer.filter ? ["all", layer.filter, nearby] : nearby }).length };
        }
        catch { return { layer: layer.id, count: 0 }; }
      }) };
  }, publicPoint);
  const radians = Math.PI / 180, centreX = (state.centre.longitude + 180) / 360;
  const centreY = (1 - Math.log(Math.tan(Math.PI / 4 + state.centre.latitude * radians / 2)) / Math.PI) / 2;
  const distance = .5 * state.height / Math.tan(state.fieldOfView * radians / 2) / (512 * 2 ** state.zoom), horizontal = distance * Math.sin(state.pitch * radians);
  return { ...state, eye: {
    longitude: (centreX - Math.sin(state.bearing * radians) * horizontal) * 360 - 180,
    latitude: Math.atan(Math.sinh(Math.PI * (1 - 2 * (centreY + Math.cos(state.bearing * radians) * horizontal)))) / radians,
    altitude: state.ground + distance * Math.cos(state.pitch * radians) * 2 * Math.PI * 6371008.8 * Math.cos(state.centre.latitude * radians),
  } };
}
async function eventually(read, predicate, label, timeout = 45000) {
  const deadline = Date.now() + timeout; let value;
  while (Date.now() < deadline) { value = await read(); if (predicate(value)) return value; await new Promise(done => setTimeout(done, 250)); }
  assert.fail(`Timed out: ${label}`);
}
async function choose(page, label) {
  await page.locator('summary[aria-label="Choose camera view"]').click();
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.waitForTimeout(100);
}
function sameEye(before, after) {
  assert.ok(Math.abs(before.eye.longitude - after.eye.longitude) < 1e-7, "Look input moved the physical eye longitude");
  assert.ok(Math.abs(before.eye.latitude - after.eye.latitude) < 1e-7, "Look input moved the physical eye latitude");
  assert.ok(Math.abs(before.eye.altitude - after.eye.altitude) < .002, "Look input moved the physical eye height");
}
async function noOverflow(page, label) {
  const size = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth }));
  assert.ok(size.scrollWidth <= size.viewportWidth + 1, `${label} has horizontal overflow`); return size;
}
async function attribution(page, fallback = false) {
  const control = page.locator(fallback ? ".leaflet-control-attribution" : ".maplibregl-ctrl-attrib");
  await control.waitFor({ state: "visible" });
  if (!fallback && !await control.locator(".maplibregl-ctrl-attrib-inner").isVisible()) await control.locator(".maplibregl-ctrl-attrib-button").click();
  const text = await control.innerText();
  assert.match(text, /OpenStreetMap/iu, "Map provider attribution is missing");
  return { visible: await control.isVisible(), text: text.trim() };
}
async function visibleLeafletTiles(page) {
  return page.locator(".leaflet-container").evaluate(container => {
    const frame = container.getBoundingClientRect();
    const tiles = [...container.querySelectorAll("img.leaflet-tile")].filter(tile => {
      const box = tile.getBoundingClientRect();
      return box.right > frame.left && box.left < frame.right && box.bottom > frame.top && box.top < frame.bottom;
    });
    return { visible: tiles.length, loaded: tiles.filter(tile => tile.complete && tile.naturalWidth > 0 && tile.classList.contains("leaflet-tile-loaded")).length };
  });
}
async function saveEvidence() {
  const json = JSON.stringify(evidence, null, 2) + "\n";
  await Promise.all([writeFile(resolve(screenshots, "24-camera-discovery-evidence.json"), json), writeFile(resolve(artifacts, "24-camera-discovery-evidence.json"), json)]);
}

try {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const phone = viewport.width < 500, label = phone ? "phone" : "desktop";
    const context = await browser.newContext({ viewport, reducedMotion: "reduce", isMobile: phone, hasTouch: phone, locale: "en-AU" });
    const page = await context.newPage();
    let routeRequests = 0, savingRequests = 0;
    const providers = new Map();
    page.on("pageerror", error => evidence.runtimeErrors.push({ viewport: label, message: error.message }));
    page.on("request", request => {
      const url = new URL(request.url());
      if (url.pathname === "/api/map/route") routeRequests++;
      if (url.pathname === "/api/exploration") savingRequests++;
    });
    page.on("response", response => {
      const url = new URL(response.url());
      if (url.origin !== origin && response.ok()) providers.set(url.hostname, (providers.get(url.hostname) ?? 0) + 1);
    });
    const snapshot = { viewport, label, overflow: {}, cameras: [], routeRequests: 0, savingRequests: 0 };
    evidence.viewports.push(snapshot);
    try {
      await page.goto(origin, { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "Face north", exact: true }).waitFor({ timeout: 45000 });
      const canvas = await page.locator("canvas.maplibregl-canvas").elementHandle();
      assert.ok(canvas);
      snapshot.initial = await eventually(() => inspect(page), state => state.loaded && state.tilesLoaded && state.sourceFeatures.some(source => source.count > 0), "real geographic tiles and building geometry");
      snapshot.overflow.initial = await noOverflow(page, `${label} initial map`);
      assert.equal(snapshot.initial.fog.features, 0);

      await page.locator('summary[aria-label="Map layers"]').click();
      await page.getByRole("button", { name: "Discovery fog", exact: true }).click();
      await page.locator('summary[aria-label="Map layers"]').click();
      snapshot.fog = await eventually(() => inspect(page), state => state.fog.features > 0 && state.fog.renderedFeatures > 0 && state.fog.sourceLoaded, "rendered geographic fog");
      assert.equal(snapshot.fog.fog.initialCellCovered, 0); assert.equal(snapshot.fog.fog.initialCellOnScreen, true);
      assert.ok(snapshot.fog.fog.opacity > 0 && snapshot.fog.fog.opacity < .5);
      snapshot.attribution = await attribution(page);
      await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(150);
      await page.screenshot({ path: resolve(screenshots, `24-fog-${label}.png`) });
      snapshot.overflow.fog = await noOverflow(page, `${label} fog`);

      for (const [name, mode] of [["Third person view", "third"], ["Close third person view", "close"]]) {
        await choose(page, name); assert.equal(await page.locator("[data-camera]").getAttribute("data-camera"), mode);
        assert.ok(await canvas.evaluate(node => node.isConnected && node === document.querySelector("canvas.maplibregl-canvas")));
        snapshot.cameras.push({ mode, sameCanvas: true, pose: await inspect(page) });
      }
      await choose(page, "First person view");
      const before = await inspect(page); assert.ok(Math.abs(before.eye.altitude - 1.7) < .002);
      const box = await page.locator("canvas.maplibregl-canvas").boundingBox(); assert.ok(box);
      const x = box.x + box.width * .4, y = box.y + box.height * .42;
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 70, y + 18, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(80);
      const dragged = await inspect(page); sameEye(before, dragged); assert.ok(Math.abs(dragged.bearing - before.bearing) > 5);
      await page.getByRole("button", { name: "Zoom in on geographic map", exact: true }).click(); await page.waitForTimeout(80);
      const zoomed = await inspect(page); sameEye(before, zoomed); assert.ok(zoomed.fieldOfView < before.fieldOfView);
      await page.locator("canvas.maplibregl-canvas").focus(); await page.keyboard.press("ArrowLeft");
      const keyed = await inspect(page); sameEye(before, keyed);
      if (phone) {
        const cdp = await context.newCDPSession(page);
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x - 30, y, id: 1 }, { x: x + 30, y, id: 2 }] });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x - 55, y, id: 1 }, { x: x + 55, y, id: 2 }] });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await cdp.detach();
      } else { await page.mouse.move(x, y); await page.mouse.wheel(0, 100); }
      const finalLook = await inspect(page); sameEye(before, finalLook);
      assert.equal(await page.locator("[data-selected]").getAttribute("data-selected"), "false"); assert.equal(routeRequests, 0);
      snapshot.firstPerson = { before, dragged, zoomed, keyed, finalLook, eyeRemainedFixed: true, routeRequestsAfterLook: routeRequests };
      snapshot.overflow.firstPerson = await noOverflow(page, `${label} street camera`);
      if (phone) { await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: resolve(screenshots, "24-eye-look-phone.png") }); }

      await page.getByRole("button", { name: "Overhead view", exact: true }).click();
      await page.getByRole("button", { name: "Explore full map", exact: true }).click();
      await page.getByRole("dialog", { name: "Explore the world", exact: true }).waitFor();
      snapshot.expanded = { sameCanvas: await canvas.evaluate(node => node.isConnected && node === document.querySelector("canvas.maplibregl-canvas")), bounds: await page.locator("canvas.maplibregl-canvas").boundingBox() };
      assert.equal(snapshot.expanded.sameCanvas, true); snapshot.overflow.expanded = await noOverflow(page, `${label} full map`);
      await page.keyboard.press("Escape"); await page.getByRole("button", { name: "Explore full map", exact: true }).waitFor();
      const lost = await canvas.evaluate(node => { const gl = node.getContext("webgl2") || node.getContext("webgl"); const extension = gl?.getExtension("WEBGL_lose_context"); extension?.loseContext(); return !!extension; });
      assert.ok(lost, "Browser must support deliberate WebGL context loss for recovery evidence");
      await page.locator(".leaflet-container").waitFor();
      await page.locator(".leaflet-discovery-fog-pane path").first().waitFor({ state: "attached" });
      const visibleTiles = await eventually(() => visibleLeafletTiles(page), tiles => tiles.visible > 0 && tiles.loaded === tiles.visible, "all visible real fallback tiles");
      await page.waitForTimeout(350); // Leaflet's tile fade must finish before capture.
      snapshot.fallback = { contextLost: true, fogPaths: await page.locator(".leaflet-discovery-fog-pane path").count(), attribution: await attribution(page, true), visibleTiles, actualTilesLoaded: await page.locator(".leaflet-tile-loaded").count() };
      snapshot.overflow.fallback = await noOverflow(page, `${label} fallback`);
      if (phone) { await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: resolve(screenshots, "24-fog-fallback-phone.png") }); }
      await page.getByRole("button", { name: "Retry 3D", exact: true }).click();
      await page.getByRole("button", { name: "Face north", exact: true }).waitFor({ timeout: 45000 });
      snapshot.recovered = await eventually(() => inspect(page), state => state.fog.features > 0 && state.fog.renderedFeatures > 0 && state.tilesLoaded, "real map and fog after 3D retry");
      assert.equal(snapshot.recovered.fog.initialCellCovered, 0);
      snapshot.overflow.recovered = await noOverflow(page, `${label} recovered map`);
      snapshot.routeRequests = routeRequests; snapshot.savingRequests = savingRequests; snapshot.providerResponses = Object.fromEntries(providers);
      assert.equal(routeRequests, 0, "Camera inputs must not request walking routes");
      assert.equal(savingRequests, 0, "Manual discovery must never contact account saving");
      assert.ok(providers.has("tiles.openfreemap.org"), "The actual map provider must respond");
      console.log(`${label}: real fog gaps, fixed 1.7 m eye, retained full-map canvas and WebGL recovery passed`);
    } finally { await context.close(); await saveEvidence(); }
  }
  assert.deepEqual(evidence.runtimeErrors, []);
  evidence.status = "passed"; await saveEvidence();
  console.log("Saved docs/screenshots/24-camera-discovery-evidence.json and artifacts/24-camera-discovery-evidence.json");
} catch (error) { evidence.status = "failed"; evidence.failure = error.message; await saveEvidence(); throw error; }
finally { await browser.close(); }
