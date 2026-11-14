# Website deployment handoff

Updated 14 November 2026 for [Kalana8/Food_Go](https://github.com/Kalana8/Food_Go). This is a Next.js 16 website inside an npm workspace containing an Expo app and shared domain package. Deploy the web application with a Node.js server or a Next.js hosting adapter. GitHub Pages/static export cannot serve its server routes, cookies, authenticated calls and SMS hook.

The configured path below is Vercel. No hosting project, domain, provider secret or public deployment has been created by adding these files. The repository branch and PR are for review into `develop`; `main` is not the delivery target.

## 1. Reproduce the build from a clean checkout

Check out the review branch, or `develop` after its PR has been reviewed and merged. Use Node.js **24.x** and the repository-root `package-lock.json`:

```sh
npm ci
npm run check
npm run test:security
npm run build:web
npm run start:web:local
```

Open `http://127.0.0.1:3000/demo/explore`. The `/demo` presentation needs no Supabase, email, SMS, GPS or paid map credentials. Fictional progress stays in the browser. Keep local account and delivery flags disabled. In another terminal, `npm run check:web` runs loopback-only HTTP checks. It must be used only with closed account services; it intentionally exercises rejected requests.

The repository includes `.nvmrc` with `24`. `npm ci` must run at the repository root, since `@food-go/domain` is a local workspace and the only lockfile lives at the root. Do not install the web workspace as an unrelated project or replace its workspace dependency with a registry package.

## 2. Import the web project into Vercel

Use the client's account and import the GitHub repository. Start with a **Preview** from the review branch. Use these project settings:

| Setting | Value |
| --- | --- |
| Root Directory | `apps/web` |
| Include source files outside Root Directory in the Build Step | Enabled, so the root lockfile and `packages/domain` are available |
| Framework Preset | Next.js |
| Node.js Version | 24.x |
| Install Command | `npm ci --prefix ../..` |
| Build Command | `npm run build` |
| Output Directory | `.next` |

`apps/web/vercel.json` commits the framework, install, build and output settings. Root Directory, outside-root access, project ownership, domains and environment scopes remain dashboard settings. Select the matching Root Directory rather than importing the repository root as a static site. Vercel runs the Next.js adapter; it does not need a custom production start command.

After review, the owner may choose `develop` as the deployment branch for the demonstration project. Set that in the Vercel project's Git settings. Do not merge to or configure a deployment from `main` as a shortcut. Promoting a public production release is a separate decision from accepting a preview build.

Use the [demo environment values](environment.md) first, scoped to this project's Preview environment. No server secret belongs in a `NEXT_PUBLIC_` variable. Keep personal `.env.local`, `.vercel` linkage files and provider credentials out of source control. Provide actual secrets through the hosting/provider dashboards.

This configuration follows Vercel's [monorepo workflow](https://vercel.com/docs/monorepos), [build settings](https://vercel.com/docs/builds/configure-a-build) and [Node version settings](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions). Confirm the final settings shown in the deployment log before sharing the URL. The Vercel adapter deployment itself has not been exercised in this environment.

## 3. Check the deployed preview

Follow the [release checklist](release-checklist.md). At minimum, open `/api/health`, then Explore, Feed, FoodDex, VenueDex, trails and Passport using both the actual presentation computer and phone. Check images/fonts, map fit, walking, optional avatars, wall posting, reload persistence and external Maps handoff. Check the browser console and hosting logs. The health response indicates the website process is responding; it does not prove database access or live Auth delivery.

GitHub Actions runs root-locked installation, workspace checks, security conventions, production build, loopback HTTP checks, dependency audit and a disposable local Supabase test job. Hosted database credentials are not used by that workflow. CI failures must be reviewed before merging the PR; a successful local check is not evidence that remote CI or Vercel succeeded.

## Alternative: an ordinary Node.js host

Keep the complete workspace checkout and installed runtime dependencies. From the repository root:

```sh
npm ci
npm run build:web
npm run start:web
```

The production command uses `next start`, with its standard `0.0.0.0` hostname and host-provided `PORT` (3000 if unset). Supply `PORT` as a process environment variable, not in `.env.local`, because Next reads the listening port before loading application environment files. Put the service behind HTTPS and the host's normal reverse proxy/process manager. For local-only QA use `start:web:local`, which explicitly binds `127.0.0.1`.

Do not upload only `.next/static` or the original `prototype` folder as the complete application. Keep the shared workspace package available to Next. Standalone/Docker packaging is not configured or validated in this handoff.

## Connected services are a later release stage

The existing **Food go** Supabase project was approved for development/test use. Use a separate reviewed staging/production environment for real customers. Migrations are committed, not automatically applied by a web deployment. A database administrator must review the target and apply them through the [Supabase workflow](../../supabase/README.md); do not reset a hosted database.

Brevo sender/domain and SMTP credentials are still owner inputs. SMS sign-in requires Mobile Message credentials, approved sender, a public signed Supabase hook and controlled delivery tests. Keep account, production-readiness, phone and SMS flags closed until the corresponding release checks pass. The [environment manifest](environment.md), [messaging guide](../integrations/messaging.md) and [go-live checklist](../launch/go-live-checklist.md) describe the remaining work. Never enable a gate merely to make the demo appear connected.
