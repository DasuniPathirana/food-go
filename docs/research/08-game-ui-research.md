# Food Go daylight game interface research

Research and implementation decision: 13 November 2026.

The client wants saturated, confident colours on LIGHT surfaces, bold readable typography and a food exploration game with a social wall. They approved the original illustrated map, dimensional buildings, photo markers, explorer, radar and movement. The superseded dark palette and subsequent pale green/Outfit treatment do not meet this latest brief.

This is a reasoned design recommendation for Food Go, not a claim that one palette or typeface is universally the best. Product-specific choices below are labelled as decisions or inferences. No referenced brand's logo, characters, art, proprietary font or interface assets are reused.

## What the existing screens reveal

The reviewed mobile captures are `docs/screenshots/07-explore-mobile.jpg` and `docs/screenshots/07-feed-mobile.jpg`. The source references are `PRODUCT.md`, `DESIGN.md`, `docs/design/prototype-reference.md`, `prototype/styles.css` and `prototype/map.js`.

Explore has the right illustrated world, but the heading, search, location, category and toolbar rows make its first impression resemble a directory. The feed has familiar social controls but does not show an immediate relationship to discovery, collection or progress. Changing green to another accent alone would not supply the game loop. This is our assessment of the captures, not a user study.

Decision: retain the approved art and interactions; make progress visible and secondary tools expandable. Explore is the first destination and centre navigation item. Feed is prominent, Passport contains the personal wall, and food trails remain reachable from Explore.

## Primary-source findings and Food Go implications

