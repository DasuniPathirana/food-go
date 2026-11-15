import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { parseEnv } from "node:util";
import { setTimeout as delay } from "node:timers/promises";

// Only the disposable GitHub job starts this test. The web process receives a
// publishable key; the test creates its own identity via the local Auth service.
assert.equal(process.env.CI, "true");
const origin = "http://127.0.0.1:3026";
const provider = "http://127.0.0.1:54321";
const command = (executable, args, options) => execFileSync(executable, args, {
  encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], ...options,
});
function localSql(sql) {
  return command("docker", ["exec", "-i", "supabase_db_food-go-local", "psql",
    "-XAtq", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"], { input: sql }).trim();
}
const settings = parseEnv(command("npx", ["--yes", "supabase@3.1.0", "status", "-o", "env"]));
assert.equal(settings.API_URL, provider);
const publicKey = settings.PUBLISHABLE_KEY || settings.ANON_KEY;
const adminKey = settings.SECRET_KEY || settings.SERVICE_ROLE_KEY;
assert.ok(publicKey && adminKey, "The local stack must provide both key types");
const email = `operator-${randomUUID()}@example.test`;
const password = randomBytes(30).toString("base64url");
const identity = await fetch(`${provider}/auth/v1/admin/users`, {
  method: "POST", headers: { apikey: adminKey, Authorization: `Bearer ${adminKey}`, "Content-Type": "application/json" },
  body: JSON.stringify({ email, password, email_confirm: true }),
});
assert.equal(identity.status, 200, "Create a verified disposable operator");
const { id: userId } = await identity.json();
assert.match(userId, /^[\da-f-]{36}$/i);
const venue = randomUUID(), organisation = randomUUID(), offer = randomUUID();

function authenticatorCode(secret) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = Array.from(secret.replace(/=+$/u, "").toUpperCase(), ch => {
    const index = alphabet.indexOf(ch);
    assert.ok(index >= 0, "Authenticator key uses base32");
    return index.toString(2).padStart(5, "0");
  }).join("");
  const key = Buffer.from(bits.match(/.{8}/g).map(value => parseInt(value, 2)));
  const count = Buffer.alloc(8);
  count.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const hash = createHmac("sha1", key).update(count).digest();
  return ((hash.readUInt32BE(hash.at(-1) & 15) & 0x7fffffff) % 1000000).toString().padStart(6, "0");
}

const cookies = new Map();
async function webPost(path, body, jar = cookies, extraHeaders = {}) {
  const response = await fetch(origin + path, { method: "POST", headers: {
    Origin: origin, "Content-Type": "application/json", Cookie: [...jar].map(([k,v]) => `${k}=${v}`).join("; "), ...extraHeaders,
  }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) });
  for (const header of response.headers.getSetCookie()) {
    const pair = header.split(";")[0], equals = pair.indexOf("=");
    jar.set(pair.slice(0, equals), pair.slice(equals + 1));
  }
  return response;
}
const venueSlug = `ci-${venue}`;
const app = spawn(process.execPath, ["../../node_modules/next/dist/bin/next", "dev", "-H", "127.0.0.1", "-p", "3026"], {
  cwd: "apps/web", stdio: "ignore", env: { ...process.env, NODE_ENV: "development", APP_ORIGIN: origin,
    SUPABASE_URL: provider, SUPABASE_PUBLISHABLE_KEY: publicKey, FOOD_GO_AUTH_COOKIE_SECRET: randomBytes(36).toString("base64url"),
    FOOD_GO_AUTH_ENABLED: "true", FOOD_GO_PARTNER_ENABLED: "true", FOOD_GO_COMMUNITY_ENABLED: "true",
    FOOD_GO_CATALOGUE_MODE: "supabase", NEXT_TELEMETRY_DISABLED: "1" },
});
try {
  let ready = false;
  for (let i = 0; i < 55 && !ready && app.exitCode === null; i++) {
    try { ready = (await fetch(origin + "/api/health", { signal: AbortSignal.timeout(12000) })).ok; } catch {}
    if (!ready) await delay(1000);
  }
  assert.ok(ready, "Local web server started");
  const signin = await webPost("/api/auth/sign-in", { email, password });
  assert.equal(signin.status, 200, "Verified account signs in");
  assert.equal((await webPost("/api/admin/security", { action: "enrol" })).status, 403, "Member cannot enrol via operator endpoint");
  localSql(`begin;
    insert into private.food_go_operators(user_id) values ('${userId}');
    insert into public.organizations(id,name) values ('${organisation}','Fixture restaurant group');
    insert into public.venues(id,organization_id,slug,name,venue_type,cuisine,address,suburb,state,postcode,status,ownership_verified_at)
    values ('${venue}','${organisation}','${venueSlug}','Fixture kitchen','restaurant','Modern Australian','123 Test Street','Melbourne','VIC','3000','published',now());
    commit;`);
  const draft = { action: "promo.create", requestId: randomUUID(), id: offer, reason: "Fixture offer owner approval",
    venueId: venue, title: "Lunchtime offer", description: "Fixture lunch special.", startsAt: new Date(Date.now() - 60000).toISOString(),
    endsAt: new Date(Date.now() + 3600000).toISOString() };
  assert.equal((await webPost("/api/admin", draft)).status, 403, "First-factor session cannot publish");
  const enrol = await webPost("/api/admin/security", { action: "enrol" });
  assert.equal(enrol.status, 200, "Operator can enrol an authenticator");
  const setup = await enrol.json();
  assert.ok(setup.secret && setup.factorId && setup.qr, "Enrolment returns the operator's own factor");
  const verified = await webPost("/api/admin/security", { action: "verify", factorId: setup.factorId, code: authenticatorCode(setup.secret) });
  assert.equal(verified.status, 200, "Verify a real TOTP challenge and upgrade the session");
  assert.equal((await verified.json()).verified, true);
  const dashboard = await fetch(origin + "/admin", {
    headers: { Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join("; ") },
    signal: AbortSignal.timeout(90000),
  });
  assert.ok(dashboard.ok && (await dashboard.text()).includes("Fixture kitchen"), "Operator dashboard renders its restaurant queue");
  const change = async action => assert.ok((await webPost("/api/admin", action)).ok, `Apply ${action.action}`);
  const publicOffers = async () => {
    const response = await fetch(provider + "/rest/v1/rpc/food_go_active_promotions", { method: "POST",
      headers: { apikey: publicKey, "Content-Type": "application/json" }, body: "{}" });
    assert.ok(response.ok, "Public promotion RPC is readable");
    return (await response.json()).some(p => p.id === offer);
  };
  await change(draft);
  assert.equal(await publicOffers(), false);
  for (const [action, visible] of [["promo.publish", true], ["promo.withdraw", false]]) {
    const version = localSql(`select to_json(updated_at)#>>'{}' from public.promotions where id='${offer}'`);
    await change({ action, id: offer, requestId: randomUUID(), version, reason: "Fixture offer lifecycle" });
    assert.equal(await publicOffers(), visible, "Public read follows the operator decision");
    const deals = await fetch(origin + "/deals", { signal: AbortSignal.timeout(90000) });
    assert.ok(deals.ok, "Public Deals page renders");
    assert.equal((await deals.text()).includes(draft.title), visible, "Signed-out Deals follows the operator decision");
  }
  async function read(path, jar = cookies) {
    const response = await fetch(origin + path, { headers: { Cookie: [...jar].map(([key,value]) => `${key}=${value}`).join("; ") },
      signal: AbortSignal.timeout(90000) });
    assert.ok(response.ok, "Read " + path.split("?")[0]);
    return response.json();
  }
  async function signup(accountType) {
    const address = `${accountType}-${randomUUID()}@example.test`, jar = new Map();
    const registered = await webPost("/api/auth/register", { email: address, password, displayName: "Fixture " + accountType, accountType }, jar);
    assert.equal(registered.status, 200, "Register through the application");
    const before = await webPost("/api/auth/sign-in", { email: address, password }, jar);
    assert.equal(before.status, 400, "Unconfirmed account cannot sign in");
    let mail;
    for (let attempt = 0; attempt < 30; attempt++) {
      const response = await fetch("http://127.0.0.1:54324/api/v1/message/latest");
      if (response.ok) {
        const latest = await response.json();
        if (latest.To?.some(to => to.Address === address)) { mail = latest; break; }
      }
      await delay(500);
    }
    assert.ok(mail, "Confirmation email arrives in the local inbox");
    const link = /href="([^"]+\/auth\/v1\/verify[^"]+)"/u.exec(mail.HTML || "")?.[1]?.replaceAll("&amp;", "&");
    assert.ok(link, "Confirmation email contains a verification link");
    const verificationUrl = new URL(link);
    assert.ok(verificationUrl.origin === provider && verificationUrl.pathname === "/auth/v1/verify", "Confirmation stays on the disposable provider");
    const verifiedEmail = await fetch(verificationUrl, { redirect: "manual" });
    const callback = new URL(verifiedEmail.headers.get("location"));
    assert.ok(callback.origin === origin && callback.pathname === "/auth/callback", "Provider returns to the application callback");
    const confirmed = await fetch(callback, { redirect: "manual", headers: { Cookie: [...jar].map(([k,v]) => `${k}=${v}`).join("; ") } });
    for (const header of confirmed.headers.getSetCookie()) {
      const pair = header.split(";")[0], equals = pair.indexOf("=");
      jar.set(pair.slice(0, equals), pair.slice(equals + 1));
    }
    const target = new URL(confirmed.headers.get("location"), origin);
    assert.ok(target.pathname === (accountType === "partner" ? "/partner/dashboard" : "/"), "Confirmed account reaches its own interface");
    assert.equal((await read("/api/journey", jar)).accountType, accountType);
    return { address, jar };
  }
  const owner = await signup("partner"), customer = await signup("explorer");
  const created = await webPost("/api/partner/venues", {
    name: "Connected fixture kitchen", email: owner.address, phone: "0391234567",
    address: "123 Test Street", suburb: "Melbourne", state: "VIC", postcode: "3000", cuisine: "Italian",
    venueType: "restaurant", description: "Fixture restaurant created through the owner registration journey.",
    gameEnabled: true, acceptedTerms: true,
  }, owner.jar, { "Idempotency-Key": randomUUID() });
  assert.equal(created.status, 201, "Owner saves their restaurant");
  const createdVenue = (await created.json()).data.id;
  let workspace = await read("/api/partner/manage?venueId=" + createdVenue, owner.jar);
  assert.equal((await webPost("/api/partner/manage", { action: "issue", venueId: createdVenue }, owner.jar)).status, 409, "Unpublished venues cannot issue verification codes");
  assert.ok((await webPost("/api/partner/manage", { action: "submit", venueId: createdVenue, version: workspace.venue.updated_at }, owner.jar)).ok);
  for (const action of ["venue.verify","venue.publish"]) {
    const version = localSql(`select to_json(updated_at)#>>'{}' from public.venues where id='${createdVenue}'`);
    await change({ action, id: createdVenue, requestId: randomUUID(), version, reason: "Fixture independent business review" });
  }
  const dishId = randomUUID();
  const menu = await webPost("/api/partner/manage", { action: "dish", venueId: createdVenue, dishId, name: "Pasta", description: "Handmade pasta", price: 2500, available: true }, owner.jar);
  assert.ok(menu.ok, "Owner adds the menu");
  assert.ok((await read("/api/venues?q=Connected")).data.some(v => v.id === createdVenue), "Published restaurant appears to explorers");
  assert.equal((await webPost("/api/partner/manage", { action: "issue", venueId: createdVenue }, customer.jar)).status, 403, "Customer cannot issue verification evidence");
  for (const [kind, id] of [["venue", createdVenue],["dish", dishId]]) {
    const saved = await webPost("/api/journey", { action: "save", kind, id, saved: true }, customer.jar);
    assert.ok(saved.ok, "Save to the signed-in collection");
    const issued = await webPost("/api/partner/manage", { action: "issue", venueId: createdVenue, ...(kind === "dish" && { dishId }) }, owner.jar);
    assert.ok(issued.ok, "Owner issues a visit or dish QR");
    const evidence = await issued.json();
    assert.ok(evidence.qr?.startsWith("data:image/png;base64,"), "QR image is generated locally");
    const claim = { action: "redeem", code: evidence.code };
    const receipt = await webPost("/api/journey", claim, customer.jar);
    assert.ok(receipt.ok && (await receipt.json()).points === (kind === "venue" ? 50 : 100), "Server awards the fixed discovery points");
    const retry = await webPost("/api/journey", claim, customer.jar);
    assert.ok(retry.ok && (await retry.json()).points === 0, "Retry cannot duplicate an award");
    assert.equal((await webPost("/api/journey", claim, owner.jar)).status, 403, "Venue owner cannot collect their own evidence");
  }
  const progress = await read("/api/journey", customer.jar);
  assert.ok(progress.savedVenues.includes(createdVenue) && progress.savedDishes.includes(dishId), "Collections survive a fresh account read");
  assert.equal(progress.visits.length, 1);
  assert.equal(progress.discoveries.length, 1);
  assert.equal(progress.progress.xp, 150);
  const newSession = new Map();
  const returning = await webPost("/api/auth/sign-in", { email: customer.address, password }, newSession);
  assert.ok(returning.ok && (await returning.json()).redirectTo === "/", "Returning explorer reaches Explore");
  assert.equal((await read("/api/journey", newSession)).progress.xp, 150, "Progress survives a new sign-in session");
  assert.equal((await read("/api/journey", owner.jar)).progress.xp, 0, "Progress is isolated between accounts");
  console.log("Verified customer and owner signup, confirmation email, role routing, restaurant review, menu, QR visits, dish XP, retry handling and persistent collections.");
} finally {
  app.kill("SIGTERM");
}
