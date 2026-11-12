# Food Go

A food discovery and restaurant marketplace for Australia, built in stages with React Native, Expo and Next.js.

## Current milestone

Milestone 03 adds a configured local Supabase connection and a repeatable read-only SDK check. The live check accepts the publishable key and confirms email sign-in with email confirmation. The Food Go venue relation is not yet available through the Data API. Application account routes remain disabled while the database, email sender and provider settings are completed and tested.

Milestone 02 revised the website and React Native interface with a warm paper palette, bold typography, numbered maps and local food photography. Discovery search, venue details, saved places, FoodDex planning, quest planning, a guest passport and a three-step restaurant draft are working previews. The mobile app has five interactive tabs.

The website now includes sign-in, registration and recovery screens with server-side Supabase account integration. Account services remain disabled until a client-owned test project and email sender are configured. Public release also requires the remaining account safeguards and connected tests described in [the identity guide](docs/security/identity.md).

The venue draft stays in page memory. Website example bookmarks use browser local storage. Mobile example saves last for the current app session. Nothing is published or verified, and saves do not sync between apps. Restaurant ownership verification, payments, live maps, uploads, rewards and administration workflows are not connected.

## Run locally

Use Node.js 24 or later and npm.

```sh
npm ci
npm run dev
```

Open the printed local URL, normally `http://127.0.0.1:3000`. No keys or paid services are needed for the preview. The development server binds only to loopback.

For the Expo mobile project:

```sh
npm run dev:mobile
```

See [the mobile README](apps/mobile/README.md) for Expo and device requirements. A responsive web screenshot does not prove native Android or iOS rendering. Store builds and native device QA are separate milestones.

## Project structure

| Folder                | Purpose                                                              |
| --------------------- | -------------------------------------------------------------------- |
| `apps/web`            | Next.js discovery experience and restaurant portal foundation        |
| `apps/mobile`         | Expo and React Native Android/iOS foundation                         |
| `packages/domain`     | Shared validation contracts                                          |
| `supabase/migrations` | Database and tenant access policies, not applied to a hosted service |
| `supabase/tests`      | Live database assertions requiring a local Supabase stack            |
| `docs`                | Architecture, roadmap, decisions, screenshots and milestone reports  |

## Checks

```sh
npm run check
npm run test:security
npm run build:web
npm audit --omit=dev --audit-level=moderate
```

`check` runs workspace TypeScript checks and input/search/origin tests. `test:security` runs static convention checks, not a penetration test. The database integration assertions require Supabase and Docker. Read [the Supabase setup notes](supabase/README.md) before using them.

For a configured local Supabase project, run `npm run check:supabase`. This loads the ignored local environment file and makes only read requests. It checks public account settings and makes a zero-row venue query through the SDK. It prints no keys, account records or raw provider errors. A non-zero exit code means the connection or venue catalogue is not ready. This command does not apply SQL, change dashboard settings, create an account or send email.

## Security boundaries

- The demo has no working privileged write endpoint. `POST /api/partner/venues` rejects untrusted origins and otherwise remains unavailable.
- The database migration enables row-level security on all application tables, restricts editable columns, keeps venue contacts private and reserves verification/reward decisions for future server workflows.
- The web app has a per-request nonce Content Security Policy and restrictive browser headers. Local photos and vector maps make no third-party image/map request.
- Environment files, signing materials and dependency caches are ignored by Git. Use `apps/web/.env.example` as the template; never put server credentials in public variables.
- Account routes validate inputs, require an exact trusted origin for browser writes and use server-verified identities and HttpOnly cookies. Production account services require an explicit release gate.
- No software is guaranteed unhackable. Connected account and database tests, CAPTCHA integration, durable single-use recovery handling, account deletion, abuse limits, monitoring and independent security review are launch requirements.

## Design rules

Calm forest, sage and cream colours. Accessible labels and focus states. Responsive spacing. One main vertical page scroll with fixed mobile navigation, rather than nested scrolling panels. No emojis or em dashes in application copy or project documentation.

## Documentation

Start at [the documentation index](docs/README.md) and [Milestone 03](docs/progress/03-supabase-connection.md). The [illustrated Word report](docs/deliverables/Food-Go-Development-Report.docx) explains the developed features, subscriptions and client actions in simple English. [Milestone 02](docs/progress/02-redesign-and-identity.md) and [Milestone 01](docs/progress/01-foundation.md) preserve earlier delivery records. [Visual asset credits](docs/assets.md) identify illustrative photography and licences.

The next step is authenticated management or database access to the intended test project. Review the read-only SQL preflight before applying the migration, then run the live access policy tests in a confirmed disposable environment. Complete the account release safeguards and verify account and email behaviour before saving real venue information. The publishable SDK key is sufficient for application access but does not grant these management permissions.
