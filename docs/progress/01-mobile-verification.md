# Milestone 1: Mobile toolchain verification

Date: 10 November 2026

This record covers the React Native and Expo foundation in `apps/mobile` after a clean workspace dependency installation. It records real command results. It does not certify native device behavior or production readiness.

## Verified versions

| Package                        | Installed version |
| ------------------------------ | ----------------- |
| Expo                           | 58.0.23           |
| React                          | 19.3.0            |
| React Native                   | 0.88.1            |
| React Native Safe Area Context | 5.11.1            |
| React Native SVG               | 15.16.0           |
| TypeScript                     | 5.9.3             |

React, React Native, safe-area and SVG versions match `node_modules/expo/bundledNativeModules.json`. Dependency overrides for `glob` and `minimatch` are defined at the repository root. The fingerprint check below exercises one Expo tool that depends on those packages.

## Results

| Check                                | Result | Evidence                                                                                            |
| ------------------------------------ | ------ | --------------------------------------------------------------------------------------------------- |
| Mobile TypeScript                    | Passed | `npm run typecheck --workspace @food-go/mobile` exited with code 0.                                 |
| Android production JavaScript export | Passed | Metro bundled 2,781 modules and wrote a Hermes bundle of approximately 4.2 MB plus export metadata. |
| iOS production JavaScript export     | Passed | Metro bundled 2,782 modules and wrote a Hermes bundle of approximately 4.2 MB plus export metadata. |
| Expo fingerprint API                 | Passed | Returned the hash below and 19 source entries without an API compatibility error.                   |

The Expo fingerprint result was restricted to a hash and source count. Source contents were not printed:

```json
{
  "hash": "09ea568976edd354b87c8c407b63d1163429b609",
  "sourcesTotal": 19
}
```

The fingerprint is Expo's native configuration and dependency identifier. It is not a vulnerability assessment or a guarantee of bundle security.

## Reproduce the checks

From the repository root:

```powershell
npm run typecheck --workspace @food-go/mobile
```

From `apps/mobile`, run each export separately:

```powershell
$env:EXPO_NO_TELEMETRY = '1'
$env:EXPO_OFFLINE = '1'
node ../../node_modules/expo/bin/cli export --platform android --output-dir ../../artifacts/mobile-android --max-workers 2
node ../../node_modules/expo/bin/cli export --platform ios --output-dir ../../artifacts/mobile-ios --max-workers 2
```

From the repository root, run the fingerprint smoke check:

```powershell
node -e "const {createFingerprintAsync}=require('@expo/fingerprint'); createFingerprintAsync('apps/mobile').then(result=>console.log(JSON.stringify({hash:result.hash,sourcesTotal:result.sources.length}))).catch(error=>{console.error(error.message);process.exit(1);});"
```

Generated bundles are under `artifacts/mobile-android` and `artifacts/mobile-ios`. These directories are ignored by Git. They are local verification outputs, not app-store packages.

Observed bundle files:

- `artifacts/mobile-android/_expo/static/js/android/index-5f56369a133d8bb9287301b7d3fee0f4.hbc`
- `artifacts/mobile-ios/_expo/static/js/ios/index-e5aac7047f26ce4c66281b296d0597aa.hbc`

The CLI printed a non-blocking warning because the host set both `NO_COLOR` and `FORCE_COLOR`. The export result and process exit code determine whether the check passed.

## What these results establish

- The installed TypeScript declarations accept the mobile source.
- Both platform exports resolve the application's dependencies and produce platform-specific production JavaScript and Hermes bytecode.
- The fingerprint API can inspect the project with the installed dependency overrides.
- No dependency changes were needed during these checks.

## Checks still required before a mobile release

- Create signed Android and iOS native builds and inspect their actual permissions.
- Run on physical Android and iOS devices, including smaller screens and larger accessibility text settings.
- Test VoiceOver, TalkBack, safe areas, keyboard behavior, back navigation and restored application state.
- Connect and test authentication, private session storage, account deletion and the shared backend.
- Replace the illustrative map with a licensed map provider and request foreground location only when the implemented feature needs it.
- Test venue verification, QR replay protection and server-side reward rules before enabling real check-ins.
- Complete app-store account, signing, privacy and submission requirements.

No emulator, physical device or native GUI was launched for this verification. The app still uses fictional content and session-only React state. A successful JavaScript export must not be described as an installed or device-tested application. Native screenshots have not been captured in this verification step.
