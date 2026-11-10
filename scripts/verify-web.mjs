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
for (const path of [
  "/",
  "/food-dex",
  "/venue-dex",
  "/quests",
  "/profile",
  "/partner",
  "/partner/onboarding",
  "/help",
  "/venues/finch-and-field",
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
    searchResult.mode === "demo" &&
    searchResult.data.length === 1 &&
    searchResult.data[0].id === "ciao-carlton",
  "Catalogue search filters examples",
);
check(
  (await (await request("/api/venues?state=NSW")).json()).data.length === 0,
  "Search does not invent venues in another state",
);
check(
  (await request("/api/venues?limit=1000")).status === 400,
  "Unbounded catalogue request is rejected",
);
check(
  (await request("/api/venues?admin=true")).status === 400,
  "Unknown catalogue parameters are rejected",
);
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
  (await request("/api/partner/venues")).status === 405,
  "Unsupported write endpoint method is rejected",
);
check(
  (await request("/venues/not-a-real-venue")).status === 404,
  "Unknown venue has a real 404 response",
);
for (const image of ["brunch", "pizza", "coffee"]) {
  const response = await request(`/images/${image}.jpg`);
  check(
    response.ok &&
      (response.headers.get("content-type") || "").startsWith("image/"),
    `${image} photo is served locally`,
  );
}
console.log(
  `Passed ${assertions} local HTTP assertions. Browser layout and native runtime are separate checks.`,
);
