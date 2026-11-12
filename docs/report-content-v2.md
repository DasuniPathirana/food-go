# Food Go development report

Prepared for the Food Go project owner. Updated 12 November 2026.

This report explains the work completed so far, shows the current screens and lists the services needed for the next stage. Food Go has a working website preview and a React Native mobile foundation. The Supabase SDK connection now passes a read-only check. The example venues can be searched, saved and explored. Application account routes remain disabled while database setup, provider configuration and release safeguards are completed. A public restaurant service, real check-ins and payments are still later work.

The screenshots were captured from the revised application on 11 November 2026. The SDK setup does not change the interface or map. A mobile-width website screenshot is a website view. Android and iOS JavaScript exports are build checks, not evidence of testing on phones.

## Current position

You can review the discovery screens, save example places, plan example trails and complete a venue draft without buying a subscription. The venue names and stories are examples. Saving a place does not create a verified visit. Completing a draft does not publish a restaurant.

The project keeps the public website, restaurant tools and mobile application in one repository. They are designed to use the same venue and dish records when the backend is connected. This avoids asking an owner to enter the same information for the game and marketplace.

| Area                            | Current position                                                                |
| ------------------------------- | ------------------------------------------------------------------------------- |
| Website and restaurant draft    | Working preview with example content                                            |
| Android and iOS                 | Expo application source and production JavaScript exports                       |
| Account screens                 | Code implemented; local SDK connection passes; application account routes disabled |
| Venue database                  | Migration and access rules written; venues unavailable through the Data API; migration and live tests pending |
| Check-ins and dish verification | Not connected                                                                   |
| Payments and bookings           | Not connected                                                                   |

## Exploring places

Screenshot planned: `docs/screenshots/02-explore-desktop.jpg`.

The Explore screen is the starting point. An explorer chooses a city, searches for a dish, cuisine or suburb, and narrows the results by venue type. Map and list controls offer two ways to browse the same example venues.

The revised layout puts the map and useful venue details before decorative marketing content. Clear names and direct labels help people decide where to look next. The illustration is not a live navigation map and does not collect location data.

The example listings currently cover Melbourne. Selecting another city must show an honest empty result rather than suggesting that participating venues have already joined throughout Australia.

## Looking at a venue

Screenshot planned: `docs/screenshots/02-venue-detail.jpg`.

A venue page brings together its name, suburb, food style, photograph and example signature dish. The save control adds the place to the user's planning list. The food trail link opens the available example adventures.

The current venue names, address descriptions and participation are fictional. The photographs illustrate food. Real opening hours, menu prices and dietary information will need to come from verified venue owners.

## FoodDex

Screenshot planned: `docs/screenshots/02-food-dex.jpg`.

FoodDex helps an explorer keep track of dishes to try. Saving an example place also keeps its signature dish in the planning list. The user can switch between the available dish ideas, saved ideas and verified dishes.

Verified dishes stay at zero in this stage. A restaurant visit alone cannot prove that someone ate a particular dish. The live product will need separate evidence for a dish experience, such as staff confirmation or an eligible redemption.

## VenueDex

Screenshot planned: `docs/screenshots/02-venue-dex.jpg`.

VenueDex keeps saved places together. An explorer can open a venue page or remove a bookmark. The browser keeps these example bookmarks so they remain available when the page is revisited.

Saved places and visited places are separate. Verified visits stay at zero until the secure check-in system is connected. The stored browser values are example venue identifiers, not passwords, payment information or a private location history.

## Quests and trails

Screenshot planned: `docs/screenshots/02-quests.jpg`.

The trail screen offers example routes built around food interests. An explorer can add or remove a trail from the current page's plan and switch to the planned-trails view.

Planning a trail does not award points or complete it. Verified progress remains at zero. When check-ins are introduced, the server will need to check the evidence and prevent the same event from awarding a reward twice.

## Explorer profile

Screenshot planned: `docs/screenshots/02-profile.jpg`.

The profile page shows the current preview account state, the saved example count and the space for future verified visits and achievements. The user can clear saved browser examples.

The preview does not create a public identity or invent an explorer level. A real passport will depend on a signed-in account and trusted visit records. The account deletion process must be completed and tested before public accounts launch.

