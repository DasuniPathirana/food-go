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

Game map materials add cool grey land `#e9edf2`, blue water `#8fc9f4`, mint parks `#b7e3b9`, white roads and grey casing `#cad3df`. Compact pastel buildings provide depth while keeping the explorer readable. These are reversible presentation choices over real geometry: Game heights are deliberately stylised, while Streets and Satellite restore the source heights. The first manual view is Federation Square, with the actual river and parks providing colour rather than fabricated geography. Approved venue photo pins and named mall markers carry food identity; unavailable shops are never fabricated to decorate the map.

## Browser routes

| Destination | First screen | Phone adaptation |
| --- | --- | --- |
| Explore | A playful Game view of worldwide real streets, an animated explorer and optional licensed satellite imagery. Search sits above the map. An in-map button expands the same camera and selection. | Swipe to pan and pinch to zoom. Compact location, follow and avatar controls preserve the view. |
| Explorer controls | Choose a point and place the explorer or follow a real pedestrian route. Live location is optional. Group co-located approved restaurants into a directory below the map. | Route actions sit beneath the scene. Avatar customisation expands only when requested. |
| Feed | A public timeline, composer and social actions. Passport holds the personal wall. | One document scroll through the composer and stories. |
| FoodDex, VenueDex and trails | Food photos, concise collection status, numbered itineraries and perforated reward stubs. | Short horizontal collection rows and stacked trail photographs. |
| Deals | Active, published offers show their venue and expiry. Explore includes promotions and a three-column restaurant directory. | The directory adapts to the available width. The offer highlight respects reduced motion. |
| Passport | Petrol explorer pass, saffron progress stub and personal wall. Game detail and avatar customisation expand on request. | Identity, selected avatar and verified progress stay above the personal wall. |

## Map behaviour

Explore is the centre destination and opens on worldwide real geography. OpenFreeMap provides street vectors and available 3D building data. The local aerial layer and building components use a City of Melbourne survey. The local satellite layer uses a dated Copernicus observation; worldwide satellite imagery requires a configured MapTiler key. Pan, zoom and pitch establish the view. Place search, arbitrary pin selection and external directions stay available independently of a Food Go account. The explorer, radar, avatar choices and actions carry the approved prototype's game interactions into real geography. The standalone prototype stays intact; its fictional venues and local progression never appear as verified production records.

Each map fits below its own header and above the phone navigation. Long feeds and directories use normal page scrolling. Keep map inputs keyboard-accessible and respect reduced-motion settings. Labels and pressed states accompany colour changes. Licence attribution remains available on both geographic renderers.

## Product boundaries

The map shows provider place labels and validated, published Food Go venues. Google Maps and Apple Maps use the chosen geographic destination. Live GPS requires an explicit user action and browser permission; manual positioning remains available. Route walking follows a real pedestrian polyline and records session movement only. It does not prove a visit or award XP. Customer collections and social XP use server verification. Native map parity and physical-device GPS performance require separate delivery and testing.

[World map operations](docs/deployment/world-map.md) · [Launch requirements](docs/launch/go-live-checklist.md)
