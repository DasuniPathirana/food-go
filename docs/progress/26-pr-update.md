# PR update, 18 November 2026

PR12 targets develop and now includes the existing map foundation, camera/discovery and restaurant-encounter work recorded in milestones23–25. The owner's local changes are preserved. No deployment, hosted migration application, account, email or SMS was performed by this publication pass.

Read-only hosted migration history confirmed eighteen installed versions through `20261118000948_food_go_encounter_foreign_key_indexes.sql`. Do not reset the project or reapply these versions. Geographic recording and encounters remain disabled by default; real accounts, messaging, approved campaigns and physical-device acceptance retain their separate requirements.

Verification in this pass: workspace types and271 application tests passed; all10 security convention checks passed. The browser suite built and served the production website, passed46 of48 cases, and reported two desktop failures while another project task was completing changes. After that task finished, both affected cases passed three times on desktop and phone,12 repeated cases total. The owner separately confirmed their build completed. Earlier milestone25 records its own full-run/isolated-rerun and178-assertion HTTP evidence. No clean48-case single-run claim is made for this publication pass.

The whole-workspace production dependency audit fails with25 high findings propagated from picomatch through Expo/React Native tooling. The [reviewed advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) lists versions through4.0.7 as affected and no published patch as checked18 November. Installed npm-managed web/shared-domain production graphs contain no picomatch edge; this is graph scope, not proof that every bundled component is unaffected. No audit suppression, forced SDK downgrade or unreviewed dependency patch was applied. The existing CI audit gate remains unchanged, so this is an explicit merge/release blocker.

CI must run against the pushed head, including all repository SQL suites. The earlier unsafe startup-loader revision remains excluded from the current tree, environment files remain ignored, and the original prototype is unchanged.
