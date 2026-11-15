# Web environment manifest

Use `apps/web/.env.example` for local names and safe defaults. In hosting, set variables on the **web project**, scoped separately to Preview and Production. The web code reads these on the server; it does not require browser-visible Supabase variables. Do not copy a developer's ignored `.env.local` into the repository.

## Credential-free demonstration

The Melbourne real map ships with aerial photography, a dated satellite image and surveyed building heights. The browser downloads these assets from the deployment itself. No map provider account is required for this coverage.

For satellite imagery outside central Melbourne, create an origin-restricted public MapTiler browser key on a suitable plan. Set `NEXT_PUBLIC_MAPTILER_KEY` for the intended hosting environment and rebuild. This value is public in the browser bundle. Verify satellite tiles, attribution, usage limits and allowed deployment origins on that environment. The wider imagery layer does not extend the bundled 3D building survey. [Satellite dataset](https://docs.maptiler.com/schema-raster/satellite/)

These values make the deployed site an explicit demo with live account services closed:

```dotenv
FOOD_GO_CATALOGUE_MODE=demo
FOOD_GO_COMMUNITY_ENABLED=false
FOOD_GO_AUTH_ENABLED=false
FOOD_GO_AUTH_PRODUCTION_READY=false
FOOD_GO_PARTNER_ENABLED=false
FOOD_GO_PHONE_AUTH_ENABLED=false
FOOD_GO_SMS_ENABLED=false
```

Use `/demo/explore` to present the geographic map. Its imagery and landmark coordinates come from the public datasets listed in the map credits. Adventure uses fictional game locations, and its social examples, XP and avatar preferences stay in the browser. Leave Supabase, cookie-signing and SMS secrets unset for this mode. Connected routes can show an empty catalogue or a closed account sign-in screen.

Set `APP_ORIGIN` to the exact stable HTTPS origin once the domain is chosen, for example `https://food-go-preview.example.com`. That example is not an owned/live domain. Omit a trailing slash, path, query and fragment. Do not trust request headers to choose the application's origin. A different temporary preview hostname is a different origin; keep Auth disabled on arbitrary branch previews rather than weakening origin checks.

## Server configuration for a later connected release

| Variable | Purpose | Requirement |
| --- | --- | --- |
| `APP_ORIGIN` | Exact trusted website origin for callbacks and browser writes | Stable HTTPS origin in hosted environments |
| `SUPABASE_URL` | Intended hosted project's HTTPS API origin | Required for connected catalogue/community and accounts |
| `SUPABASE_PUBLISHABLE_KEY` | Public project key used by the server's anonymous or session-bound client | Publishable key or compatible legacy anonymous key; never a privileged project key |
| `FOOD_GO_CATALOGUE_MODE` | `demo` or `supabase` | Supabase mode shows only genuine published records and never silently substitutes examples |
| `FOOD_GO_COMMUNITY_ENABLED` | Enables connected community reads and progression endpoints | Requires reviewed community/social-XP migrations; account writes also require verified identity and Auth gates |
| `FOOD_GO_AUTH_COOKIE_SECRET` | Signs the application's recovery/session-related proof | Server secret, at least 32 random bytes encoded as base64url; separate per environment |
| `FOOD_GO_AUTH_ENABLED` | Enables configured account endpoints | Keep false until intended account flow is ready |
| `FOOD_GO_AUTH_PRODUCTION_READY` | Explicit gate for Auth in a production-mode Next process | Remains false until documented production checks pass; hosting a preview still runs Next in production mode |
| `FOOD_GO_PARTNER_ENABLED` | Verified-account private venue draft workflow | Requires Auth and partner migration; does not publish or verify a business |
| `FOOD_GO_PHONE_AUTH_ENABLED` | Australian phone-code request/verify routes | Requires Auth, Supabase phone settings and controlled SMS checks |
| `FOOD_GO_SMS_ENABLED` | Enables the server's signed SMS delivery adapter | Keep false until provider/hook setup and delivery tests pass |
| `SUPABASE_SMS_HOOK_SECRET` | Supabase Standard Webhooks signing secret | Secret supplied by the intended project's Send SMS Hook configuration |
| `MOBILE_MESSAGE_API_USERNAME` | Mobile Message API authentication | Server secret from the provider |
| `MOBILE_MESSAGE_API_PASSWORD` | Mobile Message API authentication | Server secret from the provider |
| `MOBILE_MESSAGE_SENDER_ID` | Approved sender identity | Provider-approved value, no OTP or personal phone number in source |
| `PORT` | Listening port for ordinary Node.js hosting | Host process environment; Vercel manages its own serving runtime |

Only literal `true` enables a feature flag. The owner explicitly selected the existing Food go project for the connected release. Use the [release handoff](connected-release.md) for its target origin, setup and checks. Store server secrets in the host environment.

## Settings outside this application's environment

- **Supabase:** exact Site URL, allowed callback URLs, email/phone/signup policy, token/OTP expiry, rate limits, hook registration and backups. The app currently creates callback URLs under `/auth/callback` for profile confirmation and password recovery. Follow the exact allowlist in the [identity guide](../security/identity.md).
- **Brevo:** verified sender name/address, owned domain DNS authentication and SMTP username/key configured in Supabase Auth's custom SMTP dashboard. This path does not use an application Brevo API key. The sender was deferred by the owner.
- **Mobile Message:** approved sender, account credit/limits and owner-controlled Australian test phone. The signed hook endpoint is `https://<your-exact-origin>/api/webhooks/supabase/sms`; configure the actual HTTPS origin in Supabase and the matching hook secret in the host.
- **Operations:** approved venues/content, moderation ownership, privacy/support details, monitoring and budget controls.

See the [messaging configuration guide](../integrations/messaging.md) and [production gate](../security/production-gate.md) before enabling live accounts or delivery. No real email or SMS delivery is established by a successful build.
