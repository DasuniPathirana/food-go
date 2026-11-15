import assert from "node:assert/strict";
const origin = process.env.FOOD_GO_CHECK_ORIGIN || "http://127.0.0.1:3000";
const url = new URL(origin);
assert.ok(["127.0.0.1","localhost","[::1]"].includes(url.hostname));
let assertions = 0;
const check = (condition, message) => { assert.ok(condition, message); assertions++; };
const request = (path, options) => fetch(new URL(path, url), { signal: AbortSignal.timeout(20000), ...options });
const health = await request("/api/health");
check(health.ok && (await health.json()).mode === "supabase", "Server runs the connected catalogue");
const session = await request("/api/auth/session");
const sessionBody = await session.json();
check(session.status === 503 && sessionBody.configured === false && sessionBody.user === null, "Smoke server has account services disabled");
const catalogueResponse = await request("/api/venues?limit=2");
const catalogue = await catalogueResponse.json();
check([200,503].includes(catalogueResponse.status) && catalogue.mode === "supabase" && Array.isArray(catalogue.data), "Public catalogue uses explicit connected state");
check(catalogue.data.length <= 2 && typeof catalogue.hasMore === "boolean", "Public read is bounded");
check(catalogueResponse.headers.get("cache-control") === "no-store", "Catalogue does not cache");
for (const venue of catalogue.data) {
  check(venue.source === "supabase" && !["email","phone","organization_id"].some(key => key in venue), "Catalogue excludes fictional venues and private contacts");
}
for (const path of ["/","/feed","/deals","/profile","/collect","/food-dex","/venue-dex","/quests",
  "/partner","/partner/dashboard","/partner/onboarding","/admin","/admin/security",
  "/auth/register","/auth/sign-in","/auth/forgot-password","/auth/reset-password","/auth/phone","/help","/acknowledgement"]) {
  const response = await request(path), html = await response.text();
  check(response.ok && html.includes("Food Go"), `${path} renders`);
  check(response.headers.get("x-content-type-options") === "nosniff", `${path} prevents MIME sniffing`);
  check(response.headers.get("x-frame-options") === "DENY", `${path} prevents framing`);
  check(!html.includes('href="/demo') && !html.includes('href="/feed-preview'), `${path} exposes no example entry points`);
  const csp = response.headers.get("content-security-policy") || "";
  check(csp.includes("frame-ancestors 'none'") && !csp.includes("unsafe-eval"), `${path} has the production CSP`);
  if (path === "/") {
    check(html.includes("Search map places") && html.includes("Explore full map"), "Explore has search and an expanded map");
    check(html.includes("Streets") && html.includes("Enable live location") && html.includes("Avatar options"), "Explore exposes worldwide maps, opt-in location and the avatar");
    check((response.headers.get("permissions-policy") || "").includes("geolocation=(self)"), "Geolocation is permitted for this site's explicit request");
  }
}
for (const path of ["/demo","/demo/explore","/demo/passport","/explore-preview","/feed-preview","/explore-preview/venues/finch-and-field"]) {
  check((await request(path)).status === 404, `${path} is retired`);
}
check((await request("/feed?wall=me")).url === new URL("/profile", origin).href, "Personal wall opens in Passport");
for (const query of ["q=a&q=b","limit=1000","state=other","status=draft"]) {
  check((await request("/api/venues?" + query)).status === 400, "Catalogue rejects invalid query");
}
for (const path of ["/api/map/search?q=a","/api/map/search?q=A&q=B","/api/map/route?from=1,2&to=999,3"]) {
  check((await request(path)).status === 400, "Map services reject invalid or ambiguous input");
}
for (const path of ["/api/journey","/api/game","/api/partner/venues","/api/community/policy"]) {
  check((await request(path)).status === 503, `${path} is disabled when Auth is unconfigured`);
}
for (const path of ["/api/journey","/api/partner/manage","/api/admin","/api/admin/security",
  "/api/community","/api/community/policy","/api/auth/register","/api/auth/sign-in","/api/auth/sign-out","/api/auth/forgot-password","/api/auth/reset-password"]) {
  check((await request(path, { method: "POST" })).status === 403, `${path} requires the trusted origin`);
  const response = await request(path, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: "{}" });
  check(response.status === 503 && response.headers.get("cache-control") === "no-store", `${path} respects the closed account configuration`);
}
const first = await request("/"), second = await request("/");
const nonce = response => /'nonce-([^']+)'/u.exec(response.headers.get("content-security-policy") || "")?.[1];
check(!!nonce(first) && nonce(first) !== nonce(second), "CSP nonce changes for each request");
check((await first.text()).includes(`nonce="${nonce(first)}"`), "Framework scripts receive the request nonce");
const unknownVenue = await request("/venues/not-a-real-venue");
check(unknownVenue.status === 404 || (await unknownVenue.text()).includes("Places are temporarily unavailable"),
  "Unknown venue reports missing data or an honest service failure");
console.log(`Passed ${assertions} local HTTP assertions.`);
