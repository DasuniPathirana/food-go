# Neighbourhood guide UI refresh

14 November 2026. The owner requested a more pleasant, distinctive, researched interface and confirmed that the intended audience is all ages. This delivery refreshes the browser UI while retaining the light theme, approved interactive map, social walls, game progression and optional avatars. It does not establish production readiness or guarantee client preference.

## Delivered experience

- A horizontal desktop masthead replaces the large sidebar and daily promotion, giving Explore more room. The original fork/map-pin brand, labelled navigation and compact XP controls anchor the page. Phone navigation retains Explore in the centre, Feed prominently and Passport as the identity/progress destination.
- A fresh white canvas, dark ink, tomato actions and butter-yellow XP replace the repeated cream containers. Bricolage Grotesque supplies concise headings; Source Sans 3 carries reading, forms and controls. Both fonts are self-hosted with their OFL licences.
- Feed uses a short Community heading, inline wall controls, a smaller composer and an open story stream. Food photography and people appear sooner. Existing publishing, audience, reaction, comment, sharing, reporting and blocking behaviour is retained.
- Food trails pair a photograph with their route and progress, stacking on phones. FoodDex and VenueDex use larger photos, captions and dividers. Counts use the available width rather than reserving a vacant fourth column.
- Passport starts with a deep-green identity cover, chosen avatar and progression, followed by the optional wardrobe, statistics, milestones and activity. The 3D/anime choices and preview/apply semantics remain available.
- The illustrated scene, buildings, photo pins, explorer, radar, pan/zoom and walking remain. Optional shop, walking and avatar panels disclose below the scene. One Garden Arcade marker opens three shops grouped by ground floor and level 1, with unit numbers.
- Footer links keep the connected catalogue, help and privacy reachable from the demo.

The standalone `prototype` was not edited. Shared browser colour/type tokens also update connected screens, but this milestone's detailed layout review covers the browser demo. The Expo application has not received this complete redesign.

## Research and design judgement

The [research record](../research/10-distinctive-ui-research.md) distinguishes primary-source observations from Food Go decisions. It examines [COLLINS' historical Sweetgreen case](https://wearecollins.com/case-studies/sweetgreen/), [Pentagram's Shake Shack identity](https://www.pentagram.com/work/shake-shack), [Beli's own product overview](https://beliapp.com/), [Duolingo's core-tab redesign](https://blog.duolingo.com/core-tabs-redesign/) and [Bricolage Grotesque's author](https://github.com/ateliertriay/bricolage). These are precedents for specific identity, hierarchy and content decisions, not proof that a visual treatment will satisfy every user.

The [direction contract](../design/10-neighbourhood-guide.md) records the neighbourhood-guide approach and alternatives considered. The implementation gives each destination its own useful composition within a shared type, colour and navigation system. Existing credited photography and original vector artwork provide the content; no new generated raster or external character asset was introduced. See [asset provenance](../assets.md).

Measured contrast pairs: ink/canvas 15.23:1, muted/canvas 6.05:1, white/tomato 5.29:1, ink/yellow 10.10:1 and white/Passport green 11.69:1. These describe the named pairs, not a complete pixel-level accessibility audit.

## Verification

| Check | Result and scope |
| --- | --- |
| Workspace types and behaviour tests | `npm run check`: all workspace type checks and 94 tests passed during this milestone. |
| Repository security checks | `npm run test:security`: 8 passed. |
| Final production build | `npm run build:web`: completed successfully after the correction batch. |
| Final local HTTP checks | `npm run check:web`: 203 assertions passed against the rebuilt server. |
| Source consistency | `git diff --check` passed; demo CSS class coverage was checked. No database migration, Auth rule or game-award rule changed in this refresh. |
| Desktop/phone layout | Paired Chromium views at 1280x720 and 390x844 across Explore, Feed, trails and Passport; FoodDex and avatar options also inspected. The compact header fitted 320px without horizontal overflow. |
| Social/reward behaviour | Daily boost +25, public example story +25, like +2 and comment +5 produced the expected 377 XP from 320; the Passport activity log showed the matching events. The published text/comment were visible. |
| Avatar behaviour | Actual Foodie 3D preview and Wave were exercised; cancelling retained Original explorer. Earlier [Milestone 09](09-avatar-options.md) documents the full choice/apply/persistence and rendering checks. |
| Map disclosures and controls | Final phone check opened all three mall shops below the scene with its 790px height unchanged, then used zoom and walking controls. Panels could collapse again. |
| Browser errors | The final review tab reported no console warnings or errors. |

One initial paired review identified the trail metadata position, a missing Passport wrapper class, three-item stats spacing, footer access and compact header targets. One grouped correction pass addressed them, followed by the final confirmation. An independent visual reviewer judged the result a clear improvement, with no additional material visual defects in the supplied captures. Interaction verification was completed by the implementing agent; a second independent interaction review did not complete.

Disposable local QA activity was reset to Alex, 320 example XP and empty game collections. The original explorer and idle motion on remain selected. No live public post, email or SMS was sent. The final Explore tab was retained, and temporary viewport overrides were reset.

## Final screenshots

| Destination | Desktop | Phone |
| --- | --- | --- |
| Explore | [View](../screenshots/10-explore-desktop.jpg) | [View](../screenshots/10-explore-mobile.jpg) |
| Feed | [View](../screenshots/10-feed-desktop.jpg) | [View](../screenshots/10-feed-mobile.jpg) |
| Food trails | [View](../screenshots/10-trails-desktop.jpg) | [View](../screenshots/10-trails-mobile.jpg) |
| Passport | [View](../screenshots/10-passport-desktop.jpg) | [View](../screenshots/10-passport-mobile.jpg) |
| FoodDex | [View](../screenshots/10-food-dex-desktop.jpg) | Phone layout inspected during the paired review |
| Avatar options | [Initial review](../screenshots/10-avatar-desktop.jpg) | [Initial review](../screenshots/10-avatar-mobile.jpg) |

## Demo and release boundary

Open `http://127.0.0.1:3000/demo/explore` on the development computer. The local production server uses `npm run start --workspace @food-go/web` after `npm run build:web`. The demo is persistent browser-only fictional activity; its visits, XP and audience figures are not verified account progression or redeemable rewards.

The loopback URL cannot be opened from another phone or computer. A shareable HTTPS deployment and checks on the actual presentation devices remain required. Physical handset GPU performance, Safari and an operating-system reduced-motion toggle were not tested in this milestone. Source pause/reduced-motion paths and illustrated WebGL fallbacks remain implemented.

For real users, the owner still needs hosting/domain decisions, a production Supabase environment, Brevo verified sender/SMTP, Mobile Message sender/account configuration and a controlled Australian test phone, approved venue/content records, and moderation/support ownership. Keep secrets in provider dashboards or ignored environment files. Account and SMS production gates remain closed until controlled delivery and release checks pass. The full [go-live checklist](../launch/go-live-checklist.md) separates owner inputs from engineering work; credentials alone do not complete launch.
