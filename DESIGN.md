---
name: Food Go
description: Food discovery, a worldwide geographic explorer and a social food passport.
colors:
  canvas: "#fff9ee"
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

## Browser routes

| Destination | First screen | Phone adaptation |
| --- | --- | --- |
| Explore | Worldwide streets, an animated explorer and optional licensed satellite imagery. Search sits above the map. An in-map button expands the same camera and selection. | Swipe to pan and pinch to zoom. Compact location, follow and avatar controls preserve the view. |
| Explorer controls | Choose a point and place the explorer or follow a real pedestrian route. Live location is optional. Group co-located approved restaurants into a directory below the map. | Route actions sit beneath the scene. Avatar customisation expands only when requested. |
| Feed | A public timeline, composer and social actions. Passport holds the personal wall. | One document scroll through the composer and stories. |
| FoodDex, VenueDex and trails | Food photos, concise collection status, numbered itineraries and perforated reward stubs. | Short horizontal collection rows and stacked trail photographs. |
| Deals | Active, published offers show their venue and expiry. Explore includes promotions and a three-column restaurant directory. | The directory adapts to the available width. The offer highlight respects reduced motion. |
| Passport | Petrol explorer pass, saffron progress stub and personal wall. Game detail and avatar customisation expand on request. | Identity and progress stay close to the composer. The avatar and XP ticket provide entry in the demo. |

## Map behaviour

Explore is the centre destination and opens on worldwide real geography. OpenFreeMap provides street vectors and available 3D building data. The local aerial layer and building components use a City of Melbourne survey. The local satellite layer uses a dated Copernicus observation; worldwide satellite imagery requires a configured MapTiler key. Pan, zoom and pitch establish the view. Place search, arbitrary pin selection and external directions stay available independently of a Food Go account. The explorer, radar, avatar choices and actions carry the approved prototype's game interactions into real geography. The standalone prototype stays intact; its fictional venues and local progression never appear as verified production records.

Each map fits below its own header and above the phone navigation. Long feeds and directories use normal page scrolling. Keep map inputs keyboard-accessible and respect reduced-motion settings. Labels and pressed states accompany colour changes. Licence attribution remains available on both geographic renderers.

## Product boundaries

The map shows provider place labels and validated, published Food Go venues. Google Maps and Apple Maps use the chosen geographic destination. Live GPS requires an explicit user action and browser permission; manual positioning remains available. Route walking follows a real pedestrian polyline and records session movement only. It does not prove a visit or award XP. Customer collections and social XP use server verification. Native map parity and physical-device GPS performance require separate delivery and testing.

[World map operations](docs/deployment/world-map.md) · [Launch requirements](docs/launch/go-live-checklist.md)
