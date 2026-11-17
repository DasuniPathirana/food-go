import assert from "node:assert/strict";
import test from "node:test";
import { adventureActionSchema } from "./adventure-contracts";
import { xpForLevel, levelRequirements, levelFromAchievements, questRewards, questDailyXpCap } from "./adventure-rules";

const none = { visits: 0, cuisines: 0, quests: 0, questCategories: 0, posts: 0, harvests: 0, buildings: 0 };
test("250-level curve strictly increases and becomes substantially steeper after level 100", () => {
  assert.equal(xpForLevel(1), 0);
  for (let level = 2; level <= 250; level++) assert.ok(xpForLevel(level) > xpForLevel(level - 1));
  assert.ok(xpForLevel(101) - xpForLevel(100) > (xpForLevel(100) - xpForLevel(99)) * 1.5);
  assert.ok(xpForLevel(250) - xpForLevel(249) > (xpForLevel(101) - xpForLevel(100)) * 20);
  assert.throws(() => xpForLevel(251)); assert.throws(() => xpForLevel(0));
});
test("XP alone cannot bypass diverse milestones or the level 250 maximum", () => {
  assert.equal(levelFromAchievements(xpForLevel(250), none).level, 100);
  assert.equal(levelFromAchievements(xpForLevel(250), none).xpLevel, 250);
  assert.equal(levelFromAchievements(xpForLevel(101), levelRequirements(101)).level, 101);
  const full = levelRequirements(250);
  assert.equal(levelFromAchievements(xpForLevel(250) + 100000, full).level, 250);
  assert.equal(levelFromAchievements(xpForLevel(250), { ...full, questCategories: 0 }).level, 100);
  assert.throws(() => levelFromAchievements(-1, none));
});
test("quest rewards are category-owned and every new client mutation rejects forged balances or dates", () => {
  assert.ok(Object.values(questRewards).every(points => points <= 100 && points <= questDailyXpCap));
  const requestId = "00000000-0000-4000-8000-000000000001";
  assert.ok(adventureActionSchema.safeParse({ action: "plant", requestId, cell: 6, crop: "carrot" }).success);
  for (const extra of [{ coins: 9999 }, { readyAt: "2000-01-01T00:00:00Z" }, { xp: 500 }])
    assert.equal(adventureActionSchema.safeParse({ action: "plant", requestId, cell: 6, crop: "carrot", ...extra }).success, false);
  assert.equal(adventureActionSchema.safeParse({ action: "build", requestId, cell: 16, structure: "bakery" }).success, false);
  assert.equal(adventureActionSchema.safeParse({ action: "chooseDestination", requestId, region: "USA" }).success, false);
});
