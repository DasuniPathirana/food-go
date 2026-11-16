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
  const unknownSession = await fetch(origin + "/api/auth/session", { headers: { Cookie: [...cookies].map(([k,v]) => `${k}=${v}`).join("; ") } });
  assert.equal((await unknownSession.json()).user.ageStatus.status, "unknown", "An existing account is not silently declared adult");
  assert.equal((await webPost("/api/account/age", { birthDate: "1990-01-01" })).status, 200, "An existing account records its private date once");
  assert.equal((await webPost("/api/account/age", { birthDate: "2000-01-01" })).status, 409, "Age declaration cannot be changed through another request");
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
  async function signup(accountType, birthDate = "1990-01-01") {
    const address = `${accountType}-${randomUUID()}@example.test`, jar = new Map();
    const registered = await webPost("/api/auth/register", { email: address, password, birthDate, displayName: "Fixture " + accountType, accountType,
      acknowledgementVersion: "food-go-community-2026-11-15", acceptedAcknowledgement: true }, jar);
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
  const young = await signup("explorer", "2015-01-01");
  const youngCookie = [...young.jar].map(([k,v]) => `${k}=${v}`).join("; ");
  const youngSession = await fetch(origin + "/api/auth/session", { headers: { Cookie: youngCookie } });
  const youngPresentation = await youngSession.json();
  assert.equal(youngPresentation.user.ageStatus.status, "under16", "Signup birth date reaches the private age gate");
  assert.ok(!JSON.stringify(youngPresentation).includes("2015-01-01"), "Session presentation does not expose the date");
  assert.equal((await fetch(origin + "/api/community", { headers: { Cookie: youngCookie } })).status, 403, "Young account cannot read Feed API");
  assert.equal((await webPost("/api/community", { action: "create", body: "This should remain blocked", visibility: "public", requestId: randomUUID() }, young.jar)).status, 403, "Young account cannot post even before consent");
  assert.equal((await webPost("/api/account/age", { birthDate: "1990-01-01" }, young.jar)).status, 409, "Young account cannot change its date to unlock Feed");
  const youngHtml = await (await fetch(origin + "/feed", { headers: { Cookie: youngCookie } })).text();
  assert.ok(youngHtml.includes("Feed is for ages 16 and over") && !youngHtml.includes('data-section="feed"'), "Direct Feed link returns an age notice and no Feed tab");
  console.log("Feed age API: 9 assertions passed for existing-account declaration, private signup age, server denial and direct-route protection.");
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
  for (let stop = 2; stop <= 3; stop++) {
    const added = await webPost("/api/partner/venues", {
      name: "Connected fixture kitchen " + stop, email: owner.address, phone: "0391234567",
      address: stop + "23 Test Street", suburb: "Melbourne", state: "VIC", postcode: "3000", cuisine: "Italian",
      venueType: "restaurant", description: "Additional fixture stop for the verified three-place challenge.",
      gameEnabled: true, acceptedTerms: true,
    }, owner.jar, { "Idempotency-Key": randomUUID() });
    assert.equal(added.status, 201);
    const stopId = (await added.json()).data.id;
    for (const action of ["venue.verify","venue.publish"]) {
      const version = localSql(`select to_json(updated_at)#>>'{}' from public.venues where id='${stopId}'`);
      await change({ action, id: stopId, requestId: randomUUID(), version, reason: "Fixture trail stop review" });
    }
    const issued = await webPost("/api/partner/manage", { action: "issue", venueId: stopId }, owner.jar);
    assert.ok(issued.ok);
    const evidence = await issued.json();
    assert.ok((await webPost("/api/journey", { action: "redeem", code: evidence.code }, customer.jar)).ok);
  }
  const challenge = await read("/api/journey", customer.jar);
  assert.equal(challenge.progress.xp, 350, "Three places and one dish earn the one-time challenge bonus");
  assert.equal(challenge.progress.level, 2, "Verified discoveries advance the explorer level");
  const missingAcknowledgement = await webPost("/api/community", { action: "create", body: "Not accepted yet.", visibility: "public", requestId: randomUUID() }, customer.jar);
  assert.equal(missingAcknowledgement.status, 403, "A verified account cannot post before acknowledging the policy");
  assert.equal((await missingAcknowledgement.json()).code, "acknowledgement_required");
  for (const account of [customer, owner]) {
    const before = await read("/api/community/policy", account.jar);
    assert.equal(before.acceptedAt, null, "Registration checkbox alone cannot forge a verified acceptance receipt");
    const response = await webPost("/api/community/policy", { version: before.version, accepted: true }, account.jar);
    assert.ok(response.ok, "Verified account can explicitly accept the acknowledgement");
    const saved = await response.json();
    assert.ok(saved.acceptedAt);
    const repeated = await webPost("/api/community/policy", { version: before.version, accepted: true }, account.jar);
    assert.equal((await repeated.json()).acceptedAt, saved.acceptedAt, "Acceptance retries preserve the original timestamp");
  }
  const story = await webPost("/api/community", { action: "create", body: "A great lunch and three new places discovered.",
    visibility: "public", requestId: randomUUID() }, customer.jar);
  assert.ok(story.ok, "Customer can post a food experience");
  const postId = (await story.json()).id;
  assert.ok((await read("/api/community?wall=me", customer.jar)).posts.some(p => p.id === postId && p.status === "pending"), "Pending post stays on its personal wall");
  await change({ action: "post.publish", id: postId, requestId: randomUUID(), version: "pending", reason: "Fixture independent post review" });
  assert.equal((await fetch(origin + "/api/community")).status, 401, "Guests cannot read age-restricted Feed content");
  assert.ok((await read("/api/community", owner.jar)).posts.some(p => p.id === postId), "Approved story reaches an eligible member's feed");
  assert.ok((await webPost("/api/community", { action: "like", postId, liked: true }, owner.jar)).ok);
  assert.ok((await webPost("/api/community", { action: "view", postId }, owner.jar)).ok);
  assert.ok((await webPost("/api/community", { action: "view", postId }, owner.jar)).ok);
  const combined = await read("/api/journey", customer.jar);
  assert.equal(combined.progress.xp, 378, "Social XP combines with exploration and challenge XP");
  assert.equal(combined.progress.reachCount, 1, "Repeated signed-in views count once");
  let adventureChecks = 0, villageCreated = false;
  const questId = randomUUID(), adventureRequests = [];
  const playerId = localSql(`select id from auth.users where email='${customer.address}';`);
  assert.match(playerId, /^[\da-f-]{36}$/iu);
  const adventureEqual = (actual, expected, message) => { assert.equal(actual, expected, message); adventureChecks++; };
  const adventureOk = (condition, message) => { assert.ok(condition, message); adventureChecks++; };
  function adventureInput(action) {
    const requestId = randomUUID(); adventureRequests.push(requestId);
    return { ...action, requestId };
  }
  async function adventurePost(action, jar = customer.jar) {
    const response = await webPost("/api/adventure", action, jar);
    adventureEqual(response.status, 200, `Adventure ${action.action} succeeds through the authenticated API`);
    return response.json();
  }
  try {
    const initial = await read("/api/adventure", customer.jar);
    adventureEqual(initial.profile.xp, 378, "Adventure reads canonical existing XP through a genuine session");
    adventureEqual(initial.village, null, "A new account has no silently chosen village");
    const destination = adventureInput({ action: "chooseDestination", region: "VIC" });
    const chosen = await adventurePost(destination);
    villageCreated = true;
    adventureEqual(chosen.state.village.region, "VIC", "Selected destination is persisted");
    adventureEqual(chosen.state.village.plots.length, 16, "Server creates all sixteen real village plots");
    adventureEqual(chosen.state.village.resources.wood, 100, "Server supplies the initial materials");
    const repeatedChoice = await adventurePost(destination);
    adventureEqual(repeatedChoice.state.village.resources.wood, 100, "Destination retry never grants another starting balance");
    const clearing = adventureInput({ action: "clear", cell: 0 });
    const cleared = await adventurePost(clearing);
    adventureEqual(cleared.state.village.resources.wood, 90, "Clearing spends exactly ten wood");
    const repeatedClear = await adventurePost(clearing);
    adventureEqual(repeatedClear.state.village.resources.wood, 90, "Network retry cannot spend clearing materials twice");
    const construction = adventureInput({ action: "build", cell: 0, structure: "shed" });
    const built = await adventurePost(construction);
    adventureEqual(built.state.village.resources.wood, 60, "Construction spends its server-owned cost");
    adventureEqual(built.state.village.plots.find(plot => plot.cell === 0)?.status, "building", "Construction has an actual pending state");
    const repeatedBuild = await adventurePost(construction);
    adventureEqual(repeatedBuild.state.village.resources.wood, 60, "Build retries do not duplicate construction spending");
    const earlyFinish = await webPost("/api/adventure", adventureInput({ action: "finish", cell: 0 }), customer.jar);
    adventureEqual(earlyFinish.status, 409, "Browser cannot finish construction before its server timer");
    const campaign = await adventurePost(adventureInput({ action: "questCreate", id: questId, venueId: createdVenue,
      title: "Meet the fixture kitchen", description: "Visit our kitchen and meet the team for a genuine experience.",
      category: "explore", startsAt: new Date(Date.now() - 60000).toISOString(), endsAt: new Date(Date.now() + 3600000).toISOString(), capacity: 2 }), owner.jar);
    adventureEqual(campaign.state.quests.find(quest => quest.id === questId)?.status, "draft", "Manager creates a private draft quest");
    const submitted = await adventurePost(adventureInput({ action: "questSubmit", questId }), owner.jar);
    adventureEqual(submitted.state.quests.find(quest => quest.id === questId)?.status, "pending", "Submission waits for independent approval");
    adventureEqual((await webPost("/api/adventure", adventureInput({ action: "acceptQuest", questId }), customer.jar)).status, 404,
      "Pending campaigns cannot be accepted by customers");
    const approved = await adventurePost(adventureInput({ action: "questReview", questId, decision: "approve", reason: "Independent fixture campaign review" }), cookies);
    adventureEqual(approved.state.quests.find(quest => quest.id === questId)?.status, "published", "MFA operator independently publishes the quest");
    await adventurePost(adventureInput({ action: "acceptQuest", questId }));
    await adventurePost(adventureInput({ action: "acceptQuest", questId }), cookies);
    const issued = await adventurePost(adventureInput({ action: "questIssue", questId }), owner.jar);
    adventureOk(/^[a-f0-9]{32}$/u.test(issued.code), "Restaurant issues an opaque staff confirmation code");
    const completion = adventureInput({ action: "completeQuest", questId, code: issued.code });
    const completed = await adventurePost(completion);
    adventureEqual(completed.state.profile.xp, 428, "Genuine staff confirmation adds exactly fifty quest XP");
    adventureOk(completed.state.quests.find(quest => quest.id === questId)?.participation?.completedAt,
      "Completion receipt persists on the player's accepted quest");
    const sameRetry = await adventurePost(completion);
    adventureEqual(sameRetry.state.profile.xp, 428, "Identical completion retry does not mint XP");
    const freshRetry = await adventurePost(adventureInput({ action: "completeQuest", questId, code: issued.code }));
    adventureEqual(freshRetry.state.profile.xp, 428, "A fresh retry identifier still cannot repeat a completed award");
    const replay = await webPost("/api/adventure", adventureInput({ action: "completeQuest", questId, code: issued.code }), cookies);
    adventureEqual(replay.status, 404, "Second accepted account cannot replay the consumed staff code");
    adventureEqual((await read("/api/adventure", cookies)).profile.xp, 0, "Cross-account replay grants no XP");
    const daily = await adventurePost(adventureInput({ action: "claimDaily" }));
    adventureEqual(daily.state.village.dailyClaimed, true, "Verified food participation earns a real daily supplies receipt");
    adventureEqual(daily.state.village.resources.wood, 80, "Daily supplies add the documented earned materials");
    adventureEqual((await webPost("/api/adventure", adventureInput({ action: "claimDaily" }), customer.jar)).status, 409,
      "Daily supplies cannot be duplicated with another request ID");
    const persisted = await read("/api/adventure", newSession);
    adventureEqual(persisted.village.resources.wood, 80, "Village balances survive a separate genuine sign-in session");
    adventureEqual(persisted.profile.xp, 428, "Quest progression survives another sign-in session");
    const canonical = await read("/api/game", newSession);
    adventureEqual(canonical.status, "ready", "Canonical game profile endpoint accepts the same verified session");
    adventureEqual(canonical.xp, 428, "Canonical game profile shares the adventure XP ledger");
    adventureOk(Number.isInteger(canonical.level) && canonical.level >= 1 && canonical.level <= 250
      && Number.isInteger(canonical.xpLevel) && canonical.achievements && canonical.nextRequirements,
    "Canonical profile returns the 250-level ladder and server-derived achievement gates");
    console.log(`Adventure API: ${adventureChecks} assertions passed across real sessions, village spending, independent quest review, one-use evidence and persisted progression.`);
  } finally {
    // Remove only the adventure fixtures this block created. Existing signup,
    // collection and moderation fixtures belong to the disposable job lifecycle.
    localSql(`begin;
      delete from private.adventure_rewards where quest_id='${questId}';
      delete from private.adventure_participations where quest_id='${questId}';
      delete from private.adventure_codes where quest_id='${questId}';
      delete from private.adventure_quests where id='${questId}';
      delete from private.operator_audit where target='${questId}' and action like 'quest.%';
      ${adventureRequests.length ? `delete from private.adventure_requests where request_id in (${adventureRequests.map(id => `'${id}'`).join(",")});` : ""}
      ${villageCreated ? `delete from private.outback_events where user_id='${playerId}';delete from private.outback_villages where user_id='${playerId}';` : ""}
      commit;`);
  }
  console.log("Verified customer and owner signup, confirmation email, role routing, restaurant review, menu, QR visits, dish XP, retry handling and persistent collections.");
} finally {
  app.kill("SIGTERM");
}
