# Food Go

A food discovery and restaurant marketplace for Australia, built in stages with React Native, Expo and Next.js.

## Current milestone

Milestone 01 is a runnable product foundation with fictional example data. The web experience includes discovery search and filters, an illustrative map, venue detail pages, saved places, FoodDex planning, quest planning, a guest passport and a three-step restaurant onboarding draft. The mobile app has five interactive tabs with original vector artwork.

The venue draft stays in page memory. Only non-sensitive example bookmarks use browser local storage. Nothing is published or verified. Real authentication, restaurant ownership verification, payments, geographic map services, uploads, rewards and admin workflows are not connected.

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

## Security boundaries

- The demo has no working privileged write endpoint. `POST /api/partner/venues` rejects untrusted origins and otherwise remains unavailable.
- The database migration enables row-level security on all application tables, restricts editable columns, keeps venue contacts private and reserves verification/reward decisions for future server workflows.
- The web app has a per-request nonce Content Security Policy and restrictive browser headers. Local photos and vector maps make no third-party image/map request.
- Environment files, signing materials and dependency caches are ignored by Git. Use `apps/web/.env.example` as the template; never put server credentials in public variables.
- No software is guaranteed unhackable. Live policy tests, authentication, rate limiting, abuse controls, monitoring and independent security review are launch requirements.

## Design rules

Calm forest, sage and cream colours. Accessible labels and focus states. Responsive spacing. One main vertical page scroll with fixed mobile navigation, rather than nested scrolling panels. No emojis or em dashes in application copy or project documentation.

## Documentation

Start at [the documentation index](docs/README.md) and [Milestone 01](docs/progress/01-foundation.md). Each milestone records what works, screenshots, checks, limitations and the next stage. [Visual asset credits](docs/assets.md) identify illustrative photography and licences.

The next milestone is real authentication and trusted self-service onboarding against a client-owned Supabase project, with tested tenant isolation and a genuine ownership-verification workflow.
