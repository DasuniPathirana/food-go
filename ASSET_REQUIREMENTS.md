# Food Go production game assets

17 November 2026. The supplied screenshots are composition references only. No franchise characters, sounds or branded content may be copied.

## Character delivery gate

Provide original or commercially licensed rigged GLB/glTF explorers, with licence/source/author and permitted redistribution recorded alongside each asset. Current procedural Three.js/SVG art is a development proxy; it is not finished AAA character artwork. Do not change that status merely by exporting procedural geometry to GLB.

The admission and loader path is implemented in `avatar-assets.ts` and `avatar-model-loader.ts`, with a deliberately empty production catalogue. A production manifest requires a local `/models/avatars/*.glb` path, exact byte length (up to 12 MiB), SHA-256, author/source/licence/redistribution evidence, forward axis, height/eye metrics, in-place root motion, walk/jog cycle distance and nine distinct named clips. The current loader accepts embedded GLB resources, with no external URI or additional compression decoder. It checks rig/geometry/material/texture budgets, ground scale and clips before showing the asset, crossfades an actual AnimationMixer, and disposes resources on abort/error/teardown. The authored test rig proves parsing and animation behaviour only; it is not admitted game art. Models currently use the existing avatar renderer, so shared map GL integration remains required.

- Consistent human proportions and 1.7 m eye height, metres, feet at ground origin, documented forward axis and skinning hierarchy.
- Named idle, walk, jog, turn-left/right, stop, interact, celebrate and discover clips, with root-motion policy and seamless loops. Clips must crossfade and support distance-matched gait.
- Initial evaluation budgets, not measured performance claims: <=25k triangles for hero LOD, <=10k/3k alternatives, <=60 bones, <=4 materials, 1k/2k texture variants and compressed mobile delivery. Measure the integrated scene on real mid-range phones before final budgets.
- PBR materials, skin/hair readability, no baked directional shadows inconsistent with map lighting; map-scale silhouette and contact shadow. KTX2/Meshopt/Draco require compatibility/byte-cost evaluation before adding decoders.
- Clothing/colour slots with stable identifiers, thumbnails, loading/error fallback and complete geometry/material/texture disposal.

## Encounter / environment assets

Original chest or venue-themed discovery object with closed/open/claim poses, Common/Rare/Epic/Legendary material treatments, ground contact and modest VFX. Optional short interaction/open/reveal sounds need documented commercial licences and user-controlled audio. Reduced motion uses a still readable reveal. Real venue photos require owner approval; no fabricated participating restaurant, discount or loot pool.

Map geography remains provider data with attribution. Any terrain/environment prop must align with true geometry and have appropriate LOD. Decorative game objects must not imply passable/private areas or change real road relationships. AR assets need accurate bounds, anchors, surface placement tests and native hardware evidence. Device-camera permissions alone do not establish spatial tracking.

Existing photography, Lucide icons, fonts and procedural artwork retain their credits in `docs/assets.md`. No paid model generation, purchase or new third-party character asset has been authorised or performed by this slice.
