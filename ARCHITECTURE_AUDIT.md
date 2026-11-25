# Food Go game architecture audit

17 November 2026. Repository inspection before the game transformation. The attached game brief is the implementation request. Reference screenshots communicate depth, composition and exploration, not licensed assets to copy. Existing unrelated working-tree changes are retained.

Implementation update on 18 November: this table preserves the baseline audit. [Milestone 24](docs/progress/24-camera-and-discovery.md) records subsequent first-person controls, permission-aware compass, camera clearance against loaded building footprints, guarded GLB loading and opt-in private geographic-cell persistence. [Milestone 25](docs/progress/25-restaurant-encounters.md) adds private encounter tables and checked RPCs for independent campaign approval, weighted draws, stock/cooldowns, one-use staff confirmation/redemption and replay-safe inventory. Its API and browser presentation remain behind the closed encounter flag. No licensed production character has been admitted; world-integrated rendering, richer 3D encounter assets and native AR remain separate work. The encounter database suite uses rollback-only fixtures; actual competing-transaction and physical-device acceptance remain outstanding.

## Runtime and modules

| Area | Observed implementation | Retain / constraint |
| --- | --- | --- |
| Web | Next.js 16.4.6 App Router, React 19.3.1, TypeScript 7.0.2; npm workspaces, Node >=24 | Retain. Read installed Next client, CSS and lazy-loading guides before edits. |
| Geographic renderer | `atlas-canvas.tsx`: lazy MapLibre GL 6.18.0; one reversible style, geographic camera, DOM/React markers, route and accuracy GeoJSON | Retain real geography, provider attribution, gestures and context-loss recovery. Extrusions alone are not a game engine. |
| Geographic fallback | `world-map-fallback.tsx`: Leaflet 1.9.4 raster world map, same parent selection, player and route | Retain and test with unavailable WebGL/provider. |
| Providers | OpenFreeMap Liberty vectors, OSM raster fallback; City of Melbourne building/aerial survey, dated local Copernicus image; optional MapTiler world satellite/search | Local imagery is explicitly bounded; worldwide satellite needs a licensed configured key. Search/foot routes use bounded server adapters. |
| World presentation | `world-map-style.ts`: stylised heights/materials over source footprints, daylight sky, route/accuracy layers | Retain geography, improve material cohesion and labels. Source heights restore in Streets. No collision geometry, world physics or terrain game simulation. |
| Player | `map-player.tsx`, `explorer-avatar.tsx`, `explorer-avatar-scene.ts`: original SVG default and four procedural articulated Three.js 0.187.0 avatars | Retain compatibility and static fallbacks. These are development art, not the requested production rigged GLB/animation assets. No GLB assets found. Separate WebGL avatar canvases are not world-scale integrated characters. |
| Camera | `explorer-camera.ts`: actual 1.7 m eye camera and third-person overview; marker interpolation, shortest heading rotation, detached browsing | Retain calculator and map instance. Add explicit readable planning/follow profiles incrementally. Current profile switches reset the camera abruptly. |
| Location | `use-explorer-location.ts`: opt-in foreground browser watch, hide/unmount cleanup, permission/error feedback. Motion helper filters cosmetic gait/distance | Defect: every raw fix still updates rendered position. Separate raw accuracy from a stabilised cosmetic player position. Never treat browser fixes as reward proof. |
| Routes | `use-street-walk.ts`, `/api/map/route`: actual pedestrian polyline, cancellable request, pause/resume, session-only virtual distance | Retain. Manual travel does not award verified progress. |
| Identity | Supabase SSR/client, checked server routes, production and provider gates, operator MFA, private age declaration and community acknowledgement | Retain all closed gates. No credentials in browser/source/logs. |
| Backend | Supabase PostgreSQL, SQL migrations/RPCs, Zod 4.6.7 schemas, server-only adapters. No ORM | Retain checked RPC boundary, PostGIS geography and GiST venue index, RLS and denied direct ledger access. |
| Verified progression | Staff-issued visit/dish codes, receipts, once-only rewards; reviewed quest campaigns, single-use codes, idempotency, Sydney-day caps, server XP/250 levels and Outback timers/resources | Retain. Existing XP cannot be replaced with client proximity claims. |
| Community / catalogue | Published venue catalogue, grouped mall markers and unit directory, public/personal walls, moderation, FoodDex/VenueDex, trails, Deals, Quests, Outback | Preserve all routes and primary navigation. No fabricated venues to populate an empty live map. |
| Native | Expo 58.0.23, React Native 0.88.1; original demo and anonymous public catalogue mode | Foundation only: no connected account, native geographic renderer, foreground GPS or AR. Android explicitly blocks camera/location. Native builds/device testing needed. |
| Shared contracts | `packages/domain`: venue validation and avatar definitions; web libraries hold journey/adventure contracts | Extend shared modules when native consumers exist; avoid blanket renames of working modules. |

## Configuration and tests

Public configuration: `NEXT_PUBLIC_MAPTILER_KEY`; Expo catalogue mode/origin. Private server configuration: Supabase public project connection, auth cookie secret/origin and explicit auth production-readiness gate, community/partner gates, signed email/SMS hooks, optional Photon/foot router endpoints. Names are documented in `.env.example`; secret values were not read or printed. Mobile Message is intended for SMS. Brevo activation remains deferred.

Baseline `npm run check`: PASS, web/native type checks and 181 tests. Existing Node tests cover contracts, motion, cameras, map styles, account/security and backend adapters. Rollback-only SQL suites cover tenant isolation, journeys, community, operators, age, quests and adventure. Existing Playwright config and two browser regressions are uncommitted work present before this task. No dedicated lint script/config exists; do not claim lint passed. Current audit does not rerun hosted fixture tests or change the database.

Parallel backend read-only review corroborated existing PostGIS/RLS/verification boundaries. It found no geographic cell ledger, loot rarity/inventory schema, movement attestation or AR adapter. Browser/physical-device evidence is recorded with each delivery, not inferred from source.

## First files to change

`geographic-explore.tsx` / CSS: map-first layout, contextual HUD and selected details below the scene. `atlas-canvas.tsx` / CSS and geographic fallback: remove redundant recenter action. New character control: tap locate/follow, hold customise, keyboard equivalent, drag cancellation. Location helper/hook: stable cosmetic GPS without altering raw fix semantics. `world-map-style.ts`: restrained daylight geographic materials. Tests exercise these behaviours before later slices.

The standalone `prototype/map.js`, styles and running reference are inspected and remain unchanged. Legacy illustrated/adventure/atlas renderers serve explicit previews and older screens; do not delete them as apparent duplicates without route and native migration evidence.
