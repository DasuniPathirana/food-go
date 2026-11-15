# Food Go: what is needed to go live

Updated 15 November 2026. The target is the connected browser release, with real signup, restaurant management, approved content and server-verified XP. Historical website demo routes return 404. The owner selected the existing Food go Supabase project and a PR-only handoff to the hosting team. Follow [connected release](../deployment/connected-release.md) and [world map operations](../deployment/world-map.md) for the current rollout.

## Inputs needed from the owner

| Priority | Provide or configure | Where and why |
| --- | --- | --- |
| Before deployment | Hosting team access and agreed domain | Current origin is `https://food-go-three.vercel.app`; the custom domain is pending. The deployer merges the reviewed PR to `develop`, configures Vercel and checks HTTPS on actual desktop and phone browsers. Automatic Vercel previews currently report an author-access block. |
| Before real users | Existing Food go project configuration and release ownership | The owner selected **Food go** for rollout. Review backup and migration history, apply pending migrations, configure backups and verify restore procedures. Configure the exact site origin and Auth redirect URLs. Do not reset the hosted database. |
| Before email sign-in | Sender name, verified sender email, owned domain/DNS access and Brevo SMTP settings | You previously deferred this. Authenticate the domain and configure Brevo SMTP inside Supabase. The app's Auth emails use SMTP; a Brevo API key alone does not configure this flow. Enter secrets in the dashboard or an ignored environment file. [Brevo setup](https://developers.brevo.com/docs/supabase-smtp-integration), [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp). |
| Before mobile-code sign-in | Mobile Message API username/password, approved sender, credit and an owner-controlled Australian test phone | Use the actual provider **mobilemessage.com.au**. Configure the signed Supabase Send SMS Hook at the public HTTPS endpoint. SMS is for sign-in codes as requested. Check sender approval in the provider account. Never paste passwords or one-time codes into chat. [Provider API](https://mobilemessage.com.au/api-documentation), [Supabase hook](https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook). |
| Before live catalogue | Approved venue names, genuine street addresses, mall floor/unit details, menus/prices, photos with usage rights and evidence of business authority | The example venues are not real listings. Partner drafts do not publish themselves. Select who reviews ownership and approves listings. |
| Before live social use | At least two consenting verified acceptance accounts, approved stories and a named moderation operator | Prove a viewer can see an approved public story, count once, and increase the author's progress. A second tab using the same account is not a second unique viewer. Pending/private stories and self-views must not count. |
| Before public rewards | Acceptance of server XP values, caps and collection rules | Verified venue visits award 50 XP once, dish discoveries 100 XP once and the three-place challenge 100 XP once. The server validates owner-issued codes. Virtual map walks award no XP. Monetary rewards require separate venue agreements. |
| Before worldwide satellite | Origin-restricted public MapTiler key and suitable plan | Set `NEXT_PUBLIC_MAPTILER_KEY` before building. Streets work worldwide without this key. Bundled satellite/aerial imagery covers Melbourne only and is labelled. |
| Before map traffic | Apply the map-service lease migration and choose provider capacity | Public Photon and FOSSGIS services are best effort and globally paced by the database. Configure operated geocoding or supported foot routing for expected traffic. Run the phone GPS and provider checks in [world map operations](../deployment/world-map.md). |
| Before public launch | Final privacy/terms/support details, moderation owner and operating budget | Agree reporting response, retention, account deletion, location consent, analytics, spend limits and incident contacts. Existing help text is not a completed legal or operational review. |

Google Maps and Apple Maps links use the selected real geographic coordinates. Google's universal Maps URLs do not require an API key. Worldwide interactive streets, optional live location and real pedestrian route walking are implemented; global satellite needs its provider key. [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started).

## Implemented social XP rules

| Event | Beneficiary and reward | Limit |
| --- | --- | --- |
| Approved public story | Author +25 XP | First 3 eligible awards per Australia/Sydney calendar day |
| Approved reply to another author's published public story | Commenter +5 XP | First 10 eligible awards per day |
| Like from another verified account | Story author +2 XP | One event per account/story; first 50 eligible like awards per author/day |
| Qualified unique signed-in reach | Story author +1 XP | One account/story ever; first 25 qualified accounts earn XP per story. Further qualified accounts still count as reach. |
| Shares, anonymous impressions, self-engagement, private/pending content | No XP | Sharing remains available; it is not an unlimited reward source. |

Live community progression starts at 0 XP, level 1, with 250 XP per level. The local demo starts at 320 example XP and preserves the prototype's example level scheme; the separate stores are intentional. Demo reaction bonuses illustrate the game feel and are not the live received-like policy.

For browser qualification, at least 50% of a story must remain visible for three continuous seconds while the tab is in the foreground. The server verifies identity, public publication, blocks and deduplication. A direct authenticated API call cannot prove someone read a post; unique accounts are not proof of unique humans. Production anti-abuse monitoring and stronger controls remain release work.

Removing/unpublishing a source, unliking it, losing verified identity or blocking the relevant account removes its eligible XP from the derived total. The historical event/cap slot remains, so like toggles and reapproval cannot mint another award. Deleting a user's account cascades its source records. Reach counts are distinct account/story pairs, not a cross-post audience deduplicated across the whole profile.

## Engineering gates still required

Credentials alone do not complete these:

- Controlled deployed email/SMS journeys: correct, incorrect, expired and replayed codes/links; refresh; recovery; sign-out; redirects; consent and provider limits. No real email or SMS has been sent during automated checks.
- Distributed application/provider abuse controls, CAPTCHA where appropriate, monitoring and cost alerts. Keep `FOOD_GO_AUTH_PRODUCTION_READY` and SMS delivery gates closed until these checks pass.
- Provision the first operator, enrol MFA and accept the delivered review portal with an independent venue owner. Set moderation response ownership and decision procedures.
- Exercise delivered expiring visit/dish QR codes, retry protection and atomic collection awards on the hosted origin. Physical proximity verification and monetary offer redemption are separate work; map movement is not evidence of a visit.
- Finalise account deletion/export/retention procedures, team invitations, scoped uploads and storage delivery where required. Partner listing and menu editing are delivered; payments/bookings/subscriptions are not connected workflows.
- Staging HTTP tests with multiple real accounts, real desktop/phone browser checks, backups and recovery, dependency/security review and the [production gate](../security/production-gate.md).

## Suggested order

Review the PR and its application/database checks, apply pending migrations, configure the existing Supabase project's providers and Vercel environment, then deploy the reviewed commit through the hosting team. Use controlled accounts to accept signup, ownership review, publication, collection codes, social XP and unique reach. Test the world map and GPS on actual HTTPS phones before inviting users. Release monetary rewards only after a separate redemption workflow is agreed and tested.

Never set a release flag simply to hide an unavailable feature or make a demonstration appear connected.
