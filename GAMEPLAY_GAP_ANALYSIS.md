# Gameplay gap analysis

17 November 2026. Status at audit, before implementation.

Implementation update on 18 November: [Milestone 23](docs/progress/23-game-map-foundation.md) delivers the viewport/HUD/location foundation. [Milestone 24](docs/progress/24-camera-and-discovery.md) delivers fixed-eye controls, explicit compass, camera clearance against loaded building volumes, the guarded GLB/animation loader and bounded geographic fog with authenticated opt-in coarse-cell storage. [Milestone 25](docs/progress/25-restaurant-encounters.md) adds approved pools, server-owned weighted draws, private inventory, one-use staff confirmation/redemption, versioned review and an original SVG/CSS chest. The feature remains disabled by default and no participating pools or offers were seeded. Real partner content, deployed signed-in journeys and observed competing transactions remain acceptance work. The table below preserves the original audit. Licensed production character art/world integration, native AR, verified geographic milestones and hardware acceptance remain outstanding.

| Requested slice | Working foundation | Missing acceptance criteria |
| --- | --- | --- |
| 1. Geographic world / HUD / location | Real worldwide vectors and buildings, game materials, fallback, published photo/mall pins, real pedestrian routes, opt-in GPS | Maximum-area viewport, compact contextual HUD, single character locate/customise control, stabilised displayed GPS, measured visual evidence |
| 2. Premium avatar / follow camera | Original procedural rig, idle/walk/gestures, distance-driven gait, preferences and fallback | Licensed production GLB, authored animation clips and crossfades, integrated world-scale avatar/contact shadow, jogging/turn/stop/discovery; collision-aware follow where geometry exists |
| 3. Camera profiles | Eye-height first person, third-person overview, pinch/rotate, follow/detach | Unified overhead/follow/close profiles and continuous transitions, optional permission-aware device orientation, collision handling |
| 4. Geographic fog | No persistent geographic exploration | Spatial cells, authenticated ledger/retention, reveal renderer, offline sync and verified-movement policy. Cosmetic exploration must not mint rewards. |
| 5. Restaurant encounters / loot | Approved venue coordinates, verified staff codes, idempotent server rewards/quests | Encounter state machine/radii, approved loot pools, expiry/cooldowns, rarity, inventory and replay-safe claim/redemption RPCs; real partner content |
| 6. Camera / AR | No AR session | Permission-aware adapters, actual WebXR/native capability checks, tracking/surface placement, authored treasure assets, native permissions/builds/device verification. A video overlay is not spatial AR. |
| 7. Progression / release | Verified FoodDex/VenueDex, quests, server XP, achievements and Outback | Geographic milestones/cosmetics/reward history integration, mobile parity, measured performance/hardware acceptance and release configuration |

No browser camera overlay, generated discount, local movement reward or mock geographic ledger will be labelled complete. Existing four procedural characters remain explicitly development assets until production art is supplied. Working server authority and account gates remain intact.

The latest request supersedes the earlier playful rainbow/illustrative presentation for the connected geographic world. The light theme, bold legibility, original Food Go identity, geographic relationships and prototype interaction principles remain. Explore remains central, with Feed, Quests, Deals, Outback and secondary Passport/collections retained.