## Restaurant onboarding

Screenshots planned: `docs/screenshots/02-partner.jpg` and `docs/screenshots/02-onboarding.jpg`.

The restaurant page introduces the owner tools and opens the venue draft. The draft groups information into three steps: contact details, venue details and a final review. It checks required fields and explains how to correct invalid information.

The owner can go back, edit the details, reset the draft and create an in-page listing preview. The current draft exists in page memory. Reloading clears it. No restaurant is published, no email is sent and no ownership claim is approved by completing this preview.

The live version will need verified ownership, duplicate venue checks and a controlled publication process. An owner must not be able to approve their own verification by changing a browser value.

## Restaurant partner entry

Screenshot planned: `docs/screenshots/02-partner.jpg`.

The partner page is the starting point for restaurant and cafe owners. It explains the owner tools and opens the three-step venue draft. The owner can try the flow before the live registration and verification service is enabled.

The draft is the current working feature. A live partner dashboard for managing published venues, staff, menus, redemptions and billing is still to be built. The entry page does not imply that those services are already operating.

## Accounts and recovery

Screenshot planned: `docs/screenshots/02-auth.jpg`.

The identity code covers sign-in, registration, email confirmation, password recovery and sign-out. It checks the account with Supabase before treating a visitor as signed in. It also includes a shared session-refresh path so connected sessions can be refreshed while the website is used.

The project connection is configured locally and its read-only SDK check passes. Application account routes remain disabled until database setup, provider configuration and release safeguards are completed. The public preview must not claim that an account was created or a recovery email was sent without testing those flows.

Password recovery requires a short-lived permission linked to the verified user. Being signed in by itself is not enough to use the recovery endpoint. The server also checks return links and rejects destinations outside the approved application pages.

The project owner will need to approve the real website address, configure allowed return links and arrange a sender address for confirmation and recovery emails. Passwords and email confirmation links must not be placed in the Word document or screenshots.

Account deletion and CAPTCHA integration are not implemented yet. Before public registration opens, we need to complete that work, agree reliable one-use handling for recovery links and test the connected account service.

## Android and iOS foundation

Screenshot planned: `docs/screenshots/02-explore-mobile.jpg`, labelled as a mobile-width website view unless a real native capture is supplied.

The mobile source uses React Native and Expo. The five main sections are Map, FoodDex, VenueDex, Quests and Profile. The foundation includes example search and filters, map selection, planning controls and a fixed bottom navigation area.

Android and iOS JavaScript exports were produced during the first milestone. This proves that the code can be bundled for those platforms. It does not prove camera behavior, permission prompts, safe areas or performance on real phones. Those checks require native builds and test devices.

The current application does not ask for background location, microphone or camera access. Live location and QR check-ins will be introduced only when the relevant features are ready.

## React Native app preview

Screenshot planned: `docs/screenshots/02-native-preview.jpg`.

This is the React Native application running through Expo Web in a browser. It is a different application from the mobile-width Next.js website shown earlier. It lets us review the mobile app's shared screens, navigation, example map and planning controls.

The browser preview does not prove native iPhone or Android behavior. Device testing is still needed for permissions, cameras, safe areas, touch behavior and performance. Production JavaScript exports are build checks, not app-store packages or device certification.

The mobile example saves and plans last only for the current app session. They do not sync with the website or an account.

## Security and technical work

The website checks input before it is used. It limits public search requests and rejects unsupported parameters. The current restaurant write endpoint stays closed, including for a request coming from the correct website, until the trusted publication workflow is ready.

Browser rules restrict scripts and prevent other sites from placing the app inside a frame. A different script nonce is generated for each page request. A nonce is a one-use value that allows the expected page scripts to run. The production policy does not allow unsafe script evaluation.

We have written database tables and access rules that separate public listings from private contact records. The rules reserve venue approval, staff-role changes and points for trusted server workflows. Venue visits and dish discoveries have separate records. The rules still need to be applied to the test database and checked with real database requests.

The repository includes checks for code types, input behavior, browser headers, routes and dependency advisories. It also contains database tests for two organisations and their private records. The live database tests have not been run without a configured test database.

The help page explains what the preview can do and how example preferences are stored. Missing venue pages return a real not-found response. An application error screen gives the user a way to try again without displaying private technical details.

