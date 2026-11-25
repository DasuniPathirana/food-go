# Restaurant encounters and inventory

18 November 2026. Continues the geographic game transformation with approved restaurant encounters, private inventory and separate staff redemption. The feature remains behind `FOOD_GO_ENCOUNTERS_ENABLED=false` by default. Existing production account and provider gates were not enabled, and no participating restaurant, campaign, collectible or discount was seeded.

## Delivered behaviour

Explore retains the geographic map as its main surface. With encounters enabled and foreground live location available, it considers at most 200 published, positioned catalogue venues and requests encounter information for the nearest three within 350 metres. These requests contain public venue IDs, not GPS coordinates. A short in-memory cache bounds repeated requests; hiding Explore clears the cache and aborts pending work. A fresh, accurate fix can highlight a participating landmark and expose a compact nearby entry beneath the map. This is a browsing hint, not proof of arrival or claim eligibility.

Selected restaurant encounters expand below the scene. A mall keeps its existing shared building marker and directory, but the customer chooses an explicit shop before opening that shop's encounter. A nearby shop entry also selects that exact venue. The first shop in a building is never silently treated as the beneficiary of the whole building's reward pool.

The encounter panel shows the restaurant, approved pool, remaining quantity, rarity weights, cooldown and confirmation requirements. Manual mode is explicitly labelled as a preview of an unconfirmed physical location. A customer can begin an encounter without sending location to the claim service, but starting neither reserves stock nor reveals a random outcome. It produces a short-lived reference to show venue staff. The customer then enters the fresh confirmation code staff supplies.

An original layered SVG chest uses CSS lid, emblem, glow and sparkle animation. The illustrated object opens and displays the granted rarity only after the client acknowledges the server's inventory item. An unavailable code or failed semantic result leaves it closed. Reduced motion uses the readable open still. This is original browser illustration and animation, not a rigged GLB treasure object, spatial AR or a completed premium world-art system.

Inventory is reachable at `/inventory` through Collections, Passport and the encounter panel. It separates non-transferable digital collectibles from restaurant offers, retains granted names, terms and rarity, and shows offer availability, expiry and redemption state. Collectibles have no monetary value or expiry. A customer can prepare an offer's temporary redemption code; only current authorised staff of the issuing venue can confirm its redemption. A customer button press cannot mark an offer redeemed.

The management screen at `/encounters` is linked from restaurant management and operator operations. Current owners and managers can create an immutable pool and submit its campaign for independent review. Staff can issue a guest confirmation against the customer's encounter reference and consume a redemption code. A current independent MFA operator reviews the campaign version and records an approval, rejection or withdrawal reason. Self-review and review of one's own organisation remain prohibited by the server.

## Approval and server authority

A campaign requires a published, ownership-verified, game-enabled venue with valid geographic coordinates. Its pool contains one to eight positively weighted entries across Common, Rare, Epic and Legendary. Rarity changes presentation and draw weight; it never bypasses confirmation, stock, cooldown or account requirements. The server performs the cryptographic weighted draw after successful confirmation. Clients cannot choose an item, rarity, quantity, stock balance, customer identity or XP value.

Offer entries reference an existing published promotion for the exact venue. Their name and terms come from that record rather than client-authored reward copy, and the promotion's schedule must cover the campaign. Approval and claim recheck the pool and captured promotion version. An inventory grant snapshots its approved name, terms, rarity and expiry. Changed promotion versions, withdrawal, expired benefits or lost venue approval prevent redemption while leaving the original item visible with an honest unavailable or expired state. No actual discount value is invented by this implementation.

The customer encounter lasts up to 15 minutes, bounded by the campaign end. Staff confirmation and redemption codes last up to two minutes, bounded by the session or item's remaining validity. New codes are random 32-character hexadecimal tokens. Database storage retains their hashes and purpose-bound references, not plaintext tokens. Codes bind the campaign/version, customer, session or inventory item, issuer and issuer session. Replacement invalidates the old challenge. Current identity, active sessions, bans, venue role and participation are rechecked; an organisation member cannot claim a customer reward from their own venue.

These new challenges are separate from the legacy visit/dish exploration codes. Those legacy codes support once-per-account collection while still valid; they are not globally one-use encounter challenges. Encounter claim and redemption each consume their own purpose-bound challenge once. Staff confirmation is the evidence mechanism here, not GPS attestation or a guarantee of physical arrival.

