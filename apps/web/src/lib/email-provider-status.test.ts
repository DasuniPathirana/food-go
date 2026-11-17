import assert from "node:assert/strict";
import test from "node:test";
import { emailProviderStatus, type EmailAuthOperation } from "./auth/email-provider-status";

const operations: EmailAuthOperation[] = ["register", "recovery", "resend"];

test("disabled signup, provider, restricted default sender and hook errors cannot become inbox success", () => {
  const codes = ["signup_disabled", "email_provider_disabled", "provider_disabled", "email_address_not_authorized",
    "hook_timeout", "hook_timeout_after_retry", "hook_payload_over_size_limit", "hook_payload_invalid_content_type",
    "captcha_failed", "request_timeout", "unexpected_failure"];
  for (const operation of operations) for (const code of codes) for (const status of [400, 401, 403, 422, 500])
    assert.equal(emailProviderStatus({ code, status }, operation), 503, `${operation}/${code}/${status}`);
  assert.equal(emailProviderStatus({ code: "signup_disabled", status: 422 }), 503);
});

test("only accepted requests and explicit account-sensitive cases retain neutral responses", () => {
  for (const operation of operations) {
    assert.equal(emailProviderStatus(null, operation), null);
    assert.equal(emailProviderStatus(undefined, operation), null);
    for (const code of ["email_exists", "user_already_exists", "identity_already_exists", "user_banned"])
      assert.equal(emailProviderStatus({ code, status: 422 }, operation), null);
  }
  for (const operation of ["recovery", "resend"] as const) for (const code of ["user_not_found", "email_not_confirmed"])
    assert.equal(emailProviderStatus({ code, status: 404 }, operation), null);
  assert.equal(emailProviderStatus({ code: "user_not_found", status: 404 }, "register"), 503);
});

test("provider rate limits survive status variations and service failures never report success", () => {
  for (const operation of operations) {
    assert.equal(emailProviderStatus({ status: 429 }, operation), 429);
    for (const code of ["over_email_send_rate_limit", "over_request_rate_limit"])
      assert.equal(emailProviderStatus({ code, status: 422 }, operation), 429);
    assert.equal(emailProviderStatus({ code: "email_exists", status: 503 }, operation), 503);
    for (const error of [{}, { status: 400 }, { status: 403 }, { status: 422, code: "new_unknown_code" }])
      assert.equal(emailProviderStatus(error, operation), 503);
  }
});

test("known parameter/password failures stay generic input failures without reading private messages", () => {
  for (const operation of operations) for (const code of ["email_address_invalid", "validation_failed", "weak_password", "bad_json"])
    assert.equal(emailProviderStatus({ code, status: 422 }, operation), 400);
  const privateError = { status: 422, code: "signup_disabled", get message(): never { throw new Error("Private provider message must never be read"); } };
  assert.equal(emailProviderStatus(privateError), 503);
});
