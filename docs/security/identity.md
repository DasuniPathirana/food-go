# Identity implementation and activation

Review updated on 11 November 2026. See [the identity verification record](../progress/02-identity-verification.md) for the latest command results and source review.

The account screens and server routes are implemented for a client-owned Supabase project. They are disabled in the current preview because no project or email service has been connected. No real account, email, password or recovery request was used for development checks.

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

1. Create the client-owned Supabase project in Sydney and keep its dashboard access restricted.
2. Apply the database migration to a disposable test environment first. Run the live tenant policy assertions there.
3. Enable email and password sign-in and require email confirmation. Configure the app origin and the exact callback URL in Supabase. Avoid broad redirect wildcards.
4. Connect the transactional email provider, authenticate its sending domain and test delivery, spam handling and expiry.
5. Copy `apps/web/.env.example` to an ignored local environment file. Set the server-only Supabase URL and publishable key, the exact app origin and a cryptographically random cookie signing secret. Do not paste these values into chat or commit them.
6. Generate the signing secret from at least 32 random bytes and encode it as base64url. A long repeated string is not a suitable production secret.
7. Set `FOOD_GO_AUTH_ENABLED=true` only for the private test environment. Keep `FOOD_GO_AUTH_PRODUCTION_READY=false` until every production requirement below is complete.
8. Test registration, email confirmation, sign-in, expiry, refresh, sign-out and recovery in the same browser. PKCE recovery and confirmation links must be opened in the browser that started the request. Another browser should receive a clear link failure.

The current configuration accepts hosted `supabase.co` project URLs and development loopback URLs. Custom provider domains require an explicit reviewed configuration change. Production requires an exact HTTPS app origin, complete project settings and the explicit release gate.

## Session refresh integration

`getAuthState` in `apps/web/src/lib/auth/server.ts` returns only configured status and a minimal verified account. It uses React request caching to avoid duplicate checks in the same server render.

Server Components cannot reliably write refresh cookies. The global proxy now calls `refreshAuthSession(request, requestHeaders)` from `apps/web/src/lib/auth/proxy.ts` before creating `NextResponse.next`, then copies each returned cookie update to that final response. The helper forwards refreshed cookies into the request headers used by the render as well. This preserves the nonce and Content Security Policy headers already set by the proxy.

The root layout and profile page use verified account state, and the profile provides a sign-out action when configured. Saved example collections remain on the browser; account-to-collection synchronisation is not connected yet.

API and callback handlers can persist refreshed cookies. `GET /api/auth/session` is also a writable refresh path, but it does not replace global proxy refresh. The integration is implemented in source, but provider-backed expiry and concurrent-tab testing have not been performed. Keep production identity disabled until those tests pass.

## Production requirements still outstanding

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

No application can be guaranteed impossible to compromise. The current controls reduce specific risks while keeping incomplete account workflows closed.
