# Email and SMS connections

Updated 12 November 2026.

The website has Supabase email account routes, a mobile-code sign-in screen and a Mobile Message SMS delivery adapter. All account and SMS features are disabled by default. Provider credentials and live delivery checks must be configured separately. Automated checks do not send email or SMS.

The web sign-in flow requests a code and verifies it with Supabase. Confirmed email or a confirmed Australian mobile identifies an explorer account. These account checks do not establish venue ownership. Phone changes, linking an existing email account to a number and native account flows remain separate work.

## Sign in with a mobile code

Open `/auth/phone`, enter an Australian mobile number, request the code and enter the SMS code. The email sign-in screen links to this option. Local `04`, `614` and `+614` formats are accepted without spaces; the server normalises them consistently.

The app uses `POST /api/auth/phone/request` and `POST /api/auth/phone/verify`. Supabase creates, expires and verifies the one-time code. Successful verification is checked against `getUser`, including the confirmed phone and matching number, before returning the profile destination. Session cookies stay HttpOnly. The phone and code are held in page memory and never written to browser storage or returned as session tokens.

Code requests use `shouldCreateUser=true`: a new verified number can create an explorer account when the provider allows signups. Supabase's signup setting remains authoritative. Request responses use the same public wording for accepted and ineligible numbers. An existing email account is not automatically linked to a phone account by matching a name or business contact.

For a controlled development test:

1. Configure the SMS adapter and signed HTTPS hook below, starting with sandbox credentials.
2. Enable Supabase phone authentication, configure OTP expiry and provider request limits, and decide whether new phone accounts may register.
3. Set `FOOD_GO_AUTH_ENABLED=true`, `FOOD_GO_PHONE_AUTH_ENABLED=true` and the existing valid app configuration on the development server. Keep `FOOD_GO_AUTH_PRODUCTION_READY=false`.
4. Test code request, wrong and expired codes, successful sign-in, replay rejection, refresh and sign-out using authorised test information. Sandbox delivery does not send a code to a handset; use Supabase's controlled test-phone facility or the provider sandbox's authorised inspection tools. Never record real codes in evidence.
5. Test actual delivery separately with a controlled phone and live provider configuration before rollout.

The screen provides a 60-second resend cooldown for usability. It is not a distributed abuse limit. Production remains closed until provider limits, CAPTCHA, durable protections and the other account release requirements are complete. Provider signups and limits also need review because application flags do not close the provider's direct public API.

