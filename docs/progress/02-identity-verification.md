# Identity verification record

Review date: 11 November 2026.

The account source and its integration with the website have been reviewed. The local checks below pass. Account services remain disabled until a client-owned Supabase project and email service are configured and the outstanding release requirements are completed.

No real account was created, no recovery email was sent and no live provider credentials were inspected during this review.

## Command results

| Check | Result | What it covers |
| --- | --- | --- |
| `npm run check` | Passed | Both web and mobile TypeScript checks and fourteen behavior tests. |
| `npm run test:security` | Passed | Eight static source and repository convention checks. |
| `npm audit --omit=dev --audit-level=moderate` | Passed | Zero known vulnerabilities reported by the dependency advisory service on the review date. |
| Connected Supabase account flows | Not run | No test project or mail service has been connected for this review. |
| Live database access policy assertions | Not run | Requires a disposable configured Supabase test environment. |
| Native device account flows | Not run | Native account screens and provider integration are a later step. |

The website build, browser screenshots and responsive checks are recorded separately by the main milestone review. These command results do not establish live mail delivery, token expiry or account deletion behavior.

## Source controls reviewed

The review covered account configuration, request validation, server actions, email callback routing, recovery permissions, server identity reads, session refresh and the root proxy integration.

- Incomplete or disabled configuration keeps account services closed. Production also requires an explicit release flag and an HTTPS app origin.
- Browser write requests must come from the exact configured app origin. Requests are limited to JSON and a maximum streamed body of 4 KB.
- Strict account input schemas reject unexpected fields such as a client-selected administrator role.
- Server account reads use Supabase `getUser`. The application does not use a client-supplied session object as proof of identity.
- Session cookies are HttpOnly and SameSite Lax. HTTPS and production cookies are secure.
- The global proxy refreshes cookies before Server Component rendering, forwards the updated request cookies and copies the response cookie updates onto the same response that carries the nonce-based Content Security Policy.
- Callback destinations are an exact list of local pages. Arbitrary URLs and extra query strings do not become redirect targets.
- Password recovery requires both a verified user and a signed permission bound to that user with a ten-minute lifetime. Missing, altered, wrong-user and expired permissions fail the focused tests.
- Account responses do not return access tokens or raw provider errors. Identity reads return only minimal account information.

## Error handling correction

The review found that the password recovery action did not inspect the result of provider-wide sign-out after a successful password update. It could therefore present ordinary completion even if signing out other sessions failed.

The action now checks both rejected and thrown revocation errors. It states that the password was updated but other-session sign-out could not be confirmed, and asks the user to sign out and sign in again. The recovery cookie is cleared after the successful password update. This provider failure branch still needs a connected test before release.

## What still needs verification or development

The current preview does not expose active account services, and this review found no path that allows it to create a real verified venue or award a reward. That does not make the future connected service ready for public release.

Before enabling production accounts:

1. Connect and test the real email provider, email confirmation, recovery expiry and exact redirect allowlist.
2. Add a complete CAPTCHA token flow and configure provider and infrastructure abuse limits. Provider settings alone are not a working application CAPTCHA flow.
3. Test refresh, sign-out, password changes, revoked sessions and concurrent tabs against the actual provider.
4. Add durable single-use recovery consumption or an equivalent tested server-side mechanism. Clearing the browser cookie alone does not invalidate a captured copy before its expiry.
5. Implement and test account deletion, ownership transfer, retention rules and consent records.
6. Run the live database policy assertions, review deployment settings and complete native device testing.

No application can be guaranteed unhackable. The checks establish specific source boundaries and local behavior; production safety also depends on the connected services and operational controls.

See [identity setup and release requirements](../security/identity.md) for the setup sequence and account routes.
