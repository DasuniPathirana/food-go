# Map fit, inline walking and external maps

14 November 2026. The owner reported that Explore's map extended beyond the visible browser section and that opening Walk created another large section. They requested a complete visible scene, compact walking icons on the map and external navigation for selected places.

## Changes

- The scene now uses the available viewport height after the actual page header, banner and phone navigation. Removed the fixed 780–875px immersive heights and overlay-dependent minimum heights. Marker spacing and search/trail composition adapt with the scene, rather than merely cropping the old canvas.
- A persistent four-arrow pad replaces the Walk disclosure. Arrows are small, with 44px targets. Keyboard walking, drag, zoom, reset, touch-drag mode, motion pause and optional avatars remain available.
- Standard phones place view controls and movement at opposite lower corners. Narrow, short phones expose filters and view controls through compact optional popovers. Escape dismisses them; closing view tools restores focus. Walking remains visible.
- Selecting a demo place replaces the existing trail shortcut with an explicitly labelled real-area Google Maps link. Full selected-stop actions and Apple Maps remain below the scene. Removed the duplicate default selection panel from the unified demo, so selecting a pin does not automatically scroll to another detail section.
- Garden Arcade still groups three shops by floor and unit. Opening its directory does not resize the map. Each shop's detail page provides external map access.

Exact published directions still require a complete genuine address. Fictional venues open a real area search, using only suburb/state, never an invented street address or illustrated coordinates. Finch & Field opens Fitzroy; Ciao, Carlton opens Carlton; Small Hours opens Melbourne CBD. The three invented Garden Arcade shops explicitly open Melbourne. Links use fixed HTTPS provider hosts, encoded query parameters, a new tab and `noopener noreferrer`. No user origin or GPS is supplied.

Provider URL contracts were checked against the official [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started) and [Apple unified Maps URLs](https://developer.apple.com/documentation/mapkit/unified-map-urls) documentation. No provider API key or third-party map engine was added.

## Verification

`npm run check` passed all workspace types and **97 behaviour tests**, including six directions tests. Three new tests cover demo area searches, all three mall-shop fallbacks, validation and parameter/host boundaries. The final production build passed. The final rebuilt server passed **203 local HTTP assertions**. `git diff --check` passed, and the layout detector reported no findings.

Browser confirmation used Chromium viewport overrides:

| View | Measured map position | Result |
| --- | --- | --- |
| Desktop 1280×570 | Top 142.7px, bottom 557.7px, height 415px | All map edges fit the visible section. |
| Phone 390×844 | Top 126.7px, bottom 751.7px, height 625px | Entire scene above the navigation starting at 774.3px. |
| Landscape 844×390 | Top 118.7px, bottom 377.7px, height 259px | Complete scene and compact controls fit. |
| Short phone 320×568 | Top 126.7px, bottom 475.7px, height 349px | Entire scene above navigation starting at 498.3px; marker plane remains nonzero at 112.7px. |

No document horizontal overflow occurred in those views. The narrow 320×740 view was also inspected during the first review. Independent source review identified the short-phone height conflict; the compact HUD/tools correction addressed it before final confirmation.

A direct pointer click moved the explorer from 58% to 54% horizontally with page scroll remaining at 0. The walking arrows do not open a section. Zoom worked in the short-phone tools popup; Escape closed it and restored focus. The filters popup opened and dismissed. Selecting Finch & Field exposed the map-header shortcut; clicking it opened a new tab at Google's Fitzroy area search URL. Cloud Patisserie displayed both external area links pointing at Melbourne. The mall directory retained the 625px scene height while open. Final browser logs contained no warnings or errors.

The original explorer and 320 example XP remain. No visit, dish, reward, account, public post or database record was changed. The original `prototype` folder remains unchanged. The final review tab was retained and temporary viewport overrides were reset.

## Screenshots and limits

- [Phone with selected-place Maps shortcut](../screenshots/11-map-portrait.jpg)
- [Landscape with complete map and walking pad](../screenshots/11-map-landscape.jpg)
- [Short phone with compact controls](../screenshots/11-map-small-phone.jpg)

Open the local demo at `http://127.0.0.1:3000/demo`. Real handset/Safari testing remains outstanding. The illustrated neighbourhood remains a fictional playground rather than a licensed geographic map; arbitrary illustration points have no genuine navigation coordinates. Real published addresses retain exact directions. Account, SMS and public-launch gates are unchanged; see the [go-live checklist](../launch/go-live-checklist.md).
