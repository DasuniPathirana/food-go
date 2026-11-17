export type EmailAuthOperation = "register" | "recovery" | "resend";
type ProviderError = { status?: number; code?: string };
export type EmailProviderFailureStatus = 400 | 429 | 503;

const rateLimits = new Set(["over_email_send_rate_limit", "over_request_rate_limit"]);
const existingIdentity = new Set(["email_exists", "user_already_exists", "identity_already_exists", "user_banned"]);
const privateAccountState = new Set(["user_not_found", "email_not_confirmed"]);
const invalidInput = new Set(["email_address_invalid", "validation_failed", "weak_password", "bad_json"]);

/** null permits the existing neutral result; it never establishes email delivery.
 * Known address/account cases stay indistinguishable, while provider/configuration
 * failures must not fall through to a successful "check your inbox" response.
 * Read only stable status/code fields. Provider messages may contain private data.
 */
export function emailProviderStatus(
  error: ProviderError | null | undefined,
  operation: EmailAuthOperation = "register",
): EmailProviderFailureStatus | null {
  if (!error) return null;
  if (error.status === 429 || rateLimits.has(error.code ?? "")) return 429;
  if (error.status && error.status >= 500) return 503;
  if (existingIdentity.has(error.code ?? "")) return null;
  if (operation !== "register" && privateAccountState.has(error.code ?? "")) return null;
  if (invalidInput.has(error.code ?? "")) return 400;
  // Includes signup_disabled (often HTTP 422), email_provider_disabled,
  // email_address_not_authorized, captcha/hook failures, invalid project keys
  // and unknown errors. Fail closed rather than implying a message was sent.
  return 503;
}
