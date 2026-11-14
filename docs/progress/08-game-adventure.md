# Milestone 08: daylight game adventure

13 November 2026. Target: desktop and mobile web browsers for the client's next-day demo.

## Delivered

The client requested stronger saturated colours and fonts on a light theme, while retaining the approved interactive map. The website now uses deep blue ink, warm cream, coral/tomato actions, gold progression and turquoise discovery. Fredoka and Nunito Sans are locally hosted with their OFL licences. The [research report](../research/08-game-ui-research.md) separates primary-source observations from Food Go design decisions and records measured colour contrasts.

The complete **/demo** adventure now has its own consistent shell, centred Explore navigation, prominent Feed, Passport, trails, rewards and a single persisted browser store. It restores route -> arrival -> simulated QR visit -> separate dish collection -> trail completion -> one-time claim. Passport reflects XP, levels, badges, activity and collections. Daily claims use Australia/Sydney dates. The feed awards bounded example participation XP and retains public/private walls, reactions, comments, shares and safe example moderation actions.

The map keeps the original scene, layered markers, explorer, radar and ambient animations. Pan, zoom, simulated walking and touch-drag controls remain. Optional panels disclose below the scene. Garden Arcade has one building marker and a three-shop directory with floors and units. All demo venue links stay inside /demo. The standalone prototype is unchanged.

Connected Supabase social progression is separate: approved stories, approved replies, received likes and qualified unique signed-in reach produce server-owned event identities. Public/private status, verified identity, self-exclusion, blocking, caps and deduplication are checked by SQL. Unlike, unpublishing, source removal and loss of eligibility withdraw derived XP while preserving historical award/cap slots. The browser submits a view after 50% visibility for three continuous foreground seconds; this is an impression qualification rule, not proof that a human read it.

The development migration is **20261113122412_food_go_social_xp** on the owner-approved Food go project. No production project was reset or deployed. No real email/SMS, account or venue fixture remains from database tests.

## Verification

| Check | Result |
| --- | --- |
| Workspace types and automated behaviour tests | 89 passed |
| Repository security conventions | 8 passed |
| Production website build | Passed |
| Production dependency audit | 0 reported vulnerabilities |
| Installed development database suites | 185 assertions passed: 27 tenant + 29 partner + 46 community + 83 social XP/reach |
| Candidate migration preflight | Existing 46 and new 83 assertions passed with schema and fixtures rolled back before applying |
| Local production HTTP smoke checks | 203 assertions passed |
| Fixture cleanup | Auth users, venues, community posts, views and XP events all 0 |

Browser QA used the in-app Chromium browser at desktop default 1280x720 and a 390x844 phone viewport override, with 375px usable document width after its scrollbar. It is not a physical-device Safari/Chrome certification. The verified scripted journey produced **682 demo XP**, level 4, two visits, two dishes, one claimed trail and four badges, then retained it after reload. Collection saving/filtering, daily claim disabling, public post, other-author like, comment and sharing to My wall were exercised.

The first paired visual review found a selected action disappearing after the first check-in, duplicate feed introduction banners and small phone labels. The correction batch keeps the selected venue after check-in, consolidates feed navigation/banners, increases game labels to 12px and ordinary prose to 14px, and carries the demo name into the feed. Final confirmation verified the first automatically routed trail stop still exposes the dish action after check-in, private posting leaves XP unchanged, and the edited name appears in the composer and own stories. Reward receipts clear after five seconds. Final screenshots are in docs/screenshots/08-*.

Supabase advisories report the deliberately closed private tables without policies and intentionally executable checked SECURITY DEFINER RPCs. These are not claimed as an empty advisory report: raw private access is revoked, the functions use empty search paths and bounded data, and the role-specific tests exercise the intended boundary. [Private RLS advisory](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [checked public RPC advisory](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [checked member RPC advisory](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

## Presentation and release boundaries

Use the [demo runbook](../demo/08-demo-runbook.md). Browser example XP is neither verified account progress nor redeemable credit. Unique reach is implemented and database-tested, but is not fabricated from the fictional audience in /demo. A real two-account deployed browser check still requires configured Auth and moderated content.

No public URL has been deployed during this delivery. Brevo sender/domain configuration remains with the owner. Mobile Message requires credentials, approved sender, credit, signed HTTPS hook setup and controlled delivery tests. Production account/SMS gates remain closed. Real QR/proximity/staff evidence, physical reward redemption, complete partner/operator workflows, deletion/retention and distributed abuse controls remain release work. The [go-live checklist](../launch/go-live-checklist.md) names each input and gate. The Expo native app has not received this complete browser UI and game implementation.

The result is a tested presentation path and connected progression foundation; no claim is made that every device, network or provider configuration works 100%.
