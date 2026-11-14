# Food Go: what is needed to go live

Updated 14 November 2026. The immediate target is a responsive browser demonstration. The local `/demo` adventure works without email, SMS, GPS, paid map services or live accounts. Its places, visits and XP are explicitly fictional. The current browser UI and checks are recorded in [Milestone 10](../progress/10-neighbourhood-guide.md).

## Inputs needed from the owner

| Priority | Provide or configure | Where and why |
| --- | --- | --- |
| For a shareable demo URL | Client-owned hosting account/project and chosen preview hostname | Deploy the website over HTTPS. A local loopback URL cannot be opened on a phone. A desktop browser's phone-size viewport is useful QA but does not replace checking a real handset. No public deployment has been performed in this delivery. |
| Before real users | Production Supabase project and account ownership | Existing **Food go** is the owner-approved development/test project. Provision a separate production environment, apply reviewed migrations, configure backups and perform a restore exercise. Configure the exact site origin and Auth redirect URLs. |
| Before email sign-in | Sender name, verified sender email, owned domain/DNS access and Brevo SMTP settings | You previously deferred this. Authenticate the domain and configure Brevo SMTP inside Supabase. The app's Auth emails use SMTP; a Brevo API key alone does not configure this flow. Enter secrets in the dashboard or an ignored environment file. [Brevo setup](https://developers.brevo.com/docs/supabase-smtp-integration), [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp). |
| Before mobile-code sign-in | Mobile Message API username/password, approved sender, credit and an owner-controlled Australian test phone | Use the actual provider **mobilemessage.com.au**. Configure the signed Supabase Send SMS Hook at the public HTTPS endpoint. SMS is for sign-in codes as requested. Check sender approval in the provider account. Never paste passwords or one-time codes into chat. [Provider API](https://mobilemessage.com.au/api-documentation), [Supabase hook](https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook). |
| Before live catalogue | Approved venue names, genuine street addresses, mall floor/unit details, menus/prices, photos with usage rights and evidence of business authority | The example venues are not real listings. Partner drafts do not publish themselves. Select who reviews ownership and approves listings. |
| Before live social demo | At least two consenting verified test accounts, approved test stories and a named moderation operator | Prove a viewer can see an approved public story, count once, and increase the author's progress. A second tab using the same account is not a second unique viewer. Pending/private stories and self-views must not count. |
| Before public rewards | Agreement on XP values, caps, level thresholds and whether rewards have monetary value | Current social rules are listed below. Browser-demo check-ins cannot become real rewards. Physical offers require venue agreements and a separate redemption workflow. |
| Before public launch | Final privacy/terms/support details, moderation owner and operating budget | Agree reporting response, retention, account deletion, location consent, analytics, spend limits and incident contacts. Existing help text is not a completed legal or operational review. |

Google Maps and Apple Maps links already use real published destination details. Google's universal Maps URLs do not require an API key. A licensed geographic map with live positions is a separate provider decision; the approved illustrated map is a playground, not GPS. [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started).

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
- Staff/operator moderation and ownership review tools with auditable decisions. The database enforces pending/public boundaries; a complete operational review console is not delivered.
- Real signed, expiring QR issuance, proximity and replay checks, separate dish evidence, atomic visit/reward transactions, and offer redemption. These are simulated only in `/demo`.
- Account deletion/export/retention, partner draft editing/team invitations, scoped uploads and storage delivery. Payments/bookings/subscriptions are not connected production workflows.
- Staging HTTP tests with multiple real accounts, real desktop/phone browser checks, backups and recovery, dependency/security review and the [production gate](../security/production-gate.md).

## Suggested order

Use `/demo` for the scripted presentation. Set up the client-owned HTTPS preview and test it on the actual presentation devices. Next configure production/staging, sender identities and controlled test accounts. Validate live Auth, moderation and unique reach before inviting users. Release physical rewards only after their evidence and redemption workflows pass separately.

Never set a release flag simply to hide an unavailable feature or make a demonstration appear connected.
