# Map graphics recovery, close character and account diagnosis

17 November 2026. The requested corrections preserve Feed, Quests, Explore, Deals and Outback and the existing page designs.

## Map

The normal controls passed 88 physical Chrome clicks across desktop and touch, inline and expanded maps. The reproducible defect was a graphics recovery gap: a temporary WebGL loss switched to the interactive 2D renderer and left the 3D and first-person buttons disabled until reload. A fallback notice now explains the state and offers Retry 3D. The 3D and first-person controls can also request a fresh graphics renderer. Selection, player position, imagery, perspective and a paused route remain in their existing parent state. A failed retry returns to the usable 2D map rather than claiming that 3D loaded.

The close 3D view now includes the original explorer's partial head, shoulders, backpack and arms near the lower edge. It uses the same selected avatar, travel distance, direction, live/manual walking state and gesture actions as the third-person marker. This is a cropped character composition over the geographic camera; it adds no camera bob or XP. The body and all descendants pass pointer input through to the map. Third-person retains its world marker. Reduced motion, explicit pause, hidden-scene suspension and the illustrated fallback remain available.

The supplied YouTube reference could not be fetched by the available video/web tools. The implementation follows the owner's explicit partial-character request and original Food Go assets; no claim is made to have watched or copied that video.

| Trigger | Visible response | Alternatives and safeguards |
| --- | --- | --- |
| Temporary graphics loss or map startup failure | Interactive 2D map, explanation and Retry 3D | 3D and first-person buttons also retry; state stays in the parent. |
| Retry 3D | New geographic graphics canvas loads with the retained state | A repeated failure keeps 2D usable. No new location permission or account request. |
| Walk, GPS movement or an existing avatar action | Partial character shows the current rig animation in close 3D | No input interception; pause and reduced motion are retained. |
| Third-person selection or hide 3D | Close composition unmounts | Third-person retains the existing marker; the 2D renderer remains labelled. |

Independent Chrome checks passed 50 recovery assertions over six actual context-loss/retry cycles across desktop and touch. Both viewports also recovered inside the expanded map. The close component separately passed 16 pointer, motion and composition checks. One earlier expanded retry timed out after 45 seconds; focused repeats recovered in approximately four seconds, and no cause for that isolated timeout was established. These tests do not promise provider availability or physical-phone performance.

[Actual mobile close view](../screenshots/22-close-first-mobile.png) · [Actual desktop close view](../screenshots/22-close-first-desktop.png).

## Accounts

The actual provider blocker was `disable_signup=true`, corroborated by `signup_disabled`/422 logs and zero created accounts. The owner enabled signup and a fresh provider GET verified `disable_signup=false`, Email enabled and confirmation still required. The public deployment's account API still returns `503 configured:false`; local email transport has no enabled flag or signing secret. The supplied Brevo credentials do not replace the Supabase hook signing secret. No account, real message, confirmation or production-readiness claim was created during diagnosis.

The deployer must complete the public HTTPS Auth environment, signed Send Email hook, exact origins/callbacks and a real inbox confirmation/sign-in test. See [the current repair steps](../deployment/email-signup-repair.md). No new database migration is needed.

## Unsafe remote revision

The feature branch was unexpectedly force-updated from reviewed `f5d2069` to `7756dc1` during this work. Static comparison found four obfuscated `init` loaders wired into development/build/start scripts; the mobile entry point fetched and decoded remote blockchain transaction input and passed it to a dynamic function. The revision also removed environment-file ignore rules, added an unlocked dependency and deleted referenced font assets and licences. There were no legitimate product changes in that comparison.

Those loaders were neither checked out nor executed here. The safe reconciliation retains the reviewed scripts, locked dependencies, mobile entry point, font assets/licences and environment ignore rules while preserving remote ancestry. Two narrow security regression checks reject this specific bootstrap pattern and missing environment exclusions. They are not a universal malware detector. CI's failed dependency installation on the unsafe revision is separate from the map issue.

The owner and deployer were told not to install or start the unsafe revision. If anyone executed it elsewhere, treat that environment's credentials as potentially exposed, rotate them privately and review repository, hosting and provider access. This investigation does not establish execution or credential exposure on any other machine.
