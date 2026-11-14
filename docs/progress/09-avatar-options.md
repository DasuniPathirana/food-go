# Optional explorer avatars

13 November 2026. Browser avatar personalisation extends Milestone 08 without changing its game or account rules.

## Choices and behaviour

The original illustrated explorer remains the default. Four optional choices add Foodie and Trailblazer as rounded 3D characters, and Sky and Violet as original anime inspired 3D characters. No franchise character, external model service or paid asset is used. Users preview before applying. Closing the options keeps the current choice.

Open Avatar in the map's lower controls or Change avatar on Passport. The options disclose below the scene or within Passport, preserving the map's canvas, pan and zoom. Applying changes the map character and static Passport/header portraits. The cosmetic selection and idle-motion preference persist on this browser, including across demo and connected preview pages. They do not sync to a Supabase account or another device. Game reset keeps cosmetic preferences; selecting Original explorer restores the familiar style.

| Surface | Subject and camera | Interaction and fallback |
| --- | --- | --- |
| Explore map | Original explorer or small transparent orthographic 3D character in the approved illustrated scene | Tap the character to wave. Use the walking controls for simulated movement. Map Avatar opens options below the scene. |
| Avatar options | One selected full-body character in a stationary portrait composition | Preview five choices, try actions, toggle idle motion, then apply or keep the current avatar. |
| Passport/header | Static illustrated portrait of the selected character | A recognisable identity without another GPU scene. Passport exposes Change avatar. |

| Trigger | Response | Pause/reduced-motion behaviour |
| --- | --- | --- |
| Standing with idle motion on | Gentle breathing, occasional head turns and blinking on 3D characters | Stops when offscreen, tab hidden, map paused, idle motion disabled or reduced motion requested. |
| Tap character / Wave | One short arm wave | No movement while map motion is paused; reduced motion acknowledges with a still pose. |
| Celebrate | One short arm raise and small bounce | Reduced motion uses a still celebratory pose. |
| Look around | One short head turn | Reduced motion uses a still head pose. |
| Walking buttons/keys | Existing simulated position movement with a brief walking gait | Existing map bounds remain; reduced motion removes animated travel and gait. |

These actions are cosmetic. They cannot create a visit, a dish, XP, an account or a navigation destination. Anime is an explicit choice, never an automatic replacement.

## Implementation and checks

The 3D scene loads only for an optional character when its map/preview is visible. Original and thumbnail rendering stay in SVG. Procedural geometry and shared materials avoid model and texture downloads. Pixel ratio is capped at 1.75. Hidden/offscreen scenes stop scheduling frames; unmount disposes geometry, materials, renderer and listeners. WebGL/context failure leaves the selected illustrated fallback and usable controls.

This follows the project's 3D Website Creator, Scene Architecture, Motion and Interaction, and Responsive Accessibility skills. The engine setup, resize handling and explicit GPU cleanup were checked against the current official [Three.js installation](https://threejs.org/manual/pages/installation.html), [responsive design](https://threejs.org/manual/pages/responsive.html), [cleanup](https://threejs.org/manual/pages/cleanup.html) and [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer) documentation. The renderer requires WebGL2; its illustrated fallback keeps the experience usable on unsupported devices.

The domain adds five tests for valid choices, palettes, malformed/future/oversized preference stores, independent defaults and absence of game/account authority. Workspace types and all 94 behaviour tests pass, as do the eight repository security checks, production build and 203 local HTTP assertions. The production dependency audit reports zero known vulnerabilities.

Browser QA confirmed actual Foodie, Trailblazer, Sky and Violet 3D rendering, preview/apply, reload persistence, map wave, cancelled draft, motion pause and unchanged XP at 1280x720 and 390x844 viewport sizes. Idle motion off survived reload; manual wave still worked and returned to idle. Zoom, walking and the three-shop mall directory remained usable. The final browser reported no console errors. A single correction batch improved phone labels and original portrait positioning; final paired screenshots are [desktop](../screenshots/09-avatar-desktop.jpg) and [phone](../screenshots/09-avatar-mobile.jpg). The original explorer and idle motion on were restored after QA, with an optional Violet preview left open for review.

Physical phone GPU performance, an operating-system reduced-motion toggle and a deliberately lost GPU context have not been exercised in this environment. Their source paths and illustrated fallbacks are implemented. Cross-device account synchronisation is not part of this cosmetic browser preference.
