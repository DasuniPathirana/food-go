---
name: Food Go
description: Melbourne food discovery, a geographic city map and a collectible neighbourhood adventure.
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
| Real map | City directory beside geographic imagery. Aerial, Satellite and 3D share one camera. A strip below the image carries the selected point and directions. | Place selector above the map. Controls stay compact and the readout fits above phone navigation. |
| Adventure | The original dimensional illustrated streets, animated explorer, radar and food photo markers. An arcade storefront groups shops by floor and unit. | Slim search field, expandable tools and small walking arrows with full touch targets. Additional details open below the map. |
| Feed | Public and personal walls, a writing area and photo-led stories with familiar social actions. | One document scroll through the composer and stories. |
| FoodDex, VenueDex and trails | Food photos, concise collection status, numbered itineraries and perforated reward stubs. | Short horizontal collection rows and stacked trail photographs. |
| Deals | Venue offers retain the owner's summary, local details and expiry labels. | Deals remains the fifth navigation item. |
| Passport | Petrol explorer pass, saffron progress stub and personal wall. Game detail and avatar customisation expand on request. | Identity and progress stay close to the composer. The avatar and XP ticket provide entry in the demo. |

## Map behaviour

Explore is the centre destination and opens on real geography. The detailed aerial layer and building components use a City of Melbourne survey. The satellite layer uses a dated Copernicus observation. Pan, zoom and pitch establish the view. Place selection, arbitrary pin selection and directions stay available independently of a Food Go account. The illustrated game remains a separate selectable mode with walking, optional avatars and action previews. Only Adventure uses the fictional venue positions and browser game ledger.

Each map fits below its own header and above the phone navigation. Long feeds and directories use normal page scrolling. Keep map inputs keyboard-accessible and respect reduced-motion settings. Labels and pressed states accompany colour changes. Licence attribution remains available on both geographic renderers.

## Product boundaries

The map shows public landmark coordinates and validated, published venue positions. Google Maps and Apple Maps use the chosen geographic destination. Adventure links use real area searches for fictional places. Real map selection does not record location, prove a visit or award XP. Account-based social XP and reach use server verification. Native map parity and real-device performance require separate delivery and testing.

[Current map delivery](docs/progress/14-melbourne-geography.md) · [Launch requirements](docs/launch/go-live-checklist.md)
