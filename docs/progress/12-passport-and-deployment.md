# Passport wall and deployment handoff

14 November 2026. The owner requested compact sections across pages, personal wall content inside Passport, darker familiar text, and the complete project delivered to `Kalana8/Food_Go` through a named feature branch and PR into `develop`. They confirmed that “one scroll” means one natural document scroll with compact sections, rather than fitting every post on a fixed screen.

## Browser changes

Passport now combines a compact identity/XP cover with the owner's actual wall, composer, own posts and shared discoveries. Audience selection, private stories, comments and post actions remain. Posting stays on Passport. A native “Progress, badges and avatar” disclosure retains the wardrobe, statistics, trails, milestones, activity log and reset controls. The public Feed remains a separate navigation destination. Connected Passport includes the owner's live wall only when an account is available; guests see sign-in and example options. Account gates remain unchanged.

Functional headings and body text use familiar Arial/Helvetica, with `#111111` primary text and `#414141` secondary text. The original wordmark alone retains Bricolage Grotesque. These are owner-directed visual decisions, not a claim that authorship can be detected from a font. Page introductions, collection statistics, card photography and trail layouts take less vertical space. Content stays in the document scroll; the intentionally bounded illustrated map still fits the available viewport.

## Deployment package

The [deployment guide](../deployment/README.md), [environment manifest](../deployment/environment.md) and [release checklist](../deployment/release-checklist.md) define the handoff. Node 24 is pinned in `.nvmrc`. `apps/web/vercel.json` specifies the Next.js preset, root workspace installation, web build and `.next` output. The deployer must select Root Directory `apps/web` and enable outside-root sources so the shared package and root lockfile are included.

`npm run start:web` uses the host's standard Next.js hostname/PORT. `npm run start:web:local` explicitly binds loopback for QA. CI covers workspace types/tests, repository security conventions, production build, local HTTP checks, production dependency audit and a disposable local Supabase job. Hosting ownership, domains and provider secrets remain dashboard configuration. No actual hosting deployment or live email/SMS delivery was performed.

## Local verification

- All workspace types and **97 behaviour tests** passed. The personal-wall component's 18 targeted community/privacy/game tests also passed during implementation.
- **8 repository security checks** passed. These check source conventions and do not constitute a complete security audit.
- The final production build passed; its running server passed **203 local HTTP assertions**.
- `npm audit --omit=dev --audit-level=moderate` reported **0 known vulnerabilities**.
- Desktop 1280×720 and phone 390×844 review confirmed compact Passport/Feed/collection/trail layouts and no document horizontal overflow. DOM inspection found no nested vertical content scrollers in the inspected main sections. Textareas and protected dialogs retain their appropriate bounded behaviour.
- Publishing a public example story from Passport kept `/demo/passport`, displayed the story and raised XP from 320 to 345. A private story stayed on the personal wall, earned no public posting XP, and was absent from Public Feed. Both persisted through Feed navigation and browser Back. Profile disclosures retained the previous controls.
- The final phone Explore scene remained at top 126.7px and bottom 751.7px in an 844px viewport. Fonts computed as Arial for functional text and Bricolage for the wordmark; primary ink computed as `rgb(17, 17, 17)`.
- Final browser logs contained no warnings or errors. Disposable QA posts/progress were reset to 320 example XP. No live public post, account or Supabase record was changed.

## Review evidence

- [Passport with example public/private stories](../screenshots/12-passport-wall-desktop.jpg)
- [Clean phone Passport](../screenshots/12-passport-mobile.jpg)
- [Phone FoodDex](../screenshots/12-food-dex-mobile.jpg)
- [Phone trails](../screenshots/12-trails-mobile.jpg)

Screenshots of QA posts are fictional browser examples captured before reset. Real handset/Safari testing remains outstanding. The native Expo application has not received the complete browser redesign. The [go-live checklist](../launch/go-live-checklist.md) still governs production accounts, moderation and messaging.

## Repository delivery

The handoff branch is `codex/passport-and-deployment`, targeting `develop`. The new repository initially contained only its README. The delivery snapshot is based on that repository's `develop` commit, preserving the separate original local history and leaving both local and remote `main` unchanged. It contains the full project source, migrations, tests, original prototype reference, licensed assets and documentation.

Publication excludes local environment secrets, dependency/build output, Vercel linkage and Supabase CLI linkage/cache directories. A pattern scan of candidate text files found one intentionally invalid Auth-test key fixture and no other matches for its recognised privileged-key/token patterns. This bounded check does not prove the absence of every possible secret. The GitHub credential used for repository operations stays in memory and is never included in the repository.

The PR and remote CI state are reported at handoff. A local successful build does not establish that GitHub Actions, Vercel or production providers have passed.
