import assert from "node:assert/strict";
const origin = process.env.FOOD_GO_CHECK_ORIGIN || "http://127.0.0.1:3000";
const url = new URL(origin);
if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname))
  throw new Error("Smoke checks are restricted to loopback previews.");
let assertions = 0;
const request = (path, options) =>
  fetch(new URL(path, url), { signal: AbortSignal.timeout(15000), ...options });
const check = (condition, message) => {
  assert.ok(condition, message);
  assertions += 1;
};
const health = await request("/api/health");
check(
  health.ok && (await health.json()).mode === "foundation-preview",
  "Correct Food Go preview is running",
);
// Establish closed account services before exercising any blocked POST routes.
// These checks never submit an email address, phone number, venue, or test account.
const session = await request("/api/auth/session");
const sessionData = await session.json();
check(session.status === 503 && sessionData.configured === false && sessionData.user === null, "Account services must be disabled for this smoke run");
const catalogueResponse = await request("/api/venues?limit=2");
const catalogue = await catalogueResponse.json();
check(catalogueResponse.status === 200 && catalogue.status === "ready" && ["demo", "supabase"].includes(catalogue.mode) && Array.isArray(catalogue.data), "Public catalogue is available in an explicit mode");
check(catalogue.data.length <= 2 && typeof catalogue.hasMore === "boolean", "Catalogue result limit and continuation indicator are bounded");
check(catalogueResponse.headers.get("cache-control") === "no-store", "Catalogue responses are not cached");
check(catalogueResponse.headers.get("access-control-allow-origin") === "*" && !catalogueResponse.headers.has("access-control-allow-credentials"), "Anonymous catalogue supports cross-origin mobile web reads without cookies");
for (const venue of catalogue.data) {
  check(!["email", "phone", "organization_id", "venue_contacts"].some((key) => key in venue), "Public catalogue excludes private contacts and organisation identifiers");
  check(typeof venue.slug === "string" && Array.isArray(venue.dishes), "Catalogue supplies canonical venue links and menu items");
}
for (const path of [
  "/",
  "/explore-preview",
  "/feed",
  "/feed-preview",
  "/demo",
  "/demo/explore",
  "/demo/feed",
  "/demo/food-dex",
  "/demo/venue-dex",
  "/demo/quests",
  "/demo/passport",
  "/demo/rewards",
  "/demo/venue/arcade-cloud-patisserie",
  "/explore-preview/venues/finch-and-field",
  "/explore-preview/venues/arcade-leaf-and-grain",
  "/explore-preview/venues/arcade-laneway-noodles",
  "/explore-preview/venues/arcade-cloud-patisserie",
  "/food-dex",
  "/venue-dex",
  "/quests",
  "/profile",
  "/partner",
  "/partner/onboarding",
  "/partner/dashboard",
  "/help",
  ...catalogue.data.slice(0, 1).map((venue) => `/venues/${encodeURIComponent(venue.slug)}`),
  "/auth/sign-in",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/phone",
]) {
  const response = await request(path);
  const html = await response.text();
  check(response.status === 200 && html.includes("Food Go"), `${path} renders`);
  check(
    response.headers.get("x-content-type-options") === "nosniff",
    `${path} has MIME protection`,
  );
  check(
    response.headers.get("x-frame-options") === "DENY",
    `${path} blocks framing`,
  );
  check(
    !response.headers.has("x-powered-by"),
    `${path} does not expose the framework header`,
  );
}
const communityResponse = await request("/api/community");
const gameResponse = await request("/api/game");
check(gameResponse.status === 503 && (await gameResponse.json()).status === "disabled", "Connected progression remains closed while accounts are disabled");
check(gameResponse.headers.get("cache-control") === "no-store", "Progression responses are never cached");
check((await request("/demo/venue/not-a-demo-venue")).status === 404, "Unknown demo venues do not receive invented fixtures");
check((await request("/demo/unknown")).status === 404, "Unknown demo screens fail closed");
const community = await communityResponse.json();
check(communityResponse.status === 200 && ["ready", "disabled"].includes(community.status) && Array.isArray(community.posts), "Community reads have an explicit connected or disabled state");
check(community.viewer === null && community.posts.length <= 20, "Anonymous community reads are bounded and have no account identity");
check(communityResponse.headers.get("cache-control") === "no-store", "Community reads are not cached");
for (const query of ["wall=someone", "wall=me&wall=public", "limit=1000", "cursor=offset100", "post=invalid"]) {
  check((await request(`/api/community?${query}`)).status === 400, "Community query rejects ambiguous or unbounded controls");
}
check((await request("/api/community", { method: "POST" })).status === 403, "Community writes reject an originless request");
check((await request("/api/community", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ action: "create" }) })).status === 503, "Community posting stays disabled while account gates are closed");
const first = await request("/");
const second = await request("/");
const csp = first.headers.get("content-security-policy") || "";
const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
check(Boolean(nonce), "Page CSP contains a nonce");
check(
  nonce !==
    /'nonce-([^']+)'/.exec(
      second.headers.get("content-security-policy") || "",
    )?.[1],
  "Nonce changes on every request",
);
check(
  !csp.includes("unsafe-eval"),
  "Production CSP excludes unsafe evaluation",
);
check(
  csp.includes("frame-ancestors 'none'") && csp.includes("object-src 'none'"),
  "CSP blocks embedding and plugins",
);
check(
  (await first.text()).includes(`nonce="${nonce}"`),
  "Framework scripts receive the actual request nonce",
);
const search = await request("/api/venues?q=Italian");
const searchResult = await search.json();
check(
  search.status === 200 &&
    searchResult.mode === catalogue.mode && searchResult.status === "ready" && Array.isArray(searchResult.data),
  "Catalogue search preserves the configured mode",
);
if (catalogue.mode === "demo") {
  check(searchResult.data.length === 1 && searchResult.data[0].id === "ciao-carlton", "Demo search filters fictional examples");
} else {
  check(searchResult.data.every((venue) => `${venue.name} ${venue.suburb} ${venue.cuisine}`.toLowerCase().includes("italian")), "Connected search matches public names, suburbs or cuisines");
  if (!catalogue.data.length) check((await request("/venues/finch-and-field")).status === 404, "An empty connected catalogue does not expose demo venue pages");
}
const stateSearch = await request("/api/venues?state=NSW");
const stateResult = await stateSearch.json();
check(stateSearch.status === 200 && stateResult.data.every((venue) => venue.state === "NSW"), "State search returns only matching published catalogue records");
check(
  (await request("/api/venues?limit=1000")).status === 400,
  "Unbounded catalogue request is rejected",
);
check(
  (await request("/api/venues?admin=true")).status === 400,
  "Unknown catalogue parameters are rejected",
);
for (const query of ["q=a&q=b", "limit=2&limit=3", "state=VIC&state=NSW", "limit=0", "q=%00", "venueType=other"]) {
  check((await request(`/api/venues?${query}`)).status === 400, "Ambiguous or invalid catalogue parameters are rejected");
}
const absentId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
for (const query of ["", "kind=venue", "kind=other&ids=" + absentId, "kind=venue&ids=invalid", `kind=venue&kind=dish&ids=${absentId}`, `kind=venue&ids=${absentId}&admin=true`]) {
  check((await request(`/api/collections?${query}`)).status === 400, "Collection lookup rejects unsupported or ambiguous parameters");
}
for (const kind of ["venue", "dish"]) {
  const lookup = await request(`/api/collections?kind=${kind}&ids=${absentId}`);
  const lookupData = await lookup.json();
  check(lookup.status === (catalogue.mode === "supabase" ? 200 : 503), "Saved public ID lookup respects connected catalogue mode");
  if (catalogue.mode === "supabase") check(lookupData.mode === "supabase" && lookupData.status === "ready" && Array.isArray(lookupData.venues), "Saved lookup returns only the public catalogue contract");
  check(lookup.headers.get("cache-control") === "no-store", "Saved public ID lookups are not cached");
  check(lookup.headers.get("access-control-allow-origin") === "*" && !lookup.headers.has("access-control-allow-credentials"), "Anonymous saved lookup exposes no credentialed CORS access");
}
check(
  (await request("/api/partner/venues", { method: "POST" })).status === 403,
  "Originless venue write is rejected",
);
check(
  (
    await request("/api/partner/venues", {
      method: "POST",
      headers: { origin: "https://attacker.example" },
    })
  ).status === 403,
  "Cross-origin venue write is rejected",
);
check(
  (
    await request("/api/partner/venues", {
      method: "POST",
      headers: { origin: url.origin },
    })
  ).status === 503,
  "Even a trusted origin cannot publish a venue in the preview",
);
check(
  (await request("/api/partner/venues")).status === 503,
  "Private partner listing stays disabled with account services closed",
);
check((await request("/api/partner/venues", { method: "PATCH" })).status === 405, "Unsupported partner method is rejected");
check(
  (await request("/venues/not-a-real-venue")).status === 404,
  "Unknown venue has a real 404 response",
);
for (const image of ["brunch.jpg", "pizza.jpg", "coffee.jpg", "venue-placeholder.svg"]) {
  const response = await request(`/images/${image}`);
  check(
    response.ok &&
      (response.headers.get("content-type") || "").startsWith("image/"),
    `${image} photo is served locally`,
  );
}
for (const action of ["sign-in", "register", "sign-out", "forgot-password", "reset-password", "phone/request", "phone/verify"]) {
  check((await request(`/api/auth/${action}`, { method: "POST" })).status === 403, `${action} rejects an originless request`);
  const response = await request(`/api/auth/${action}`, { method: "POST", headers: { origin: url.origin, "Content-Type": "application/json" }, body: "{}" });
  check(response.status === 503, `${action} stays disabled without a connected account service`);
  check(response.headers.get("cache-control") === "no-store", `${action} does not cache account responses`);
}
check((await request("/auth/callback?next=https://attacker.example")).status === 503, "Disabled callback does not redirect to an untrusted destination");
console.log(
  `Passed ${assertions} local HTTP assertions. Browser layout and native runtime are separate checks.`,
);