Security also needs operations after launch. Someone must apply updates, monitor failures, review suspicious behavior, test backups and handle reported content. No subscription or codebase can make a service impossible to attack.

## Work still to complete

The remaining work includes real venue ownership verification, saved server drafts, secure uploads, approved venue publication, opening hours, live maps, QR visits, separate dish evidence, rewards, offers, booking handling and administration tools.

Payments, restaurant subscriptions, payouts and social features should follow the agreed business model. Public user photos and reviews need reporting and moderation before they are enabled. These features should not be described as complete because a placeholder screen or database table exists.

The next practical step is secure management access to a confirmed test project. Review the database preflight, apply the migration and run the 23 policy assertions only on a disposable database. Then test account, email and tenant access flows before saving real venue information.

## Supabase connection update

On 12 November, the app connection details were saved in an ignored local environment file. They include the project URL, the publishable key and a new cookie signing secret generated from 32 random bytes. Neither application accounts nor the production account release flag was enabled. The service-role and secret keys were not used.

The live read-only check reached Supabase successfully using the publishable key. The public account settings report that email and password sign-in is enabled, email confirmation is required and direct provider registration is enabled. Closing the Food Go account routes does not disable Supabase's own registration API.

The SDK also made a zero-row request to the venues catalogue. It reported that the venues relation is unavailable through the Data API schema cache. This is not a complete database inventory and does not prove that the database is empty. The project region, email sender and callback configuration have not been verified.

The SDK is the library used by the application to call Supabase. It can sign users in and access data allowed by the project's policies. Changing database structure, email settings and callback URLs requires separate management access, such as an authorised CLI session, Management API token or database connection. That access is not available in the current setup.

The database migration now stops if it would collide with existing application tables, the private schema, a storage bucket or an incompatible PostGIS installation. A separate read-only preflight helps the developer review the target before applying the migration. No database migration or policy test has run against the hosted project.

No account was created, no email was sent and no application data or dashboard setting was changed by the connection check. The next step is to rotate the exposed privileged keys, arrange management access securely, review the preflight and complete the test database setup. Never post replacement secrets or management tokens in chat or the report.

## Subscriptions to buy

Prices were checked on 11 November 2026. The listed provider prices are in US dollars unless a different currency is explicitly shown. Taxes, exchange rates and additional usage may change the invoice. Paid services are not needed just to review the current local preview.

React Native, Next.js and the Expo development tools do not need a paid framework licence. Both mobile platforms are designed to use one shared backend once connected. Standard Vercel hosting includes HTTPS, so a separate SSL certificate purchase is not needed for that setup.

| Service                   | Recommended timing                                                                 | Starting cost                                                                 | What to use it for                                                      |
| ------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Supabase                  | Create a client-owned free test project now; use Pro before production             | Free for initial testing; Pro from US$25 per month                            | Accounts, database and file storage. Choose the specific Sydney region. |
| Separate test database    | Keep it separate from production                                                   | Additional Micro project from US$10 per month on a paid organisation          | Test changes without changing the live data.                            |
| Vercel Pro                | Buy when hosting this commercial project                                           | US$20 per month starting price                                                | Next.js website and server routes. Extra seats and usage cost more.     |
| Resend                    | Set up a sender for connected account testing; choose Pro as email volume requires | Free up to 3,000 emails a month and 100 a day; Pro US$20 per month for 50,000 | Confirmation, recovery and notification emails.                         |
| Expo services             | Create the project account when native builds start; a paid plan is optional       | Free limited plan; Starter US$19 per month plus usage                         | Cloud app builds and updates.                                           |
| Apple Developer Program   | Start organisation preparation before iPhone distribution                          | US$99 per year, with regional pricing                                         | TestFlight and App Store distribution.                                  |
| Google Play Console       | Set up before Android distribution                                                 | US$25 once                                                                    | Android release and testing tracks.                                     |
| Domain and business email | Arrange before branded email and public hosting                                    | Depends on the chosen name and provider                                       | Website address, sender identity and support contact.                   |

