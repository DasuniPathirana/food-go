# Setup required before public launch

Updated 16 November 2026. This is the immediate handoff for the website at `https://food-go-three.vercel.app` and Supabase **Food go**, project `azccigsctzhbaxoajqst`. The owner selected this existing project for the release. The final custom domain has not been chosen.

Delivery remains a branch and PR into `develop`. The hosting team owns migration application, merge and deployment. Do not change `main`, reset the hosted database or deploy an unreviewed branch. This document records required setup; it does not certify that the service is ready.

## What the read-only audit found

| Check on 16 November | Observed result | Meaning |
| --- | --- | --- |
| Public `/api/health` | HTTP 200, Supabase mode, status `ok` | The deployed API responds. This alone does not verify accounts or delivery. |
| Public `/api/auth/session` | HTTP 503, `configured:false` | The current deployment has account services closed or incompletely configured. |
| Public `/api/venues?limit=1` | HTTP 200, ready, zero records | No public restaurant is available in the deployed catalogue. |
| Aggregate hosted database count | Zero venues, zero published venues | Genuine approved restaurant content is required. |
| Hosted migration history | Six applied, latest `20261113122412` | Four repository migrations below are pending. |
| Operator, journey, map lease and policy receipt tables | Absent | Those connected features cannot work on this schema yet. |

These were safe GETs, migration inspection and aggregate reads. No account, invitation, email, SMS, database fixture or deployment was created. The Vercel dashboard, actual SMTP settings and actual environment scopes were not inspected. A supplied key or a passing build does not prove that the deployed site uses it.

The owner has supplied one browser MapTiler key and an openrouteservice key for private local configuration. Their values must stay out of this guide, commits, PR descriptions and logs. Local configuration does not update Vercel. The selected MapTiler setup uses that one public key for browser imagery and browser place search on the allowed local and deployed origins. No second or third MapTiler key is required for this setup.

## Inputs to supply now

| Owner or deployer input | Secure destination | Used for |
| --- | --- | --- |
| Confirm MapTiler commercial-use entitlement and map/search capacity before public commercial launch | MapTiler account | Current Free plan covers development/testing, not public commercial operation; no plan purchase is performed by this PR |
| Existing single browser MapTiler key, allowing the three hostnames below | Vercel `NEXT_PUBLIC_MAPTILER_KEY` before build, and ignored `apps/web/.env.local` for local use | Worldwide satellite tiles and browser place search with the same public key |
| openrouteservice/HeiGIT API key and agreed usage capacity | Server-only `OPENROUTESERVICE_API_KEY` | Real pedestrian routes; existing supplied key still needs deployed verification |
| Verified sender domain, sender email and sender name | Brevo domain/sender dashboard, then Supabase SMTP settings | Signup confirmation and password recovery |
| Brevo SMTP login and generated SMTP key | Supabase custom SMTP dashboard | Email transport; no Brevo REST API key is needed for this path |
| Mobile Message API username, password and approved sender ID | Server-only environment values below | SMS sign-in codes |
| Supabase Send SMS Hook signing secret | Supabase hook settings and matching server secret | Authenticate the SMS webhook |
| Controlled email inbox and Australian mobile for acceptance | Private test arrangement with account holder | Actual confirmation, recovery and SMS checks |
| Approved restaurants, locations, menus, photos and offers | Verified owner workspace, reviewed by operator | Real catalogue, promotions and verified discovery |
| Privacy/support contacts, approved policy text and operational owner | Reviewed public policy pages and private operations handoff | Consent, moderation, requests and incident handling |
| Vercel project access or an authorised deployment operator | Vercel project membership | Deploy the reviewed commit and inspect results |

Only the browser MapTiler key belongs in a `NEXT_PUBLIC_` variable. Enter private credentials directly in the provider/hosting dashboard or the ignored local file. Do not send them through chat. Previously exposed privileged Supabase credentials must be rotated and retired by the project owner; the application requires the publishable key, not a service-role key.

## 1. Configure map accounts and keys

MapTiler's Free plan permits non-commercial use and commercial research/development. Public commercial operation requires an appropriate commercial subscription or agreement. The account holder must confirm entitlement and capacity before that launch. This PR does not purchase or change any plan. Retain attribution and branding. See [current Cloud terms](https://www.maptiler.com/terms/cloud/) and [capacity and billing](https://www.maptiler.com/cloud/pricing/).

