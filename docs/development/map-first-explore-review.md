# Map-first Explore / early 3D world slice

This is a **review-only** update based on the latest camera/verification work in `codex/playful-world-motion` (PR #12).

## What changed

- Explore fills the usable screen with the same MapLibre map and existing camera states.
- The header/search, map HUD, selected place, character, consent/help and encounter controls are contextual overlays or a compact **Game details** drawer.
- The storefront remains reachable through `/?view=catalogue`; other application routes keep their normal scrolling layouts.
- Game mode now includes a georeferenced Three.js custom 3D layer, drawn in the map's existing WebGL context with its depth buffer. This uses simple original beacon geometry at actual listed-venue coordinates and the currently selected map point. An optional visual fixture appears at `/?world-demo=1`.
- The map's game-mode colors have a lighter verdant palette with more differentiated building surfaces.

## Honest limitations

- This first pass does **not** deliver a premium fully modeled city, footpaths, procedural forests, a real rigged player in shared world coordinates or native AR.
- The 3D beacons are visual hints only; the backend remains the sole authority for verified visits, redeemable offers and inventory.
- If the venue catalogue is unavailable, real restaurant landmarks do not appear. The `world-demo=1` marker is clearly a nonredeemable review fixture and must never be promoted to a real venue.
- Real place names/locations are never invented, altered or seeded into production databases.
- The old avatar remains intentionally unchanged until a separately approved rigged model is ready.
- No browser or device screenshots, lint, TypeScript build or regression tests were executed in this connector-only environment. Run the checks below on the branch before promoting it.

## Review checklist (local Codex or other terminal)

```bash
npm ci
npm run check
npm run build:web
npm run test:e2e
```

Review at mobile 390 x 844 and desktop 1440 x 900. Check:

1. / opens a non-scrolling game viewport with search, avatar control, camera controls, an accessible Game details drawer and visible map attribution.
2. /?view=catalogue exposes the restaurants/storefront with normal document scroll.
3. /?world-demo=1 shows a nonredeemable 3D waypoint near the initial Melbourne view, with no award/claim.
4. Game->Streets->Game, overhead->follow->close->first person and graphics failure/retry do not lose player or route.
5. The Game details drawer exposes opt-in exploration recording, delete/retry, privacy copy and nearby venues. It must remain keyboard reachable and scrollable.
6. Signed-in approved encounters retain server-only eligibility, codes and claim verification.
7. Check for WebGL context errors and device GPU load; disable the custom layer in Low detail mode.
8. Verify the child 3D beacons do not obscure genuine restaurant markers in the rendered map. Adjust their ground scale and contrast as needed.

Do not merge to develop or deploy until screenshots and tests are reviewed.
