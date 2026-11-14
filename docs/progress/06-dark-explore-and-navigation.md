# Dark Explore, expandable panels and venue directions

Date: 13 November 2026.

The client's latest feedback supersedes the previous light palette. The requested direction is a bold dark food brand with strong highlights and an exploration game feel, while retaining Food Go's own dimensional neighbourhood, character and animation.

## Delivered

- Dark forest and charcoal surfaces, cream text and yellow highlights across the website and both native modes. The original prototype source and artwork files remain intact. The website applies a dark treatment to the existing neighbourhood artwork.
- Explore is the third, centre item in the five-item navigation. Profile is labelled Passport; existing account routes and internal identifiers still work.
- Recommendations and walking controls start collapsed. They expand below the canvas, along with selected-venue details and mall directories. Opening or closing a panel preserves map pan, zoom and canvas height. Keyboard Escape closes a panel and returns focus to its opener.
- The phone heading and category row are compact so the map has more room. Map view controls remain accessible; ordinary page scrolling and the opt-in touch-drag mode remain separate.
- Garden Arcade demonstrates three distinct fictional shops sharing one building marker. The marker shows the matching shop count; its directory groups shops by floor and lists unit numbers. Each shop has its own working example detail page. Search and category filters preserve the explicit building relationship.
- Published venues with a complete Australian address offer Google Maps and Apple Maps links on their detail page. These deliberate links need no SDK key or Food Go location permission. Fictional and incomplete addresses cannot become navigation destinations.

The updated product and visual rules live in [PRODUCT.md](../../PRODUCT.md), [DESIGN.md](../../DESIGN.md), its machine-readable sidecar and the root project instructions.

## Verification

| Check | Result |
| --- | --- |
| Web and native TypeScript | Passed |
| Automated application and runner tests | 69 passed, including mall grouping, filtering, fictional-position boundaries and encoded directions URLs |
| Production web build | Passed after the phone-layout correction |
| Production HTTP checks | 145 passed, including all three mall shop detail routes |
| Browser interaction | Expanded recommendations retained scale 1.15 and the 780px desktop canvas; dragging produced a 60px/30px pan; walking moved the preview explorer; Pause stopped all three food animations; selected venue and mall panels rendered below the canvas; closing restored focus |
| Phone layout | 390 by 844 viewport: content and scroll widths both 375px. Compact overlay measured 251px, reduced from 382px; venue and mall marker boxes no longer overlapped |
| Keyboard focus | Recommendation save control used the gold focus ring, verified from computed style after keyboard navigation |
| Fictional directions | Example shop detail loaded successfully and showed the unavailable explanation; zero Google or Apple Maps navigation links |

The independent review identified phone header density, a selected-callout collision and a low-contrast recommendation focus ring. Those corrections were implemented together. The reviewer scored all three findings resolved from the replacement captures and source, and confirmed that the venue and mall markers are visibly separate on the phone. This verdict covers those reviewed findings, not native-device or production readiness.

Captures: [desktop Explore](../screenshots/06-explore-dark-desktop.jpg), [phone Explore](../screenshots/06-explore-dark-mobile-top.jpg), [phone mall directory](../screenshots/06-mall-directory-mobile.jpg) and [desktop mall directory](../screenshots/06-mall-directory-desktop.jpg).

## Scope and limits

The mall example is isolated from the public catalogue. Supabase's published DTO and schema do not yet store approved mall membership or map coordinates. Connected venues receive no fictional map markers. Production mall mapping still needs approved building relationships and real positions.

The native palette and navigation are updated and typechecked. The larger interactive web map, mall directory and external directions have not been ported to native, and physical-device visual testing remains outstanding. This delivery does not enable account/messaging flags, create live venues, verify visits or award rewards.

Google Maps URL parameters were checked against [Google's official Maps URLs guide](https://developers.google.com/maps/documentation/urls/get-started); Apple links against [Apple's unified Maps URLs documentation](https://developer.apple.com/documentation/mapkit/unified-map-urls). A venue address is a destination suggestion and does not establish surveyed coordinates.
