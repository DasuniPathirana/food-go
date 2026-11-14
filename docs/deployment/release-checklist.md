# Deployment acceptance checklist

This checklist distinguishes a shareable browser demonstration from opening real-user services. Record the deployed commit, hostname, tester and date in the PR or release record.

## Preview handoff

- [ ] Review the PR against `develop`; leave `main` untouched. Required GitHub checks complete successfully.
- [ ] A clean root `npm ci`, workspace checks, security conventions, production build and dependency audit pass on Node.js 24.
- [ ] Vercel settings match the [handoff](README.md), including `apps/web`, outside-root workspace access, root lockfile installation and Node.js 24.
- [ ] Environment scopes are correct; credentials are absent from Git/source and live service gates remain closed.
- [ ] The deployed `/api/health` returns HTTP 200. This is website liveness only.
- [ ] The actual demo computer and phone can open `/demo/explore` over HTTPS. Map controls, marker/mall choices, external Maps, avatar options and motion pause work.
- [ ] Feed and Passport wall can create an example post, choose its audience and use reactions/comments; progress and examples survive reload on that browser. Confirm game reset before the presentation if desired.
- [ ] FoodDex, VenueDex, trails, rewards and Passport remain reachable with one normal page scroll and no lost actions.
- [ ] Test an empty search, blocked browser storage and the intended keyboard/touch path. Read the console and host logs without recording secrets.
- [ ] Confirm the UI labels fictional places, simulated visits and browser-only XP accurately. A demo is not verified reach, visit evidence or a redeemable offer.
- [ ] Record the final hostname and rollback path. On Vercel, retain the previous known-good deployment; review environment changes separately from code rollback.

## Before real users

- [ ] Provision and review staging/production Supabase separately from the approved development/test project; apply reviewed migrations, verify policies and test backup restoration.
- [ ] Configure the stable HTTPS origin, exact Supabase callbacks, verified sender/SMTP and approved SMS hook/provider settings in dashboards.
- [ ] Exercise real confirmation, login, refresh, sign-out, recovery, incorrect/expired/replayed codes or links and redirect rejection using controlled consenting accounts.
- [ ] Complete application/provider abuse controls, rate/cost monitoring, moderation and business-ownership operation, account deletion/export/retention and incident/support responsibility.
- [ ] Validate public/private/moderation boundaries and unique signed-in reach with separate verified accounts; self/anonymous/repeat views must not create awards.
- [ ] Implement and verify genuine visit/dish evidence and redemption before advertising physical rewards. Browser simulations do not meet that gate.
- [ ] Complete the [full go-live requirements](../launch/go-live-checklist.md) and [production gate](../security/production-gate.md) before changing a release flag.

No public deployment, production database migration, live account activation or provider delivery has been performed by preparing this repository handoff.
