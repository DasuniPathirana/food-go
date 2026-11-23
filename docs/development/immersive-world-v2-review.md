# Food Go: immersive world pass — integrated review gate

Branch `chatgpt/map-world-first-pass` / draft PR #13, based on PR #12.
Status: **development candidate, not approved for deployment**.

## Scope delivered together

- A single player-facing **Food Go game world**, not a switcher between Streets,
  Aerial and Satellite maps. The Graphics menu retains 3D on/off, low-detail
  mode and privacy-preserving geographic discovery fog; WebGL failure still
  falls back to the existing 2D renderer.
- Full viewport Explore, compact persistent avatar/location interaction and
  camera controls, with account/privacy/discovery actions in contextual sheets.
- Original, instanced, mixed-species 3D park canopy and undergrowth, ~68 max
  georeferenced trees sampled in park landcover near the player, with softened
  non-authoritative tree shadows and open lawn gaps.
- Bounded decorative rooftop dressing sourced from actual visible building
  footprints and provider heights. Solar arrays, pavilions, small gardens and
  skylights are visual inventions, **not** surveys of individual rooftops.
- Visually differentiated 3D Food Go restaurant discovery stations at
  existing, approved catalogue coordinates (no invented real venues).
- An original small 3D treasure chest at the existing `?world-demo=1` test
  coordinate, tap/click hit area, animated opening panel and an explicit
  **no XP, no inventory, no offers** boundary.
- Softer pedestrian path styling, less intrusive generic provider POIs,
  and geographic fog with diffused edge and rim layers.
- Pure unit tests for roof sampler, park cover geometry and regression tests
  for single-world settings and demo chest.

## What is deliberately NOT done

- No final rigged hero import. The V7 working GLB submitted for art review
  contains 185,810 triangles, 242 meshes, 24 material entries and 65 joints:
  it exceeds the earlier mobile delivery limits and current 60-bone loader.
  The previous player remains a deliberate temporary asset. Do not quietly
  raise performance limits or rename the V7 asset as production-approved.
- No true AR camera tracking, native geospatial anchors or physical-device QA.
- No actual retail rewards from manual walk, visual beacon or demo chest.
  Staff verification, approval and stock/offer rules remain server-owned.
- No guarantee of accurate physical tree/roof object placement; city decoration
  is intentionally stylised and non-navigational.

## One consolidated visual QA pass (required before merging)

Use a clean local copy of PR #13; no production Supabase keys, no deploy.
Use real provider tiles when available, and capture **actual application screenshots**.

### Melbourne CBD, same player coordinates across before/after

- 1440×900 and 390×844, default overview and follow.
- Zoom into nearby roofs (17–18+), then select close and first-person.
- Inspect building/roof alignment, rooftop gaps, camera clearance, art
  composition, depth and 3D model shadows.
- Change Graphics to Low detail, verify the 3D object layer unloads and
  the geographic roads/player remain. Re-enable; geometry must return.
- Verify the new single-world Graphics menu, search, location short tap,
  wardrobe long press, buttons and mobile navigation without overlaps.

### Fitzroy Gardens

- Game world at zoom 18, 3D on, Low detail off, fog hidden.
- Confirm mixed broadleaf/conifers, park undergrowth, soft shade, nonzero
  `data-game-tree-count`, and no repetitive flat black shadow disks.
- Pan and zoom. Fixed grove positions must not jump; grass path geography
  and nearby water/roads must remain readable.
- On weak or lost WebGL, confirm 2D fallback with preserved discovery state.

### Non-redeemable treasure

- Open `/?world-demo=1`.
- Find the chest at longitude 144.96915, latitude -37.81790.
- At close zoom click the actual chest or click the accessible
  "Discover treasure" control, then "Open chest".
- Confirm visual reveal, "No inventory, offers or XP awarded" text.
- Check **no** inventory/reward/claims POSTs; server gates unchanged.
- Without `world-demo=1`, neither the fixture nor the preview CTA should
  appear. Approved real venues retain server-only encounter validation.

### Automated and performance checks

```bash
npm ci
npm run check
npm run build:web
npm run test:e2e
```

- Chrome desktop 1440×900 and phone emulation 390×844, plus a real mid-range
  Android device before production approval.
- Capture GPU vendor, WebGL errors, browser warnings, min/median/95th frame
  gaps during 2-minute park and city pan/rotation, plus context loss recovery.
- Check brand/map attribution stays visible, all overlay buttons have >=44px
  touch areas, and reduced motion prevents rapid effects.
- Screenshots and passing tests are evidence; **neither alone proves
  production-ready game quality**.

## Release constraint

Do not merge PR #13 to the underlying branch or deploy it until the one
consolidated visual/performance review passes. The city still relies on
MapLibre footprint extrusions and geometric decoration; achieving a
full production-quality game environment will also require studio-level
architecture assets, authored materials and device iteration.