The next connected testing can start with the free Supabase and Resend allowances. When the commercial website is hosted, Vercel Pro and a production Supabase Pro project start at about US$45 per month. An additional paid test database adds about US$10 and Resend Pro adds US$20 if its free email limits are too small. Those paid choices total about US$75. Optional Expo Starter brings that example to US$94. These are subscription subtotals before extra usage and taxes. They exclude maps, domains, monitoring, file backups, development and support staff.

Live maps can be billed by usage. Set up the map account when the integration starts and restrict its keys to the intended apps and websites. Google Places is not a directory that can be freely copied into Food Go. Permanent venue information should come from owners or an appropriately licensed source.

Stripe is not needed for the current preview. Choose the payment setup after deciding whether customers pay restaurants directly or Food Go collects and pays out money. Online card processing, recurring billing and restaurant payouts have different fees.

The default Supabase email sender is unsuitable for public accounts: it only sends to authorised team addresses and currently has a very small hourly limit. Configure custom email delivery before testing public sign-up. Database backups also exclude the actual uploaded photo files, so production needs a file backup plan.

Official pricing and setup sources:

- [Supabase pricing](https://supabase.com/pricing)
- [Supabase Sydney region](https://supabase.com/docs/guides/platform/regions)
- [Supabase custom email](https://supabase.com/docs/guides/auth/auth-smtp)
- [Supabase backups](https://supabase.com/docs/guides/platform/backups)
- [Vercel pricing](https://vercel.com/pricing)
- [Vercel commercial use](https://vercel.com/docs/plans/hobby)
- [Expo pricing](https://expo.dev/pricing)
- [Resend pricing](https://resend.com/pricing)
- [Apple enrollment](https://developer.apple.com/programs/enroll/)
- [Google Play registration](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en)
- [Google organisation details](https://support.google.com/googleplay/android-developer/answer/13628312?hl=en)
- [Google Maps pricing](https://developers.google.com/maps/billing-and-pricing/pricing)
- [Google Places data rules](https://developers.google.com/maps/documentation/places/web-service/policies)
- [Stripe Australia pricing](https://stripe.com/au/pricing)

## What you need to do

1. Rotate the privileged keys exposed in chat and screenshots through Supabase. Keep replacements in an approved secret store. Keep business accounts under the client, enable multi-factor authentication and invite developers instead of sharing passwords.
2. Confirm the business name, logo, public support email and website domain. The domain should be owned by the client. Do not buy an expensive domain or an annual hosting bundle without agreeing the name and hosting plan.
3. Confirm a separate Sydney test project. Arrange CLI or Management API access securely, without posting tokens in chat. Review the read-only database checks, apply the migration there and run the 23 database policy tests only on a disposable test database.
4. Configure the exact app callback URLs and a domain sender. Your developer can set SPF, DKIM and DMARC records. Test confirmation, recovery, failed delivery and session expiry before public registration.
5. Decide how owners will prove authority to manage a venue. Choose the evidence, who reviews exceptions and what happens when two people claim the same business. Knowing an ABN or business name is not enough on its own.
6. Provide a small set of real pilot venues with permission to use their information and photographs. Supply addresses, opening hours, menus and signature dishes. Agree who will maintain this information after launch.
7. Decide what counts as a verified venue visit and a verified dish experience. Agree whether staff confirmation, a QR code, a redemption or transaction evidence is required. A visit and a dish experience need separate rules.
8. Confirm whether the first booking feature is an enquiry or a confirmed reservation. Decide whether the customer pays the restaurant directly. These choices change the payment, refund and support work.
9. Arrange an Australian review of the privacy policy, terms, offers and safety wording. Decide the target age group, profile privacy defaults, retention periods and overseas service disclosures. Choose the person responsible for complaints, moderation and privacy requests.
10. Prepare Apple and Google organisation account details, including the company name, address, website, contact person and D-U-N-S number. Apple also checks that the account holder has legal authority to represent the business. Start verification early and confirm the final app identifiers before signing release builds.
11. Provide access to an iPhone and an Android phone for testing. Ask a small group of intended users and venue owners to try the important flows. Include larger text sizes, screen readers, slow connections and declined permissions.
12. Agree the launch scope and operating budget. Start with enough venues in a pilot area to make the experience useful. Nationwide infrastructure can be ready before nationwide venue coverage exists.
