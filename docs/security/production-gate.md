# Production security gate

Status: not cleared. The first milestone must not be advertised as production-ready.

## Required before real accounts or venue data

- [ ] Apply migrations to an isolated local Supabase database and run all integration tests.
- [ ] Repeat cross-user, cross-organisation and anonymous access tests against staging APIs.
- [ ] Confirm row-level security and restricted grants on every exposed table and RPC.
- [ ] Ensure no service-role credential, database password or private token appears in client bundles, source history, logs or screenshots.
- [ ] Use secure server-validated sessions, an explicit redirect allowlist and production SMTP.
- [ ] Require MFA for operators and sensitive partner actions where appropriate.
- [ ] Build an authenticated, transactional onboarding workflow. Never trust an organisation ID, role or verification flag supplied by the browser.
- [ ] Add independent business-authority verification and duplicate-venue handling.
- [ ] Apply CSRF/origin protections appropriate to the authentication method, plus HTTPS, secure cookies and production content security policy.
- [ ] Add distributed rate limits, bounded request bodies, database statement timeouts and vendor spend alerts.
- [ ] Back up database and stored files separately, and complete a restore exercise.
- [ ] Publish privacy, location-consent, data-deletion and retention workflows and relevant legal terms.
- [ ] Test deletion of users with linked visit and dish evidence, and test organisation ownership transfer before deleting an owner's account.
- [ ] Add auditable administrative actions, alerts and an incident-response contact.

## Required before uploads, rewards or payments

- [ ] Authorise every upload against the authenticated user's venue membership and generated storage path.
- [ ] Verify MIME type and actual file bytes, enforce size limits and strip metadata where appropriate.
- [ ] Deliver private files with controlled, expiring access and prevent arbitrary URL fetching.
- [ ] Verify QR signatures, expiry and one-use redemption on the server. Do not award while offline before reconciliation.
- [ ] Validate reward evidence and user ownership inside the same transaction as the award.
- [ ] Document that a location check-in and a verified dish experience use separate evidence.
- [ ] Verify payment webhook signatures, event idempotency, refund permissions and amounts derived from server data.
- [ ] Add report, block and moderation handling before public user-generated content.
- [ ] Complete an independent security review and resolve material findings before public launch.

## Verification record

Record the date, environment, migration version, test command, result and reviewer when each gate is completed. A passing build or a screenshot does not clear database, authentication or payment security gates. Do not describe the system as unhackable.
