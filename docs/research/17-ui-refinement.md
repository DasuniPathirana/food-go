# Connected UI refinement research

15 November 2026. This pass refines the existing light market-signage identity for desktop and phone browsers. The approved standalone prototype was inspected in its running form and remains unchanged. Current connected pages were captured before editing. Their weak points were a crowded map, controls competing for attention, oversized empty surfaces and inconsistent section hierarchy.

## Primary sources and design decisions

| Source observation | Food Go application, a design judgement |
| --- | --- |
| [Duolingo's core-tab redesign](https://blog.duolingo.com/core-tabs-redesign/) describes inconsistent headings, type hierarchy and spacing. Its final framework uses tiered title sizes and purposeful spacing, with each tab retaining its role. | Keep shared navigation and functional typography consistent. Give the map a compact header, Feed a conversational entry, Passport an identity cover, collections distinct emblems and promotions an offer-ticket structure. Avoid a large decorative hero on every tab. |
| [Apple's map guidance](https://developer.apple.com/design/human-interface-guidelines/maps.md) emphasises familiar interaction and keeping the map usable around controls. | Preserve pan, pinch, zoom and fullscreen. Quiet the imagery switch, keep edge controls compact and place destination/route actions below the scene. Move idle motion controls to optional explorer actions. |
| [The official Pokémon GO map guide](https://scopelyexplore.helpshift.com/hc/en/5-pokemon-go/faq/1084-what-is-the-map-view/) separates the avatar, its interaction area, orientation and contextual activity. | Keep the Food Go explorer and radar as the focal game element. Distinguish location/follow/avatar tools from camera controls and selected-place actions. Preserve Food Go's original character and real geographic data. |
| [Duolingo's shape-language article](https://blog.duolingo.com/shape-language-duolingos-art-style/) describes recognisable forms, colour and negative space. | Reuse Food Go's existing explorer, food photography and icon system for purposeful identity and empty states. Keep artwork out of the geographic interaction area. |
| [Apple motion guidance](https://developer.apple.com/design/human-interface-guidelines/motion) treats motion as feedback and orientation, with accessibility controls. | Use short colour/shadow feedback for controls, retain optional avatar motion and respect reduced-motion preferences. Avoid adding page-entry choreography or extra looping decoration. |
| W3C explains [minimum text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [minimum target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html). | Keep functional text dark, primary actions clear and main touch controls at least 44 px. Secondary controls stay spaced and keyboard accessible. Check 320 px width and footer clearance, rather than relying only on desktop resizing. |

These references informed hierarchy and interaction choices; they are not evidence of Food Go retention or an endorsement of its design. No third-party game artwork or interface was copied.

## Applied visual system

The saffron masthead remains recognisable. Petrol now consistently marks active navigation and main actions, with warm ink for text. Barlow Condensed is reserved for headings and Source Sans 3 carries controls and longer copy. The wordmark retains Bricolage Grotesque. Existing mint, saffron and apricot tones carry collection and game identity.

Explore has a stronger search rail, quieter layer switch, lighter building materials and a less steep default camera. Transit labels become detailed at closer zoom, keeping street names legible at neighbourhood scale. Building geometry and heights are unchanged. A destination dock connects selection to directions and walking without covering the scene. The raster fallback now reports tile loading and offers retry when requests fail.

Feed introduces posting through a useful guest entry, then prioritises stories and familiar social controls. Passport puts the chosen avatar, verified progression and linked collections above the personal wall. Longer account/game details expand on request. Collections distinguish dishes and places visually, while promotion cards use offer details and expiry rather than generic dashboard panels. Empty and unavailable states remain accurate and point to real actions.

## Verification scope

The implementation uses existing local fonts, photographs and avatar artwork. No new runtime package or provider account is required for these UI refinements. Primary colour pairs were measured using WCAG relative luminance:

| Foreground / background | Ratio |
| --- | --- |
| White / petrol `#006d68` | 6.20:1 |
| Ink `#241b29` / canvas `#fffaf4` | 16.01:1 |
| Muted `#594c51` / canvas | 7.85:1 |
| Input placeholder `#776e64` / white | 5.00:1 |

These measurements cover representative shared colour pairs, not a claim of complete accessibility certification. Browser checks cover desktop, phone and narrow-screen layouts, real controls, populated component fixtures, consent, map interaction and fallback states. Physical-handset performance and actual retention remain unmeasured in this pass.
