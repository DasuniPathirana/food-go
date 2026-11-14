# Melbourne geographic Explore

Open `/demo/explore` for the browser demo or `/` for connected Explore. Both start with the detailed aerial view and 3D buildings. Satellite switches to a genuine Sentinel-2B image from 5 March 2025 at 10 metre resolution. Aerial uses the May 2020 City of Melbourne orthophoto, resampled to approximately one metre per pixel. The local extent is approximately 2.14 by 2.00 kilometres around the CBD. The building layer extrudes 7,213 surveyed polygon components using their measured base and roof elevations. A building can have several components. [Aerial source](https://discover.data.vic.gov.au/dataset/2020-aerial-imagery) · [Building survey](https://data.melbourne.vic.gov.au/explore/dataset/2020-building-footprints/) · [Satellite observation](https://earth-search.aws.element84.com/v1/collections/sentinel-2-l2a/items/S2B_55HCU_20250305_0_L2A)

## Show the client

1. Select Melbourne Central from Places. On a phone the directory becomes a single selector above the map. Google Maps and Apple Maps use the selected coordinates. The landmark point identifies the site. Entrances can be elsewhere on its boundary.
2. Switch to Satellite, turn off 3D, and drop a pin away from the named stops. Both directions links follow that point. Keyboard users can focus the map, pan with the arrows and select the centre with Enter.
3. Choose Adventure for avatar movement, the Garden Arcade shop directory, trail check-ins and demo XP. The direct game entry is `/demo/explore?map=adventure`. The geographic map grants no XP. Deals occupies the owner’s fifth navigation slot, and the XP ticket and explorer portrait open Passport.
4. Open Feed for the public wall or Passport for the personal wall. FoodDex, VenueDex, food trails and rewards use photographic tickets and visible collection or claim states.

## Data and deployment

The demo has four city landmarks. Connected Explore also accepts valid published Food Go coordinates. Co-located listings share a pin with individual entries. Address-only listings remain in the searchable catalogue at `/?view=catalogue`. The development project returned zero published venues during this delivery. The existing latitude, longitude, publication and ownership policies support the change without a database migration.

MapLibre loads on demand. The local, fixed-bearing renderer uses the same survey and images when interactive WebGL is unavailable. Optional MapTiler satellite imagery extends geographic coverage. Its hosted tiles require a public key configured at build time. The local images have capture dates and the local building survey has a fixed boundary. [Deployment settings](../deployment/environment.md) · [Dataset transformations and licensing](../../apps/web/public/atlas/sources.html)

## Browser verification

The production website rendered WebGL buildings on desktop and at a simulated phone viewport. Checks covered both imagery switches, the 3D toggle, selection by landmark and keyboard pin, both directions URLs, the bottom navigation clearance, shop levels and units in Adventure, and the Deals, Feed and Passport routes. The test run used the bundled datasets. A hosted global provider account, physical-phone GPU performance and the Expo application were outside this browser run.

[Desktop view](../screenshots/14-melbourne-3d-desktop.jpg) · [Phone view](../screenshots/14-melbourne-3d-phone.jpg)
