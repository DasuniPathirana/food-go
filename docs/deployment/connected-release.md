# Connected website release

The owner selected the existing Sydney Supabase project `Food go` (`azccigsctzhbaxoajqst`). The initial web origin is `https://food-go-three.vercel.app`. The hosting team owns the merge and deployment. Set up the custom domain and update both Vercel and Supabase when its name is confirmed.

The website uses connected data throughout. The old example routes return 404. Set the catalogue mode to `supabase`. The standalone `prototype` folder remains a design reference.

## Customer and owner journeys

Signup offers **Food explorer** or **Restaurant or cafe owner**. Confirmation and later sign-ins send explorers to Explore and owners to their restaurant dashboard. Account type selects the interface. Organisation membership controls restaurant access, and operator grants control administrative access.

An owner creates a private restaurant, opens it under **My restaurants**, edits the listing, adds menu items and submits it for review. An independent operator verifies ownership and publishes the restaurant. The owner can then submit promotions for approval and issue customer verification QR codes.

Customers save venues and dishes to their account. At the venue, a customer scans the owner's QR or enters its code on `/collect`. They confirm the collection to receive 50 XP for their first verified visit to that place or 100 XP for the first verified discovery of that dish. Separate codes verify visits and dishes. Three different places grant a one-time 100 XP challenge bonus. A code expires after ten minutes. Repeated claims return zero new points. The database limits a customer to 20 new discoveries a day and a venue to 60 issued codes per hour. An owner or member cannot collect codes for their own organisation. Passport and the collections show the persisted results after reload or a new sign-in.

The chosen initial award amounts and limits are server rules in the connected journey migration. XP records progression and has no cash value.

## Deploy in this order

1. Select the release branch from this PR, review the GitHub application and database checks, and merge to `develop` following the team's normal release process. The branch includes the earlier geographic Explore work. The Vercel Git integration reported that the commit author lacks project access for automatic preview builds. An authorised hosting team member can deploy the reviewed commit or grant the contributor access and retry.
2. In the selected Supabase project, review the backup and migration history. Apply all pending migrations, including the operator/promotions and connected-journeys migrations. The website requires both for administration, collections, restaurant management and verified XP. Keep existing venues, users and history. Use the disposable CI database for fixture tests.
3. In Vercel select the existing Food Go project, `apps/web` as root and Node.js 24. Set `APP_ORIGIN=https://food-go-three.vercel.app`, `SUPABASE_URL=https://azccigsctzhbaxoajqst.supabase.co`, the project's publishable key, and `FOOD_GO_CATALOGUE_MODE=supabase`. Set `FOOD_GO_COMMUNITY_ENABLED=true` for real Feed reads. The public site entry is `/`. The local CBD imagery is bundled. Wider satellite coverage uses an origin-restricted `NEXT_PUBLIC_MAPTILER_KEY` supplied at build time.
4. Configure Supabase Auth with the exact website origin, the two callback URLs in the [identity guide](../security/identity.md), email confirmation, and authenticator (TOTP) enrolment and verification. Configure the verified Brevo sender in Supabase custom SMTP. Set a generated `FOOD_GO_AUTH_COOKIE_SECRET` in Vercel. Enable `FOOD_GO_PARTNER_ENABLED`, `FOOD_GO_AUTH_ENABLED`, `FOOD_GO_AUTH_PRODUCTION_READY` and `FOOD_GO_COMMUNITY_ENABLED` on the configured deployment. Check signup, confirmation and returning sign-in on that exact origin. SMS sign-in uses the separate sender, signed hook and delivery settings in the [messaging guide](../integrations/messaging.md).
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
| Connected website | Confirm `/demo`, `/feed-preview` and `/explore-preview` return 404. Explore shows the real map and published restaurants. |
| Feed and personal wall | Create a public post. A separate operator reviews it. View it from Feed. Open Passport to find the author's wall and private posts. |
| FoodDex and VenueDex | Check each collection on desktop and a phone. Its description fits one line. Collection entries retain their actions without an Explore call to action or XP count. |
| Promotions | Create a timed offer for a verified published restaurant. Publish it and refresh Explore and Deals in a signed-out browser. Withdraw it and confirm it disappears. Test expired and future offers. |
| Restaurant layout and promo highlight | Check three restaurant columns at desktop width and the responsive layout on a phone. Turn on reduced motion and verify the offer remains readable. |
| Admin portal | Enter with a confirmed operator account and authenticator. Review a venue, place its coordinates, review a public post, moderate a report, and inspect the decision history. A regular account must be denied. |
| Signup and returning sign-in | Create both account types, confirm their emails and verify their landing screens. Sign out and sign back in. |
| Customer discovery and persistence | Collect a real venue-issued visit and dish code, repeat the requests and verify a single award. Sign in in a second browser and check saved items, FoodDex, VenueDex and Passport. |
| Owner workspace | Edit an owned listing, add an available dish, submit a promotion and issue visit and dish QR codes. A customer account and another business owner must be denied that workspace. |

Record the deployed commit, successful origin, approved restaurant, and the outcome of each check for the handoff. The existing public catalogue needs owner-approved restaurant content and offers before the storefront can display them.
