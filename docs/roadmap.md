# Food Go delivery roadmap

## Delivery approach

Build complete user journeys in stages. Each stage should have working behavior, relevant checks, screenshots, and documented limitations before moving on. A screen that resembles a future feature does not count as that feature being operational.

## Milestone 01: local foundation and discovery experience

Scope:

- Create the Next.js web and Expo mobile workspaces.
- Establish calm visual styling, spacing, accessible controls, and responsive navigation.
- Provide reviewable discovery screens using clearly identified example content.
- Create a venue onboarding draft with shared validation.
- Establish the shared domain package and proposed database access boundaries.
- Document the architecture, security model, setup, and verification status.

Acceptance:

- Web checks and a production build complete successfully.
- Mobile source type checks pass, with device verification status stated explicitly.
- Discovery controls behave as described and do not award verified visits or rewards from client state.
- The onboarding preview does not publish a real venue or accept unvalidated server writes.
- Desktop and mobile-width screenshots show readable content and one main vertical scroll.
- No production secret is required to review example content.

Evidence: [Milestone 01 progress](progress/01-foundation.md).

## Milestone 02: identity and verified venue onboarding

Scope:

- Connect a dedicated test Supabase project.
- Add registration, sign-in, verified email, password recovery, sign-out, and account deletion.
- Add organisation creation and controlled staff membership.
- Add existing-venue search, duplicate detection, and a venue claim workflow.
- Agree and implement ownership evidence and operator exceptions.
- Save venue drafts and publish only through authorised server rules.
- Add secure media upload limits, content handling, and removal.

Acceptance:

- Two organisations cannot access each other's private records.
- Anonymous and ordinary customer sessions cannot write owner data.
- An owner cannot self-verify, publish through an unauthorised path, or elevate a staff role.
- Email delivery, recovery, session expiry, and deletion work in the test environment.
- Duplicate claims and failed verification have understandable recovery paths.
- Access controls are exercised against the actual database, not only inspected in source.

## Milestone 03: marketplace and operational portal

Scope:

- Public approved venue pages, suburb and cuisine search, menus, and favourites.
- Owner editing for venues, opening hours, dishes, photos, and game participation.
- Canonical food catalogue and venue-specific dish links.
- Basic offers, explicit conditions, redemption tracking, and booking enquiries.
- Operator review queues, audit records, reporting, and basic analytics.

Acceptance:

- Unapproved and private data never appears through public queries.
- Owners can maintain their own information without routine operator entry.
- Changes to offer validity and opening hours behave in each venue's local time zone.
- Empty, loading, error, and regional-connectivity states are usable.
- User-submitted photos and reviews have reporting and moderation paths before public release.

## Milestone 04: verified exploration game

Scope:

- Integrate a licensed map provider and foreground location permission.
- Add nearby participating venues from the shared database.
- Add secure visit verification with short-lived or single-use evidence.
- Add separate dish verification under an agreed evidence model.
- Connect FoodDex, VenueDex, food passport, basic quests, badges, and progress.

Acceptance:

- Permission refusal still allows location search.
- Replayed, expired, duplicate, and out-of-range check-in attempts are handled safely.
- Server-side event records prevent duplicate rewards.
- A venue visit cannot silently become a verified dish experience.
- Precise user location is not exposed to other explorers by default.
- Android and iOS permission, camera, and navigation behavior is verified on real devices.

## Milestone 05: commercial expansion

Scope depends on the agreed business model:

- Restaurant subscriptions through the partner website.
- Full booking integrations or reservation inventory.
- Customer payment collection, commissions, refunds, and restaurant payouts.
- Transaction-backed verification and POS integrations where available.
- Advanced partner analytics and multi-venue team controls.

Acceptance:

- Store rules distinguish physical dining purchases from digital app benefits.
- Webhooks are authenticated and processed idempotently.
- Payment, refund, dispute, and payout states reconcile with the provider.
- Failed payments do not corrupt venue access or customer entitlements.
- Support and finance owners can resolve exceptions with an audit trail.

## Milestone 06: community and campaigns

Scope:

- Friends, following, discovery sharing, groups, and community feeds.
- Rankings with abuse controls and privacy settings.
- Creator campaigns, regional adventures, and travel passes.
- Competitions and prizes only after their operational and legal requirements are agreed.

Acceptance:

- Reporting, blocking, moderation, and appeals operate at the expected scale.
- Private profiles and location histories stay private across social features.
- Reward and ranking abuse can be detected and reversed through audited processes.

## Release requirements across every milestone

- Test the behavior that changed, including error and permission paths.
- Review dependencies and privileged code.
- Keep screenshots free of secrets and real customer information.
- Preserve the no-emoji and no-em-dash copy convention.
- Check representative desktop and mobile widths for overflow and nested vertical scrolling.
- Update the progress record with actual results rather than planned checks.
- Do not mark live integrations complete until they have been configured and exercised.
