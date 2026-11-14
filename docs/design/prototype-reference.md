# Approved Explore direction

Map behaviour confirmed by the client on 13 November 2026. The latest correction explicitly requires a LIGHT theme with bright colours, bold readable typography and a social food community. This supersedes the dark interpretation. [PRODUCT.md](../../PRODUCT.md) and [DESIGN.md](../../DESIGN.md) record the current brief and tokens.

The standalone `prototype` is the approved visual and interaction reference. Preserve that folder as the reference implementation. The running scene and `artifacts/prototype-map-reference.jpg` show the approved composition: an immersive illustrated neighbourhood behind discovery controls, raised photo pins, a small explorer with a radar ellipse, floating map and walking controls, and food photography in a bottom discovery sheet.

The main website carries this direction through `apps/web/src/components/adventure-map.tsx` and its scoped stylesheet. Local assets in `apps/web/public/images/adventure` are exact SVG outputs extracted from the existing `prototype/map.js` renderer: the neighbourhood, explorer, avocado, pizza, coffee and market illustrations. The source buildings, trees, river, character paths and food drawings remain intact. The website restores the bright neighbourhood artwork with no darkening filter, and uses light controls with lime and sunny yellow accents. Depth still comes from building offsets, raised photo rings, cast shadows and layered radar treatment.

Keep the map as the focal Explore surface, including when the connected database is empty. Search controls float above the illustration. Recommendations and walking controls start collapsed behind two compact dock buttons. Opening them reveals content below the canvas without changing map pan, zoom or canvas height. Selected venue details and mall shop directories also appear below the canvas. There is one main vertical page scroll.

At widths up to 700 pixels, map view controls form a compact horizontal toolbar. The short heading and horizontally browsable categories leave more room for the map. Walking controls are available on demand below the scene at every width. Explore occupies the centre navigation position; the account area is labelled Passport. The original prototype remains unchanged.

## Interaction contract

- Mouse dragging pans the illustration within the prototype's bounded range. Zoom buttons and the + and - keys keep the original 0.85 to 1.75 range. Home and recenter reset the view.
- Arrow keys move the explorer while the map itself has keyboard focus. Labelled walking buttons provide the same action. Standard tab navigation can leave the map and reach search, markers, controls and result links.
- Touch scrolling stays available by default. Move map enables touch dragging; Scroll page restores normal page scrolling over the scene. This prevents a large map from trapping the page gesture.
- Ambient radar and food motion use the original CSS timing. Pause controls, page visibility and viewport visibility stop ambient loops. Reduced-motion preferences remove loops and spatial transitions while retaining the controls and selected state.
- Photo markers select the fictional example and keep its canonical detail link. The existing web fixture positions are preserved as illustration percentages: Finch & Field at 67/34, Ciao, Carlton at 34/21 and Small Hours at 21/60. These values are not latitude or longitude.
- Garden Arcade is a separate fictional building at 77/72, with three distinct shop records. One marker shows the matching shop count, and opening it lists shops by floor and unit. Filtering retains the explicit building relationship, including when only one shop matches. Unknown records and connected venues receive no invented positions.

## Connected data boundary

The illustrated scene is explicitly a playground preview. It does not report GPS location, accurate street navigation, visits, ownership approval or earned rewards. The explorer caption says Preview explorer. Marker badges say Example rather than claiming XP.

Connected Supabase venues are supplied to the expandable results panel. They are never supplied as illustration markers. Accurate live markers require approved geographic coordinates and the selected licensed map implementation. Empty or unavailable public results do not create fictional listings. Published venue detail pages with a complete Australian address provide deliberate Google Maps and Apple Maps links. Fictional addresses never become navigation destinations; no location permission or automatic launch is requested.

The explicit `/explore-preview` route loads demonstration records independently of the connected environment. Its venue links stay under `/explore-preview/venues/[id]`, with an example page strip, fictional-venue explanation and return link to the example neighbourhood. Catalogue DTOs carry an explicit source so a real venue with the same slug still links to the public venue route. The connected Explore link invites the visitor to opt into the example neighbourhood. This is a review route, not an automatic fallback when the public service is empty or unavailable.

Further interface work should use this reference for the map's appearance and motion. Extend the connected behaviours with trusted server rules while preserving the approved scene.
