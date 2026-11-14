# Foundation source review

Date: 10 November 2026

Scope: source inspection of the initial web components, shared schema, CSP proxy, database grants, policies and security documentation. This is not a penetration test, browser runtime test or live database policy verification.

## Results

- Eight static source-convention checks pass after explicitly revoking foundation table privileges from PostgreSQL PUBLIC as well as anonymous and authenticated client roles.
- No direct client grant was found for organisation membership changes, venue publication, ownership verification, verified coordinates, check-in insertion, dish verification or reward insertion.
- The membership helpers use fixed search paths and database membership records rather than editable user metadata.
- Contact information and private user history have separate access policies. Public venue queries require published, ownership-verified records.
- The onboarding preview uses escaped React text and shared strict validation. It keeps its draft in component memory and accurately explains that it does not submit, verify or publish a venue.
- The saved-example hook stores only bounded strings under a demo preference key. It does not store credentials, onboarding contacts or GPS history.
- No raw HTML rendering or evaluation sink was found in the reviewed web components.
- The CSP proxy replaces the inbound nonce, forwards the policy to Next.js and returns the matching browser policy. Actual nonce application and hydration still require browser and response-header verification.

## Required later verification

The live Supabase integration suite remains unexecuted. Test organisation isolation, protected column permissions, identity-change re-verification and metadata escalation against a disposable database before connecting real accounts.

Restrictive evidence foreign keys preserve visit and dish relationships. The future deletion workflow must test accounts containing both records and remove dependent evidence in a deliberate order before deleting the authentication account. Also test ownership transfer for an account that owns an organisation. Account deletion is not implemented in this milestone.

The database currently defaults a venue timezone to Australia/Sydney. The future onboarding server must assign the actual venue timezone before implementing timed offers, opening hours or bookings across Australian regions. A state code alone is not always enough to infer the timezone correctly.

The preview confirmation in the onboarding form is not contractual consent or venue-authority evidence. The future connected onboarding workflow must present the real terms and record the applicable version, timestamp and authenticated user separately.

Do not report the static checks, source review, build or screenshots as proof of production security. The [production gate](production-gate.md) remains uncleared.
