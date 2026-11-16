import assert from "node:assert/strict";
import test from "node:test";
import { readBrowserAvatarPreferences } from "./avatar-preferences";

test("new web explorers start in 3D without changing a valid saved cosmetic choice", () => {
  assert.equal(readBrowserAvatarPreferences(null).avatarId, "foodie");
  for (const avatarId of ["explorer", "foodie", "anime-violet"] as const)
    assert.deepEqual(readBrowserAvatarPreferences(JSON.stringify({ version: 1, avatarId, idleMotion: false })), { version: 1, avatarId, idleMotion: false });
  for (const value of ["not json", "{}", JSON.stringify({ version: 2, avatarId: "explorer", idleMotion: true }), "x".repeat(513)])
    assert.equal(readBrowserAvatarPreferences(value).avatarId, "foodie");
});
