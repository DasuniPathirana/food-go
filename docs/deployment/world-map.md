# Worldwide explorer operations

Explore keeps one interactive map for streets, imagery, published venues, the avatar and pedestrian routes. Search stays above the map. Expansion uses the same mounted canvas and selection; the original page remains in place when it closes. The original standalone prototype is unchanged.

Game is the first view. Its blue water, mint parks, white streets and compact pastel buildings use real geographic sources. Building heights are explicitly stylised in Game; Streets and Satellite restore the source heights. Layer changes update materials on the mounted map and preserve the camera, avatar and selected point. Manual exploration starts at the real Federation Square reference point until the user chooses a location or enables GPS. It is never presented as the device's measured position.

## Providers and rollout

1. Apply all pending migrations, including `20261116055307_food_go_map_service_limits.sql`, using the hosting team's release process. This PR does not alter the hosted database. The small private lease table stores only service identifiers and next-available timestamps. The public RPC grants no access to private location or account data.
2. OpenFreeMap supplies worldwide vector streets and available 3D building data without an API key. The OpenStreetMap raster fallback supports browsing when the 3D renderer cannot start. These are external network dependencies, so check them from the intended deployment region. Retain visible attribution. Normal interactive tile requests use browser caching; no offline prefetch or bulk download is implemented.
3. Set the existing single `NEXT_PUBLIC_MAPTILER_KEY` before building for worldwide satellite imagery and browser place search. The selected key allows `food-go-three.vercel.app`, `localhost` and `127.0.0.1`, one hostname per line, with user-agent blank. The owner accepts combined local/deployed use; remove local hosts when testing ends. Separate environment keys are optional when the account supports them. Confirm commercial-use entitlement before public commercial launch; the Free plan covers development/testing. Both renderers preserve imagery contributors and MapTiler branding. Without the key, satellite/aerial overlays cover Melbourne CBD only and keep a worldwide street base. See [exact one-key setup](setup-now.md).
4. Place search submits only on Search, with no provider autocomplete traffic. With the public key it calls MapTiler geocoding directly from the browser's allowed origin and retains attribution. No private key is needed for this path. The server search endpoint still supports an optional separate `MAPTILER_SERVER_KEY`, or Photon without it; it never reuses the public key to bypass browser restrictions. Public Photon is best-effort without an availability promise. A shared 1.1-second database lease enforces its global request rate across hosting instances; busy requests return 429. An operated Photon endpoint can use `FOOD_GO_PHOTON_ENDPOINT`. The server's bounded five-minute memory cache reduces repeat requests but is not the rate limiter.
5. The default FOSSGIS OSRM endpoint is explicitly the `routed-foot` service. Its published maximum is one request per second; the application uses its own independent 1.1-second shared lease. Configure `OPENROUTESERVICE_API_KEY` for `https://api.heigit.org/openrouteservice/v2/directions/foot-walking/geojson`, or `FOOD_GO_FOOT_ROUTER_ENDPOINT` for an owned OSRM pedestrian service. The GeoJSON endpoint requires its GeoJSON Accept header. Do not substitute the retired API host or a car-routing endpoint. Review the selected provider's capacity and monitoring for launch. There is no invented straight-line route when a provider fails.

Search accepts a place/address or a latitude, longitude pair. Coordinates work without a geocoder. Route requests accept endpoints no more than 20 km apart and validate bounded GeoJSON returned by the provider. A missing route, unavailable provider or busy lease leaves map exploration and external directions available.

## Live location and virtual movement

Live location starts only after the user selects its control and grants browser permission. Hosted sites require HTTPS and allow geolocation only for their own origin. Denied, unavailable or timed-out location leaves manual placement available. Watches stop on unmount, explicit opt-out and when Explore is hidden. Re-enabling is deliberate.

Raw GPS fixes remain in mounted page state. They are not saved to browser storage or the Food Go database. Centring a map requests third-party tiles for that viewed area. A typed search goes to the geocoder; a requested walking route sends its endpoints to the routing provider. Review the provider privacy policies and update the published privacy notice for the deployment's selected providers.

Manual mode lets the user place an explorer, select a destination and follow the returned street polyline at walking speed or an explicit 4-times speed. Pause, resume and end route are available. Hidden pages pause walking; reduced motion pauses new routes and active walking when the preference changes. Live mode displays the device's position and plans a route without moving the avatar virtually. It does not claim turn-by-turn guidance, road safety, location spoofing protection or verified physical arrival.

The 3D avatar turns relative to map bearing and uses distance-driven articulated legs. Marker travel and gait interpolate together over 80 ms for manual travel and 600 ms for GPS fixes; relocations over 250 m snap rather than flying across the world. The raw GPS point remains separate from this visual interpolation. Approximate session walking excludes coarse, stale, stationary and implausible fixes; it is cosmetic and not a fitness measurement or reward proof. New browsers start with Foodie 3D, while valid saved avatar choices are preserved.

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
