import assert from "node:assert/strict";
import { test } from "node:test";
import { communityWriteSchema, parseCommunityQuery } from "./community";
import { CommunityProviderError, createCommunityHandlers, readCommunityConfig, runBounded, type CommunityProvider } from "./community-handlers";

const origin = "http://localhost:3000";
const env = {
  NODE_ENV: "test", APP_ORIGIN: origin, FOOD_GO_COMMUNITY_ENABLED: "true", FOOD_GO_AUTH_ENABLED: "true",
  FOOD_GO_AUTH_COOKIE_SECRET: "a".repeat(48), SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example_public_key_for_tests",
};
const post = {
  id: "91000000-0000-4000-8000-000000000001", author: { id: "92000000-0000-4000-8000-000000000001", name: "A food explorer" },
  body: "A lovely lunch nearby.", createdAt: "2026-11-13T05:00:00+00:00", visibility: "public", status: "published",
  likeCount: 0, commentCount: 0, shareCount: 0, liked: false, shared: false, comments: [], commentsNextCursor: null,
};
const feed = { status: "ready", posts: [post], viewer: null, nextCursor: null };
const create = { action: "create", body: "My latest food experience.", visibility: "public", requestId: "93000000-0000-4000-8000-000000000001" };
const req = (value: unknown, headers: Record<string,string> = {}) => new Request(`${origin}/api/community`, {
  method: "POST", headers: { origin, "content-type": "application/json", ...headers }, body: JSON.stringify(value),
});
test("reach writes accept only a post ID; anonymous viewers and forged XP never reach the database", async () => {
  const app = setup({ async write() { return { ok: true, reachCount: 1 }; } });
  const view = { action: "view", postId: post.id };
  assert.equal((await app.handlers.POST(req(view))).status, 200);
  for (const value of [{ ...view, viewerId: post.author.id }, { ...view, xp: 100 }, { ...view, qualified: true }, { action: "view", postId: "invalid" }])
    assert.equal((await app.handlers.POST(req(value))).status, 400);
  const denied = setup({ async getUser() { return null; } });
  assert.equal((await denied.handlers.POST(req(view))).status, 401);
  assert.equal(denied.calls, 0);
});
function setup(overrides: Partial<CommunityProvider> = {}, environment = env) {
  let calls = 0;
  let lastAction: unknown;
  const provider: CommunityProvider = {
    async getUser() { return { identityConfirmed: true }; }, async feed() { return feed; },
    async write(action) { lastAction = action; calls++; return { ok: true, id: post.id, status: "pending" }; }, ...overrides,
  };
  return { handlers: createCommunityHandlers({ env: environment, async getProvider() { return provider; } }), get calls() { return calls; }, get lastAction() { return lastAction; } };
}

test("community read gate is independent from account activation and validates public project configuration", async () => {
  assert.equal(readCommunityConfig({}), null);
  assert.equal(readCommunityConfig({ ...env, FOOD_GO_COMMUNITY_ENABLED: "false" }), null);
  assert.equal(readCommunityConfig({ ...env, SUPABASE_URL: "https://provider.example/path" }), null);
  assert.ok(readCommunityConfig({ ...env, FOOD_GO_AUTH_ENABLED: "false" }));
  const disabled = setup({}, { ...env, FOOD_GO_COMMUNITY_ENABLED: "false" });
  assert.deepEqual(await (await disabled.handlers.GET(new Request(`${origin}/api/community`))).json(), { status: "disabled", posts: [], viewer: null, nextCursor: null });
  assert.equal((await disabled.handlers.POST(req(create))).status, 503);
});

test("community query parsing rejects ambiguous or unbounded controls and preserves keyset cursors", () => {
  for (const value of ["?wall=me&wall=public", "?wall=someone", "?limit=1000", "?post=invalid", "?commentsCursor=bad", "?cursor=offset100", `?cursor=${"x".repeat(201)}`])
    assert.equal(parseCommunityQuery(new URL(`${origin}/${value}`)), null, value);
  const cursor = "2026-11-13 05:00:00+00|91000000-0000-4000-8000-000000000001";
  assert.equal(parseCommunityQuery(new URL(`${origin}/?cursor=${encodeURIComponent(cursor)}`))?.cursor, cursor);
  assert.ok(parseCommunityQuery(new URL(`${origin}/?post=${post.id}&commentsCursor=${encodeURIComponent(cursor)}`)));
  assert.equal(parseCommunityQuery(new URL(`${origin}/?post=${post.id}&cursor=${encodeURIComponent(cursor)}`)), null);
});

