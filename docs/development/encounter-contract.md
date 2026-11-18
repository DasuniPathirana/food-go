# Restaurant encounter slice contract

Implementation coordination for milestone 25. No seed rewards or participating venues. Default `FOOD_GO_ENCOUNTERS_ENABLED=false`; existing auth/production gates remain unchanged. Browser proximity is cosmetic, never claim authority. No encounter action grants XP or writes existing visit/quest/reward ledgers.

## Authority and lifecycle

- Only a venue's current owner/manager creates/submits its immutable pool. Venue must be published, ownership verified, game enabled and have valid coordinates.
- An independent current MFA operator approves a pending campaign version, or rejects/withdraws it with a reason. No self/own-organisation approval. A withdrawal stops claims and offer redemptions.
- Pool: 1–8 entries, `common|rare|epic|legendary`, integer weights 1–1000. Collectibles are non-transferable, have no monetary value and no expiry. Offer entries reference an existing published promotion for the exact venue; name/terms come from that promotion. Never invent offer values. Campaign dates must fit each linked promotion's dates. No pool edits after creation; create a replacement draft instead.
- Campaign: `draft|pending|published|rejected|withdrawn`. Schedule max 90 days, discover radius 30–150 m, cooldown 24–168 h, finite `maxClaims` 1–10000, offer validity 1–168 h. Stock consumed only on successful claim.
- Customer starts a 15-minute session. Starting reveals no random outcome, reserves no stock and proves no location. Maximum 3 active sessions/account; repeated start reuses that customer's current session for the campaign. Customer cannot be any member of the venue organisation.
- Staff issues a two-minute, 32-hex-character random challenge bound to session, beneficiary, campaign and current issuer. Hash-only storage; replacement invalidates old code. Session moves `started → awaiting_confirmation → claimed` (or time-derived expired/cancelled).
- Claim atomically revalidates campaign/venue/pool/issuer, consumes challenge once, draws a crypto-random server-owned weighted item, decrements campaign stock and inserts exactly one inventory item for that session. Checks per-venue cooldown across campaigns, 10 claims/Sydney day, max 500 lifetime inventory grants. Rarity never bypasses eligibility.
- Collectibles stay `collected`. Offers are `available|redeemed|expired|unavailable`, with time-derived expiry (minimum of claim+offerValidityHours and promotion end), immutable granted name/terms/rarity and captured promotion version. Expiry/withdrawal/changed promotion/venue approval is rechecked for redemption.
- Customer prepares a two-minute redemption code bound to their available offer item. Authenticated current staff of the exact venue consumes it once. Customer cannot redeem it themselves. No transfer API.
- Reuse active verified `private.journey_user()` and current MFA operator checks. Private RLS tables, revoke direct access. Public invoker wrappers over checked private definer RPCs. Lock consistently: account advisory, campaign, session/item, challenge. Serialize global stock on campaign row. Keep code plaintext out of receipts/logs/errors; only initial issue/preparation response returns code. Idempotent replay of code issuance returns `code:null`, `replayed:true` so user deliberately generates a replacement if original delivery was lost. Claim/redeem replay returns the same item, never a second grant.
- Every mutation has UUID requestId + strict fields; hash includes complete canonical payload. Same key/changed payload conflicts. Bound successful requests 200/account/Sydney day and failed claim/code guesses separately (persisted failures must not roll back with a raised exception). Cap venue code issuance 60/hour. Lazy prune old non-grant sessions/requests/challenges safely. No hosted fixture commits; all tests roll back.

## RPC / API

Public `food_go_venue_encounters(p_venue uuid)` only approved active campaigns, <=3; checks publication/ownership/game/coordinates/promotions at read. No customer identity, issuer, raw code or private organisation fields.

`GET /api/encounters?venueId=UUID`: public read using anonymous catalogue provider config (never credential fallback). Returns PublicResponse.

`GET /api/encounters`: verified account own inventory, sessions and management snapshot through `food_go_encounter_journey({action:'read'})`. Returns Snapshot. `POST /api/encounters`: verified, origin/body guarded, calls same RPC with strict command. Create body limit is 16KiB, including streamed UTF-8 bytes. No raw location accepted/sent. Server validates output; safe errors; no-store responses; 10-second RPC timeout.

DTOs, use strict zod objects. ISO timestamps have an offset; arrays bounded before parsing. All DTOs include `ok:true,version:1,serverTime`.

`Venue = {id:UUID,name:string,slug:string,coordinates:{longitude,latitude}}`.

`PoolItem = {id:UUID,kind:'collectible'|'offer',name:string,description:string,rarity,weight:int,promotionId:UUID|null}`.

