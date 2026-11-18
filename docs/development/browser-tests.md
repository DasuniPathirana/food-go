# Browser test setup

The repository pins `@playwright/test` as a development dependency. Three.js,
React Three Fiber and Drei retain their existing pinned versions.

```sh
npm ci
npx playwright install chromium
npm run test:e2e
```

Use `npm run test:e2e:ui` for the interactive test runner. On Linux CI, install
the browser and system dependencies with `npx playwright install --with-deps chromium`.

The suite builds the production website and starts its own loopback server on
port 3100. Leave that port free and avoid running another build or development
server in the same checkout during the suite. It closes account and messaging
gates and clears the catalogue provider credentials for its child server.
Browser requests to external hosts are blocked.

Desktop Chromium and an emulated Pixel 7 check map expansion, Escape and focus
restoration, imagery controls, perspective selection, avatar panel interaction,
navigation order and horizontal overflow. Real MapLibre rendering with explicit
local geometry fixtures additionally measures fixed 1.7 m eye position after
drag/keyboard/optical zoom, touch pinch, compass opt-in and manual takeover,
loaded-building clearance, real fog gaps, bounded wide views and WebGL loss with
Leaflet recovery. Location fixtures check denied/weak/stale/hidden states. These
checks do not certify physical GPS, actual orientation, provider uptime,
authenticated live-browser journeys or native apps. Failure screenshots and
traces are saved under ignored `test-results/`.

Encounter cases bundle the actual `EncounterPanel` and `EncounterWorkspace`
components, their CSS and the production fonts into an isolated browser fixture.
`scripts/build-encounter-fixture.mjs` runs in a native Node child process and uses
the existing test bundler; `artifacts/encounter-ui-fixture.json` is test output,
not a production route or application payload measurement. Only Next's link
adapter and HTTP responses are replaced. The fixture visibly states that it
represents no live restaurant or offer. It exercises code refusal, uncertain
claim retry, acknowledged chest opening, expiry, inventory filters, temporary
staff codes, owner pool creation and independent review. Chest opening uses
normal motion on desktop and reduced motion on phone. Separate requests exercise the actual
gated `/inventory`, `/encounters` and encounter API routes. Database rollback
tests establish server policy separately; these fixtures do not certify a
signed-in live-browser or real restaurant journey. Current results and images
belong in [Milestone 25](../progress/25-restaurant-encounters.md).

`FOOD_GO_CHECK_ORIGIN=http://127.0.0.1:3200 node scripts/capture-discovery.mjs`
captures real unmocked provider rendering separately, with account gates closed.
Start the production server on that loopback origin first. Capture evidence is
in `docs/screenshots/24-camera-discovery-evidence.json`; it is not a frame-rate,
battery or physical-device benchmark.

This npm setup does not install an IDE extension or a Codex MCP server. Figma,
Blendstra, Mapbox Studio and Sentry require their own service connections or
application setup.
