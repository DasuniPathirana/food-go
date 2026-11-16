# Web environment manifest

Use `apps/web/.env.example` for local names and safe defaults. In hosting, set variables on the **web project**, scoped separately to Preview and Production. The web code reads these on the server; it does not require browser-visible Supabase variables. Do not copy a developer's ignored `.env.local` into the repository.

The [setup required now](setup-now.md) records the 16 November findings, installed migrations through `20261116181558`, provider inputs and remaining acceptance checks.

## Maps and connected accounts

Worldwide streets and available building footprints use OpenFreeMap, OpenMapTiles and OpenStreetMap. The keyless browser style has no Melbourne boundary. The bundled Melbourne survey supplies more detailed local building heights, aerial photography and a dated satellite image. A raster OpenStreetMap fallback preserves map selection, avatar positioning and routes if WebGL is unavailable.

For worldwide satellite imagery, create an origin-restricted public MapTiler browser key on a suitable plan. Set `NEXT_PUBLIC_MAPTILER_KEY` for the intended hosting environment and rebuild. This value is public in the browser bundle. Verify satellite tiles, attribution, usage limits and allowed deployment origins. Game opens first with real streets and stylised building heights; Streets restores source building heights. The Melbourne satellite/aerial choices remain explicitly local overlays without a worldwide imagery key. The world street map remains interactive outside those overlays. [Satellite dataset](https://docs.maptiler.com/schema-raster/satellite/)

The selected setup uses the account's existing single `NEXT_PUBLIC_MAPTILER_KEY` for satellite tiles and direct browser place search. Allow `food-go-three.vercel.app`, `localhost` and `127.0.0.1`, one hostname per line, with the user-agent field blank. The owner accepts combined development/deployed use; remove local entries when testing ends. Do not copy this public key into `MAPTILER_SERVER_KEY`, which is an optional separate backend-only key, not required here. Confirm commercial-use entitlement before public commercial operation; the Free plan permits development/testing, not commercial launch. See [setup required now](setup-now.md).

`20261116055307_food_go_map_service_limits.sql` is installed on the selected project. It provides a shared database lease across server instances, independently limiting public Photon fallback search and default public foot routing to one request per 1.1 seconds. It stores service names and timestamps only. A missing lease returns an unavailable response rather than bypassing provider limits. Direct browser MapTiler search follows the selected account's quota. See [world map operations](world-map.md) for provider setup, privacy and acceptance checks.

Use these values after supplying the server settings below and configuring the intended Auth provider:

```dotenv
FOOD_GO_CATALOGUE_MODE=supabase
FOOD_GO_COMMUNITY_ENABLED=true
FOOD_GO_AUTH_ENABLED=true
FOOD_GO_AUTH_PRODUCTION_READY=true
FOOD_GO_PARTNER_ENABLED=true
FOOD_GO_PHONE_AUTH_ENABLED=false
FOOD_GO_SMS_ENABLED=false
```

Open `/` for Explore. All website catalogue and account flows use connected records. The historical example routes return 404. Missing configuration produces an unavailable state. Enable the separate phone and SMS flags after their signed-hook and delivery tests pass.

Set `APP_ORIGIN=https://food-go-three.vercel.app` for the current hosting address. Update it and the Supabase callback allowlist together when the final domain is chosen. Omit a trailing slash, path, query and fragment. Configure branch previews separately if accounts need to work on their origins.

## Server configuration

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
| `FOOD_GO_EMAIL_ENABLED` | Enables the signed Supabase email hook and Brevo REST adapter | Keep false until the intended hook, verified sender and delivery checks are configured |
| `SUPABASE_EMAIL_HOOK_SECRET` | Send Email Hook signing secret | Private; separate from the SMS signing secret |
| `BREVO_API_KEY` | Brevo transactional REST authentication | Private API key, not an SMTP key |
| `EMAIL_SENDER_NAME` | Approved Brevo sender display name | Owner selected `TaskRoof` temporarily |
| `EMAIL_SENDER_ADDRESS` | Verified Brevo sender | Owner selected `support@taskroof.com.au` temporarily; must be approved in the provider account |
| `SUPABASE_SMS_HOOK_SECRET` | Supabase Standard Webhooks signing secret | Secret supplied by the intended project's Send SMS Hook configuration |
| `MOBILE_MESSAGE_API_USERNAME` | Mobile Message API authentication | Server secret from the provider |
| `MOBILE_MESSAGE_API_PASSWORD` | Mobile Message API authentication | Server secret from the provider |
| `MOBILE_MESSAGE_SENDER_ID` | Approved sender identity | Provider-approved value, no OTP or personal phone number in source |
| `OPENROUTESERVICE_API_KEY` | Optional supported pedestrian routing provider | Server secret; uses `foot-walking`, never include it in a public variable |
| `MAPTILER_SERVER_KEY` | Optional separate server-side MapTiler search key | Leave unset for the current one-key browser setup; a backend key must be private and separate from `NEXT_PUBLIC_MAPTILER_KEY` |
| `FOOD_GO_PHOTON_ENDPOINT` | Optional owned Photon search endpoint | HTTPS URL; unset uses the public Photon service and shared lease |
| `FOOD_GO_FOOT_ROUTER_ENDPOINT` | Optional owned OSRM foot router | HTTPS base URL; must serve pedestrian routes, unset uses public FOSSGIS foot routing and shared lease |
| `PORT` | Listening port for ordinary Node.js hosting | Host process environment; Vercel manages its own serving runtime |

Only literal `true` enables a feature flag. The owner explicitly selected the existing Food go project for the connected release. Use the [release handoff](connected-release.md) for its target origin, setup and checks. Store server secrets in the host environment.

## Settings outside this application's environment

- **Supabase:** exact Site URL, allowed callback URLs, email/phone/signup policy, token/OTP expiry, rate limits, hook registration and backups. The app currently creates callback URLs under `/auth/callback` for profile confirmation and password recovery. Follow the exact allowlist in the [identity guide](../security/identity.md).
- **Brevo:** the selected transport is the signed Supabase Send Email Hook using a private REST API key. Verify the temporary TaskRoof sender/domain and configure the HTTP hook plus matching signing secret. SMTP credentials are not needed for this connection. See the [email setup](../integrations/messaging.md).
- **Mobile Message:** approved sender, account credit/limits and owner-controlled Australian test phone. The signed hook endpoint is `https://<your-exact-origin>/api/webhooks/supabase/sms`; configure the actual HTTPS origin in Supabase and the matching hook secret in the host.
- **Operations:** approved venues/content, moderation ownership, privacy/support details, monitoring and budget controls.

See the [messaging configuration guide](../integrations/messaging.md) and [production gate](../security/production-gate.md) before enabling live accounts or delivery. No real email or SMS delivery is established by a successful build.