Sources: [Supabase phone sign-in](https://supabase.com/docs/guides/auth/phone-login), [requesting OTPs](https://supabase.com/docs/reference/javascript/auth-signinwithotp) and [verifying OTPs](https://supabase.com/docs/reference/javascript/auth-verifyotp).

## Brevo REST email through the Supabase Send Email Hook

The selected connection uses the supplied **Brevo REST API key**, not an SMTP password. Supabase creates account tokens and calls the signed Food Go email hook; the server sends the email through Brevo's fixed transactional REST endpoint. When this hook is enabled, Supabase does not use SMTP for these emails. The owner's temporary sender is **TaskRoof <support@taskroof.com.au>**. Verify that sender/domain in the selected Brevo account before delivery.

Configure these server-only values through the hosting dashboard or ignored local environment:

| Variable | Value or source |
| --- | --- |
| `FOOD_GO_EMAIL_ENABLED` | Keep `false` until the intended hook and sender are configured; set `true` for controlled delivery checks. |
| `BREVO_API_KEY` | The owner's Brevo REST key, kept private. An SMTP key cannot substitute for it. |
| `EMAIL_SENDER_NAME` | `TaskRoof`, the owner's selected temporary sender. |
| `EMAIL_SENDER_ADDRESS` | `support@taskroof.com.au`, verified in that Brevo account. |
| `SUPABASE_EMAIL_HOOK_SECRET` | Signing secret from the intended project's Send Email Hook, retaining `v1,whsec_`/`whsec_` format. Separate from the SMS hook secret. |
| `APP_ORIGIN` and `SUPABASE_URL` | Exact intended website and project origins. |

Deploy the reviewed endpoint, then in **Supabase Authentication > Hooks > Send Email**, select an HTTP hook and enter:

```text
https://food-go-three.vercel.app/api/webhooks/supabase/email
```

Generate the hook signing secret and copy it verbatim into `SUPABASE_EMAIL_HOOK_SECRET` in the corresponding web environment. Save/enable the hook. Keep the Email provider enabled, email/password enabled and confirmation required. Site URL and exact callback entries remain those in [setup required now](../deployment/setup-now.md); do not point the callback directly at the reset screen. No SMTP username, SMTP password or Brevo email-template ID is required by this connection.

The endpoint verifies Standard Webhooks signatures and five-minute timestamp tolerance against the exact raw body, caps input and provider responses at 32 KB, and accepts only known account email actions. It builds links through the configured Supabase `/auth/v1/verify` endpoint, with a validated same-origin confirmation/recovery callback. Supabase performs token verification and redirects with its PKCE code; the existing Food Go callback exchanges that code and grants recovery permission only for a recovery flow. Open confirmation/recovery mail in the browser that initiated it. Secure email changes send the current and new addresses their correctly mapped hashes in one Brevo batch.

Each signed event deterministically produces one UUID in Brevo's `headers.idempotencyKey`. A timeout or webhook retry reuses that UUID; the application does not retry inline. Brevo documents a 30-minute deduplication window. Explicit provider idempotency duplicates are acknowledged without another send; other failures remain unavailable. Keep API credentials/sender configuration stable while retries are outstanding. This provider window does not establish permanent replay protection or delivery to an inbox. There is no process-local deduplication claim.

The hook returns an empty HTTP 200 only for a valid accepted batch or an explicit idempotency duplicate. It never logs tokens, links, recipients, provider bodies or exceptions. Public errors are generic. Account security notifications and reauthentication codes have bounded fixed copy. App account gates remain separate from delivery configuration.

Use an authorised inbox to test signup, confirmation, recovery, wrong/expired/replayed links and delivery failure on the deployed origin. Verify sender-domain authentication and actual received links; disable click-tracking/link rewriting for authentication mail. Automated tests use fake fetch only and do not send email. SMTP remains an optional alternative transport if the owner deliberately chooses it later; do not configure both as competing delivery paths.

Sources: [Supabase Send Email Hook and hash mapping](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook), [Brevo transactional REST API](https://developers.brevo.com/reference/send-transac-email), [Brevo idempotency](https://developers.brevo.com/docs/heterogenous-versions-batch-emails).

## Mobile Message SMS hook

The provider is [Mobile Message](https://mobilemessage.com.au/api-documentation). Its domain is `mobilemessage.com.au`. Supabase can use a custom provider through its [Send SMS Auth Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook).

Configure these server environment values:

| Name | Purpose |
| --- | --- |
| `FOOD_GO_SMS_ENABLED` | Keep `false` until a controlled delivery environment is configured. |
| `SUPABASE_SMS_HOOK_SECRET` | Supabase hook signing secret, including `v1,whsec_`, or the `whsec_` format. Use at least 32 random secret bytes. |
| `MOBILE_MESSAGE_API_USERNAME` | API username for the selected sandbox or live account. |
| `MOBILE_MESSAGE_API_PASSWORD` | Matching API password. |
| `MOBILE_MESSAGE_SENDER_ID` | Sender approved in that Mobile Message account. |

Keep these values on the server. Do not add them to public environment variables, mobile bundles, source control, chat or logs.

Deploy the web app to a reachable HTTPS origin, then configure the intended Supabase project's HTTP Send SMS hook to:

```text
https://YOUR_APP_ORIGIN/api/webhooks/supabase/sms
```

Use the same signing secret at Supabase and the application. No browser origin or account cookie is needed for this provider webhook; its signed headers authenticate the request. Keep production phone accounts closed until the intended product flow and abuse controls are ready.

Start with Mobile Message sandbox credentials. Sandbox sends exercise the API without delivery to handsets or credit use. Set `FOOD_GO_SMS_ENABLED=true` for that controlled server only, then test an authorised Supabase hook. Configure an approved sender, account limits and monitoring before any live rollout.

## What the adapter enforces

The endpoint verifies Standard Webhooks HMAC-SHA256 signatures using constant-time comparison. The signature covers the event ID, timestamp and exact UTF-8 body. Timestamps outside five minutes in either direction are rejected. The request body is limited to 32 KB and a one-second read budget. Only Australian mobile numbers and numeric OTPs of six to ten digits are accepted.

One fixed-format SMS is sent to the official HTTPS API with Basic authentication, a three-second timeout and a one-part cap. Unsubscribe blocking remains enabled. Each message result is checked; an HTTP 200 batch alone does not establish acceptance. Success returns the empty HTTP 200 required by Supabase. Failures contain generic messages; OTPs, numbers, credentials and provider errors are never logged or returned.

An `Idempotency-Key` derived from the signed webhook ID stays stable across retries. Mobile Message deduplicates matching requests for 24 hours within the same API key, including concurrent requests. This uses provider persistence rather than a process-local counter. Do not switch API keys or sender configuration while accepted or uncertain deliveries are being retried. Different credentials do not share the provider's deduplication scope. A separate ledger is needed if longer retention or continuity across provider credentials is required.

Sources: [Standard Webhooks specification](https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md), [Supabase hook signatures](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/auth-hooks.mdx), and [Mobile Message OpenAPI contract](https://mobilemessage.com.au/assets/openapi.json).

## Verification and remaining work

The automated tests use fake provider requests. They cover missing or altered signatures, timestamp replay, body bounds, destination validation, provider idempotency, per-message rejection, sanitised failures and timeout cancellation. Phone account tests exercise the actual request guards and actions with a fake Supabase client, including feature gates, invalid inputs, provider errors, code rejection and confirmed-number/session checks. Run `npm test` to include them.

Hosted hook configuration, actual provider idempotency, mail delivery, SMS delivery, sender approval and live phone account behavior require connected verification. Completing email and SMS setup does not clear the [production security gate](../security/production-gate.md).
