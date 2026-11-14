---
name: Food Go
description: A neighbourhood food guide with a living map, food stories and collected experiences.
colors:
  canvas: "#fffefa"
  surface: "#ffffff"
  surface-raised: "#f4f3ed"
  ink: "#111111"
  forest: "#111111"
  muted: "#414141"
  line: "#dddcd4"
  coral: "#f26a4f"
  primary: "#c73527"
  gold: "#f4ce55"
  success: "#337363"
  passport-cover: "#303a31"
  focus: "#2459d3"
typography:
  display:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "clamp(28px, 3.2vw, 40px)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.4
  brand:
    fontFamily: "Bricolage Grotesque, Arial, Helvetica, sans-serif"
    fontSize: "35px"
    fontWeight: 800
    lineHeight: 1
rounded:
  control: "5px"
  photo: "8px"
  panel: "7px"
spacing:
  compact: "8px"
  group: "12px"
  section: "24px"
  desktop-inset: "32px"
  mobile-inset: "20px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "11px 17px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "11px 17px"
---

## Overview

Food Go is a neighbourhood food guide people use together. Milestone 12 retains the light theme and approved animated map, with fresh white surfaces, near-black functional text, tomato actions and butter-yellow progression. The audience is all ages, as requested by the owner. Clear food photography and useful local content balance the playful map and optional game characters.

The desktop masthead, original fork/map-pin mark and open page layouts replace the wide dashboard sidebar and repeated cream cards. Each destination has its own composition: Explore is map-led, Feed is story-led, trails pair photography with a route, collections use open captions, and Passport has a deep-green identity cover. The earlier dark, sage/lime and Fredoka/Nunito browser directions are historical.

## Typography

Use the familiar Arial, Helvetica, sans-serif stack for functional headings, stories, navigation, forms and labels. This is the owner's requested move towards a familiar social-app reading style. Bricolage Grotesque remains only in the original Food Go wordmark, rather than across page headings. Its unmodified local font and OFL licence remain in `apps/web/public/fonts`; the earlier Source Sans 3 and other licensed files are retained for historical designs.

Demo headings use weight 700 and 1.15 line height, with the main title capped at 40px on desktop and 30px on phones. The demo body is 16px with 1.55 line height; shared catalogue body is 15px with 1.6 line height. Metadata is generally 12–14px. Use near-black text to strengthen reading without making every secondary label bold or every heading oversized.

## Colour and contrast

Tomato identifies decisive actions, yellow identifies XP and rewards, dark ink carries reading and navigation, and green supports completion states. Cobalt provides visible keyboard focus. The Passport cover uses `#303a31`; it is a contained identity surface within the light theme.

Measured colour pairs are near-black ink/canvas 18.71:1, muted/canvas 10.12:1, white/tomato 5.29:1 and ink/yellow 12.41:1. These measurements describe those pairs, not a claim that every rendered state has been audited. Use dark text on bright accents and white on the deeper action colour. Selected, collected and completed states also need labels, icons or progress, rather than colour alone.

## Layout

Explore is the initial demo screen and middle phone navigation item. Feed, FoodDex, Explore, VenueDex and Passport share labelled navigation. Desktop uses a horizontal masthead with compact progress and reward access; phone uses a fixed five-item bottom bar with safe-area spacing. Food trails remain reachable from the guide links and map mission. The owner confirmed one natural vertical page scroll with compact sections, rather than forcing every tab's entire content into one viewport. Footer links retain access to the connected catalogue, help and privacy.

Content introductions use 26px top padding on desktop and 20px on phones, with shorter title spacing and open statistics. Collection photography is 210px high on desktop and 145px on phones; trail compositions retain their route-specific image treatment. Keep the primary task close to the top and let longer feeds and collections continue in the document scroll. Avoid independent vertical scrolling containers for each section.

Fit the complete Explore scene beneath the measured page header and above phone navigation. Use a compact arrow pad directly on the map, with small icons inside 44px targets. On phones its painted buttons are 32px, leaving the surrounding map visible. Recommendations, full selected-stop actions, avatar options and mall directories disclose below the scene. Phone filters, trail/selected-place shortcut and view tools use optional compact popovers; the default view keeps one slim search bar and three small utility icons. Group one mall's shops into one building marker with a count and floor/unit directory. Preserve scene height, pan, zoom and keyboard/touch controls when content expands. Routes lead to explicitly simulated arrival, visit and separate dish actions below the map.

Feed uses a short Community heading, inline Public/My wall controls, an economical composer and a flat story stream with food photography. Do not restore a large promotional card or nested navigation above the stories. Food trails use a photo/route layout, stacking on phones. Collection counts use available width rather than reserving an empty fourth column.

Passport combines a compact identity/progression cover with the user's own wall directly underneath, including the composer and their stories. Its embedded wall stays scoped to the owner and omits duplicate public-wall navigation, promotional rails and Community introductions. Avatar choices, counts, trails, milestones, activity and reset remain in a native expandable profile-details section. Keep the same document scroll through cover, details and wall. Connected Passport uses the account's own wall when identity is available; guest/disabled states remain explicit. Game totals derive from event history rather than independent screen counters.

## Motion and depth

Keep the approved dimensional map artwork, food photo markers, explorer, radar and ambient motion. Motion pauses offscreen, in hidden tabs, on request and under reduced-motion preferences. Ordinary rewards use a concise XP receipt. Progress, disabled actions and completion states must remain understandable without animation.

Use restrained borders and depth around content. Most ordinary page sections use spacing and dividers rather than nested rounded containers. Keep circular anchors for avatars and map markers where their shape has a purpose. Use Lucide icons consistently. Header XP, notification and avatar controls provide at least 44px targets; compact map controls retain their established interaction layout.

## Product truth

Avatar personalisation is optional. Keep the original illustrated character as the default, with rounded 3D and anime inspired alternatives behind Avatar or Passport's Change avatar control. Use one selected 3D preview with static illustrated thumbnails, transparent map framing and a quiet gold stage. Apply commits the cosmetic browser choice; closing keeps the current character. Idle/action animation follows map pause and reduced-motion settings. Avoid opening a persistent customisation tray over the map.

The /demo namespace is a cohesive browser-only adventure with fictional places, posts, check-ins and XP. Keep that boundary clear while avoiding duplicate disclaimers in every section. Connected community progression is server-derived and separate. Anonymous demo activity is not unique signed-in reach. Real navigation links use approved genuine venue destinations; illustration coordinates never become directions. Demo selections may open an explicitly labelled real suburb/area search in Google Maps or Apple Maps. Never pass a fictional street address or scene coordinate to navigation.

The standalone prototype is unchanged. The Expo native app has not received this complete browser redesign. The design decisions and primary-source research are in [Milestone 10 research](docs/research/10-distinctive-ui-research.md); [go-live requirements](docs/launch/go-live-checklist.md) remain separate release gates. A visual refresh does not establish production account readiness or physical-device performance.
