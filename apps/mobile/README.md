# Food Go mobile foundation

This is the React Native and Expo Android/iOS foundation. The five primary screens are FoodDex, VenueDex, Explore, Quests and Passport, with Explore in the centre. Internal demo identifiers still use Map and Profile.

## Interface update

The latest corrected client direction uses light surfaces, readable green text and bright lime, sunny yellow and coral accents. It supersedes the dark pass. Both native demo and public API modes use the updated chrome; existing map artwork and business flows remain unchanged. The new web community Feed, expanded map, mall directory and external directions have not been ported to native. Native still has the existing five navigation areas listed above. Physical-device visual verification remains outstanding.

The larger illustrative map has numbered markers that match the venue rows. Food photographs are bundled locally from the same licensed files used by the web app. Venue names now match the website examples. Main body copy is 14 to 15 points, and interactive controls have at least a 44-point touch area. The app still uses one main vertical scroll and fixed bottom navigation.

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
- An original vector neighbourhood illustration and bundled food photographs, with no third-party map or image requests. See [asset credits](../../docs/assets.md).
- Clear all saved examples and trail plans from the guest profile.
- Expand and close an explanation of the preview without leaving the screen.

## Connected public catalogue mode

The default `demo` mode keeps the illustrated Melbourne map and the existing fictional examples. An optional `api` mode reads the website's public catalogue without opening mobile accounts or sharing any Supabase credentials.

Copy `.env.example` to the ignored `.env.local` inside `apps/mobile`, then set:

```text
EXPO_PUBLIC_CATALOGUE_MODE=api
EXPO_PUBLIC_API_ORIGIN=https://your-food-go-api.example
```

Use the exact API origin, with no path, query, credentials or trailing slash. HTTPS is required for a release build. During Expo development, HTTP is accepted only for `localhost`, `127.0.0.1` or `[::1]`. A physical device's loopback address points to that device, so use a reachable HTTPS API for device testing. The website must be running in Supabase catalogue mode; mobile API mode rejects a demo response instead of presenting fictional venues as real.

Restart Metro after changing environment values:

```sh
npm run start --workspace @food-go/mobile -- --clear
```

The variables above are public and ship in the application bundle. Do not put passwords, Supabase server keys, Brevo keys or SMS provider tokens in them. Native apps do not require browser CORS permission. Expo web needs the API's anonymous catalogue GET response to permit the preview origin through CORS.

In API mode:

- Explore searches published venues by name, suburb or cuisine and filters cafe, restaurant or market records through `GET /api/venues`. Each search loads at most 50 venues, with an explicit message when more matches exist.
- Venue details show owner-supplied public addresses and available menu items. Prices use AUD. A neutral icon replaces missing venue photographs, and no illustrative map positions are presented as actual locations.
- FoodDex uses the real menu-item UUID; VenueDex uses the real venue UUID. Saving a dish does not save its venue or verify that it was eaten.
- Saves retain the public details loaded during this app session. They do not persist across app restarts, automatically refresh, or sync to a website account. Availability and menu details may change after saving.
- Loading, empty catalogue, unavailable service and retry states are distinct. Invalid configuration, a provider failure or an empty database never falls back to fictional records.
- Connected quests have an empty state. This mode does not import the fictional trails or award progress.

The five focused catalogue tests use fake HTTP responses and perform no network calls:

```sh
npm run test:catalogue --workspace @food-go/mobile
npm run typecheck --workspace @food-go/mobile
```

## Explicit limits

In default demo mode, all venues, dishes and trails are fictional examples. In API mode, venues and available dishes come from the connected public catalogue. In both modes, saves live in component memory and reset when the app restarts. They are not synced to the web application. There is no connected mobile account, live map, GPS, check-in, QR scanner, permanent storage or awarded reward. The demo's illustrative map must never be described as an accurate street map.

The app requests no camera, microphone or location permissions. Android explicitly blocks those permissions for this foundation. Future location or check-in work must revisit those settings, consent copy and store declarations together.

Bundle identifiers `au.foodgo.app` are placeholders pending the client's legal identity, domain and store ownership. Store registration, device testing, release signing and production builds have not been completed by creating these files.

## Version policy

Use the installed Expo SDK's recommended React, React Native, safe-area and SVG versions. Run `npx expo install --check` from this directory when upgrading. Never resolve native dependency conflicts with forced peer dependency installation.

## Next mobile milestone

The public catalogue can be reviewed now against a configured website API. Mobile accounts and shared permanent saves require verified sign-in, secure session storage, account deletion and tested server-side access policies. Live maps then require an approved licensed provider, foreground permission requests at the point of use, and actual Android and iOS device verification. Reward decisions must remain on the backend.
