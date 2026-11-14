import assert from "node:assert/strict";
import test from "node:test";
import { AVATARS, AVATAR_FALLBACK_IMAGE, avatarMetadataSchema, avatarPaletteSchema, createAvatarPreferences, isAvatarId, parseAvatarPreferences } from "./avatar";

test("the five cosmetic avatar choices have unique validated metadata and complete palettes", () => {
  assert.deepEqual(AVATARS.map((avatar) => avatar.id), ["explorer", "foodie", "trailblazer", "anime-sky", "anime-violet"]);
  assert.equal(new Set(AVATARS.map((avatar) => avatar.id)).size, AVATARS.length);
  for (const avatar of AVATARS) {
    assert.deepEqual(avatarMetadataSchema.parse(avatar), avatar);
    assert.equal(avatar.fallbackImage, AVATAR_FALLBACK_IMAGE);
    assert.equal(Object.keys(avatar.palette).length, 6);
  }
  assert.equal(AVATARS[0].style, "illustrated");
  assert.equal(AVATARS.filter((avatar) => avatar.style === "anime").length, 2);
});
test("palette validation rejects unsupported colour strings and external assets", () => {
  const sample = AVATARS[1];
  for (const skin of ["red", "#fff", "#ffffff00", "url(https://example.com/a)", "#GG0000"]) {
    assert.equal(avatarPaletteSchema.safeParse({ ...sample.palette, skin }).success, false);
  }
  assert.equal(avatarMetadataSchema.safeParse({ ...sample, fallbackImage: "https://example.com/avatar.svg" }).success, false);
  assert.equal(avatarMetadataSchema.safeParse({ ...sample, description: "x".repeat(161) }).success, false);
});
test("all recognised avatar preferences round-trip with either idle motion setting", () => {
  for (const avatar of AVATARS) for (const idleMotion of [true, false]) {
    const expected = { version: 1 as const, avatarId: avatar.id, idleMotion };
    assert.deepEqual(parseAvatarPreferences(JSON.parse(JSON.stringify(expected))), expected);
    assert.equal(isAvatarId(avatar.id), true);
  }
});
test("malformed, future, unknown and extra-field persisted preferences fail closed", () => {
  const defaults = createAvatarPreferences();
  const invalid: unknown[] = [null, undefined, "foodie", [], {}, 1,
    { ...defaults, version: 2 }, { ...defaults, avatarId: "other" }, { ...defaults, avatarId: "anime-sky".repeat(1000) },
    { ...defaults, idleMotion: 1 }, { ...defaults, idleMotion: "false" }, { version: 1, avatarId: "foodie" },
    { ...defaults, xp: 900 }, { ...defaults, avatarId: "constructor" }, { ...defaults, avatarId: "__proto__" },
  ];
  for (const value of invalid) assert.deepEqual(parseAvatarPreferences(value), defaults);
  assert.equal(isAvatarId(null), false);
  assert.equal(isAvatarId("unknown"), false);
  assert.equal(isAvatarId(AVATARS[0]), false);
});
test("default and parsed preferences are isolated values with no account or XP fields", () => {
  const first = createAvatarPreferences(); first.avatarId = "foodie";
  assert.equal(createAvatarPreferences().avatarId, "explorer");
  const source = { version: 1 as const, avatarId: "trailblazer" as const, idleMotion: false };
  const parsed = parseAvatarPreferences(source); parsed.idleMotion = true;
  assert.equal(source.idleMotion, false);
  assert.deepEqual(Object.keys(parsed).sort(), ["avatarId", "idleMotion", "version"]);
});
