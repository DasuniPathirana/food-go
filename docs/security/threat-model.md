# Food Go security model

## Scope and status

This first milestone provides shared validation and a proposed database permission model. It is not a penetration test or a guarantee against attacks. Authentication, real persistence, payments, live check-ins and public uploads must remain unavailable until their production gates pass.

## Assets and trust boundaries

Protect private user and visit history, restaurant management access, ownership evidence, reward integrity, uploaded files, payment operations and service credentials. Treat browsers, mobile apps, QR scanners, user metadata, uploaded files and all request payloads as untrusted.

The trusted boundary is the authenticated backend plus reviewed database policies. A mobile app cannot keep a privileged secret. Supabase publishable credentials identify a project, but never replace row-level security. Service-role credentials bypass those policies and belong only in server secret storage.

## Threats and controls

| Threat                                                 | Foundation control                                                  | Required follow-up                                                                        |
| ------------------------------------------------------ | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Restaurant reads or edits another restaurant           | Organisation membership policies and restricted column grants       | Run live cross-tenant tests for every API and upload endpoint                             |
| User claims an administrator role in editable metadata | Membership roles are database-owned and ignored in profile metadata | Add protected operator roles, MFA and audited approval workflows                          |
| Owner self-verifies or publishes a venue               | No client grants on verification, status, coordinates or membership | Authenticated ownership review with evidence and audit history                            |
| API accepts extra privileged fields                    | Strict shared Zod objects reject unknown fields                     | Revalidate on the server, map allowed fields explicitly and parameterise database queries |
| QR screenshot sharing, replay or location spoofing     | Clients cannot insert verified check-ins or rewards                 | Short-lived signed tokens, replay locks, proximity checks, rate limits and anomaly review |
| Check-in incorrectly counts as proof of a meal         | Separate visit and dish records, constrained evidence links         | Define independent staff, redemption or transaction evidence                              |
| Cross-site scripting from names, descriptions or files | Bounded text; images-only private bucket                            | Escape text, avoid raw HTML, restrict CSP and verify uploaded file bytes                  |
| Repeated requests produce repeated points              | Unique reward-source and request idempotency keys                   | Make evidence verification and awards one atomic transaction                              |
| Contact and location data leaks                        | Private venue contacts; private profile and visit history policies  | Data minimisation, controlled logs, retention and deletion workflows                      |
| Stolen operator or service credentials                 | No privileged credentials required for local demo                   | MFA, secret scanning, key rotation, alerting and incident response                        |
| Automated abuse or service cost spikes                 | Bounded search input                                                | Distributed rate limits, request limits, spend alerts and vendor quotas                   |
| Malicious dependencies or deployment changes           | Reviewable source foundation                                        | Lockfile review, dependency updates, protected branches and least-privilege CI            |

## Important limitations

The schema does not by itself implement server identity verification, onboarding, a signed-QR service, uploads, payments or account deletion. A service-role key bypasses row-level policies, so every privileged backend operation must validate identity, permission, allowed input and current record state independently.

Do not store raw QR secrets, access tokens, payment-card information or continuous location history in logs. Public display names and descriptions remain untrusted plain text even after validation. A valid email or phone number is not proof of venue authority.

Australian data processing and retention choices need review across every processor. Choosing a Sydney database region does not constrain email, crash-reporting, CDN, backup or analytics processors automatically.