Campaign-row locks serialize finite stock consumption. Each encounter session has a unique inventory grant. The per-venue cooldown applies across campaigns, and the grant stores `cooldown_until`: replacing a seven-day pool with a one-day pool cannot shorten an existing customer's promised wait. The current campaign's own cooldown is also checked. Expiry and cancellation do not replenish claimed stock or erase history used for limits.

| Bound | Implemented limit |
| --- | --- |
| Active customer sessions | 3 per account |
| Customer session lifetime | Up to 15 minutes |
| Confirmation/redemption token lifetime | Up to 2 minutes |
| Successful mutations | 200 per account per Sydney day |
| Claim/redemption guesses | 20 per account per 15-minute window |
| Venue token issuance | 60 per venue per rolling hour, shared across current staff and campaigns |
| Inventory claims | 10 per account per Sydney day |
| Inventory history | 500 lifetime grants per account |
| Pool and campaign | 1–8 entries; 1–10000 total claims; schedule up to 90 days |
| Discovery radius and cooldown | 30–150 metres; 24–168 hours |
| Venue campaign creation | 10 per venue per rolling 24 hours |

Every mutation carries a UUID request ID and a hash of its complete canonical payload. Identical claim or redemption retries return the original item outcome; changed payloads with the same key conflict. Issuance retries return `code:null` with an explicit replay flag because plaintext codes are not saved in request receipts. If the original code response was lost, staff or the customer deliberately generates a replacement.

Expected invalid-code attempts return a safe semantic error while preserving their guess counter. The client treats this as failure even though HTTP transport succeeded and never opens the chest or celebrates. Unknown network outcomes retain one in-memory submission with the same request ID for an explicit retry or inventory refresh. Raw codes are not put in browser storage, URLs, application logs or request receipts. Hiding, unmounting, changing account or changing venue invalidates pending callbacks and clears sensitive code/retry state. Issued-code displays expire. A browser abort cannot reverse a transaction the server already accepted, so an uncertain result remains explicit.

The API uses no-store responses, strict bounded schemas, trusted-origin write checks, a 16 KiB streamed request limit and a five-second body-read deadline. Existing auth callers retain their default 4 KiB limit. Public reads use a stateless anonymous catalogue client and return only approved active pools for the requested venue. Private reads and writes require the existing verified active-session boundary. RPCs have a ten-second API deadline. Browser transport caps public responses at 256 KiB and account snapshots at 4 MiB, with array bounds checked before parsing.

No encounter operation writes the existing XP, check-in, food-discovery or quest-reward ledgers. Inventory items are the separate outcome of this feature. There is no transfer API, paid random draw or automatic cash settlement.

## Database delivery

Applied only to the owner-approved development/test project `Food go` (`azccigsctzhbaxoajqst`), without resetting the database:

- `20261117231324_food_go_restaurant_encounters.sql`
- `20261117231739_food_go_encounter_cooldown_snapshot.sql`
- `20261118000948_food_go_encounter_foreign_key_indexes.sql`

Eight private tables hold campaigns, pool items, sessions, hashed challenges, inventory, account limits, idempotency receipts and review audit. They enable RLS and deny direct client access. Public invoker wrappers call narrowly granted private functions; account mutations use the existing active verified-session guard and operator decisions require current independent MFA access. New public tables or broadly callable public definer functions were not introduced.

The CLI labels the project's main branch “production”. This is the exact project the owner explicitly designated as the development/test target; no other hosted project was selected. The pinned Supabase CLI 3.2.0 was used as a transient development tool. The application received no new major dependency. The isolated UI fixture reuses the existing test bundler.

The initial candidate schema and fixture suite passed 161 assertions in one transaction that rolled back both the candidate DDL and fixtures. The final schema, including saved cooldowns and an isolated daily-claim limit, passed **165 assertions** with `rolledBack:true`. Post-rollback checks found the eight encounter tables empty and no fixture users remaining. Fixtures, temporary helpers and grants were not committed.

The suite covers active verified identities, bans/revoked sessions, private table/helper permissions, independent approval and version changes, venue participation, exact promotion identity and terms, code rotation/expiry/purpose/customer/session binding, issuer role/session loss, replay/conflicting keys, cryptographic server-owned outcomes, finite stock, cross-campaign cooldown preservation, persistent guess limits, Sydney-day mutation and claim limits, shared venue issuance caps, session and lifetime inventory capacity, staff-only redemption, unavailable/expired benefits and absence of XP/check-in/quest reward side effects.

