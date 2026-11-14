# Approved Explore map and database validation

Date: 13 November 2026.

The client-approved prototype is the visual reference for Food Go. The user specifically reaffirmed the Explore map, its animation and dimensional presentation. This direction is now recorded in the root [project instructions](../../AGENTS.md), so future interface work can follow it.

## Explore direction

The connected website is adopting the original prototype's illustrated neighbourhood, layered buildings, explorer, radar, floating food icons, photo-marker treatment, pan, zoom and walking controls. The map remains the main surface, with search above the scene and discoveries in a lower sheet. The original prototype remains intact.

The artwork creates depth with SVG and CSS. An illustrated explorer does not represent the user's real location. Live venue positions, visit verification and rewards still require their production data and server rules. Published catalogue records are kept separate from fabricated map positions. Example neighbourhood browsing is an explicit preview, rather than an automatic replacement when the live service fails.

Keyboard controls, touch scrolling and map movement, reduced motion and an ambient-motion pause control are part of the implementation. On phones, view, touch and pause actions share a compact toolbar, with walking in a separate row below the scene. Desktop retains floating walking controls. Browser verification is recorded below.

## Database work completed

The owner confirmed the empty Food go Supabase project as the development/test target. After that confirmation, the existing 27 tenant-policy assertions passed against its actual PostgreSQL database.

The partner-draft migration was then applied as version `20261112232102`. All 29 partner-workflow assertions passed. These cover confirmed email and Australian mobile identities, atomic private draft creation, duplicate detection, unchanged retries, changed retry keys, per-account limits and isolation from other accounts. A draft cannot publish or verify itself.

The earlier Docker attempt failed because its internal filesystem became read-only. To complete the database checks, a reviewed helper captured the existing pgTAP results and executed each complete suite through the CLI's native SQL-query path. It checks the plan, assertion count, numbering and final diagnostics before rolling back. A deliberately failed assertion and a deliberate SQL error both failed the command without a success marker.

The final database inspection found zero fixture users, organisations, venues, contacts or draft-request records. Temporary pgTAP installation and grants also rolled back. No hosted database reset was used, and no email or SMS was sent.

The security advisor's private-table and authenticated-function notices are explained in [the detailed analysis](04-project-analysis.md). The private ledger deliberately denies direct client access; the authenticated function requires controlled elevated authority to create the organisation and draft together. The tested actor and data checks remain inside that function.

## Verification record

| Check | Result |
| --- | --- |
| Tenant-policy database assertions | 27 passed and rolled back |
| Partner workflow database assertions | 29 passed and rolled back |
| Automated application and runner tests | 63 passed |
| Updated Explore type checks and production build | Passed after the final mobile-control correction |
| Production HTTP assertions | 133 passed, including the explicit preview and example detail routes |
| Static security conventions | 8 passed |
| Desktop and mobile-width map interaction | Pan, zoom, button and keyboard walking, ambient pause, touch/page-scroll modes and example detail links passed. Live Explore showed zero fictional markers. Content width matched scroll width at the tested phone size. |
| Independent finish review | The reviewer confirmed fidelity to the approved map direction, identified one phone-control overlap, then scored that correction resolved from the replacement captures and source. No further correction was requested for that finding. |

Review captures: [desktop viewport](../screenshots/05-explore-desktop.jpg), [phone map and toolbar](../screenshots/05-explore-mobile-top.jpg), and [phone walking row](../screenshots/05-explore-mobile.jpg). These show the website at tested viewport sizes, not a native-device release. The local production preview is available at `/explore-preview`; `/` retains the connected catalogue.

## Remaining work

Account and messaging release flags stay disabled until the approved Mobile Message sender, server credentials, reachable hook and controlled phone sign-in have been configured and tested. Brevo setup remains deferred at the user's request.

The illustrated map is not yet a licensed geographic map. Native phone account flows, native map parity, saved-draft editing, ownership review, administration, verified check-ins and rewards, bookings, payments and community operations remain separate implementation work. Android and iOS bundle exports do not establish physical-device or store readiness.
