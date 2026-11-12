# Supabase foundation

This directory contains a proposed PostgreSQL schema and tenant-isolation integration tests. Committing these files does not create a Supabase project or apply a migration.

## Apply safely

1. Install the Supabase CLI using its supported instructions and Docker for the local database.
2. Initialise Supabase in this checkout if `supabase/config.toml` is not present: `supabase init`.
3. Start the isolated development stack: `supabase start`.
4. Apply migrations to that disposable database: `supabase db reset`.
5. Run `supabase test db`. The integration test contains 23 role and permission assertions and rolls its fixtures back.
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

- Public access exposes published, ownership-verified venues, available dishes and active canonical food definitions.
- All foundation tables explicitly revoke privileges from PostgreSQL PUBLIC, anonymous and authenticated roles before receiving narrowly scoped client grants.
- Account profiles and visit history are private by default. Public profile sharing is a later feature requiring explicit policies and consent.
- Organisation membership lives in a database table. User-editable authentication metadata never grants roles.
- Owners and managers can edit permitted fields in their organisation. Staff can read permitted information, but cannot edit venues.
- Clients cannot create organisations or membership, publish or verify venues, alter verified coordinates, insert check-ins, mint rewards or verify dish discoveries.
- Server onboarding must atomically create the organisation, owner membership, venue and private contact record. That endpoint is not included in this SQL foundation.
- Editing a verified venue's name or address returns it to pending verification and clears its coordinates. Only the trusted server can restore verification and coordinates.
- Storage is private and no client upload policies are introduced. Actual upload and signed delivery workflows remain closed until implemented and reviewed.

## Data design

One venue record supports both discovery and the marketplace. `venue_contacts` keeps onboarding email and phone out of public venue responses. `canonical_foods` maps venue-specific dishes to a consistent FoodDex. `check_ins` and `food_discoveries` are separate facts, with cross-venue and cross-user evidence constrained by composite foreign keys.

`reward_events` is an append-only ledger from the client's perspective. Its unique event key prevents duplicate awards for the same source. A trusted reward service must also validate that the source event belongs to the user, that a quest is actually complete, and that limits and fraud checks pass. This workflow is not implemented by the schema alone.

Nearby queries should use the indexed PostGIS `location` column and a server-enforced result limit. Do not expose an unrestricted security-definer query or accept raw SQL filters from a client. Only independently supplied or properly licensed coordinates should be stored permanently.

## Remaining backend work

- Authenticated, rate-limited onboarding transaction and duplicate detection.
- Ownership evidence checks, administrative approval and immutable audit records.
- Owner invitation acceptance with expiry, role checks and last-owner protection.
- Venue-scoped upload authorisation, byte-level file inspection and controlled delivery.
- Signed QR issuance, short expiry, replay protection, proximity checks and server-only reward transactions.
- Offer capacity, redemption, booking and billing workflows.
- Private data export, account deletion, organisation ownership transfer and retention jobs.
- API rate limiting, monitoring, operational response and deployed-environment tests.

## Verification status

The SQL integration tests must run in a real local or staging Supabase environment before claiming tenant isolation is verified. Unit input-validation tests do not prove database security. See [the production gate](../docs/security/production-gate.md).
