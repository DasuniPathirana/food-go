# Cleaner interfaces, coloured buildings and private Feed age checks

17 November 2026. The marked screenshots request less decorative UI, varied building colours, correct email-confirmation behaviour and Feed access from age 16.

## Changes

- Removed decorative heading badges, guest-composer and empty-state ornaments from Feed and the corresponding ornamental badges/seals across collections, Deals, Quests, Outback and catalogue states. Functional navigation, search, map controls, avatar controls, resource/achievement meaning and game artwork remain.
- Real Game-map buildings use a stable seven-colour material palette based on feature identity, with source-ID/height fallback. Materials do not change when panning. Streets and Satellite retain their source materials and geometry. No fictional buildings or venues are added.
- Signup requires a valid private date of birth. The database records the initial declaration once in a private RLS table. Editable user metadata and client age claims cannot change permission afterward. Existing and phone accounts receive a one-time declaration in Passport. This is self-declared age, not documentary age verification.
- Only eligible signed-in accounts see Feed navigation or personal-wall content. Passport occupies that navigation slot for everyone else, preserving Explore as the third item. Unknown age and service failures stay closed. The database independently blocks both legacy/current Feed RPCs, public/private wall access, posting, reactions, comments, sharing, reach and community-quest participation below 16. Safety reporting, blocking and deleting owned posts retain their verified-account path.
- Age uses the Sydney calendar, including exact sixteenth birthdays and leap days. No date of birth is included in public profiles, author records or the safe age response. A recorded date cannot be changed in the app.

## Missing email diagnosis

The reported signup failed before an account was created: Supabase returned `signup_disabled`, HTTP 422. The previous registration handler incorrectly showed an inbox success for that response. Registration and recovery now fail honestly for provider/configuration errors while preserving neutral responses for sensitive existing-account cases. Regression tests exercise the actual registration handler with rejected provider responses and no real network sends.

The database connection cannot change Auth service settings and browser controls were unavailable. Hosted signup remains disabled. Brevo delivery additionally needs its deployed signed hook, signing secret and controlled delivery acceptance. [Exact repair steps](../deployment/email-signup-repair.md) identify the remaining dashboard actions. No real emails, SMS or hosted fixture accounts were created.

## Verification

Workspace types, 177 application tests, eight security checks and the production build pass. [Real Supabase CI 43981251257](https://github.com/Kalana8/Food_Go/actions/runs/43981251257) passed **395 SQL assertions across ten suites**, the concurrent-manager quota test, nine existing-account/young-account age API checks, and the existing 47 adventure API assertions. Signup and confirmation used only the disposable local inbox. Supplementary PostgreSQL-WASM checks also passed age, community, consent, reach and adventure suites.

Actual Chrome passed 24 age/UI checks and 17 strict Game-map checks, with no runtime errors. Production HTTP smoke passed 165 assertions. Browser age-state checks use actual components with explicitly labelled account fixtures, not real users. The one-time age form fits 320 px and desktop widths. A purely local router shim exercises the refresh transition; the CI API tests independently establish server authorisation.

After CI passed, the age migration was applied to Food go as `20261116234618_food_go_feed_age_gate.sql`, bringing hosted history to twelve entries. The repository filename matches that actual installed version; the reviewed SQL was unchanged and hosted history was not rewritten. Do not reapply its former `20261116184952` version. Read-only receipts confirmed the private table's RLS, no direct client grants, the signup capture trigger, denied anonymous access to both Feed RPCs, and zero hosted users/birth records. No hosted fixture identities were created.

The original prototype remains unchanged. Delivery continues through the feature branch into `develop`; main and the public website are not deployed by this work.
