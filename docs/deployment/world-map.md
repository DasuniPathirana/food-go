# Worldwide explorer operations

Explore keeps one interactive map for streets, imagery, published venues, the avatar and pedestrian routes. Search stays above the map. Expansion uses the same mounted canvas and selection; the original page remains in place when it closes. The original standalone prototype is unchanged.

## Providers and rollout

1. Apply all pending migrations, including `20261115150442_food_go_map_service_limits.sql`, using the hosting team's release process. This PR does not alter the hosted database. The small private lease table stores only service identifiers and next-available timestamps. The public RPC grants no access to private location or account data.
2. OpenFreeMap supplies worldwide vector streets and available 3D building data without an API key. The OpenStreetMap raster fallback supports browsing when the 3D renderer cannot start. These are external network dependencies, so check them from the intended deployment region. Retain visible attribution. Normal interactive tile requests use browser caching; no offline prefetch or bulk download is implemented.
3. Set `NEXT_PUBLIC_MAPTILER_KEY` before building for licensed worldwide satellite imagery. Restrict the public key to authorised origins and configure plan usage limits. Both renderers preserve imagery contributors and MapTiler branding. Without it, the satellite and aerial choices cover Melbourne CBD only and keep a worldwide street base. They are labelled accordingly.
4. Place search submits only on Search, with no provider autocomplete traffic. The default Photon public endpoint is a best-effort service without an availability promise. A shared 1.1-second database lease enforces a modest global request rate across hosting instances. Busy requests return 429. For expected launch traffic, configure an operated Photon endpoint using `FOOD_GO_PHOTON_ENDPOINT` or arrange supported geocoding service capacity before opening broadly. A bounded five-minute memory cache reduces repeat requests but is not the rate limiter.
5. The default FOSSGIS OSRM endpoint is explicitly the `routed-foot` service. Its published maximum is one request per second; the application uses its own independent 1.1-second shared lease. Configure `OPENROUTESERVICE_API_KEY` for the supported `foot-walking` provider, or `FOOD_GO_FOOT_ROUTER_ENDPOINT` for an owned OSRM pedestrian service. Do not substitute a car-routing endpoint. Review the selected provider's capacity and monitoring for launch. There is no invented straight-line route when a provider fails.

Search accepts a place/address or a latitude, longitude pair. Coordinates work without a geocoder. Route requests accept endpoints no more than 20 km apart and validate bounded GeoJSON returned by the provider. A missing route, unavailable provider or busy lease leaves map exploration and external directions available.

## Live location and virtual movement

Live location starts only after the user selects its control and grants browser permission. Hosted sites require HTTPS and allow geolocation only for their own origin. Denied, unavailable or timed-out location leaves manual placement available. Watches stop on unmount, explicit opt-out and when Explore is hidden. Re-enabling is deliberate.

Raw GPS fixes remain in mounted page state. They are not saved to browser storage or the Food Go database. Centring a map requests third-party tiles for that viewed area. A typed search goes to the geocoder; a requested walking route sends its endpoints to the routing provider. Review the provider privacy policies and update the published privacy notice for the deployment's selected providers.

Manual mode lets the user place an explorer, select a destination and follow the returned street polyline at walking speed or an explicit 4-times speed. Pause, resume and end route are available. Hidden pages pause walking; reduced motion initially pauses new routes. Live mode displays the device's position and plans a route without moving the avatar virtually. It does not claim turn-by-turn guidance, road safety, location spoofing protection or verified physical arrival.

Avatar actions and virtual distance do not award XP. Customer XP remains tied to server-verified restaurant/dish codes and the existing social ledger. Cosmetic avatar choice is a browser preference. Published venue pins and co-located shop directories use genuine approved Food Go records, not provider POIs presented as Food Go partners.

## Deployment acceptance

- Check streets in Melbourne and a location outside Australia, and check exact Google/Apple directions coordinates.
- Confirm global satellite imagery on the configured key's allowed origin; inspect both network errors and credits.
- Pan, pinch, zoom, select, expand and close on desktop and physical Android/iPhone browsers. Verify camera, selection, focus and page scroll.
- Grant location on an HTTPS phone, move outdoors, then deny it in another browser and use manual search instead. Confirm leaving or hiding Explore stops collection.
- Request an actual pedestrian route, walk it virtually, pause/resume, and check live planning retains the route as GPS updates. Busy/failure states must stay usable.
- Disable WebGL and repeat selection, directions, placement and walking in the raster fallback. Test reduced motion.
- Confirm server-verified XP still requires restaurant codes and cannot be earned by teleporting or virtual walking.

The local automated browser checks use route/search fixtures to exercise UI states. They do not certify physical GPS accuracy, provider uptime, global imagery billing or real-device performance. Disposable database CI verifies the new lease and all existing account/XP policies without resetting the hosted project.

Sources: [OpenFreeMap quick start](https://openfreemap.org/quick_start/), [OpenStreetMap tile policy](https://operations.osmfoundation.org/policies/tiles/), [Photon](https://photon.komoot.io/), [FOSSGIS routing service and limits](https://routing.openstreetmap.de/about.html), [MapTiler satellite](https://docs.maptiler.com/schema-raster/satellite/), [openrouteservice API](https://openrouteservice.org/dev/#/api-docs).
