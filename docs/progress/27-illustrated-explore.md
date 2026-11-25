# Illustrated Explore surface, 19 November 2026

Explore now opens on an illustrated, dimensional map of inner Melbourne instead of the plain geographic overview. The four approved reference images set the composition: a warm, saturated city with an illustrated explorer, floating glass panels, food pins, a discovery card and the raised Explore destination in the phone dock.

The previous Explore surface is preserved on the `backup/explore-before-redesign` branch. The redesigned surface is on `redesign/illustrated-explore`.

## What changed

- New `components/explore` module. `world-layout.ts` holds one 1800 x 1150 world and projects real longitude and latitude into it, so the artwork, the venue pins, the explorer, walking routes and the discovery rings share one coordinate space.
- `world-art.tsx` draws the city deterministically: street grid from real road centrelines, extruded terraces and towers with lit shopfronts, Royal Gardens and its pond, the Yarra with a ferry and Princes and Queens bridges, the Southbank promenade, Flinders Street Station with its dome and clock tower, the Royal Exhibition Building, Queen Victoria Market, Melbourne Central, Federation Square, street furniture and footpath crowds.
- `explore-screen.tsx` is the interactive surface: pointer pan, wheel and pinch zoom, keyboard pan and zoom, tap-to-walk, follow and overview cameras, search across Food Go venues, map places and landmark reference points, quest progress, a discovery card, and a layers and about panel.
- The explorer uses the supplied V7 character renders. `artifacts/tmp/prepare_avatar_art.py` recolours the studio backdrop to the Explore palette and writes both portrait crops and transparent pose cutouts to `public/avatars`.
- The surveyed geographic map remains available at `/?map=geographic`.

## Product boundaries kept

The illustration is stylised and borrows real street geometry, not survey accuracy. The layers panel and the about panel say so. Restaurant pins come from published Food Go records; when no restaurant is published nearby the map shows City of Melbourne landmark reference points instead, which carry no offers, encounters or verified visit claims. Walking uses OpenRouteService pedestrian routes, manual walking never earns XP, and live location stays optional.

## Verification

- `tsc --noEmit` passes for the web workspace.
- Rendered with Playwright at 1440 x 900, 1280 x 800, 834 x 1112, 780 x 420, 390 x 844 and 360 x 740. Every viewport fills its stage; the phone layout keeps the map above the fixed navigation.
- Selecting a landmark shows the discovery card and advances the first quest counter.
- Reduced motion disables the radar sweep, chest pulse, explorer bob and camera easing.