`Campaign = {id:UUID,venue:Venue,title,description,theme:'cafe'|'restaurant'|'market',state,version:ISO,startsAt:ISO,endsAt:ISO,radiusMetres:int,cooldownHours:int,maxClaims:int,claimedCount:int,offerValidityHours:int,pool:PoolItem[]}`.

`Session = {id:UUID,encounterId:UUID,venueId:UUID,title:string,state:'started'|'awaiting_confirmation'|'claimed'|'cancelled'|'expired'|'unavailable',expiresAt:ISO,itemId:UUID|null}`. Session ref is safe to show/copy to staff; actual confirmation code stays in memory.

`InventoryItem = {id:UUID,sessionId:UUID,encounterId:UUID,venue:Venue,name,description,rarity,kind:'collectible'|'offer',state:'collected'|'available'|'redeemed'|'expired'|'unavailable',claimedAt:ISO,expiresAt:ISO|null,redeemedAt:ISO|null,promotionId:UUID|null}`.

`Result = {action:Command.action,sessionId:UUID|null,itemId:UUID|null,code:string|null,codeExpiresAt:ISO|null,replayed:boolean,error:null|{code:'invalid'|'missing'|'ineligible'|'limit'|'changed',message:string}}`. Expected failed code guesses return safe `result.error` with HTTP 200 so throttle writes persist; frontend must treat as failed, show it and never celebrate. No rejected code echoes. Other SQL exceptions use existing safe error mapping.

`PublicResponse = {ok:true,version:1,serverTime,encounters:Campaign[]}`.

`Snapshot = {ok:true,version:1,serverTime,inventory:InventoryItem[] (max500),sessions:Session[] (max3 active),managedVenues:Venue[] (max50),campaigns:Campaign[] (max100 own-managed or pending/published operator),operator:boolean,result:Result|null}`. Operator boolean only from current DB access. No arbitrary account or session lookup API.

Commands (all except read carry requestId UUID):

- `create`: encounterId,venueId,title (2..90),description (2..600),theme,radiusMetres,cooldownHours,startsAt,endsAt,maxClaims,offerValidityHours,pool. Each create pool entry is `{id,kind:'collectible',name(2..80),description(2..300),rarity,weight}` OR `{id,kind:'offer',promotionId,rarity,weight}`. Do not accept offer name/terms/value from client. Unique pool IDs.
- `submit`: encounterId,version.
- `review`: encounterId,version,decision:'approve'|'reject'|'withdraw',reason (5..400).
- `start`: encounterId.
- `cancel`: sessionId.
- `issue`: sessionId.
- `claim`: sessionId,code (32 lowercase hex, trim+lowercase API).
- `prepareRedemption`: itemId.
- `redeem`: code.

## UI

Explore retains map focal surface. Selected mall expands its existing directory with an explicit shop choice; never silently treat the first shop as the whole building. New `EncounterPanel` receives exact venueId, signedIn, enabled, accountKey and `proximity:{mode:'manual'|'live',fix:ExplorerLocationFix|null}`. It loads public campaigns; displays proximity from fresh accurate raw device fix only, manual preview explicitly labelled. Distance never sent as proof or used for server authority. Start usable manually but clearly requires fresh staff confirmation before claim. Each current session shows reference/copy and code field, expiry/server-time status. Original themed chest illustration with click/open/claim animation, reduced-motion still, loading/error/offline/retry states and no speculative random reward. Drawn inventory item only after acknowledged server claim; no preview rarity outcome.

`/inventory` uses `EncounterWorkspace mode='inventory'`, reachable from Passport/collections and encounter panel. `/encounters` uses same component mode='manage'`: owner create/submit form, staff issue/ref and redeem controls, independent operator review with reason and version. Pool editor supports up to8 entries, offer requires approved promotion ID (server verifies). All use plain Australian English, Lucide and bright market-signage tokens, one document scroll. No camera/AR claim in this slice.

Client transport bounded (4MiB snapshots accommodate legitimate maximum arrays and UTF-8 names/terms), same-origin static API endpoints, abort/epoch guards on venue/account/hide/unmount. Raw codes never storage, logs or URLs. One current mutation retry envelope, stable requestId; stateful retries do not mint new UUIDs. Unknown claim result offers retry same submission or refresh inventory. Clear sensitive code/envelope on hide/unmount/account change; say outcome unconfirmed and refresh rather than retrying an older account's request. Existing account gates default closed. Add deterministic browser fixtures separate from unmocked provider captures; do not persist fictional campaigns into hosted DB.
