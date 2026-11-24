# Melbourne production recovery

Date: 24 November 2026. This branch is not approved for public release.

## Verified blockers

- The owner-selected hosted development/test Food go project is healthy, has all 18 repository migrations, but has zero venue rows and zero active promotions (read-only checks).
- Public deals previously displayed fictional fallback offers and an alert claiming redemption. The connected UI now renders only published promotions with their actual titles, descriptions and expiry, and links to the venue rather than claiming a redemption.
- Geographic Explore previously created a fictional AR collectible at any selected point. This entry and simulated claim are disabled. Existing staff-verified encounters remain available behind their existing gate.
- Hardcoded mall shop and reward directory is removed from the primary world. The real venue-member list remains. Indoor floor authoring, navigation and verified floor-specific rewards still require implementation.
- Production query-string demo switches are disabled for the geographic world. Development-only visual fixtures are not launch content.
- Real account sign-in, moderation, owner onboarding and security gates require acceptance against the intended deployment. Do not bypass provider verification flags.
- The current project is explicitly a development/test target in connected-release.md. Confirm production environment and backups before any real customer launch.

## Reviewed asset installation

Extract the supplied FoodGo_Release_Asset_Library.zip into the repository root. It includes CC BY 4.0 model attribution and an empty venue association manifest. Review model licenses, third-party marks and geometry on real phones. Commit only reviewed files with the credits, never secrets or arbitrary binary uploads. The repository explicitly permits the named world model files. Ensure the actual GLB bytes are tracked and included in the deployment; local-only files will not reach Vercel.

Use an actual published venue ID as the manifest venueModels key and an allowed storefront asset ID (kyotoRestaurant, isometricCafe, japaneseBakery or stylizedFoodTruck). The assignment is an illustration, not a verified replica. Unassigned venues retain procedural fallback. Imported storefronts are capped per model in the renderer. Reward crates, benches, lamps and rocks in the library are reserved for further scene integration and do not currently enable rewards or automatic placement.

## Release acceptance (all required)

1. Review this branch and CI; check production build and real device mobile screenshots.
2. Verify exact client polygon against approved source, map zoom/fog, attribution, GPS and routing.
3. Onboard genuine restaurant owners, verify authority, approve listings/coordinates and genuine deals. Do not seed fictional businesses as live partners.
4. Test email/phone signup, reset, signout, owner and operator access, privacy and deletion.
5. Implement and test owner-submitted model and floor placement with independent moderation; no arbitrary file URLs or unverified coordinates.
6. Implement persistent owner/admin loot campaigns with server-side pilot/proximity validation, time and stock rules, atomic one-time claims and XP ledger; use camera overlay as presentation only. GPS is imperfect and cannot verify floor reliably. Use venue staff confirmation or an approved indoor verification mechanism where needed.
7. Test the complete live Feed, Deals, Explore, Quests, Outback and inventory journeys with consenting accounts, including denied location/camera permission and weak networks.
8. Clear docs/security/production-gate.md, obtain operator and hosting-team approval, deploy the reviewed revision, verify live HTTPS and rollback procedures.

See docs/deployment/connected-release.md for the existing host and feature gates. A passing build alone is not release approval.


## Follow-up implementation

- GitHub Actions run 45453651163 passed the clean install, production build, dependency audit and isolated database tests for 423833f.
- Camera encounters now use the existing approved campaign and staff confirmation path. The camera is optional, does not upload frames, and stops on exit or hidden page. It is a camera overlay, not spatial AR or GPS-only claim authorization. The newly added browser test covers camera refusal and rejected confirmation; real-device acceptance remains outstanding.
- The Deals view links to the selected published offer on its venue page. Inventory redemption still uses the existing staff code flow; public advertised deals are not automatically collectible vouchers.
- Explore loads up to 500 published, verified, geocoded pilot venues with a paginated geographic query rather than using a global 50-result catalogue. It applies the exact pilot polygon after the bounding query. This is a bounded initial load; additional results use search. Nearby 3D storefronts prioritize distance. Large-catalogue performance and device rendering still require acceptance.
