import assert from "node:assert/strict";
import { test } from "node:test";
import { createGameProfileHandler } from "./game-profile";

const env = { NODE_ENV: "test", APP_ORIGIN: "http://localhost:3000", FOOD_GO_AUTH_ENABLED: "true", FOOD_GO_COMMUNITY_ENABLED: "true", FOOD_GO_AUTH_COOKIE_SECRET: "a".repeat(48), SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example_public_key_for_tests" };
const profile = { xp: 28, level: 1, nextLevelXp: 250, reachCount: 3, activity: [{ kind: "reach", points: 1, at: "2026-11-13T12:00:00+00:00" }] };
test("game profile stays closed until identity and community release gates are ready", async () => {
  let calls = 0;
  for (const environment of [{ ...env, FOOD_GO_AUTH_ENABLED: "false" }, { ...env, FOOD_GO_COMMUNITY_ENABLED: "false" }, { ...env, NODE_ENV: "production", APP_ORIGIN: "https://food.example" }]) {
    const handler = createGameProfileHandler({ env: environment, async read() { calls++; return { verified: true, profile }; } });
    assert.equal((await handler()).status, 503);
  }
  assert.equal(calls, 0);
  const denied = createGameProfileHandler({ env, async read() { return { verified: false, profile }; } });
  assert.equal((await denied()).status, 401);
});
test("game progress is bounded, no-store and strips raw account fields", async () => {
  const handler = createGameProfileHandler({ env, async read() { return { verified: true, profile: { ...profile, email: "secret@example.invalid", actor_id: "private" } }; } });
  const result = await handler();
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.deepEqual(await result.json(), { status: "ready", ...profile });
  for (const data of [{ ...profile, xp: -1 }, { ...profile, activity: Array(13).fill(profile.activity[0]) }, { ...profile, activity: [{ ...profile.activity[0], points: 100000 }] }]) {
    const invalid = createGameProfileHandler({ env, async read() { return { verified: true, profile: data }; } });
    assert.equal((await invalid()).status, 503);
  }
  const failed = createGameProfileHandler({ env, async read() { throw new Error("secret database details"); } });
  assert.doesNotMatch(await (await failed()).text(), /secret|database/u);
});
