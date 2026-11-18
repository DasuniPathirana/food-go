import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

// Actual component code and styles in an isolated browser fixture. Only Next's
// link adapter and HTTP responses are replaced. Production routes stay gated.
let javascript: string, css: string;
test.beforeAll(async () => {
  // Build in native Node so Playwright's CommonJS transform never rewrites the
  // ESM bundler helper. The generated artifact is test-only, never deployed.
  execFileSync(process.execPath, ["scripts/build-encounter-fixture.mjs", "--output", "artifacts/encounter-ui-fixture.json"], { stdio: "pipe" });
  ({ javascript, css } = JSON.parse(await readFile("artifacts/encounter-ui-fixture.json", "utf8")));
});
const ids = { venue: "a1000000-0000-4000-8000-000000000001", campaign: "a2000000-0000-4000-8000-000000000001",
  session: "a3000000-0000-4000-8000-000000000001", item: "a4000000-0000-4000-8000-000000000001", pool: "a5000000-0000-4000-8000-000000000001", promotion: "a6000000-0000-4000-8000-000000000001" };
const at = () => new Date().toISOString(), later = (minutes = 15) => new Date(Date.now() + minutes * 60000).toISOString();
const venue = { id: ids.venue, name: "Browser fixture kitchen", slug: "browser-fixture-kitchen", coordinates: { longitude: 144.96, latitude: -37.81 } };
const campaign = () => ({ id: ids.campaign, venue, title: "Kitchen discovery", description: "A test of an independently approved restaurant pool.", theme: "cafe", state: "published", version: at(),
  startsAt: new Date(Date.now() - 60000).toISOString(), endsAt: later(1440), radiusMetres: 60, cooldownHours: 24, maxClaims: 10, claimedCount: 0, offerValidityHours: 24,
  pool: [{ id: ids.pool, kind: "collectible", name: "Laneway keepsake", description: "A test collectible with no monetary value.", rarity: "rare", weight: 100, promotionId: null }] });
const session = () => ({ id: ids.session, encounterId: ids.campaign, venueId: ids.venue, title: "Kitchen discovery", state: "awaiting_confirmation", expiresAt: later(), itemId: null });
const collectible = () => ({ id: ids.item, sessionId: ids.session, encounterId: ids.campaign, venue, name: "Laneway keepsake", description: "A test collectible with no monetary value.",
  rarity: "rare", kind: "collectible", state: "collected", claimedAt: at(), expiresAt: null, redeemedAt: null, promotionId: null });
const snapshot = (values: object = {}) => ({ ok: true, version: 1, serverTime: at(), inventory: [], sessions: [], managedVenues: [], campaigns: [], operator: false, result: null, ...values });
const result = (action: string, values: object = {}) => ({ action, sessionId: null, itemId: null, code: null, codeExpiresAt: null, replayed: false, error: null, ...values });

async function fixture(page: Page, mode = "panel") {
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.pathname === "/__encounter-fixture") return route.fulfill({ contentType: "text/html", body: '<!doctype html><html lang="en-AU"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/__encounter-ui.css"><div id="root"></div><script src="/__encounter-ui.js"></script></html>' });
    if (url.pathname === "/__encounter-ui.js") return route.fulfill({ contentType: "application/javascript", body: javascript });
    if (url.pathname === "/__encounter-ui.css") return route.fulfill({ contentType: "text/css", body: css });
    return url.hostname === "127.0.0.1" ? route.fallback() : route.abort();
  });
  await page.goto(`/__encounter-fixture?mode=${mode}`);
}
async function noOverflow(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); }

