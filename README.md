# Food Go

A food discovery and restaurant marketplace for Australia, built in stages with React Native, Expo and Next.js.

## Current milestone

Milestone 11 fits the complete Explore scene within the available browser section, replaces the separate Walk panel with an inline arrow pad, and exposes selected-place external map links. Fictional venues open an explicitly labelled real area; complete published addresses retain exact directions. See [map behaviour and verification](docs/progress/11-map-fit-and-navigation.md).

Milestone 10 refreshes the browser experience as a neighbourhood food guide: a white canvas, dark ink, tomato actions, butter-yellow XP, Bricolage Grotesque headings and Source Sans 3 reading text. A horizontal desktop masthead gives the approved map more space. Feed shows stories sooner; photographic trails, open collections and the Passport cover have distinct layouts. The game, social and optional avatar flows remain available. See [the design system](DESIGN.md), [primary-source UI research](docs/research/10-distinctive-ui-research.md) and [delivery verification](docs/progress/10-neighbourhood-guide.md). Start the local browser demo at **`/demo/explore`**. This is a browser UI refresh, not a production release or native redesign.

Optional avatars now add two rounded 3D explorers and two anime inspired choices while keeping the original explorer as the default. Open **Avatar** below the map or **Change avatar** in Passport, preview the actions, then apply. Selection and idle motion save on this browser. See [avatar behaviour and verification](docs/progress/09-avatar-options.md).

Milestone 08 delivers a cohesive browser adventure at **`/demo`**. Its warm cream/Fredoka visual styling is superseded by Milestone 10. Explore stays first and in the centre. Routes, arrival, simulated QR visits, separate dish confirmations, quests, XP, levels, badges, saved collections and the social wall share persistent demo progress. The standalone prototype remains unchanged. [Demo runbook](docs/demo/08-demo-runbook.md), [earlier UI research](docs/research/08-game-ui-research.md), [go-live requirements](docs/launch/go-live-checklist.md).

Connected social XP and unique verified signed-in reach now use private Supabase tables and checked functions. Self/anonymous views do not count, repeated account/post views deduplicate, and moderation/removal withdraws eligibility. Account release flags remain closed; a deployed live-account journey is still required. See [the delivery and verification record](docs/progress/08-game-adventure.md).

Milestone 07 introduced the public and personal community walls, posts, likes, comments and sharing. Its lime/Outfit styling is superseded by Milestone 08. `/feed` reads approved community content; `/feed-preview` remains an older isolated example.

Milestone 06 introduced expandable map panels, the centred Explore tab, Passport, mall shop directories and external directions. Its dark palette is superseded by Milestone 07. The map remains highly interactive and the original bright artwork is restored. See [product direction](PRODUCT.md) and [design system](DESIGN.md).

Milestone 05 brought the client-approved prototype map into the main website: original illustrated artwork, dimensional photo pins, explorer, radar, ambient animation, pan, zoom and walking controls. `/explore-preview` remains the older isolated example neighbourhood; use `/demo` for the complete adventure. The original `prototype` folder remains intact and the map retains its bright artwork.

The connected catalogue from Milestone 04 uses real public records when `FOOD_GO_CATALOGUE_MODE=supabase`. Empty or unavailable services never silently display fictional venues. The animated playground stays visible, while connected records remain separate from invented map positions. Demo mode remains available without credentials.

The Food Go Supabase foundation and partner-draft migration are installed in the client's Sydney development project. All 27 tenant-policy and 29 partner-workflow database assertions passed with their fixtures rolled back. The app includes a partner dashboard, Australian mobile code sign-in and a signed Mobile Message delivery adapter. Account and messaging flags remain disabled until provider configuration and controlled delivery checks are complete. Brevo will deliver Supabase authentication email through custom SMTP when the sender is supplied.

Milestone 02 revised the website and React Native interface with a warm paper palette, bold typography, numbered maps and local food photography. Discovery search, venue details, saved places, FoodDex planning, quest planning, a guest passport and a three-step restaurant draft are working previews. The mobile app has five interactive tabs.

The website now includes sign-in, registration and recovery screens with server-side Supabase account integration. Account services remain disabled until sender configuration, controlled delivery tests and connected account release checks pass. Public release also requires the remaining account safeguards and connected tests described in [the identity guide](docs/security/identity.md).

With partner accounts disabled, the venue form remains an in-memory preview. With configured verified accounts and `FOOD_GO_PARTNER_ENABLED=true`, it saves private drafts atomically and lists them in the partner dashboard. Saving does not verify ownership or publish a venue. Venue and dish bookmarks have separate browser stores and do not sync between devices. Restaurant ownership review, saved-draft editing, payments, live maps, uploads, rewards and administration workflows remain unfinished.

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

## Deploy the website

Use the [deployment handoff](docs/deployment/README.md) for the GitHub-to-Vercel path, exact monorepo settings, clean-checkout commands and rollout checks. The web project includes `apps/web/vercel.json`; choose `apps/web` as its Vercel Root Directory and Node.js 24. The `/demo` presentation works with provider services disabled. [Environment settings](docs/deployment/environment.md) separate the demo values from the later connected-account release.

For a Node.js host, build from the repository root with `npm ci` and `npm run build:web`, then run `npm run start:web`. Set `PORT` in the host process environment. For local production-build QA, use `npm run start:web:local`, which binds to loopback. Public deployment and real-user activation still require the owner's hosting settings and [release checks](docs/deployment/release-checklist.md).

## Project structure

| Folder                | Purpose                                                              |
| --------------------- | -------------------------------------------------------------------- |
| `apps/web`            | Next.js discovery experience and restaurant portal foundation        |
| `apps/mobile`         | Expo and React Native Android/iOS foundation                         |
| `packages/domain`     | Shared validation contracts                                          |
| `supabase/migrations` | Database policies and controlled partner workflow migrations |
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

Fresh white surfaces, dark ink, tomato actions and yellow progression. Bricolage Grotesque for short headings, Source Sans 3 for reading. Preserve the approved illustrated map and use distinct, content-led layouts for Feed, trails, collections and Passport. Accessible labels, visible focus and responsive spacing. One main vertical page scroll with fixed mobile navigation, rather than nested scrolling panels. No emojis or em dashes in application copy or project documentation. See [DESIGN.md](DESIGN.md).

## Documentation

Start at [the current UI delivery](docs/progress/10-neighbourhood-guide.md), [UI research](docs/research/10-distinctive-ui-research.md), [go-live requirements](docs/launch/go-live-checklist.md) and [email and SMS setup](docs/integrations/messaging.md). The earlier [complete project analysis](docs/progress/04-project-analysis.md) and [illustrated Word report](docs/deliverables/Food-Go-Development-Report.docx) explain the foundation, subscriptions and client actions at their delivery dates. [Visual asset credits](docs/assets.md) identify illustrative photography and licences.

Next, complete the Mobile Message hook and sender setup for controlled SMS sign-in testing. Configure Brevo when the verified sender is ready. Complete account safeguards and operator ownership review before opening registration or publishing real venues. See the latest analysis for the tested state and remaining national marketplace, game and native-app work.
