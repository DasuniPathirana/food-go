# Geographic game viewport and camera foundation

17 November 2026. Implements the first vertical slice of the attached game transformation brief and extends the existing camera foundation. The full seven-slice transformation is not complete.

## Delivered behaviour

Explore now opens on a real geographic overview, reaching both page edges and filling the height between search and mobile navigation. On the measured 390 × 844 browser, the scene is 390 × 653 pixels, compared with approximately 374 × 543 pixels before the change. The map no longer spends its first screen on two toolbar rows and an empty selected-place panel. Real selection details, route controls, mall shops and customisation remain below the scene. Feed, Quests, Explore, Deals, Outback and secondary Passport/collections retain their routes.

Layer controls open on demand. A low-detail setting reduces map pixel ratio to 1 and hides building extrusions; normal mode caps pixel ratio at 2. This reduces work but is not a measured battery or FPS guarantee. The geographic fallback and provider attribution remain available.

One compact explorer portrait replaces the separate GPS, avatar and recenter controls. Tap requests location when necessary, recentres and resumes following. Repeated taps on an active watch do not stop or duplicate it. A 520 ms hold opens a compact preview/apply wardrobe below the map, without requesting GPS. Moving more than 8 pixels cancels the hold. Enter locates; Shift+Enter or the context menu customises. Closing or applying restores focus and the previous page position. The existing cosmetic browser preference persists.

Raw device coordinates/accuracy remain separate from the stabilised cosmetic explorer. Fixes older than 15 seconds, more than 3 seconds into the future, worse than 35 metres or implying a sudden implausible jump do not move it. An uncertainty deadband holds stationary wobble; genuine accumulated steps ease toward the new position. A fresh fix can reacquire after a 30-second interruption without awarding distance for that gap. The accuracy circle describes the raw fix, and weak-signal feedback explains the held character. Heading/gait still use the existing movement classifier. Hiding/leaving Explore clears the foreground watch and ignores late callbacks. None of these client signals proves a visit or grants XP.

The camera control provides overhead, third-person follow, close third person and a 1.7 m eye view. Follow uses a camera 14 m behind and 4.8 m above the explorer; close uses 8 m / 3.2 m. Profile changes blend geographic position, zoom, pitch and shortest-arc heading over 650 ms, with immediate changes under reduced motion. The same geographic canvas stays mounted, including expansion. Old first-person browser preferences migrate; new browsers start overhead. Eye view no longer shows a floating rear-head overlay. The existing procedural avatar and its gestures remain in other views.

The new material pass uses a coherent daylight range of limestone, sandstone, sage, green parkland and blue water. Game heights preserve source relationships with `2 + 0.62 × height`; normal source heights restore in Streets. No geographic feature or fictional venue was added to decorate the scene.

## Defect found by actual rendering

Follow/close captures initially showed a large flat roof across the street. The worldwide building layer used `not within(local survey)` to avoid duplicating Melbourne's survey. The installed style engine only evaluates `within` for point and line features, so polygon buildings were never excluded. A polygon-distance filter now removes world roofs intersecting the local survey. The regression test evaluates actual tile-coordinate polygons inside, crossing and outside coverage. This fixes duplicate geometry; it does not establish general building collision or indoor navigation.

## Architecture and changed files

The existing MapLibre / Leaflet, Next.js, Supabase and verified-progression architecture is retained. No dependency, hosted migration, credential or production account gate was changed. Existing unrelated working-tree edits were preserved. The standalone prototype was inspected in source and running form and remains unchanged.

- `geographic-explore.tsx` / CSS own the HUD, contextual panels and parent map state.
- `explorer-control.tsx` / CSS own portrait pointer and keyboard gestures.
- `use-explorer-location.ts` and `explorer-location-filter.ts` separate raw fixes from cosmetic positions; motion telemetry remains in its existing helper.
- `explorer-camera.ts` owns profiles, pose normalisation, interpolation and limits. `atlas-canvas.tsx` applies those profiles without swapping the map instance.
- Map frame, player, compact wardrobe and fallback styles preserve safe targets and attribution clearance.
- `world-map-style.ts` owns reversible materials and the geographic building mask.
- Camera/location/style unit tests, `tests/e2e/explore.spec.ts`, `scripts/verify-web.mjs` and `scripts/capture-game-map.mjs` provide repeatable checks.
- The root audit, gap analysis, implementation plan and asset requirements record the complete requested scope; PRODUCT and DESIGN record the current connected direction.

