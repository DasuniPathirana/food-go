# Bright Food Go community

Date: 13 November 2026.

The client's corrected direction is a light interface with bright colours, bold readable fonts and a social food experience. This supersedes the dark interpretation in Milestone 06. The user confirmed that Explore remains the first screen, with a prominent Feed tab and a personal wall in Passport.

## Delivered experience

The website uses white and pale green surfaces, lime actions, sunny yellow and coral accents, readable green text and the self-hosted Outfit variable font. The original bright map artwork, dimensional markers, explorer, animation, pan, zoom and expandable panels remain intact. The standalone prototype is unchanged.

The five website navigation items are Feed, FoodDex, Explore, VenueDex and Passport. Food trails remain accessible from Explore and the community sidebar. Passport links to the user's personal wall.

`/feed` reads the connected community. It has public, personal and author walls, text posts, explicit Public or Only me visibility, likes, inline comments, sharing to a wall, copyable permalinks, own-post removal, reports and blocking. Public submissions and replies require moderation before other people can see them. Pending and private posts remain on the author's own wall. Feed and comment history use bounded keyset pagination.

`/feed-preview` is a separate interactive demonstration. Its people, photographs, stories and engagement counts are fictional. Posts, reactions, replies, shares, reports and blocks stay in the browser's isolated example store. Reset restores the sample feed. It never writes a public post or silently replaces an empty connected feed.

The phone layout keeps the heading compact and puts the composer and story stream ahead of supporting content. Selected map details and mall directories still expand below the canvas. Bright colours retain dark text and visible green keyboard focus.

## Supabase implementation

Migration `20261113105638_food_go_community.sql` is installed in the owner-confirmed Food go development project. Eight private RLS-enabled tables store public author aliases, posts, comments, likes, shares, reports, blocks and retry records. Client table access is revoked; narrow checked functions provide presentation reads and verified-account writes. Public author UUIDs are separate from authentication IDs; email addresses and phone numbers are excluded from the feed.

New public content stays pending. The application cannot approve its own content, change another author, delete another author's post or write through an anonymous account. Post/comment retry keys prevent duplicates, including unchanged retries after a posting cap is reached. Mutual blocks apply to posts, comments, counts, direct links and reshares on blocked walls. Reports remain private.

The local community read flag is enabled. Account and messaging gates remain closed, so public posting has not been opened. No real community users, posts or moderation actions were created during this work.

## Verification

| Check | Observed result |
| --- | --- |
| Workspace types and automated tests | Web/native types and all 80 tests passed |
| Static security conventions | 8 checks passed |
| Production website build | Passed after the phone-feed correction |
| Production HTTP checks | 163 assertions passed, including community routes, invalid queries, no-cache reads and closed write gates |
| Community database assertions | 46 passed before installation in a rollback-only candidate transaction; the same 46 passed against the installed schema |
| Existing database regressions | 27 tenant and 29 partner assertions passed after installation; all fixtures rolled back |
| Fixture cleanup | Final account, venue and all eight community table counts were zero; temporary pgTAP was absent |
| Connected public read | Actual API returned HTTP 200, ready, zero posts and no viewer identity |
| Browser interactions | Preview public posting, likes, replies, share-to-wall, copy link, one-post permalink, private-post separation, reporting, blocking and reset were exercised |
| Visual review | Primary-agent desktop and phone review; the phone header/composer was compacted after the first inspection. At 390 by 844, the first post moved from about 799px to 638px and no horizontal page overflow was present. Native device rendering was not inspected |

The database advisor reports nine private tables with RLS and no client policies, one intentionally anonymous presentation function, and three authenticated privileged functions including the existing partner function. These notices reflect the chosen deny-direct-access design and privileged entry points. Their caller checks, output fields and visibility rules were reviewed and tested; this is not a claim of a clean advisor report or an independent security audit.

Captures: [desktop feed](../screenshots/07-feed-desktop.jpg), [phone feed](../screenshots/07-feed-mobile.jpg), [bright desktop Explore](../screenshots/07-explore-desktop.jpg) and [bright phone Explore](../screenshots/07-explore-mobile.jpg).

## Remaining release work

Live account/provider activation, an operator moderation console with auditable decisions, account lifecycle controls, distributed abuse protection and controlled signed-in browser testing remain release requirements. Moderation can currently be performed only by an authorised database operator; the application exposes no approval control.

New posts are text-only. Personal photo/video uploads, editing published posts, following, notifications and direct messages are not delivered. The native palette is updated, but the new Feed and wall journeys have not been ported or tested on physical devices. Brevo remains deferred; SMS remains for sign-in codes. Geographic map data, live mall membership, verified visits and rewards remain separate work.
