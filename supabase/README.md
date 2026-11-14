# Supabase foundation

This directory contains versioned PostgreSQL migrations and integration tests. Committing these files does not create a Supabase project or apply a migration. The client's Sydney development project has the foundation, hardening, partner-draft and community migrations installed. All three database suites passed there using rollback-only fixtures on 13 November 2026. See [the latest community delivery](../docs/progress/07-bright-community.md) and [the earlier analysis](../docs/progress/04-project-analysis.md).

## Apply safely

1. Install the Supabase CLI using its supported instructions and Docker for the local database.
2. Initialise Supabase in this checkout if `supabase/config.toml` is not present: `supabase init`.
3. Start the isolated development stack: `supabase start`.
4. Apply migrations to that disposable database: `supabase db reset`.
5. Run `supabase test db`. CLI 3 targets the local stack by default. The suites contain 27 tenant, 29 partner and 46 community assertions. All roll their fixtures back.
6. Review and configure authentication, redirect allowlists, external SMTP and account deletion before connecting a real environment.
7. Apply reviewed migrations to a separate staging project before any production database.

## First installation checks

Before applying the foundation to a hosted project, independently confirm its project name and reference in the Supabase dashboard. The default branch label may say production even for a new project; that label does not prove it is safe to use test fixtures.

Run [the read-only preflight](preflight.sql) with the intended database administrator. It reports the required Supabase roles and objects, relation-name collisions, an existing private schema, PostGIS location, the proposed bucket collision and a public relation inventory. It does not read application records or modify the database. Review every result before applying anything.

The first-install migration stops if the application relation names, private schema or media bucket already exist, or if PostGIS is installed outside the expected `extensions` schema. It does not drop or relocate extensions, overwrite tables or change an existing storage bucket. Existing objects require a separately reviewed migration for that actual environment.

The migration runs in one transaction. A failed statement must cause rollback; do not run the remaining statements separately to work around a failure. Do not reset, clean, drop or recreate a hosted database as a shortcut.

Run tenant test fixtures only against a confirmed disposable local or staging target. Their transaction rolls back ordinary database changes, but they temporarily insert test auth users and may interact with triggers or external hooks. Do not run them against a live customer environment.

