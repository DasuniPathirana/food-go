import assert from "node:assert/strict";
import test from "node:test";
import { mayVerifyOperatorFactor, operatorFactors, operatorMfaRequest } from "./auth/operator-mfa";

test("an enrolled account cannot use an unfinished second factor for operator access", () => {
  const pending = { id: "setup", status: "unverified", factor_type: "totp" };
  const existing = { id: "active", status: "verified", factor_type: "totp" };
  assert.equal(mayVerifyOperatorFactor([pending], pending.id), true);
  assert.equal(mayVerifyOperatorFactor([pending, existing], pending.id), false);
  assert.equal(mayVerifyOperatorFactor([existing], "another account"), false);
  assert.equal(mayVerifyOperatorFactor([existing], existing.id), true);
  assert.equal(operatorFactors([{ ...existing, factor_type: "webauthn" }]).canEnrol, false);
});

test("only an explicit enrol or six-digit authenticator verification is accepted", () => {
  const input = { action: "verify", factorId: "3853c6f7-84a3-46b1-8ab0-121445ca304c", code: "013245" };
  assert.ok(operatorMfaRequest.safeParse(input).success);
  assert.ok(!operatorMfaRequest.safeParse({ ...input, verified: true }).success);
  assert.ok(!operatorMfaRequest.safeParse({ ...input, code: "123" }).success);
});
