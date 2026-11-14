# Milestone 04: project analysis and connected application work

Started 12 November 2026. Updated 13 November 2026.

Food Go has a substantial interface and database foundation. It is progressing from a client demonstration to a connected product. It is not yet the complete national marketplace, exploration game and partner operations system described in the original brief.

This review uses the current repository, the [public shared development chat](https://chatgpt.com/s/cx_6af55322e4748191bdc014a64517af55), and authorised inspection of the client's Supabase development project. The shared chat is background evidence. Current source code and actual service observations take precedence over older progress statements. Credentials from the shared chat are excluded from this report.

## What the original request means

The brief describes three connected products: a food discovery website and mobile app, a location-based food exploration game, and a self-service restaurant marketplace. The partner and administration portals are necessary operating tools for those products. They are not optional extra screens.

The intended audience is throughout Australia. React Native and Expo support the Android and iOS applications. Next.js provides the website and partner portal. One shared Supabase database should hold the approved venues, menus, account identities and verified activity used by all three applications.

The shared chat also establishes the presentation requirements: calm colours, careful spacing, clear language, no emojis or em dashes, and one main vertical scroll per screen. The client particularly liked the independent prototype's illustrated exploration map. That interaction is a useful design reference. Its simulated location, verification and rewards are not a production implementation.

The latest provider direction is Mobile Message for SMS sign-in, with Brevo to be supplied later. Sending a code to a mobile number proves control of that number. It does not prove authority to manage a restaurant or establish that a diner visited a location.

## What was already built

The repository has a useful division of responsibility:

| Area | Current purpose | Important boundary |
| --- | --- | --- |
| `prototype` | Independent client presentation with an illustrated map, simulated explorer progress and partner operations | It uses fictional information and local browser state. Its account, QR, payment and approval actions are simulations. |
| `apps/web` | Next.js discovery site, account screens and partner portal | Connected services require configuration and tested server rules. |
| `apps/mobile` | Expo and React Native application with five tabs and separate demo and public API modes | Demo preserves the illustrated map. API mode reads approved catalogue records, with session-only saves and no native account integration. |
| `packages/domain` | Shared validation for venue details and catalogue search | Validation checks input shape. It does not establish ownership or replace database access rules. |
| `supabase` | Database migrations, private data boundaries and integration assertions | A committed migration is only deployed when the target database records and exposes it. |
| `docs` | Architecture, delivery records, screenshots and a client Word report | Earlier records describe their own delivery dates and should not be mistaken for the latest service state. |

The earlier interface work includes discovery search, venue details, venue bookmarks, FoodDex planning, quest planning, a guest passport and a three-step partner form. Account registration, sign-in, recovery and sign-out have a Supabase server integration. These account routes were deliberately closed while the provider setup and release requirements were incomplete.

The client prototype contains more visible simulated workflows than the production applications. Moving those behaviours into the production product requires durable data, access checks and real operational rules. Copying the prototype's local reward or approval state into the connected application would not provide those guarantees.

## What the hosted database inspection established

The connected Supabase project is named Food go and is hosted in Sydney on PostgreSQL 17. Inspection confirmed that the foundation migration is installed. This corrects the older Milestone 03 report, which could only establish that the public application key worked and that the venue relation was unavailable at that time.

At the initial inspection for this milestone, all ten foundation application tables were empty, with no accounts or stored files. The ten tables had row-level security enabled. These observations establish the state inspected on 12 November. They are not a claim that future data or policies will remain unchanged.

The foundation separates public venues and dishes from private business contacts. Organisation membership comes from database records, rather than an editable profile field. Customers cannot give themselves a partner role, publish or verify a venue, move a venue between organisations, record a verified visit, or award themselves points through ordinary table writes.

A published venue must have an ownership verification timestamp. If a partner changes its business name or address, the database returns it to pending verification and clears the verified location. These rules are a useful starting point for the later ownership review workflow.

The review also identified an automatically installed event-trigger helper with unnecessary client execution privileges. An additive migration restricts that callable access while preserving the database trigger. Separate default-privilege hardening closes future application objects until a migration explicitly grants the required access. These changes need deployment and verification as recorded in the final checks, rather than an assumption that editing SQL changed the hosted service.

## Connected work added in this milestone

### Public venue catalogue

The web application now has a server-side catalogue source with separate demonstration and Supabase modes. The connected mode uses an anonymous application client. It does not attach an account session or privileged service credential.

Queries explicitly require published, ownership-verified venues and available dishes. The returned presentation data excludes business contact details and organisation records. Search requests have validated filters, bounded results and a timeout. Detail pages use exact venue identifiers or slugs. Saved collection lookups resolve public venue or dish identifiers independently from the first discovery result page.

An empty connected database produces an honest empty state. A failed connection produces an unavailable state. Neither condition silently substitutes fictional restaurants. Example photographs are not presented as photographs of a real venue; connected records without approved photos use a neutral venue illustration.

This is catalogue access, rather than a complete map service. The illustrated map is still an illustration. National discovery will also require a licensed geographic map, approved coordinates and a complete search and result-navigation experience. Public catalogue access can be enabled independently from public account registration.

### Mobile public catalogue access

The native source now has an optional public API mode alongside the existing demonstration. Default demo mode preserves the illustrated Melbourne map and fictional examples. API mode requests the website's approved public catalogue through an exact HTTPS origin, or a loopback origin during development. The mobile bundle needs no Supabase, email or SMS credential.

Connected discovery searches venue names, suburbs and cuisines, and filters cafes, restaurants and markets. Each request loads at most 50 matching venues and reports when the result is limited. Venue details expose only public addresses and available menu items. Generic icons replace missing photographs, and no illustrative coordinates are presented as actual locations. Empty and failed requests have separate states, with a retry action. A demonstration API response is rejected instead of being displayed as real information.

Mobile venue saves use the canonical venue UUID. Dish saves use the separate menu-item UUID. These saves keep the public details loaded during the current app session, clear on restart, and do not automatically refresh or synchronise with a web account. Connected quests remain an empty state. The mobile app requests no location, camera or microphone permission and cannot record a verified visit or award progress.

Isolated configuration, response-validation and fetch tests use fake HTTP responses. JavaScript exports are bundle checks; they do not establish physical-device rendering, network connectivity, signing or store readiness. The web SMS flow added in this milestone is not a native phone account implementation. Native OTP screens, secure session handling, phone recovery and account deletion remain separate work.

### Private partner draft creation

The partner-draft migration is installed and its 29 database workflow assertions passed on the owner-confirmed development project. The application account and partner flags remain disabled until provider setup and controlled account-delivery checks are complete. A real browser account-to-draft journey has not yet been exercised.

The partner form can submit a validated draft to an authenticated server endpoint, and the partner dashboard can list the signed-in account's organisation venues. The server verifies the account with Supabase. It accepts a confirmed email identity or a verified Australian mobile identity. The database independently checks the same identity requirement for direct calls.

One database operation creates the organisation, owner membership, private venue draft and business contact together. If the operation fails, it does not leave half of that group behind. A submission key makes retries return the original venue rather than creating extra organisations. Reusing that key with changed information is rejected.

The database serialises creation for each account, detects matching venues already associated with that account, and allows no more than five created listings per account. These controls live in the database operation, so calling it directly does not bypass them. Duplicate claims by different accounts still require a wider claim and review workflow.

The browser cannot supply an organisation, role, publication state or ownership approval. New venues are private drafts. The stored business email and phone are contact information; saving them does not verify them. The partner endpoint has a separate activation flag in addition to the account configuration. That application flag does not revoke the database operation from an otherwise authorised signed-in account.

Draft editing, ownership evidence submission, team invitations and operator approval remain separate work. A dashboard showing a draft is not evidence that the restaurant is ready to appear publicly.

### SMS sign-in and delivery integration

The web account work adds an Australian mobile number and one-time-code sign-in flow using Supabase Auth. Supabase remains responsible for issuing and verifying account codes. The application does not create its own parallel password or OTP database.

The Mobile Message delivery route accepts only authenticated Supabase SMS-hook requests. It checks the signature against the exact payload, validates the event timestamp, limits request size and accepts Australian mobile destinations. It uses a fixed provider endpoint and a stable provider submission key so delivery retries can be deduplicated. Provider responses are checked for per-message acceptance. Codes, phone numbers, credentials and raw provider errors are not logged or returned to the browser.

Source implementation and fake-provider tests do not establish live delivery. Activation still requires the real provider account, approved sender, securely installed credentials, a reachable HTTPS webhook, Supabase hook configuration, account rate limits and a controlled SMS test. The current work does not establish account recovery after a lost phone or a changed number.

Brevo is deferred under the current instruction. Future email setup must include the authorised sending domain and its authentication records, rather than only an API key. Existing email account and recovery screens must not be described as live until the delivery and account flows have been exercised.

## Security and correctness assessment

The strongest part of the foundation is the separation of authority. An explorer account, an organisation member, a restaurant owner and a platform operator have different responsibilities. Client screens do not decide that a restaurant is verified or that a diner earned a reward. Database grants and row policies enforce important parts of that separation.

The new catalogue deliberately uses anonymous access and a limited public data shape. The new partner workflow derives account identity from the verified session and creates its own organisation relationship. Private contacts stay outside public catalogue responses. The SMS webhook authenticates its sender before attempting a paid provider request.

There are still material release gaps. Public sign-up and SMS requests need provider abuse limits and appropriate bot protection. Account deletion must handle venue ownership and linked activity. Device session storage and recovery require separate mobile work. Operators need a role model, audit history and protected approval screens. Backups are incomplete as an operational safeguard until a restore has been tested. No source review can establish that the product is impossible to hack.

Privileged credentials appeared in the earlier shared material. Their owner should retire the exposed credentials and check affected services. This document does not contain them or claim that rotation has already happened. Replacement credentials should be installed through the intended secret configuration, rather than copied into project documentation.

## What is still missing from the complete brief

| Product area | Remaining work before it is operational |
| --- | --- |
| Accounts | Live SMS delivery and rate-limit verification, bot protection, expiry and revocation checks, recovery and phone-change rules, deletion and data export, native session handling |
| Partner operations | Edit and resume saved drafts, claims across accounts, ownership evidence, operator review, team invitations and role changes, last-owner protection, opening hours and menu management |
| Administration | Protected operator accounts, review queues, approvals and rejection reasons, immutable audit records, reporting and exception handling |
| Media | Venue-scoped upload authorisation, file-byte checks, size and type limits, approved delivery and removal, separate media backups |
| Maps and discovery | Licensed map provider, approved venue coordinates, location permission and manual-location fallback, nearby queries, complete national search and result navigation |
| Food exploration | Real QR or staff verification, expiry and replay protection, separate dish evidence, server reward transactions and fraud controls |
| Collections and quests | Account-synchronised favourites and wishes, verified history, quest definitions and progress, badges, levels and server-owned completion rewards |
| Dining marketplace | Actual offers and conditions, capacity and redemption, booking enquiries or reservation integration, customer support and disputes |
| Commercial features | Agreed subscriptions and pricing, billing provider, verified webhooks, refunds and entitlements, reconciliation and partner reporting |
| Community | Privacy and sharing rules, friends and following, feed storage, moderation, reporting and blocking before public user content |
| Native release | Connected backend journeys, Android and iOS physical-device QA, permission behaviour, signing, store ownership, release builds and store submission |
| Operations | Hosting and production domains, monitoring, spend alerts, incident ownership, tested backups and restores, support and required public information |

## Concrete next milestones

1. **Verify the connected sign-in and draft journey.** The reviewed migrations and rollback database suites are complete. Configure SMS securely, then prove one controlled phone sign-in and draft save through the application against development. Keep public account access closed while provider and identity release requirements remain unresolved.
2. **Complete the restaurant submission and approval journey.** Allow an owner to reopen and edit a saved draft, submit the agreed ownership evidence, and receive an operator decision. Verify that rejected or pending information remains private. Add auditable approval and publish only approved information.
3. **Make the shared catalogue useful.** Add owner-managed menus and hours, approved photographs and a small authorised real venue catalogue. Verify the mobile API mode on physical devices, implement complete search navigation and introduce the selected licensed map provider.
4. **Build verified exploration.** Add the agreed visit and dish evidence, replay-resistant verification, server-side reward and quest transactions, and physical-device permission and camera testing. The prototype remains the interaction reference while these controls are implemented.
5. **Add commercial and community features after their operating rules are agreed.** Booking, offers, subscriptions, payouts and social content have different permissions and support needs. Deliver each as a tested journey rather than opening simulated controls.

The client should own the Supabase, SMS, future email, map, hosting and store accounts. This milestone does not require buying every future service immediately. Choose and configure each when its working integration is ready to be tested. Current costs and plan limits should be verified at that time.

## Verification record

The partner HTTP and contract tests passed during implementation, and the complete web TypeScript check passed at that checkpoint. These checks do not prove that hosted migrations, live SMS, native accounts or production deployment work.

The database test file includes identity checks for confirmed email and verified Australian phone accounts, direct-call validation, atomic creation, private data isolation, duplicate handling, submission retries and account creation limits. The tenant suite covers foundation permissions. Actual execution and build results are recorded below. [Milestone 05](05-approved-map-and-database.md) adds the approved map implementation and latest browser review.

| Check | Observed result |
| --- | --- |
| Shared conversation | Retrieved and reviewed all 9 turns, including 10 user messages. Temporary downloads were removed; credentials are excluded from this report. |
| Hosted project | Food go, Sydney, healthy PostgreSQL 17. Foundation installed, ten RLS-enabled tables; initial application, account and storage inventories were empty. |
| Hosted validation route | The owner explicitly confirmed Food go as the development/test target despite its provider main-branch label. CLI 3 read-only checks confirmed 10 public RLS tables, 18 policies, private media and denied client authority writes. |
| Hosted hardening | Default privilege migration `20261112164417` and event-helper access migration `20261112164427` applied successfully. Local filenames match hosted migration history. Security and health advisors returned no notices after these changes. |
| Public catalogue | Live publishable-key check and production HTTP reads succeeded. The empty hosted catalogue returns an empty result without fictional venues. |
| Partner draft migration | `20261112232102_food_go_partner_drafts.sql` applied successfully. Local filename matches hosted migration history. Anonymous RPC execution is denied; verified authenticated accounts can create private drafts under the tested database rules. |
| Workspace types and automated tests | Web and mobile TypeScript passed; all 63 automated tests passed, including catalogue, phone, signed messaging, partner HTTP, shared domain and rollback-runner checks. |
| Web production build | Passed after the final account, catalogue and partner interface changes. |
| Native JavaScript exports | Android passed with 2,787 modules and a 4,184,576-byte Hermes bundle. iOS passed with 2,788 modules and a 4,178,784-byte Hermes bundle. These exports are not signed native releases or physical-device tests. |
| Production HTTP checks | Final production run passed all 133 assertions against the live catalogue and explicit preview routes, including anonymous CORS for mobile web reads. |
| Static security checks | All 8 passed. These are source convention checks, not penetration testing. |
| Production dependency audit | Found 0 vulnerabilities at the time checked. |
| Database integration tests | All 27 tenant-policy and 29 partner-workflow assertions passed through a rollback-only SQL runner against the authorised development project. Deliberately failing TAP and SQL batches were also rejected, with no success marker. |
| Browser and native device review | Web Explore was reviewed at desktop and phone widths, with actual map interactions and example links exercised. The independent reviewer scored the phone-control correction resolved. See Milestone 05 captures. Android and iOS physical-device tests remain outstanding. |

All database fixture accounts, organisations, venues, private contacts, draft requests, temporary pgTAP installation and test grants rolled back. The final record counts were zero. Docker storage remains unhealthy and C had less than 1 GB free when diagnosed; the database verification no longer depends on repairing it. No database reset, destructive repair or change to unrelated containers was attempted.

The pinned Supabase CLI 3.1.0 was checked against its installed help. CI uses `supabase test db`, which targets the local stack by default; its unsupported `--local` flag was removed. The hosted run used the reviewed [rollback runner](../../scripts/prepare-database-tests.mjs), which captures every TAP result, checks the plan, assertion count, numbering and final diagnostics, raises on failure, then rolls back before returning its result. Its seven local regression tests passed.

After the partner migration, the security advisor reports two intentional design notices: the private request ledger has RLS with no client policies, so it denies client access; the draft RPC is an authenticated-only SECURITY DEFINER function because it must create the organisation, membership and draft atomically. Its actor checks and authority boundaries passed the workflow suite. These notices are documented rather than hidden by broad grants or permissive policies. See [private-table notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) and [authenticated function notice](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

No live SMS delivery, Brevo configuration, store release or full production readiness is claimed. Server credentials are not shipped in either application.
