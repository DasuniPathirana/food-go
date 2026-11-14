import { test } from "node:test";
import assert from "node:assert/strict";
import { isAllowedWriteOrigin } from "./request-guards";
test("writes fail closed without an exact trusted origin", () => {
  const expected = "https://foodgo.example";
  assert.equal(isAllowedWriteOrigin(null, expected), false);
  assert.equal(isAllowedWriteOrigin(expected, undefined), false);
  assert.equal(
    isAllowedWriteOrigin("https://foodgo.example.attacker.test", expected),
    false,
  );
  assert.equal(isAllowedWriteOrigin("http://foodgo.example", expected), false);
  assert.equal(isAllowedWriteOrigin("https://attacker.test", expected), false);
  assert.equal(isAllowedWriteOrigin(expected, expected, "cross-site"), false);
  assert.equal(isAllowedWriteOrigin(expected, expected, "same-origin"), true);
});