test("community strict input cannot assign authors or approval and bounds post/comment text", async () => {
  const app = setup();
  for (const value of [{ ...create, authorId: post.author.id }, { ...create, status: "published" }, { ...create, body: "x".repeat(2001) }, { ...create, body: "\u0000hello" }, { action: "like", postId: post.id, liked: "true" }, { action: "report", postId: post.id, reason: "invented" }])
    assert.equal((await app.handlers.POST(req(value))).status, 400);
  assert.equal(app.calls, 0);
  assert.ok(communityWriteSchema.safeParse({ ...create, body: "A thought\nA second line." }).success);
  const response = await app.handlers.POST(req(create));
  assert.equal(response.status, 202);
  assert.equal((await response.json()).status, "pending");
  assert.deepEqual(app.lastAction, create);
});

test("community origin, body size and verified identity are checked before a provider write", async () => {
  const app = setup();
  assert.equal((await app.handlers.POST(req(create, { origin: "https://attacker.example" }))).status, 403);
  assert.equal((await app.handlers.POST(req(create, { "content-length": "20000" }))).status, 413);
  assert.equal((await app.handlers.POST(req(create, { "content-type": "text/plain" }))).status, 415);
  assert.equal(app.calls, 0);
  for (const user of [null, { identityConfirmed: false }]) {
    const denied = setup({ async getUser() { return user; } });
    assert.equal((await denied.handlers.POST(req(create))).status, 401);
    assert.equal((await denied.handlers.GET(new Request(`${origin}/api/community?wall=me`))).status, 401);
    assert.equal(denied.calls, 0);
  }
  const oversized = new Request(`${origin}/api/community`, { method: "POST", headers: { origin, "content-type": "application/json", "content-length": "1" }, body: `{"body":"${"x".repeat(17000)}"}` });
  assert.equal((await app.handlers.POST(oversized)).status, 413);
});

test("community responses strip unexpected contacts and invalid provider data never become example content", async () => {
  const app = setup({ async feed() { return { ...feed, email: "private@example.invalid", posts: [{ ...post, user_id: "private-auth-identity", author: { ...post.author, phone: "+61412345678" } }] }; } });
  const response = await app.handlers.GET(new Request(`${origin}/api/community`));
  const body = await response.text();
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.doesNotMatch(body, /private@example|private-auth|61412345678/u);
  assert.equal(JSON.parse(body).posts.length, 1);
  for (const value of [null, { ...feed, posts: [{ ...post, comments: new Array(21).fill({}) }] }, { ...feed, posts: new Array(21).fill(post) }]) {
    const broken = setup({ async feed() { return value; } });
    const result = await broken.handlers.GET(new Request(`${origin}/api/community`));
    assert.equal(result.status, 503);
    assert.deepEqual((await result.json()).posts, []);
  }
});

test("community provider errors have bounded public categories and no raw database diagnostics", async () => {
  for (const [code, status] of [["limit",429],["retry",409],["missing",404],["invalid",400],["unavailable",503]] as const) {
    const app = setup({ async write() { throw new CommunityProviderError(code); } });
    assert.equal((await app.handlers.POST(req(create))).status, status);
  }
  const broken = setup({ async write() { throw new Error("secret SQL detail private@example.invalid"); } });
  assert.doesNotMatch(await (await broken.handlers.POST(req(create))).text(), /secret|SQL|private@example/u);
  const noId = setup({ async write() { return { ok: true }; } });
  assert.equal((await noId.handlers.POST(req(create))).status, 503);
});

test("community request budget aborts downstream work rather than waiting indefinitely", async () => {
  let aborted = false;
  await assert.rejects(runBounded(signal => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => { aborted = true; reject(new Error("aborted")); });
  }), 10));
  assert.equal(aborted, true);
});