The current account has one key. Edit that existing key with these settings rather than creating more keys:

| Field | Value |
| --- | --- |
| Name | `FoodGo Web` |
| Description | `Food Go browser satellite imagery and location search for local testing and the website` |
| Allowed HTTP origins | The three hostnames below, one per line |
| Allowed user-agent header | Leave blank |
| Environment variable | `NEXT_PUBLIC_MAPTILER_KEY` |

```text
food-go-three.vercel.app
localhost
127.0.0.1
```

Origins are hostnames without protocol, port or path. Do not allow `*.vercel.app` or `?`. The owner selected combined local/deployed use: allowing localhost permits local use on other machines too, and usage shares the same account quota. Remove the local entries when local testing ends. Separate development/production keys remain an optional improvement when the account supports them. [Official key settings](https://docs.maptiler.com/guides/developer/credentials/api-key/)

Copy this same public key into `NEXT_PUBLIC_MAPTILER_KEY` in the ignored local file and Vercel's intended environment. Leave `MAPTILER_SERVER_KEY` unset for this one-key setup. Browser place search calls MapTiler directly from the allowed browser origin; the server does not reuse this public key, spoof an origin or bypass its restrictions. An optional dedicated private `MAPTILER_SERVER_KEY` remains supported for backend search where a separate key is available.

Set the browser key before the Vercel build and rebuild when it changes. Next.js embeds `NEXT_PUBLIC_` values in browser assets at build time. MapTiler satellite is geographical imagery with varying capture dates, not a live satellite camera. Street/building data coverage also varies; a key does not create missing 3D models. [Satellite dataset](https://docs.maptiler.com/schema-raster/satellite/)

Without the browser MapTiler key, place search uses the Food Go search endpoint: it supports an optional private MapTiler key or Photon. Public Photon and public FOSSGIS pedestrian routing require the shared lease migration and remain capacity-limited community services. Owned alternatives use `FOOD_GO_PHOTON_ENDPOINT` and `FOOD_GO_FOOT_ROUTER_ENDPOINT`; these must be HTTPS and compatible with the implemented Photon/OSRM formats. A driving router is unsuitable.

Store the supplied routing key as `OPENROUTESERVICE_API_KEY` on the server. The current directions API is `https://api.heigit.org/openrouteservice/v2/directions/foot-walking/geojson`. Use a release containing the endpoint migration; do not rely on the retired `api.openrouteservice.org` host. Confirm the account's route quota and launch capacity. No extra user-facing API key field is required. [Provider migration notice](https://ask.openrouteservice.org/t/deprecating-api-openrouteservice-org-in-favour-of-api-heigit-org/7912/), [current API entry](https://api.heigit.org/)

GPS needs HTTPS and the user's permission, not another API key. A user who declines may choose coordinates/search manually. Manual avatar travel is route preview and must not award real location or visit XP. Google Maps/external navigation links target the chosen coordinates and do not require a Google Maps API key in this implementation.

## 2. Apply the pending database migrations

The deployer must review backup status and migration history, then apply repository migrations in order to the selected project. On 16 November the pending set was:

1. `20261114211538_food_go_operator_promotions.sql`: operator grants, moderation and promotions.
2. `20261115102348_food_go_connected_journeys.sql`: owner workspace, saved collections, verified venue/dish discovery and XP.
3. `20261115150442_food_go_map_service_limits.sql`: shared public geocoding/routing leases.
4. `20261115163751_food_go_community_acknowledgement.sql`: versioned, account-bound acknowledgement receipts and contribution checks.

Recheck history immediately before applying, since another authorised deployer may have progressed it. Preserve existing records and grants. Never reset this hosted project. Run fixture suites in the disposable CI/local Supabase stack; do not run destructive fixtures against a customer-serving database. Review the [database runbook](../../supabase/README.md) and [preflight SQL](../../supabase/preflight.sql) before executing migrations.

## 3. Configure Vercel and exact account URLs

Use Node.js 24, Root Directory `apps/web`, outside-root source access enabled, install command `npm ci --prefix ../..`, build command `npm run build`, and output `.next`. Use the root lockfile and workspace. The earlier automatic preview failed because the commit author lacked Vercel project access; an authorised deployer must deploy the reviewed commit or grant suitable access and retry. See the [hosting handoff](README.md).

Set the following in the intended Vercel Preview/Production scope. Keep private server secrets separate between environments. The selected public MapTiler key is shared between allowed local and deployed browser origins:

| Variable | Required value or source |
| --- | --- |
| `APP_ORIGIN` | `https://food-go-three.vercel.app`, without trailing slash |
| `SUPABASE_URL` | `https://azccigsctzhbaxoajqst.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Selected project's publishable key; never service-role/secret key |
| `FOOD_GO_AUTH_COOKIE_SECRET` | Newly generated server secret from at least 32 random bytes, base64url encoded |
| `NEXT_PUBLIC_MAPTILER_KEY` | Existing single browser key above, present before build; also use it in the ignored local file |
| `MAPTILER_SERVER_KEY` | Optional private backend search key; leave unset for the current one-key setup |
| `OPENROUTESERVICE_API_KEY` | Supplied private routing key |

In Supabase Authentication URL Configuration set **Site URL** to `https://food-go-three.vercel.app` and allow these exact redirect URLs:

```text
https://food-go-three.vercel.app/auth/callback?next=/profile
https://food-go-three.vercel.app/auth/callback?next=/auth/reset-password
```

Confirm email/password authentication, permitted signups, required email confirmation, password policy, OTP expiry and appropriate provider rate limits. Enable authenticator/TOTP enrolment and verification for operators. Review abuse protection and the [production security gate](../security/production-gate.md); enabling provider CAPTCHA without matching client integration will break requests. [Supabase redirects](https://supabase.com/docs/guides/auth/redirect-urls)

When the final domain is known, update Vercel, `APP_ORIGIN`, MapTiler origins, Supabase Site URL, exact callbacks and SMS hook together, then rebuild/retest. Set up a preview's exact origin separately if it needs accounts. Avoid broad redirect wildcards.

## 4. Configure Brevo email now

The sender was previously deferred. The owner must now select an owned sending domain, verified sender address and sender name. In Brevo add/authenticate the domain with its supplied DNS records and verify the sender. Under **Settings > SMTP & API > SMTP**, obtain the displayed SMTP login and generate an **SMTP key**.

In Supabase **Authentication > Emails > SMTP Settings**, enable custom SMTP and enter:

| Field | Value |
| --- | --- |
| Sender email | Owner's verified Brevo sender address |
| Sender name | `Food Go`, subject to owner approval |
| Host | `smtp-relay.brevo.com` |
| Port | `587` with STARTTLS |
| Username | SMTP login displayed in Brevo |
| Password | Generated SMTP key, not a Brevo API key |

Review matching Supabase/Brevo sending limits and sender-domain authentication. The built-in Supabase sender is unsuitable for public customer delivery. Test confirmation and recovery with the controlled inbox, including expired and reused links, in the browser that initiated each PKCE flow. Keep tokens and full email links out of screenshots and records. [Brevo setup](https://developers.brevo.com/docs/supabase-smtp-integration), [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp)

## 5. Configure Mobile Message for sign-in codes

The provider is `mobilemessage.com.au`. In its dashboard open **Settings > API** for API username/password, and **Settings > Sender IDs** for a sender approved on that account. Arrange required sender registration, sufficient credit and monitored limits. Start with sandbox testing; sandbox acceptance is not proof of delivery to a real handset.

Store these on the Vercel server only:

```dotenv
SUPABASE_SMS_HOOK_SECRET=
MOBILE_MESSAGE_API_USERNAME=
MOBILE_MESSAGE_API_PASSWORD=
MOBILE_MESSAGE_SENDER_ID=
```

In Supabase enable the intended phone authentication/signup policy and configure the HTTP **Send SMS Hook** at:

```text
https://food-go-three.vercel.app/api/webhooks/supabase/sms
```

Copy the hook signing secret to `SUPABASE_SMS_HOOK_SECRET` without changing its `v1,whsec_`/`whsec_` format. The app verifies signed webhook headers; it does not use an account cookie for the hook. Mobile Message uses API username/password Basic authentication and an approved sender. This integration supports Australian mobile numbers. Test real delivery to the owner's controlled Australian phone, wrong/expired codes, resend limits, replay, sign-out and retry deduplication before public phone access. [Mobile Message documentation](https://mobilemessage.com.au/api-documentation), [Supabase Send SMS Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook)

## 6. Open gates only after their checks pass

The safe initial configuration keeps accounts, partner writes and SMS closed. A Vercel preview is still a production-mode Next process, so its account flow also requires the explicit production gate.

After migrations, provider delivery, identity, abuse controls and applicable security checks pass on the intended origin, the deployer can use:

```dotenv
FOOD_GO_CATALOGUE_MODE=supabase
FOOD_GO_COMMUNITY_ENABLED=true
FOOD_GO_AUTH_ENABLED=true
FOOD_GO_AUTH_PRODUCTION_READY=true
FOOD_GO_PARTNER_ENABLED=true
FOOD_GO_PHONE_AUTH_ENABLED=false
FOOD_GO_SMS_ENABLED=false
```

Only literal `true` enables a feature. Enable `FOOD_GO_SMS_ENABLED=true` for the controlled, signed-hook test environment once it is configured; enable `FOOD_GO_PHONE_AUTH_ENABLED=true` for controlled phone-flow tests. Keep the public phone flow closed until real delivery and abuse checks pass. Do not turn a gate on solely to hide an unavailable state. Provider public signup APIs need their own controls; application flags do not disable them.

The [production security gate](../security/production-gate.md) remains uncleared. SMTP/API keys alone do not resolve its outstanding implementation, retention/deletion, abuse-control or review requirements. Record evidence and resolve material gaps before public launch.

## 7. Provision the first admin and real restaurants

The designated first owner is **Dasuni@7deals.com.au**. After accounts and email delivery are verified, that owner registers, confirms the mailbox and sets their own password privately. The database owner checks the confirmed UUID/email together and grants operator access using [operator provisioning](operator-portal.md). The owner opens `/admin` and enrols their authenticator. There is no shared admin password to send. An unconfirmed or ordinary account must not gain access.

There are currently no venues. Supply approved restaurant names, real addresses/coordinates, business authority, contact details, menus/prices, authorised photos and valid promotions. For shared buildings include mall name, shop count and each shop's floor/unit. Owners create private drafts; an independent operator verifies ownership and publishes them. A normal owner must not approve their own listing. World-map POIs are not automatically Food Go partner records.

Use a real authorised owner/customer pair for the final visit/dish code check. Manual map walking, GPS alone and unverified marketing claims are not award evidence. Verify persisted collections and a single server XP award after sign-out/sign-in; replaying a code must not issue another award.

## 8. Acceptance before opening registration

Record the deployed commit, origin, date, reviewer and outcome. Keep identities, tokens, codes and credentials in private operational records.

- [ ] All four pending migrations are recorded on the target and CI/database suites pass.
- [ ] `/api/health` succeeds; `/api/auth/session` reports configured with no leaked session token; public catalogue shows an approved real restaurant.
- [ ] Explorer and owner signup, email confirmation, returning login, refresh, sign-out and password reset work on the exact deployed origin.
- [ ] Streets and satellite load on desktop/mobile with correct attribution; world search works; a real pedestrian route follows streets; full-map open/close preserves state.
- [ ] GPS allow/deny works on HTTPS; manual preview never earns verified XP; Google/external directions use the selected coordinates.
- [ ] Owner edits/menu/submission, independent admin approval/TOTP, promotions and access denial for another user all work.
- [ ] Customer collects visit and dish codes; repeated claims award zero extra XP; Passport and collections persist across browsers.
- [ ] Feed submission/moderation, personal wall, versioned acknowledgement and report handling work with separate authorised accounts.
- [ ] If phone sign-in is enabled, controlled real SMS delivery and wrong/expired/replayed-code checks pass.
- [ ] Motion reduction, mobile touch, keyboard navigation and service/key failures remain usable without fabricated data or rewards.
- [ ] Applicable security/privacy/backup/abuse-control gates have evidence, monitoring and named operational owners.

If any required row fails, keep its account or delivery gate closed and report the exact failed check. Do not describe the service as fully live on the basis of provider credentials, a healthy process or a successful build alone.