The advisor sweep identified 13 uncovered encounter foreign keys. The final migration adds their covering indexes, and the 165-assertion rollback suite passed again afterwards. A subsequent advisor sweep reported no unindexed encounter foreign keys. The new indexes are reported unused because no real encounter history or traffic is seeded. The private RLS-without-policies notices reflect the intentional RPC-only boundary. Existing notices concerning four earlier public definer functions and nine anonymous-access policies remain outside this slice. See the [database evidence](25-database-evidence.json) and its linked advisor guidance for the precise scope.

## Verification status

| Check | Result |
| --- | --- |
| Final hosted rollback suite | PASS: 165 assertions; all fixtures and temporary grants rolled back |
| Workspace check | PASS: web/native types and 271 application tests |
| Security conventions | PASS: 10 checks |
| Map and encounter browser regressions | PASS across 48 distinct desktop/phone cases; full run passed 47, with one desktop camera timeout passing its isolated rerun |
| Final encounter browser cases | PASS: all 12 desktop/phone cases after final spacing polish |
| Final production build | PASS: built and served by the final Playwright run |
| HTTP regression | PASS: 178 local assertions against the gated production build |
| Screenshots | PASS: six labelled component-fixture captures inspected; desktop/phone overflow checks pass |
| Actual competing transactions | NOT RUN: the disposable local Docker daemon is unavailable |
| Signed-in live-browser and physical GPS journey | NOT RUN |
| Physical phone performance, native map parity and native AR | NOT RUN |

New browser cases use the actual encounter components and styles in a clearly labelled isolated fixture. Only the Next link adapter and HTTP responses are replaced; the fixture is not a production route and never persists fictional campaigns or rewards. The label says that no live restaurant or offer is represented. Separate production-route checks verify the closed release state and navigation. These tests do not establish a signed-in live-browser journey or a staff/customer flow at a real restaurant.

Review corrected pending hint requests that could restart on a five-second clock tick, case-insensitive UUID matching at the public API, stale Begin controls after campaign expiry, and the confirmed item's rarity/action spacing. Regressions cover slow responses, hidden/unmounted cancellation, exact shop identity, server-acknowledged opening, unknown-outcome retry, reduced motion, code clearing, inventory filters, staff issue, independent review, campaign expiry/refresh and owner draft/submit with linked-promotion identity.

The first expanded browser run found an exact-label selector defect in the owner test and two missing Playwright trace files during context cleanup. The selector now uses the actual accessible combobox role. A rerun with isolated artifacts passed 47 cases; the remaining desktop camera case exceeded its 30-second total budget during its final mouse release, then passed unchanged in 7.3 seconds in isolation. The final 12 encounter cases passed together after the visual spacing change. No interaction assertion was removed or relaxed. The [browser evidence](../screenshots/25-browser-evidence.json) records commands and these rerun limits.

| Clearly labelled browser fixture | Desktop | Phone |
| --- | --- | --- |
| Confirmed collectible and open illustration | [Capture](../screenshots/25-encounter-confirmed-desktop.png) | [Capture](../screenshots/25-encounter-confirmed-phone.png) |
| Offer inventory and staff redemption code | [Capture](../screenshots/25-inventory-desktop.png) | [Capture](../screenshots/25-inventory-phone.png) |
| Independent operator review | [Capture](../screenshots/25-operator-desktop.png) | [Capture](../screenshots/25-operator-phone.png) |

The database suite is sequential. Row locks, constraints and replay paths are exercised, but a successful sequential rollback batch does not prove an observed two-transaction race. Genuine contention acceptance still needs the disposable local database; hosted fixture commits remain outside the authorised test workflow.

## Remaining acceptance

Before enabling encounters for public accounts, the hosting team must complete the existing account/provider gates, provision current restaurant staff and independent MFA operators, supply genuine approved venue pools/promotions, and test the customer and staff journeys together on the intended deployment. Real-device GPS, touch/orientation behaviour, measured performance, campaign operations and competing-transaction acceptance remain required.

Licensed production character art, shared world rendering, richer 3D encounter objects, camera/native AR sessions and the remaining full game-transformation work are not delivered by this slice. The original prototype is unchanged. No commit, push or deployment was performed.
