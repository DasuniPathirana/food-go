# Identity implementation and activation

Review updated on 12 November 2026. See [the Supabase connection record](../progress/03-supabase-connection.md) for today's setup and read-only results. The [earlier identity verification record](../progress/02-identity-verification.md) preserves the source review from the previous milestone.

The account screens and server routes are implemented for a client-owned Supabase project. The ignored local configuration now contains the project URL, publishable key and a signing secret generated from 32 random bytes. Read-only checks accepted the publishable key. Both application account flags remain false, so this setup does not open sign-in or registration in Food Go.

The provider reports that email and password accounts are enabled, email confirmation is required and direct provider sign-up is enabled. These are settings observations, not completed account tests. The Food Go application flag does not disable the provider's own public account API. No account was created, no email was requested and no remote data or project setting was changed during this check. The venue query returned PGRST205, reported by the probe as `schema_not_ready`: the Food Go `venues` relation is not available in the Data API schema cache. This does not establish the complete database inventory. Database installation and live access-policy tests remain pending.

The service-role key shared in chat and the secret key visible in the supplied screenshot require owner-led rotation. Neither belongs in the app's configuration, source, screenshots or report. Do not send replacement secret keys through chat. This application connection uses the publishable key.

## What is implemented

- Sign in, registration, forgotten password and new password screens.
- Matching same-origin server endpoints and an email callback using Supabase PKCE.
- Strict input validation and a 4 KB streaming request-body limit.
- Safe responses that do not expose provider errors, account existence, passwords, keys or tokens.
- Server-side Supabase calls using a publishable project key. A service-role key is neither required nor accepted by configuration.
- HttpOnly session cookies with SameSite Lax. HTTPS and production use secure cookies.
- Verified identity through Supabase `getUser`. Cookie session contents alone do not authorize a user.
- A signed, user-bound password recovery permission with a ten-minute lifetime. An ordinary signed-in session cannot use the recovery endpoint without that permission.
- Callback destinations restricted to specific local account and partner pages. Arbitrary URLs, query strings and protocol-relative destinations are rejected.
- Sign-out and a no-store session endpoint. Tokens are never returned in the session response. If password recovery succeeds but the provider cannot confirm signing out other sessions, the response states both outcomes instead of reporting ordinary completion.

Verified identity is a starting point for access control. Restaurant authority, staff roles, ownership checks and publication still need separate server workflows and database tests. A normal customer account does not become a restaurant owner by signing in.

## Routes

| Purpose                      | Route                            |
| ---------------------------- | -------------------------------- |
| Sign-in screen               | `/auth/sign-in`                  |
| Registration screen          | `/auth/register`                 |
| Recovery email screen        | `/auth/forgot-password`          |
| New password screen          | `/auth/reset-password`           |
| Email callback               | `/auth/callback`                 |
| Sign-in endpoint             | `POST /api/auth/sign-in`         |
| Registration endpoint        | `POST /api/auth/register`        |
| Recovery email endpoint      | `POST /api/auth/forgot-password` |
| New password endpoint        | `POST /api/auth/reset-password`  |
| Sign-out endpoint            | `POST /api/auth/sign-out`        |
| Verified session and refresh | `GET /api/auth/session`          |

## Set up a private test environment

1. Confirm the client-owned project and its region, existing data and intended use through authorised dashboard or database access. The project URL alone does not establish that it is in Sydney or safe to use for test fixtures.
2. Review the migration preflight and apply the database migrations to a separate disposable test environment first. Run the tenant and partner workflow suites there (56 assertions in total). Do not run fixture tests against the project's production branch.
3. Enable email and password sign-in and require email confirmation. Configure the app origin and the exact callback URL in Supabase. Avoid broad redirect wildcards.
4. Connect the transactional email provider, authenticate its sending domain and test delivery, spam handling and expiry.
5. This workstation now has an ignored `apps/web/.env.local` file. On another workstation, copy `apps/web/.env.example` and configure the project URL, publishable key, exact app origin and a new signing secret through the approved local or deployment environment. Do not copy a secret from the documentation or commit environment files.
6. Generate the signing secret from at least 32 random bytes and encode it as base64url. A long repeated string is not a suitable production secret.
7. Set `FOOD_GO_AUTH_ENABLED=true` only for the private test environment. Keep `FOOD_GO_AUTH_PRODUCTION_READY=false` until every production requirement below is complete.
8. Test registration, email confirmation, sign-in, expiry, refresh, sign-out and recovery in the same browser. PKCE recovery and confirmation links must be opened in the browser that started the request. Another browser should receive a clear link failure.

The current configuration accepts hosted `supabase.co` project URLs and development loopback URLs. Custom provider domains require an explicit reviewed configuration change. Production requires an exact HTTPS app origin, complete project settings and the explicit release gate.

## Required callback configuration

The current development origin is `http://127.0.0.1:3000`. Set the provider Site URL to that origin for the isolated development project. The application currently requests these two return URLs:

```text
http://127.0.0.1:3000/auth/callback?next=/profile
http://127.0.0.1:3000/auth/callback?next=/auth/reset-password
```

The first finishes registration and the second handles password recovery. Keep the `next` query choice aligned with the code; do not substitute the reset-password screen directly for the callback. Confirm both complete flows in the same browser that started them. The provider adds its code and flow information to the return. Do not publish actual confirmation or recovery links in evidence.