PostGIS schema behaviour is described in the [Supabase PostGIS guide](https://supabase.com/docs/guides/database/extensions/postgis) and [PostgreSQL CREATE EXTENSION documentation](https://www.postgresql.org/docs/17/sql-createextension.html). `IF NOT EXISTS` does not relocate an already installed extension.

The local SQL tests require Supabase's `auth` and `storage` schemas. They are not portable to an empty plain PostgreSQL database. Do not run test fixtures against production. Confirm the target project before any CLI linking or database command.

## Security model

- Social progression adds two private RLS tables: unique account/post views and immutable XP event identities. The checked view RPC accepts only a post ID, verifies the caller, rejects unavailable/blocked sources and excludes self-views. No raw table or private award function is granted to clients. `food_go_game_profile` returns only the verified caller's derived progression; `food_go_community_feed_v2` adds aggregate reach without viewer identities. The qualified browser visibility rule is best-effort; signed-in accounts are not proof of distinct humans. See [the live XP policy](../docs/launch/go-live-checklist.md).
- Community data is stored in eight private RLS-enabled tables with direct client grants revoked. Checked presentation and mutation functions enforce verified identity, moderation, public/private walls, ownership, blocks, bounded pagination and retry keys. Public author IDs are separate from auth IDs. Pending content and moderation reports are not public.
- Public access exposes published, ownership-verified venues, available dishes and active canonical food definitions.
- All foundation tables explicitly revoke privileges from PostgreSQL PUBLIC, anonymous and authenticated roles before receiving narrowly scoped client grants.
- Account profiles and visit history remain private. The community exposes only an explicit public author alias and moderated stories; it does not expose account contact records or verified visit history.
- Organisation membership lives in a database table. User-editable authentication metadata never grants roles.
- Owners and managers can edit permitted fields in their organisation. Staff can read permitted information, but cannot edit venues.
- Clients cannot directly create organisations or membership, publish or verify venues, alter verified coordinates, insert check-ins, mint rewards or verify dish discoveries.
- The authenticated draft RPC atomically creates an organisation, owner membership, private draft and contact record. It requires a confirmed email or Australian mobile identity, validates direct calls, serialises each account's submissions, limits accounts to five drafts and deduplicates retries. It cannot publish or verify a venue.
- Editing a verified venue's name or address returns it to pending verification and clears its coordinates. Only the trusted server can restore verification and coordinates.
- Storage is private and no client upload policies are introduced. Actual upload and signed delivery workflows remain closed until implemented and reviewed.

## Data design

One venue record supports both discovery and the marketplace. `venue_contacts` keeps onboarding email and phone out of public venue responses. `canonical_foods` maps venue-specific dishes to a consistent FoodDex. `check_ins` and `food_discoveries` are separate facts, with cross-venue and cross-user evidence constrained by composite foreign keys.

`reward_events` is an append-only ledger from the client's perspective. Its unique event key prevents duplicate awards for the same source. A trusted reward service must also validate that the source event belongs to the user, that a quest is actually complete, and that limits and fraud checks pass. This workflow is not implemented by the schema alone.

Nearby queries should use the indexed PostGIS `location` column and a server-enforced result limit. Do not expose an unrestricted security-definer query or accept raw SQL filters from a client. Only independently supplied or properly licensed coordinates should be stored permanently.

## Remaining backend work

- Editing saved drafts, review submission, cross-account duplicate claims and durable infrastructure abuse limits.
- Ownership evidence checks, administrative approval and immutable audit records.
- Owner invitation acceptance with expiry, role checks and last-owner protection.
- Venue-scoped upload authorisation, byte-level file inspection and controlled delivery.
- Signed QR issuance, short expiry, replay protection, proximity checks and server-only reward transactions.
- Offer capacity, redemption, booking and billing workflows.
- Private data export, account deletion, organisation ownership transfer and retention jobs.
- API rate limiting, monitoring, operational response and deployed-environment tests.

## Verification status

The 27 tenant-policy and 29 partner-workflow assertions passed on the owner-confirmed hosted development project. The native CLI pgTAP command still requires Docker, so a reviewed SQL capture runner executed the same suites through the CLI query route. Deliberately failing TAP and SQL batches were confirmed to fail before any success marker. The fixtures, temporary extension and grants rolled back; final accounts, venues, contacts and draft-request counts were zero. These results cover the tested cases, not an independent security audit or production account verification.

For an explicitly authorised development target when Docker is unavailable, prepare each suite without executing it:

```sh
node scripts/prepare-database-tests.mjs --test supabase/tests/tenant_isolation.test.sql --output artifacts/tenant-isolation-rollback.sql
node scripts/prepare-database-tests.mjs --test supabase/tests/partner_drafts.test.sql --output artifacts/partner-drafts-rollback.sql
node scripts/prepare-database-tests.mjs --test supabase/tests/community.test.sql --output artifacts/community-rollback.sql
node scripts/prepare-database-tests.mjs --test supabase/tests/social_xp.test.sql --output artifacts/social-xp-rollback.sql
```

Then use CLI 3 `db query --remote=CONFIRMED_DEVELOPMENT_REF --file artifacts/tenant-isolation-rollback.sql --yes`, and the corresponding partner file. Run one whole batch at a time with stop-on-error. Require both command success and the `passed` and `rolledBack: true` result. Never apply these generated fixture scripts as migrations or use them against an unconfirmed production project. The runner prepares reviewed repository SQL; it is not a sandbox for arbitrary SQL.

Unit input-validation tests do not prove database security. See [the production gate](../docs/security/production-gate.md).
