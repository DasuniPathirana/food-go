import assert from "node:assert/strict";
import { test } from "node:test";
import { venueDraftSchema, venueSearchSchema } from "./index.ts";

const validDraft = {
  name: "  Market Lane Table  ",
  email: "hello@example.com",
  phone: "+61 3 9000 0000",
  address: "12 Example Street",
  suburb: "Melbourne",
  state: "VIC",
  postcode: "3000",
  cuisine: "Modern Australian",
  venueType: "restaurant",
  description:
    "A neighbourhood restaurant serving seasonal Australian produce.",
  gameEnabled: true,
  acceptedTerms: true,
};

test("normalises harmless whitespace without changing legitimate text", () => {
  assert.equal(venueDraftSchema.parse(validDraft).name, "Market Lane Table");
  assert.equal(
    venueDraftSchema.parse({ ...validDraft, email: " HELLO@EXAMPLE.COM " })
      .email,
    "hello@example.com",
  );
});

test("does not accept client authority, verification or organisation fields", () => {
  for (const addition of [
    { status: "published" },
    { ownershipVerifiedAt: new Date().toISOString() },
    { organizationId: "another-restaurant" },
    { role: "admin" },
    { points: 100000 },
  ]) {
    assert.equal(
      venueDraftSchema.safeParse({ ...validDraft, ...addition }).success,
      false,
    );
  }
});

test("requires explicit authorisation and terms acceptance", () => {
  assert.equal(
    venueDraftSchema.safeParse({ ...validDraft, acceptedTerms: false }).success,
    false,
  );
  const { acceptedTerms: _ignored, ...withoutTerms } = validDraft;
  assert.equal(venueDraftSchema.safeParse(withoutTerms).success, false);
});

test("rejects malformed Australian addresses and unbounded input", () => {
  for (const addition of [
    { state: "California" },
    { postcode: "30000" },
    { postcode: "3e03" },
    { description: "x".repeat(1001) },
    { name: "Hidden\u0000text" },
    { phone: "phone me tomorrow" },
    { email: "invalid" },
  ]) {
    assert.equal(
      venueDraftSchema.safeParse({ ...validDraft, ...addition }).success,
      false,
    );
  }
});

test("allows international names and keeps description as untrusted plain text", () => {
  assert.equal(
    venueDraftSchema.safeParse({ ...validDraft, name: "Café Nguyễn" }).success,
    true,
  );
});

test("bounds search requests and rejects unknown filter fields", () => {
  assert.equal(venueSearchSchema.parse({}).limit, 20);
  assert.equal(venueSearchSchema.parse({ limit: "10" }).limit, 10);
  for (const request of [
    { limit: 100000 },
    { limit: 0 },
    { limit: "NaN" },
    { query: "x".repeat(101) },
    { includePrivate: true },
  ]) {
    assert.equal(venueSearchSchema.safeParse(request).success, false);
  }
});
