# Dependency review for milestone 01

Review date: 10 November 2026.

The initial install reported five moderate audit entries, including propagated Expo entries, from two underlying issues in its glob and minimatch tooling dependencies. No high or critical entries were reported in that initial audit.

- [Glob cancellation issue](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4): patched starting at 14.0.2.
- [Minimatch amplification issue](https://github.com/advisories/GHSA-g3hv-75wg-m249): patched starting at 11.0.1.

The root manifest pins glob 14.0.4 and minimatch 11.0.5 through overrides. Expo's installed uses of glob, globStream and the Minimatch constructor were reviewed for public API compatibility. The project stays on Expo SDK 58. React and React DOM are aligned with Expo's expected 19.3.0 renderer version.

The committed lockfile was regenerated from a clean dependency resolution so it includes the patched overrides. A clean root installation was then tested with that lockfile.

## Acceptance evidence

| Check                                         | Recorded result                                                                           |
| --------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `npm ci`                                      | Passed from the clean lockfile. Installation completed and reported zero vulnerabilities. |
| `npm audit --omit=dev --audit-level=moderate` | Passed with zero reported vulnerabilities.                                                |
| `npm run check`                               | Web and mobile type checks and nine domain or behavior tests passed.                      |
| `npm run test:security`                       | Eight static source-convention checks passed.                                             |
| `npm run build:web`                           | Next.js 16.4.6 production build passed.                                                   |
| `npm run check:web`                           | All 54 local HTTP assertions passed against the production preview.                       |
| Android and iOS production JavaScript exports | Both passed and produced platform-specific Hermes bundles.                                |
| Expo fingerprint API                          | Passed without the reviewed tooling API compatibility errors.                             |

The HTTP checks include changing CSP nonces, nonce application to framework scripts, the production restriction on unsafe evaluation, security headers, public search bounds, rejected cross-origin venue writes, disabled trusted-origin venue writes, and unknown-venue 404 behavior. They do not establish that every dependency execution path is compatible.

See [mobile toolchain verification](../progress/01-mobile-verification.md) for the export and fingerprint details, and [the foundation record](../progress/01-foundation.md) for browser interaction evidence. Native device execution and the 23 live database policy assertions remain unverified.

These overrides are a project compatibility decision, not upstream Expo certification. Review them with each Expo update and remove them when the supported upstream dependency tree contains the fixes. Audit results reflect the advisory data available on the review date. A clean dependency audit is not a penetration test or a promise of security.