| Official source | What the source establishes | Food Go decision or inference |
| --- | --- | --- |
| [Pokémon GO Map View](https://scopelyexplore.helpshift.com/hc/en/5-pokemon-go/faq/1084-what-is-the-map-view/) | The map is the principal world surface. Tasks, nearby encounters and the trainer profile have contextual entries; some controls appear only when relevant. | Inference: the illustrated neighbourhood should dominate Explore. Use a concise player/progress HUD and deliberate entries to quests, nearby places and tools. Do not make every secondary option permanently compete with the scene. Food Go's illustration is explicitly not GPS or proof of a visit. |
| [Pokémon GO trainer profile and progress](https://scopelyexplore.helpshift.com/hc/en/5-pokemon-go/faq/1087-viewing-your-trainer-profile-progress/) | The profile shows current level, next-level progress, tasks, activity history, lifetime activity and medals. | Inference: a compact level/XP summary belongs near Explore; Passport should explain progress through a journal, collected food and badges, with requirements visible before completion. |
| [Pokémon GO friendship points](https://pokemongo.com/news/pgo-remote-trade-2025) | Eligible interactions contribute at most one daily friendship point per friend; weekly challenges provide additional progression. | Inference: social progress should recognise meaningful, bounded interactions. Repeated toggles and self-engagement must not mint XP. This is inspiration for limits, not a claim that Food Go should copy Pokémon GO's reward schedule. |
| [Duolingo core tab redesign](https://blog.duolingo.com/core-tabs-redesign/) | Duolingo describes inconsistent heading sizes, type hierarchy and spacing as a cohesion problem. Its team explored several directions and then reduced type styles, used purposeful whitespace and varied header size by purpose. | Decision: shared type, navigation and progress language across Food Go. Explore stays map-led, Feed post-led and Passport collection-led. Large decorative headers on every tab would consume useful space without explaining progress. |
| [Duolingo streak and habit research](https://blog.duolingo.com/how-duolingo-streak-builds-habit/) | Duolingo describes clear daily progress, milestone celebrations and flexibility after missed days. It also acknowledges that losing a streak can demotivate people. | Inference: show immediate, short feedback after a meaningful action and larger feedback at a milestone. Keep earned XP after a missed day. Food Go has not run an experiment establishing the same retention effects. |
| [Beli's official product overview](https://beliapp.com/) | Beli connects lists/maps of places visited or wanted, friends' restaurant experiences and discovery. | Inference: Food Go posts should connect back to places, dishes, collections or trails when those records exist. A generic social stream detached from food exploration would weaken its purpose. |
| [W3C text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) | WCAG 2.2 AA normal text requires at least 4.5:1 contrast; qualifying large text requires 3:1. | Decision: bright fills carry dark labels. Bright colours do not justify faint body text or white copy on an insufficiently dark accent. |
| [W3C target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | WCAG 2.2 AA defines a 24 by 24 CSS pixel minimum with exceptions; the enhanced criterion uses 44 by 44. | Decision: Food Go uses at least 44px standalone controls and comfortable spacing. Dense map locations also have equivalent selectable directory entries. Do not misstate 44px as the AA minimum. |
| [W3C animation from interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) | This enhanced criterion allows people to disable non-essential interaction motion. | Decision: honour reduced motion, preserve the map's pause control and keep feedback understandable without movement. |

Sources were accessed on 13 November 2026. The Pokémon GO help pages now redirect from older Niantic URLs to the current official Scopely Explore help centre.

## Chosen direction: daylight adventure

The interface uses warm white, blue ink and strong food colours. Rounded, bold short headings establish the playful voice; ordinary copy remains easy to scan. Depth is strongest in the approved map. Controls use small offset, softly blurred shadows rather than unrelated halos or rigid block shadows.

| Role | Token | Use and verified text pairing |
| --- | --- | --- |
| Canvas | `#FFF8EE` | Warm light background. Blue ink is 12.00:1 against it. |
| Surface | `#FFFFFF` | Feed posts, panels and form controls. Blue ink is 12.65:1. |
| Ink | `#20344D` | Main text, strong navigation and selected filters. |
| Muted | `#526477` | Supporting copy. 5.78:1 on the warm canvas. |
| Action coral | `#FF7B5C` | Primary actions and the central Explore anchor. Blue ink is 4.96:1. |
| Deep tomato | `#CC3D2C` | Active social reactions and small strong food accents. White is 4.92:1 when a filled treatment is needed. |
| XP gold | `#FFC642` | XP, progression and collectible milestones. Blue ink is 8.08:1. |
| Turquoise | `#28BDB0` | Completed/supporting game state. Blue ink is 5.42:1. |
| Link/focus blue | `#1B61DB` | Links and visible keyboard focus. 5.27:1 on the warm canvas. |

Ratios above were calculated from the exact sRGB hex pairs using WCAG relative luminance. They verify these pairs, not every final component or image background. Bright coral and gold must not carry normal-size white labels. Colour is accompanied by text, an icon or an appropriate selected/expanded state.

The shared CSS exposes `--font-display` and `--font-body`. Fredoka at weight 600 is reserved for short headings, level numbers and the brand voice. Nunito Sans at 400, 600 and 800 carries body copy, controls and supporting information. Posts use 16px body text with a 1.65 line height; narrow screens retain readable action labels. Type tracking stays above -0.04em. Long prose is kept to a readable measure; map labels and HUD labels are deliberately compact.

The official Google Fonts repository identifies both families as SIL Open Font License fonts: [Fredoka metadata](https://raw.githubusercontent.com/google/fonts/main/ofl/fredoka/METADATA.pb), [Nunito Sans metadata](https://raw.githubusercontent.com/google/fonts/main/ofl/nunitosans/METADATA.pb). Food Go serves the downloaded variable font binaries from its own `/fonts` directory. Their separate licence files are retained alongside the assets. The browser does not fetch fonts from Google at runtime. The project still retains older font assets and their licence for provenance.

### Two materially different alternatives considered

| Direction | Visual model | Reason it was not selected for this delivery |
| --- | --- | --- |
| Arcade field club | Cool white, cobalt primary, coral/gold secondary, Sora headings and Nunito Sans body. Squarer panels, denser mission scoreboard and competition-oriented progress. | A good fit for a more competitive product, but it makes the approved organic map and friendly food community feel more technical. Sora's [official metadata](https://raw.githubusercontent.com/google/fonts/main/ofl/sora/METADATA.pb) confirms an OFL variable family. |
| Food passport studio | Warm white, deep tomato, aqua accents, Bricolage Grotesque headings and DM Sans body. Food photography, collectible stamps and editorial personal walls dominate. | A strong adult food brand option, but it expresses a quieter collecting experience. The client explicitly asks for a fuller game feeling. [Bricolage Grotesque](https://raw.githubusercontent.com/google/fonts/main/ofl/bricolagegrotesque/METADATA.pb) and [DM Sans](https://raw.githubusercontent.com/google/fonts/main/ofl/dmsans/METADATA.pb) are available as OFL variable families. |

No alternative is an evidence-based universal winner. The chosen direction follows the client's current brief and limits visual change to an implementable system before the demo.

## First-screen and feedback contract

1. Compact brand/player row, level and next-level XP progress. Explain preview progress where the experience is local.
2. One concise active challenge or next action. Detailed requirements expand deliberately.
3. Compact search and filters, followed immediately by the large illustrated neighbourhood. Keep existing pan, zoom, movement, photo markers, radar, pause and reduced-motion behaviour.
4. Selected place, mall directory, recommendations and walking controls expand below the canvas. A mall has one explicit building marker with its shop count; floor/unit entries remain individually selectable.
5. Mobile navigation: Feed, FoodDex, Explore, VenueDex, Passport. Explore remains centre and the first screen. Trail access remains available from Explore.

The feed gives priority to a concise composer and the post stream. Author, visibility and moderation state remain truthful; likes, comments, sharing, reporting and blocking keep their existing meaning. Passport explains the player's history and personal wall. A button's label states its action rather than an implementation detail.

A small XP receipt and progress-bar change communicate ordinary rewards. A short, dismissible milestone treatment can celebrate a level or badge. Do not block repeated actions behind full-screen effects. Reduced motion uses the same receipt without spatial animation. Avoid placing the XP feedback over a map marker or the primary scene.

## XP and signed-in reach policy

The owner confirmed reach means unique SIGNED-IN viewers. The recommendations below describe the intended trustworthy loop; the installed migration, tests and release notes remain the authority for delivered amounts and limits.

- Reward approved public food contributions and real completion events, with explicit daily limits. Pending/private/rejected content must not appear as an approved public contribution.
- Record XP on the server using stable event identities and a deduplicated ledger. Refresh, retry, delete/recreate and repeated like toggles must not mint rewards.
- Exclude self-engagement. Each eligible other account contributes once to a post's reach. Anonymous impressions and the author's own view do not earn reach XP.
- Count a view only after a defined visible-view condition and server acceptance. Display the definition of qualified reach; a browser scroll event alone is not evidence of a distinct person.
- Use bounded unique-account milestones for reach rewards. A raw impression counter must not become an uncapped XP tap. Apply account, content and abuse checks; a signed-in account is a useful boundary, not a guarantee that the account is a distinct human.
- Keep local demonstration XP isolated and labelled. It is not a verified visit, a redeemable reward or connected account progress.

These anti-farm rules are Food Go design and engineering decisions, informed by the bounded-interaction pattern in the official friendship-points source. The numerical reward schedule requires product judgement and observation after launch; the research does not establish one correct schedule.

## Real-world navigation

[Google's official Maps URLs guide](https://developers.google.com/maps/documentation/urls/get-started) documents cross-platform HTTPS links that open the installed Google Maps app or browser fallback. They require `api=1` but no Google API key. A directions URL can use a real destination address or coordinates and a known Place ID. Leaving origin unspecified lets the maps application handle its own current-location flow.

Food Go's decision is to offer deliberate navigation from an expanded, published venue record. Fictional illustration percentages and fictional mall addresses never become real directions. The artwork remains an exploration scene while the selected maps application handles actual navigation.

## Provider requirements still belonging to the owner

These primary references support the go-live checklist; this UI delivery does not claim those accounts are configured or tested.

| Service | Evidence and owner input |
| --- | --- |
| Brevo | Select the final sender name, sender email and owned sending domain. Complete domain authentication with the actual DNS records in [Brevo's official domain guide](https://help.brevo.com/hc/en-us/articles/12163873383186-Authenticate-your-domain-with-Brevo-Brevo-code-DKIM-DMARC). The owner deferred this configuration. Credentials belong in the provider/Supabase dashboard or an ignored environment file. |
| Supabase email | [Custom SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp) says the built-in service is not for production and restricts delivery to authorised team addresses. Configure the chosen provider, live site URL and redirect allowlist, then test sign-up, confirmation and recovery before opening account gates. |
| Mobile Message | The provider's official site is `mobilemessage.com.au`. Its [API documentation](https://mobilemessage.com.au/api-documentation) requires an API username/password and an approved sender. Custom alphanumeric senders have a documented approval flow and status. Supply the approved sender and account credentials securely and test delivery to an owner-controlled Australian phone. |
| Supabase SMS | [Send SMS Hook documentation](https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook) documents using a custom provider for authentication codes. Keep provider calls on the server, configure hook signing secrets, and test valid, invalid, expired and repeated codes. SMS remains for sign-in codes, as instructed. |

Before a public launch, also complete the repository's account, moderation, abuse-control, deployment and data requirements. The UI research does not replace those release checks or a real signed-in browser journey. A successful local browser demonstration is a separate milestone from public production readiness.

## Implementation verification

The CSS implementation uses the installed Next.js CSS and font documentation. Shared styles remain in `globals.css`; component-specific rules remain in CSS Modules. The original standalone prototype is unchanged. No additional runtime dependency or paid asset is required.

After these CSS changes, the web TypeScript check and the scoped `git diff --check` both passed. Production build, final phone/desktop screenshots and interactive demo checks are recorded separately by the main delivery task after the combined feature changes are complete.
