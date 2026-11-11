# Mobile interface verification

Recorded on 11 November 2026.

The redesigned mobile interface uses the actual React Native application source. It has a warm paper background, bold system typography, a larger numbered map and locally bundled food photographs. Venue names match the website examples. The controls keep saved plans separate from verified visits and rewards.

## Completed checks

| Check | Result |
| --- | --- |
| Mobile TypeScript | Passed with `npm run typecheck --workspace @food-go/mobile`. |
| Android production JavaScript export | Passed. The completed final-source run was confirmed during resume. It includes 2,785 modules and three food photographs. |
| iOS production JavaScript export | Passed in a fresh run after resume. It includes 2,786 modules and three food photographs. |
| Expo web export | Passed with 2,273 modules and three food photographs. |
| Local web preview | The generated HTML, application bundle and a photo return successfully from the loopback preview server. |
| Preview server boundaries | Ten HTTP assertions passed, including blocked directory escape, rejected invalid paths, rejected write methods and proper missing-file responses. |

The export commands were:

```sh
npm exec --workspace @food-go/mobile -- expo export --platform android --output-dir ../../artifacts/mobile-v2-android --max-workers 2
npm exec --workspace @food-go/mobile -- expo export --platform ios --output-dir ../../artifacts/mobile-v2-ios --max-workers 2
npm exec --workspace @food-go/mobile -- expo export --platform web --output-dir ../../artifacts/mobile-v2-web --max-workers 2
```

The resulting native JavaScript bundles are:

- Android `index-3b3eafa3f35188e4d511e5900d24f03e.hbc`, 4,159,196 bytes.
- iOS `index-8d695c2dbbb5598d8df0cd9fca9462fd.hbc`, 4,153,336 bytes.

The web bundle is `index-4e96e162e4eb2fddaf13963ea05d2b73.js`. Generated export files stay in the ignored `artifacts` directory.

## What can be reviewed

The Expo web preview runs the mobile application's own screens in a browser. It can show the map, search and venue filters, saved places, dish ideas, trail plans, guest profile, clearing saved examples and the About preview disclosure. This is distinct from resizing the Next.js website to a phone width.

Screenshots from that preview should be labelled **Expo web preview of the mobile interface**. They must not be described as Android or iPhone device screenshots.

The preview server binds only to `127.0.0.1` and serves only the generated web export. It is a temporary QA tool, not the production hosting setup. The owner of the screenshot workflow will stop it when capture is complete.

## Remaining checks

These exports do not create a signed Android or iOS store build. Actual Android and iPhone installation, safe-area behaviour, larger accessibility text, screen readers and release signing still need device testing.

Native accounts, shared permanent saves, live maps, GPS, secure QR check-ins and verified rewards are not connected. Saved examples and privacy preferences remain in app memory for the current session. No camera, microphone or location access is requested in this stage.
