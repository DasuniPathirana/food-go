# Connected website release

The owner selected the existing Sydney Supabase project `Food go` (`azccigsctzhbaxoajqst`). The initial web origin is `https://food-go-three.vercel.app`. The hosting team owns the merge and deployment. Set up the custom domain and update both Vercel and Supabase when its name is confirmed.

## Deploy in this order

1. Select the release branch from this PR, review the GitHub application and database checks, and merge to `develop` following the team's normal release process. The branch includes the earlier geographic Explore work. The Vercel Git integration reported that the commit author lacks project access for automatic preview builds. An authorised hosting team member can deploy the reviewed commit or grant the contributor access and retry.
2. In the selected Supabase project, review the backup and migration history. Apply the pending operator and promotions migration through the team's migration process. The website requires it for publishing and admin queues. Keep all existing venues, users and history. Use the disposable CI database for fixture tests.
3. In Vercel select the existing Food Go project, `apps/web` as root and Node.js 24. Set `APP_ORIGIN=https://food-go-three.vercel.app`, `SUPABASE_URL=https://azccigsctzhbaxoajqst.supabase.co`, the project's publishable key, and `FOOD_GO_CATALOGUE_MODE=supabase`. Set `FOOD_GO_COMMUNITY_ENABLED=true` for real Feed reads. The public site entry is `/`. The local CBD imagery is bundled. Wider satellite coverage uses an origin-restricted `NEXT_PUBLIC_MAPTILER_KEY` supplied at build time.
4. Configure Supabase Auth with the exact website origin, the two callback URLs in the [identity guide](../security/identity.md), email confirmation, and authenticator (TOTP) enrolment and verification. Configure the verified Brevo sender in Supabase custom SMTP. Set a generated `FOOD_GO_AUTH_COOKIE_SECRET` in Vercel. For verified partner submissions enable `FOOD_GO_PARTNER_ENABLED`. Enable `FOOD_GO_AUTH_ENABLED` and `FOOD_GO_AUTH_PRODUCTION_READY` once the [account release checks](../security/production-gate.md) pass. SMS sign-in has separate sender, hook and delivery checks in the [messaging guide](../integrations/messaging.md).
5. Have the first operator register and confirm the agreed email address, or use an existing confirmed account. The project owner grants that account's UUID the operator role. The operator signs in at `/admin` with their own password and sets up an authenticator. See [operator provisioning, revocation and recovery](operator-portal.md). Account identifiers, invitation links, passwords and backup material belong in the deployment team's private handoff.
6. Deploy the reviewed commit. In a private browser, load `/`, `/feed`, `/deals` and a published restaurant. Use a second signed-in browser to exercise the following flows before opening registration to customers.

## Accept each client request

| Request | Release check |
| --- | --- |
| Satellite view | Switch between the dated satellite observation and the higher-resolution city aerial layer. Toggle surveyed 3D buildings. Verify the external tile provider if a wider coverage key was configured. |
| Search above the map | Search for a known location. Select it and check that the map centres and both external directions links target its coordinates. |
| Finger movement | Pan with a finger. Check touch zoom and the zoom buttons, then scroll the surrounding page. Keyboard movement remains available. |
| Short instructions | Check the compact map hint and the map data credits on a phone. |
| Expand, zoom and close | Use the in-map expand control, zoom, select a place, then close with the button or Escape. Confirm selection, camera and focus survive. |
| Compact example notices | Open the explicit illustrated/example routes. Their small footer identifies example data. The connected catalogue shows published restaurants. |
| Feed and personal wall | Create a public post. A separate operator reviews it. View it from Feed. Open Passport to find the author's wall and private posts. |
| FoodDex and VenueDex | Check each collection on desktop and a phone. Its description fits one line. Collection entries retain their actions without an Explore call to action or XP count. |
| Promotions | Create a timed offer for a verified published restaurant. Publish it and refresh Explore and Deals in a signed-out browser. Withdraw it and confirm it disappears. Test expired and future offers. |
| Restaurant layout and promo highlight | Check three restaurant columns at desktop width and the responsive layout on a phone. Turn on reduced motion and verify the offer remains readable. |
| Admin portal | Enter with a confirmed operator account and authenticator. Review a venue, place its coordinates, review a public post, moderate a report, and inspect the decision history. A regular account must be denied. |

Record the deployed commit, successful origin, approved restaurant, and the outcome of each check for the handoff. The existing public catalogue needs owner-approved restaurant content and offers before the storefront can display them.
