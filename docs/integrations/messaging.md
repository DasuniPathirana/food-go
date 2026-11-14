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

## Brevo email through Supabase

Use Supabase Auth's custom SMTP configuration so Supabase creates confirmation and recovery links and Brevo delivers the mail. Application code does not need a Brevo API key for this path.

1. Authenticate the sending domain in Brevo with its supplied DNS records and verify the sender address.
2. Obtain the SMTP username and an SMTP key from Brevo's SMTP settings. The SMTP key is different from a Brevo API key.
3. In the intended Supabase development project's Authentication email settings, enable custom SMTP. Use host `smtp-relay.brevo.com`, port `587` with STARTTLS, the SMTP credentials and verified sender. Enter secrets in the dashboard or approved secret store.
4. Set the exact app origin and callback allowlist described in [the identity guide](../security/identity.md). Configure confirmation, password rules, provider limits and email templates.
5. Use a controlled test account to verify confirmation, sign-in, reset, expiry, replay rejection and delivery logs. Check received links and sender identity without recording tokens in screenshots or documentation.

Source: [Brevo's Supabase SMTP guide](https://developers.brevo.com/docs/supabase-smtp-integration) and [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

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
