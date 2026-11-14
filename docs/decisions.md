# Food Go decisions

Decisions below describe the starting direction. Revisit them when requirements or evidence changes. Record the reason and migration impact when changing a decision.

| ID  | Decision                                                                            | Reason                                                                                       | Consequence                                                                                                                                      |
| --- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| D01 | Use React Native with Expo for Android and iOS, and Next.js for web interfaces.     | Matches the requested technologies and keeps each platform suited to its primary task.       | Business rules and types can be shared. Native and browser screens still need separate implementation and testing.                               |
| D02 | Keep the applications in an npm workspace monorepo.                                 | Allows coordinated changes to shared contracts without separate releases for every package.  | Root dependency installation and checks must cover all workspaces.                                                                               |
| D03 | Use one shared venue and food data model.                                           | Prevents duplicate information between the game and marketplace.                             | Changes to venue eligibility and publication must be enforced consistently.                                                                      |
| D04 | Start with PostgreSQL, PostGIS, and Supabase.                                       | Fits related marketplace records, nearby search, authentication, and row-level access rules. | Hosted configuration and live database policy tests are required before real use.                                                                |
| D05 | Include a native mobile foundation in the first milestone.                          | The latest request explicitly asks to start building Android and iOS as part of the project. | This updates the original brief's suggestion that native apps could come later. It does not mean the initial foundation is an app-store release. |
| D06 | Keep illustrative discovery content separate from production behavior.              | The product should be reviewable without implying that unconnected services work.            | Demo records, maps, drafts, and progress must be identified honestly.                                                                            |
| D07 | Start with one organised backend rather than a separate service for each feature.   | Reduces operational complexity while product rules are still being established.              | Keep module boundaries clear so specialised jobs can be separated when needed.                                                                   |
| D08 | Keep visit verification separate from dish verification.                            | Presence at a venue does not prove consumption of a specific dish.                           | Each needs its own record, evidence, and reward rules.                                                                                           |
| D09 | Keep privileged decisions on the server and enforce tenant access in the database.  | Clients can be modified and requests can be replayed.                                        | Interface restrictions must be backed by database policies and tested server authorization.                                                      |
| D10 | Use calm neutral and green surfaces with strong text contrast.                      | Supports an approachable food discovery experience without visual clutter.                   | Accent colours cannot be the only way to communicate status.                                                                                     |
| D11 | Use one main vertical scroll area per screen.                                       | Meets the requested space-management behavior and avoids competing scroll areas.             | Responsive layouts should reflow or use bounded horizontal interaction instead of nested vertical panels.                                        |
| D12 | Do not use emojis or em dashes in interface copy or project documentation.          | Explicit user preference.                                                                    | Review new copy and documentation for these characters.                                                                                          |
| D13 | Support Australia-wide data while validating initial venue density in a pilot area. | A useful map needs participating venues, not only national technical coverage.               | Geographic marketing expansion should follow content quality and operational capacity.                                                           |
| D14 | Do not collect customer dining payments in the foundation milestone.                | Payment routing, refunds, commissions, and payouts need a separate agreed commercial model.  | Later payment work must distinguish physical meals from digital app entitlements.                                                                |

## Decisions required before production onboarding

1. Which evidence proves that a person is authorised to manage a venue?
2. Which checks can approve a venue automatically, and which need review?
3. Who supplies the initial venue and food catalogue content, and under what licence?
4. What evidence makes a dish experience verified?
5. Are reservations enquiries, external booking links, or inventory-backed confirmed reservations?
6. Does Food Go only record offer redemption, or does it also collect and distribute dining payments?
7. What are the retention periods for precise location, visit evidence, photos, and closed accounts?
8. Who handles moderation, disputes, security incidents, and support after launch?

These decisions do not block building the foundation. They do block claiming that the affected production workflows are complete.