The hosted Site URL, redirect entries and SMTP settings have not been inspected or changed. These are required setup values, not a record of completed dashboard configuration.

Use explicit callback entries rather than a broad domain wildcard, and test that unintended return addresses are rejected. When a staging or production address is agreed, replace the local origin consistently in the environment, provider Site URL and return entries. Native deep links will need their own implementation and tests. See the [official redirect guidance](https://supabase.com/docs/guides/auth/redirect-urls).

## App keys and project management access

The JavaScript SDK uses the project URL and publishable key for the application's permitted data and account requests. Signed-in users still need their own session, and database grants and row-level policies decide which records they can access. A publishable key is not permission to administer the project. See the [official key guide](https://supabase.com/docs/guides/getting-started/api-keys).

Applying SQL migrations or changing hosted project settings needs a separate authorised management path, such as the signed-in dashboard, the CLI with its required account and database credentials, or the Management API with a scoped personal access token or approved OAuth access. The provided service-role key is a privileged project API key, not a Management API login. Do not put management tokens or database passwords in the app environment or chat. See the [Management API authentication guide](https://supabase.com/docs/reference/api/introduction).

Before account email tests, configure the chosen SMTP provider and an authorised sending domain. Verify the sender records, confirmation and recovery templates, delivery failures and expiry. The default Supabase sender has team-address restrictions and low limits; its existence does not prove public email delivery is ready. See the [custom SMTP guide](https://supabase.com/docs/guides/auth/auth-smtp).

## Session refresh integration

`getAuthState` in `apps/web/src/lib/auth/server.ts` returns only configured status and a minimal verified account. It uses React request caching to avoid duplicate checks in the same server render.

Server Components cannot reliably write refresh cookies. The global proxy now calls `refreshAuthSession(request, requestHeaders)` from `apps/web/src/lib/auth/proxy.ts` before creating `NextResponse.next`, then copies each returned cookie update to that final response. The helper forwards refreshed cookies into the request headers used by the render as well. This preserves the nonce and Content Security Policy headers already set by the proxy.

The root layout and profile page use verified account state, and the profile provides a sign-out action when configured. Saved example collections remain on the browser; account-to-collection synchronisation is not connected yet.

API and callback handlers can persist refreshed cookies. `GET /api/auth/session` is also a writable refresh path, but it does not replace global proxy refresh. The integration is implemented in source, but provider-backed expiry and concurrent-tab testing have not been performed. Keep production identity disabled until those tests pass.

## Production requirements still outstanding

- Rotate the exposed privileged keys and verify that retired credentials are no longer accepted. Creating a new key alone does not necessarily retire an existing legacy key.
- Configure and verify the email provider, confirmation rules, redirect allowlist and provider password policies.
- Integrate a supported CAPTCHA flow into the account forms and provider calls before opening public registration or recovery. Merely enabling CAPTCHA in the provider without client token handling is insufficient.
- Set provider and infrastructure request limits and test abuse handling. No process-local counter is presented as a distributed rate limiter.
- Test the implemented global session refresh path against real expiry and concurrent tabs before relying on it in production.
- Exercise successful, rejected, expired and replayed confirmation and recovery links against the real provider.
- Exercise the recovery permission across sign-out, parallel tabs and password updates. Its cookie is cleared after success; stronger single-use recovery consumption is still required before relying on the flow for public production use. A captured permission and still-valid authenticated token must not be reusable during the permission window.
- Complete account deletion, retention, ownership-transfer handling and audit records. Account deletion is not implemented in this stage.
- Finalise and publish the privacy terms and account consent records before public registration.
- Configure monitoring, alerting, incident ownership, administrator MFA and backup restore checks.
- Test sessions and server errors on real devices and perform an independent security review before launch.

`FOOD_GO_AUTH_PRODUCTION_READY` is an explicit release gate, not an automated certification. It must stay false while the outstanding implementation or provider checks remain unfinished.

## Evidence

On 11 November 2026, web and mobile TypeScript checks and fourteen root behavior tests pass. Five of those tests cover identity configuration gates and unexpected endpoints, redirect attacks, input privilege injection and password handling, signed recovery permissions and generic public errors. Eight static security convention checks pass. The production dependency audit reports zero known vulnerabilities. Those checks do not replace connected provider, mail delivery, live database or native device testing.

On 12 November 2026, the root test suite passes all 17 tests and the web TypeScript check passes. The added tests cover ambiguous provider URLs, production transport restrictions and the real enabled account request reader. They reject cross-site requests, malformed bodies, unexpected privilege fields and oversized streamed data even when the request claims a smaller length. These tests use fake configuration and make no provider account requests.

Today's live checks were read-only: the public key was accepted, limited account settings were read and a zero-row venue select returned PGRST205, reported as `schema_not_ready`. No management or direct database credentials were available, so the complete schema, region, SMTP settings and redirect entries could not be confirmed. Registration, confirmation, recovery, refresh, sign-out and database policy behaviour have not yet been tested against the hosted service. Both `FOOD_GO_AUTH_ENABLED` and `FOOD_GO_AUTH_PRODUCTION_READY` remain false.

No application can be guaranteed impossible to compromise. The current controls reduce specific risks while keeping incomplete account workflows closed.