test("a staff-code refusal stays closed and an uncertain claim retries exactly once before opening", async ({ page }, info) => {
  const phone = info.project.name.startsWith("phone");
  if (!phone) await page.emulateMedia({ reducedMotion: "no-preference" });
  let active = false, granted = false, claims = 0;
  const submissions: object[] = [];
  await page.route("**/api/encounters**", route => {
    const request = route.request(), url = new URL(request.url());
    if (url.searchParams.has("venueId")) return route.fulfill({ json: { ok: true, version: 1, serverTime: at(), encounters: [campaign()] } });
    if (request.method() === "GET") return route.fulfill({ json: snapshot({ sessions: active && !granted ? [session()] : [], inventory: granted ? [collectible()] : [] }) });
    const input = request.postDataJSON();
    if (input.action === "start") { active = true; return route.fulfill({ json: snapshot({ sessions: [session()], result: result("start", { sessionId: ids.session }) }) }); }
    submissions.push(input); claims++;
    if (claims === 1) return route.fulfill({ json: snapshot({ sessions: [session()], result: result("claim", { error: { code: "missing", message: "Confirmation is unavailable or expired." } }) }) });
    if (claims === 2) return route.abort("failed");
    granted = true; return route.fulfill({ json: snapshot({ inventory: [collectible()], result: result("claim", { sessionId: ids.session, itemId: ids.item, replayed: true }) }) });
  });
  await fixture(page);
  await expect(page.getByText("Manual preview. Your physical location is not confirmed.")).toBeVisible();
  await page.getByRole("button", { name: "Begin encounter", exact: true }).click();
  await expect(page.locator('[data-open="false"]')).toBeVisible();
  await page.getByLabel("Staff confirmation code", { exact: true }).fill("a".repeat(32));
  await page.getByRole("button", { name: "Confirm and open", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Confirmation is unavailable");
  await expect(page.locator('[data-open="true"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Confirm and open", exact: true }).click();
  await page.getByRole("button", { name: "Retry same submission", exact: true }).waitFor();
  await expect(page.locator('[data-open="true"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Retry same submission", exact: true }).click();
  await expect(page.locator('[data-open="true"]')).toBeVisible();
  const lidMotion = await page.locator('[data-open="true"] svg > g[class]').evaluate(element => getComputedStyle(element).animationName);
  expect(lidMotion === "none").toBe(phone);
  await expect(page.getByRole("heading", { name: "Laneway keepsake", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Collected for now", exact: true })).toBeDisabled();
  expect(submissions[1]).toEqual(submissions[2]); expect(submissions[0]).not.toEqual(submissions[1]);
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain("a".repeat(32));
  await noOverflow(page);
  await page.screenshot({ path: `docs/screenshots/25-encounter-confirmed-${info.project.name.startsWith("phone") ? "phone" : "desktop"}.png`, fullPage: true });
});

test("inventory separates collectibles from offers and only prepares staff redemption", async ({ page }, info) => {
  const offer = { ...collectible(), id: "a4000000-0000-4000-8000-000000000002", kind: "offer", name: "Approved fixture tasting", description: "Only these approved browser fixture terms apply.",
    sessionId: "a3000000-0000-4000-8000-000000000002", state: "available", promotionId: ids.promotion, expiresAt: later(60) };
  const commands: any[] = [];
  await page.route("**/api/encounters**", route => {
    if (route.request().method() === "GET") return route.fulfill({ json: snapshot({ inventory: [collectible(), offer] }) });
    const command = route.request().postDataJSON(); commands.push(command);
    return route.fulfill({ json: snapshot({ inventory: [collectible(), offer], result: result(command.action, { itemId: offer.id, code: "b".repeat(32), codeExpiresAt: later(2) }) }) });
  });
  await fixture(page, "inventory");
  await expect(page.getByText("Only these approved browser fixture terms apply.")).toBeVisible();
  await page.getByRole("button", { name: "Restaurant offers", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Laneway keepsake", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Show venue redemption code", exact: true }).click();
  await expect(page.getByText("b".repeat(32), { exact: true })).toBeVisible();
  expect(commands[0].action).toBe("prepareRedemption"); expect(commands[0].itemId).toBe(offer.id);
  expect(commands.some(command => command.action === "redeem")).toBe(false);
  await noOverflow(page);
  await page.screenshot({ path: `docs/screenshots/25-inventory-${info.project.name.startsWith("phone") ? "phone" : "desktop"}.png`, fullPage: true });
  await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(page.getByText("b".repeat(32), { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain("b".repeat(32));
});

test("staff codes and independent review remain explicit management actions", async ({ page }, info) => {
  const pool = { ...campaign(), state: "pending" };
  const reviewVersion = pool.version;
  const commands: any[] = []; let staff = true;
  await page.route("**/api/encounters**", route => {
    const data = { managedVenues: staff ? [venue] : [], campaigns: staff ? [] : [pool], operator: !staff };
    if (route.request().method() === "GET") return route.fulfill({ json: snapshot(data) });
    const command = route.request().postDataJSON(); commands.push(command);
    if (command.action === "review") { pool.state = "published"; pool.version = at(); }
    return route.fulfill({ json: snapshot({ ...data, result: result(command.action, command.action === "issue" ? { sessionId: ids.session, code: "c".repeat(32), codeExpiresAt: later(2) } : {}) }) });
  });
  await fixture(page, "manage");
  await page.locator("summary").filter({ hasText: "Staff confirmation and redemption" }).click();
  await page.getByLabel("Guest encounter reference", { exact: true }).fill(ids.session);
  await page.getByRole("button", { name: "Generate confirmation code", exact: true }).click();
  await expect(page.getByText("c".repeat(32), { exact: true })).toBeVisible();
  expect(commands[0].action).toBe("issue"); expect(commands[0].sessionId).toBe(ids.session);
  staff = false; await fixture(page, "manage&actor=operator");
  await page.getByLabel("Review reason", { exact: true }).fill("Checked the fixture pool, stock and restaurant terms.");
  await page.getByRole("button", { name: "Save decision", exact: true }).click();
  expect(commands[1].action).toBe("review"); expect(commands[1].version).toBe(reviewVersion); expect(commands[1].decision).toBe("approve");
  await noOverflow(page);
  await page.screenshot({ path: `docs/screenshots/25-operator-${info.project.name.startsWith("phone") ? "phone" : "desktop"}.png`, fullPage: true });
});

test("actual inventory and management routes stay gated and remain reachable", async ({ page, request }) => {
  await page.goto("/inventory"); await expect(page.getByRole("heading", { level: 1 })).toContainText("Your little collection");
  await noOverflow(page);
  await page.goto("/encounters"); await expect(page.getByRole("heading", { level: 1 })).toContainText("Restaurant encounters");
  await noOverflow(page);
  await page.locator('summary[aria-label="Collections and Passport"]').click();
  await expect(page.getByRole("link", { name: /Inventory.*restaurant encounter items/ })).toHaveAttribute("href", "/inventory");
  const response = await request.get("/api/encounters"); expect(response.status()).toBe(503); expect(response.headers()["cache-control"]).toBe("no-store");
});

test("an expired public pool stops offering a start and can be refreshed", async ({ page }) => {
  await page.clock.install();
  let reads = 0;
  await page.route("**/api/encounters**", route => {
    if (new URL(route.request().url()).searchParams.has("venueId")) {
      reads++;
      return route.fulfill({ json: { ok: true, version: 1, serverTime: at(), encounters: [{ ...campaign(), endsAt: reads === 1 ? later(.02) : later(1440) }] } });
    }
    return route.fulfill({ json: snapshot() });
  });
  await fixture(page);
  await page.getByRole("button", { name: "Begin encounter", exact: true }).waitFor();
  await page.clock.fastForward(3000);
  await expect(page.getByRole("button", { name: "Begin encounter", exact: true })).toHaveCount(0);
  await expect(page.getByText("There are no approved encounters at this restaurant right now.")).toBeVisible();
  await page.getByRole("button", { name: "Refresh encounters", exact: true }).click();
  await expect(page.getByRole("button", { name: "Begin encounter", exact: true })).toBeVisible();
  expect(reads).toBe(2);
});

test("owners save a private pool with linked offer identity, then submit its server version", async ({ page }) => {
  let current: any = null;
  const commands: any[] = [];
  await page.route("**/api/encounters**", route => {
    if (route.request().method() === "GET") return route.fulfill({ json: snapshot({ managedVenues: [venue], campaigns: current ? [current] : [] }) });
    const command = route.request().postDataJSON(); commands.push(command);
    if (command.action === "create") current = { ...campaign(), ...command, id: command.encounterId, venue, state: "draft", version: at(), claimedCount: 0,
      pool: command.pool.map((entry: any) => entry.kind === "offer" ? { ...entry, name: "Approved fixture tasting", description: "Only published fixture terms." } : { ...entry, promotionId: null }) };
    if (current) { delete current.action; delete current.requestId; delete current.encounterId; delete current.venueId; }
    if (command.action === "submit") current = { ...current, state: "pending", version: at() };
    return route.fulfill({ json: snapshot({ managedVenues: [venue], campaigns: [current], result: result(command.action) }) });
  });
  await fixture(page, "manage");
  await page.getByRole("button", { name: "Create encounter", exact: true }).click();
  await page.getByLabel("Encounter title", { exact: true }).fill("A considered fixture pool");
  await page.getByLabel("What should guests expect?", { exact: true }).fill("A fixture keepsake and a separately approved tasting offer.");
  const first = page.getByRole("group", { name: "Item 1", exact: true });
  await first.getByLabel("Collectible name", { exact: true }).fill("Fixture kitchen pin");
  await first.getByLabel("Collectible description", { exact: true }).fill("A digital fixture keepsake with no cash value.");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  const second = page.getByRole("group", { name: "Item 2", exact: true });
  // Selects have an accessible name independent of their option text. The
  // implicit label also contains those options, so an exact label-text query
  // cannot reliably identify this control.
  await second.getByRole("combobox", { name: "Item type", exact: true }).selectOption("offer");
  await second.getByLabel(/Published promotion ID/).fill(ids.promotion);
  await expect(second.getByLabel("Collectible name", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Save encounter draft", exact: true }).click();
  await page.getByRole("button", { name: "Submit for independent review", exact: true }).waitFor();
  expect(commands[0].action).toBe("create"); expect(commands[0].pool).toHaveLength(2);
  expect(Object.keys(commands[0].pool[1]).sort()).toEqual(["id", "kind", "promotionId", "rarity", "weight"]);
  expect(commands[0].startsAt.endsWith("Z")).toBe(true);
  const version = current.version;
  await page.getByRole("button", { name: "Submit for independent review", exact: true }).click();
  await expect(page.getByText("pending", { exact: true })).toBeVisible();
  expect(commands[1].action).toBe("submit"); expect(commands[1].version).toBe(version);
  await noOverflow(page);
});
