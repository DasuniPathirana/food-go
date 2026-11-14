# Milestone 03: Supabase connection preparation

Date: 12 November 2026.

Status: the local SDK configuration is prepared and the publishable key was accepted by read-only checks. Food Go accounts remain closed. The hosted venue endpoint is not ready, so no live venue data has been connected to the map or collections.

## What was completed

- Created an ignored `apps/web/.env.local` with the project URL and publishable key.
- Generated a cookie-signing secret from 32 random bytes without printing it in the report.
- Kept the local origin at `http://127.0.0.1:3000`.
- Kept `FOOD_GO_AUTH_ENABLED=false` and `FOOD_GO_AUTH_PRODUCTION_READY=false`.
- Used the normal Supabase JavaScript SDK and read-only requests to check the connection.
- Added account boundary tests without using real credentials or making account requests in those tests.

No service-role or secret key is needed for this application connection. The privileged values shared in chat and the supplied screenshot require rotation by the project owner. Replacement secrets should be entered through an approved secret store or dashboard, not pasted into chat.

## Results observed

| Check                       | Actual result                            | What it establishes                                                                                                                          |
| --------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Publishable-key request     | Accepted                                 | The project accepted the supplied public application key for the read-only probe.                                                            |
| Email and password accounts | Enabled in provider settings             | This account method is available at the provider. No sign-in was performed.                                                                  |
| Email confirmation          | Required in provider settings            | Confirmation is configured as required. No confirmation email or link was tested.                                                            |
| Direct provider sign-up     | Enabled in provider settings             | Supabase can accept direct sign-up requests independently of Food Go's application flag.                                                     |
| SDK zero-row venue select   | PGRST205, reported as `schema_not_ready` | The Food Go `venues` relation is not available in the Data API schema cache. This is not an inspection of the complete database inventory.   |
| Project management settings | Not inspected                            | No management or direct database credentials were available to confirm the complete schema, region, SMTP settings or redirect entries.       |
| Root tests                  | All 25 pass                              | 17 domain and account boundary tests plus 8 isolated connection-check tests. No real keys or network calls are used by the connection tests. |
| Web TypeScript              | Passed                                   | The reviewed website code has no reported type errors.                                                                                       |
| Web production build        | Passed                                   | The app builds with local account routes still disabled.                                                                                     |
| Static security checks      | All 8 pass                               | Source conventions only; not a penetration test or a live database audit.                                                                    |

No account was created, no email was requested, and no data write, migration or project-setting change was made. No private user records were read. The provider observations do not verify SMTP delivery, session expiry, row-level access policies or production readiness.

## What the different credentials do

The app's SDK needs the project URL and a publishable key. A signed-in person's session identifies that user. Database grants and row-level access rules then control the records available to them. The key is suitable for an application connection, but it does not administer project settings. The app does not need the legacy anonymous key alongside the publishable key. See [Supabase's key guide](https://supabase.com/docs/guides/getting-started/api-keys).

Project administration uses a separate route. A signed-in dashboard can manage the project. The CLI needs its supported account and database credentials for the operation being performed. The Management API uses a scoped personal access token or approved OAuth access. A service-role project key cannot be substituted for that Management API access. See [Management API authentication](https://supabase.com/docs/reference/api/introduction).

The owner must rotate the exposed service-role and secret credentials and check their dependent services. A newly created key does not by itself prove that an older exposed credential has been retired. The document records no actual key, password, management token or confirmation link.

## Safe database work next

1. Confirm the target project's identity, region, existing tables and intended use through authorised management or database access. The current read-only SDK probe does not establish that the project is empty or disposable.
2. Use a separate disposable test project or isolated local Supabase database. Keep test fixtures away from the production branch shown in the supplied dashboard.
3. Review the migration preflight, existing object names, required extensions and access grants before applying SQL. Resolve any conflict rather than resetting or overwriting an existing database.
4. Apply the reviewed migration to the disposable target, then run all 23 pgTAP access-policy assertions there. The tests create fixtures and roll them back; they are not suitable for production data.
5. Confirm that anonymous users see only approved public listings and that one venue organisation cannot read another's private records. Test that browser clients cannot approve venues, grant themselves roles or award points.
6. Repeat the SDK venue check after the database and policies are ready. Only then connect approved records to application features.

The migration files and their tests are a foundation. They do not demonstrate that the hosted database has been installed or that its access policies have passed.

## Account and email setup next

For the isolated development project, use Site URL `http://127.0.0.1:3000` and configure the return URLs generated by the current code:

```text
http://127.0.0.1:3000/auth/callback?next=/profile
http://127.0.0.1:3000/auth/callback?next=/auth/reset-password
```

The first return finishes registration; the second is for recovery. Both return through `/auth/callback`, where the server exchanges the code. Keep the `next` query choice. Do not point the recovery email directly at the new-password screen. Test that the intended addresses work and that unintended redirects are rejected, without opening a broad wildcard. The provider will add its code and flow information. See [Supabase redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls).

These are the values the current code needs. The hosted Site URL, redirect entries and SMTP settings have not been verified or changed in this step.

Configure a transactional SMTP service and an authorised sender domain before testing with public email addresses. Verify the domain records and test delivery, failed delivery, confirmation and recovery expiry. The default sender has team-address restrictions and low limits, so a successful settings read is not proof that an email will arrive. See [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

Keep both application flags false until the private test environment is ready. Public release still requires CAPTCHA and abuse controls, reliable one-use recovery handling, account deletion, privacy and retention rules, live session tests and native phone testing. The application release flag cannot close Supabase's direct public Auth API; provider settings and limits also need review.

## Actions needed from the owner

Rotate the exposed privileged keys without posting replacements. Confirm a disposable test target and provide developer access through the dashboard or another approved management route. Confirm the sending domain and email provider. Once those are ready, account and database tests can proceed with controlled test information.

## Client report

The [illustrated Word report](../deliverables/Food-Go-Development-Report.docx) is updated to 12 November with a new connection page, current checks and the remaining owner actions. It retains the 11 actual interface screenshots captured on 11 November and does not claim new interface or map changes.

The packaged renderer was attempted but this Windows runtime has no bundled LibreOffice. Microsoft Word exported the report through its native PDF interface. Bundled Poppler rendered all 16 pages to images, and every page was visually reviewed. Those PDF and image files remain internal QA artifacts.
