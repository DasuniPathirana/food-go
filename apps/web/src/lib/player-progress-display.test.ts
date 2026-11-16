import assert from "node:assert/strict";
import test from "node:test";
import { xpForLevel } from "./adventure-rules";
import { playerProgressDisplay } from "./player-progress-display";

test("milestone-gated progression never displays negative XP or the legacy 250-point bar", () => {
  const achievements = { visits: 1, cuisines: 1, quests: 1, questCategories: 1, posts: 0, harvests: 0, buildings: 0 };
  const profile = { level: 100, xp: xpForLevel(105), nextLevelXp: xpForLevel(101), achievements,
    nextRequirements: { visits: 5, cuisines: 3, quests: 3, questCategories: 2, posts: 1, harvests: 1, buildings: 1 } };
  const display = playerProgressDisplay(profile);
  assert.equal(display.value, display.maximum);
  assert.equal(display.maximum, 8000);
  assert.match(display.text, /milestones/u);
  assert.ok(display.missing.includes("4 more verified places"));
  assert.doesNotMatch(display.text, /-\d/u);
});

test("a completed level 250 profile has a full terminal bar", () => {
  const display = playerProgressDisplay({ level: 250, xp: xpForLevel(250), nextLevelXp: xpForLevel(250) });
  assert.equal(display.complete, true); assert.equal(display.value, 1); assert.equal(display.maximum, 1);
  assert.equal(display.text, "Level 250. Legendary.");
});
