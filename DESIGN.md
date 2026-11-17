---
name: Food Go
description: Food discovery, a worldwide geographic explorer and a social food passport.
colors:
  canvas: "#fffaf4"
  surface: "#ffffff"
  ink: "#241b29"
  muted: "#594c51"
  primary: "#ff733f"
  saffron: "#ffd445"
  petrol: "#006d68"
  focus: "#304bc2"
typography:
  display: "Barlow Condensed, 700 and 800"
  body: "Source Sans 3"
  wordmark: "Bricolage Grotesque"
---

## Visual direction

Use the visual language of a Melbourne food market. The saffron masthead identifies Food Go across screens. Petrol signs identify destinations, mandarin marks actions, and dark ink on warm paper carries the reading. Barlow Condensed gives short names the scale of shop signs. Source Sans 3 keeps long stories, directions and controls legible. Keep the original fork-and-pin wordmark.

The connected UI refinement uses Barlow for section headings and Source Sans 3 for controls and reading. Petrol carries selected navigation and primary actions; saffron identifies the brand and collection/progression moments. Warm white and restrained mint/apricot surfaces separate content without a heavy outline around every group. The following supporting tones are deliberate ramps of the existing palette: warm surfaces `#f5f0e6`, `#fffdf6` and `#fff6cf`; mint surfaces `#e4f2e8`, `#edf5ef` and `#e2eee0`; apricot `#ffe2ce`; petrol hover `#00544f`; lines `#dfd7ca` and `#9a8e80`. Map water `#9fd9e6`, parks `#c3e5bb` and pale building materials are geographic styling, with all original coordinates and measured heights retained.

Use compact hierarchy for Explore, conversational typography for Feed, a clear identity cover above Passport's wall, collection emblems and segmented views for the two Dex pages, and ticket seams/expiry for offers. Hover/press feedback should take around 160–180 ms and respect reduced motion. Keep a phone footer clear of the fixed navigation; the signed-in Passport entry can use its labelled person icon on narrow screens.

Game map materials now use warm green land `#e6efd9`, bright blue water `#52bdf0`, lively parks `#8bd56e`, deeper woodland `#5dbb80`, white roads and grey casing `#cad3df`. A blue daylight sky and pale horizon support the eye-level camera. These are reversible presentation choices over real geometry: Game heights are deliberately stylised, while Streets and Satellite restore the source heights. The first manual view starts along an actual Swanston Street segment so the eye-level camera faces the street rather than a building. Approved venue photo pins and named mall markers carry food identity; unavailable shops are never fabricated to decorate the map.

Building materials now alternate stable coral, saffron, teal, green, lilac, ochre and blue by real feature identity. A monotonic Game-height scale keeps roof parts separate while remaining compact; flattening several roofs onto one capped height creates distracting colour stripes. Both building material and height changes restore when leaving Game. Remove ornamental heading/composer/empty-state icon badges throughout the product, retaining icons that operate a control, communicate state or identify game resources. Feed keeps its original first navigation slot and Explore keeps the central compass. The Feed destination gates content for eligible signed-in users aged 16 and over; it does not replace navigation with Passport.

The customer navigation is Feed, Quests, Explore, Deals and Outback. The compass stays at the centre and Explore is the initial route. Collections and Passport move to labelled secondary controls. Quests uses a compact progression pass and genuine published request cards. Deals has exactly two clearly named categories, Food Deals and Restaurant Deals. Outback uses an original isometric Australian farm with tactile roofs, crop stages, water tanks and readable resource controls. Motion can be paused, respects reduced motion and stops while the page is hidden. Plot selection and zoom remain accessible by keyboard, with no wheel capture or nested page scroll.

## Browser routes

| Destination | First screen | Phone adaptation |
| --- | --- | --- |
| Explore | First-person real streets by default, a third-person switch and optional licensed satellite imagery. Search sits above the map. An in-map button expands the same camera and selection. | Swipe to pan and pinch to zoom. Compact location, recenter and avatar controls preserve the view. |
| Explorer controls | Tap a street to walk a real pedestrian route automatically. Live location follows actual fixes. Group co-located approved restaurants into a directory below the map. | Pause, resume and end route sit beneath the scene. Avatar customisation expands only when requested. |
| Feed | A public timeline, composer and social actions. Passport holds the personal wall. | One document scroll through the composer and stories. |
| FoodDex, VenueDex and trails | Food photos, concise collection status, numbered itineraries and perforated reward stubs. | Short horizontal collection rows and stacked trail photographs. |
| Quests | Genuine independently reviewed partner requests, category filters and the 250-level progression pass. | Compact cards and expandable account requirements keep one document scroll. |
| Deals | Food Deals and Restaurant Deals show active published offers, their venue and expiry. Explore includes promotions and a three-column restaurant directory. | The directory adapts to the available width. The offer highlight respects reduced motion. |
| Outback | Original isometric village, real resource balances and server-timed construction and crops. | Accessible plot chooser, deliberate zoom/fit controls and a stacked action panel. |
| Passport | Petrol explorer pass, saffron progress stub and personal wall. Game detail and avatar customisation expand on request. | Identity, selected avatar and verified progress stay above the personal wall. |

## Map behaviour

Explore is the centre destination and opens on worldwide real geography. OpenFreeMap provides street vectors and available 3D building data. The local aerial layer and building components use a City of Melbourne survey. The local satellite layer uses a dated Copernicus observation; worldwide satellite imagery requires a configured MapTiler key. Pan, zoom and pitch establish the view. Place search, arbitrary pin selection and external directions stay available independently of a Food Go account. The explorer, radar, avatar choices and actions carry the approved prototype's game interactions into real geography. The standalone prototype stays intact; its fictional venues and local progression never appear as verified production records.

Each map fits below its own header and above the phone navigation. Long feeds and directories use normal page scrolling. Keep map inputs keyboard-accessible and respect reduced-motion settings. Labels and pressed states accompany colour changes. Licence attribution remains available on both geographic renderers.

The close 3D view shows partial original character artwork near the lower edge, synchronised to the existing travel and gesture state, without intercepting map input. The third-person marker remains separate. Graphics fallback explains why 2D is active and provides Retry 3D; the 3D and first-person choices can initiate recovery rather than remaining disabled. Parent selection, player and route state survive a renderer replacement.

## Product boundaries

The map shows provider place labels and validated, published Food Go venues. Google Maps and Apple Maps use the chosen geographic destination. Live GPS requires an explicit user action and browser permission; manual positioning remains available. Route walking follows a real pedestrian polyline and records session movement only. It does not prove a visit or award XP. Customer collections and social XP use server verification. Native map parity and physical-device GPS performance require separate delivery and testing.

[World map operations](docs/deployment/world-map.md) · [Launch requirements](docs/launch/go-live-checklist.md)
