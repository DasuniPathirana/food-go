import assert from "node:assert/strict";
import test from "node:test";
import { signInDestination } from "./auth-return";

test("sign-in returns only to explicit application screens including Quests and Outback", () => {
  for (const path of ["/quests", "/outback", "/deals", "/profile", "/admin", "/collect", "/partner/dashboard", "/inventory", "/encounters"]) assert.equal(signInDestination(path), path);
  for (const path of ["//example.com", "https://example.com", "/outback?next=//example.com", ["/outback"], "/api/admin", "/\\example.com", "javascript:alert(1)"]) assert.equal(signInDestination(path), undefined);
});
