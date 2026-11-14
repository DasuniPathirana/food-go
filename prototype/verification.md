# Prototype verification

Checked on 11 November 2026. All checks apply to this local browser prototype, not production services or native apps.

- JavaScript syntax: `npm run check` passed for app.js, map.js, partner.js and server.mjs.
- Desktop preview: the illustrated map, navigation, collections and partner studio rendered in the in-app browser at its default 1280 by 720 viewport. Venue photos loaded locally.
- Venue journey: Finch & Field detail, route, arrival and simulated QR check-in completed. The first visit added 50 XP and a VenueDex entry.
- Separate dish journey: the signature dish encounter, staff-confirmation simulation and collection success completed. FoodDex showed one collected dish and 75 additional XP.
- Persistence: reloading retained the visited venue, collected dish and XP.
- Quest journey: Coffee and a bakery stop started, routed to Small Hours, updated to one of two stops, routed to Corner Roast, updated to two of two, and awarded 100 XP on claim. The claim button disappeared after claiming. Explorer level increased as XP crossed its threshold.
- Partner onboarding: example-prefill, the three validated steps, authorisation confirmation and final review submission completed in the browser. A local review queue entry appeared.
- Partner module checks: all seven screens rendered. Keyboard submit routing, current-form listing preview, existing venue/photo/signature-dish synchronisation and isolation of unreviewed drafts passed bounded module smoke checks.
- City behaviour: Sydney displayed NSW and an empty state. Returning to Melbourne restored example venues.
- Search: an Italian search returned Ciao, Carlton as the single discovery.
- Booking: a Ciao, Carlton enquiry produced a local summary with date, time, guest count and name. The summary stated that nothing was reserved or sent.
- Account: fictional sign-in details reached the demo account state. Account credentials are excluded from the storage code and are not sent to a server.
- Mobile layout: checked at a requested 390 by 844 viewport. Explore, FoodDex, VenueDex, Quests, Passport, Community and Rewards were reachable. The six non-map pages measured 375 px document width and 375 px scroll width, with no horizontal overflow. FoodDex, VenueDex, Quests and Passport had zero broken images. The map uses intentional horizontal card browsing and drag interaction.
- Copy scan: prototype text files contain no emojis or em dashes.
- Reset: the browser reset restored the initial map, 320 example XP, zero collections and an empty adventure plan. The temporary mobile viewport override was cleared after review.

Real GPS, camera scanning, identity, ownership verification, moderation, reward entitlement, booking delivery and payments were not connected or tested. Keyboard-only and screen-reader audits, comprehensive browser compatibility and real-device testing are outside this presentation prototype.
