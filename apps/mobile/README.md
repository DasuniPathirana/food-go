# Food Go mobile foundation

This is the React Native and Expo Android/iOS foundation for milestone 1. The five primary screens are Map, FoodDex, Quests, VenueDex and Profile.

## Run

Install dependencies from the repository root, then run:

```sh
npm run start --workspace @food-go/mobile
```

Scan the Metro QR code in a compatible Expo Go installation, or use a development build. Android emulators require Android Studio. Local iOS builds require macOS and Xcode; an Expo cloud development build is an alternative.

```sh
npm run typecheck --workspace @food-go/mobile
```

## What works in this milestone

- Five tab navigation with the same position on every screen.
- Case-insensitive venue, suburb, cuisine and dish search.
- Cafe and restaurant filters and map-marker selection.
- Venue saves and dish wish lists for the current session.
- Join and leave sample quests without inventing verified progress.
- An explicitly labelled guest profile with a preview-only privacy preference.
- One vertical scroll container per screen, fixed bottom navigation, safe-area insets and labelled interactive controls.
- Original vector food and neighbourhood illustrations, with no third-party map or image requests.

## Explicit limits

All venues, dishes and trails are fictional examples. Saves and preferences live in component memory and reset when the app restarts. They are not synced to the web application. There is no connected account, live map, GPS, check-in, QR scanner, permanent storage or awarded reward. The illustrative map must never be described as an accurate street map.

The app requests no camera, microphone or location permissions. Android explicitly blocks those permissions for this foundation. Future location or check-in work must revisit those settings, consent copy and store declarations together.

Bundle identifiers `au.foodgo.app` are placeholders pending the client's legal identity, domain and store ownership. Store registration, device testing, release signing and production builds have not been completed by creating these files.

## Version policy

Use the installed Expo SDK's recommended React, React Native, safe-area and SVG versions. Run `npx expo install --check` from this directory when upgrading. Never resolve native dependency conflicts with forced peer dependency installation.

## Next mobile milestone

Connect the shared backend only after verified sign-in, session storage, account deletion and server-side access policies are tested. Then replace the illustrative map with an approved licensed map provider, add foreground permission requests at the point of use, and validate location behavior on actual Android and iOS devices. Reward decisions must remain on the backend.