## Verification

| Check | Result |
| --- | --- |
| Baseline `npm run check` | PASS: web/native types and 181 tests before edits |
| Final `npm run check` | PASS: web/native types and 187 tests |
| `npm run test:security` | PASS: 10 static convention checks |
| Production build | PASS through Playwright's production web-server command |
| `npm run test:e2e` | PASS: 20 tests on desktop Chromium and Pixel 7 browser emulation; permission denial, unavailable/timeout, weak GPS, hidden-page cleanup, hold/drag/keyboard, cosmetic persistence, camera selection, layout and navigation |
| Production HTTP regression | PASS: `FOOD_GO_CHECK_ORIGIN=http://127.0.0.1:3200 node scripts/verify-web.mjs`, 167 assertions with external account/provider gates disabled |
| Real geographic browser captures | PASS on Chromium 159.0.8154.6 at 1280 × 900 and touch-emulated 390 × 844; all camera choices retained the map canvas; no horizontal overflow or runtime exceptions |
| Normal-motion transition | PASS: actual production renderer emitted intermediate pitches between 44° and 84° and settled at 84°. This event trace is not an FPS measurement. |
| Actual context loss / retry | PASS in both captured viewports, using the real WebGL context-loss extension and interactive Leaflet fallback |
| Lint | NOT RUN: repository has no dedicated lint command/configuration |
| Physical GPS, orientation, native camera/AR and mobile performance | NOT RUN: no physical-device/native acceptance performed |

Deterministic browser tests block external providers and use explicit geolocation fixtures. They validate controls, permission/error handling and cleanup, not real-world movement accuracy. Real-map captures separately exercise actual provider geography and renderer recovery. The provider style reports missing optional POI sprite warnings in development; no runtime exception was observed. The configured local catalogue was unavailable during captures, so no live restaurant or reward flow is represented in those images.

[Machine-readable browser evidence](../screenshots/23-browser-evidence.json) · [Transition evidence](../screenshots/23-transition-evidence.json) · [Before desktop](../screenshots/23-before-desktop.png) · [After desktop](../screenshots/23-after-desktop.png) · [Before phone](../screenshots/23-before-phone.png) · [After phone](../screenshots/23-after-phone.png) · [Follow](../screenshots/23-camera-third-phone.png) · [Close](../screenshots/23-camera-close-phone.png) · [Eye view](../screenshots/23-camera-first-phone.png) · [Compact wardrobe](../screenshots/23-wardrobe-phone.png) · [2D recovery](../screenshots/23-fallback-phone.png).

## Remaining work

Slice 1's map/HUD/location foundation is delivered. Production rigged GLB art, authored animation clips/crossfades, shared-world avatar rendering/scale/contact shadows and general collision handling are not delivered. Camera profiles are a foundation, not a completed first-person game controller: ordinary map gestures detach geographic browsing; fixed-eye touch/mouse look and permission-aware device orientation remain work. No native parity, spatial-cell persistence/fog, encounter/loot inventory, rarity/reward RPC extension or spatial AR has been added. Existing server-verified collections, quests, XP, community and Outback continue to own their established behaviour.

The next asset and backend work is explicitly detailed in [ASSET_REQUIREMENTS](../../ASSET_REQUIREMENTS.md), [GAMEPLAY_GAP_ANALYSIS](../../GAMEPLAY_GAP_ANALYSIS.md) and [IMPLEMENTATION_PLAN](../../IMPLEMENTATION_PLAN.md). The current procedural characters must not be presented as finished premium assets. These changes are local and uncommitted; no public deployment or production-readiness claim is made.
