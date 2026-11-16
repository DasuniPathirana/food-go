import assert from "node:assert/strict";
import test from "node:test";
import { ageStatusForBirthDate, ageStatusSchema, birthDateSchema, isValidBirthDate, sydneyToday } from "./age-contracts";

test("sixteenth birthday is evaluated on the Sydney calendar and honours leap days", () => {
  assert.equal(sydneyToday(new Date("2026-11-16T12:59:59Z")), "2026-11-16");
  assert.equal(sydneyToday(new Date("2026-11-16T13:00:00Z")), "2026-11-17");
  assert.equal(ageStatusForBirthDate("2010-11-17", "2026-11-16").feedEligible, false);
  assert.equal(ageStatusForBirthDate("2010-11-17", "2026-11-17").feedEligible, true);
  assert.equal(ageStatusForBirthDate("2012-02-29", "2028-02-28").feedEligible, false);
  assert.equal(ageStatusForBirthDate("2012-02-29", "2028-02-29").feedEligible, true);
});
test("birth date declaration rejects impossible, future, ambiguous and implausibly old dates", () => {
  for (const value of ["2026-11-18", "1906-11-16", "2011-02-29", "2010-02-30", "17/11/2010", "2010-1-01", " 2010-11-17"])
    assert.equal(isValidBirthDate(value, "2026-11-17"), false, value);
  for (const value of ["1906-11-17", "2012-02-29", "2026-11-17"])
    assert.equal(isValidBirthDate(value, "2026-11-17"), true, value);
  assert.equal(birthDateSchema.safeParse("1990-01-01").success, true);
});
test("unknown age stays closed and status DTOs cannot claim eligibility inconsistently or expose dates", () => {
  assert.deepEqual(ageStatusForBirthDate(null), { status: "unknown", feedEligible: false });
  assert.equal(ageStatusSchema.safeParse({ status: "under16", feedEligible: true }).success, false);
  assert.deepEqual(ageStatusSchema.parse({ status: "eligible", feedEligible: true, birthDate: "1990-01-01" }), { status: "eligible", feedEligible: true });
});
