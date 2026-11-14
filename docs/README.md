# Food Go project documentation

This documentation explains what exists, what has been checked, and what will be built next. It is intended for both the client and the development team.

## Start here

- [Compact phone map controls](progress/13-compact-map-controls.md): smaller search and control groups, on-demand filters/tools and preserved tap targets.
- [Milestone 12: Passport and deployment](progress/12-passport-and-deployment.md): compact single-scroll pages, familiar darker text, personal wall under Passport and repository/deployment handoff.
- [Website deployment handoff](deployment/README.md): Vercel monorepo settings, Node.js start commands, environment manifest and release checklist.
- [Map fit and navigation refinement](progress/11-map-fit-and-navigation.md): complete viewport scene, inline walking, compact phone controls and selected-place external Maps access.
- [Milestone 10: neighbourhood guide](progress/10-neighbourhood-guide.md): refreshed desktop/phone UI, preserved map and game interactions, screenshots and delivery verification.
- [Distinctive UI research](research/10-distinctive-ui-research.md): inspected weaknesses, primary-source precedents, Food Go design judgements and validation limits.
- [Current design system](../DESIGN.md): colours, typography, page compositions, motion and product-truth rules.
- [Optional avatar choices](progress/09-avatar-options.md): original/3D/anime choices, preview/apply, idle behaviour, actions and browser preference scope.
- [Milestone 08: game adventure](progress/08-game-adventure.md): unified browser demo, saturated light UI, game progression, server XP, signed-in reach and measured verification.
- [Browser demo runbook](demo/08-demo-runbook.md): entry URL, startup, reset, scripted presentation and honest boundaries.
- [Go-live inputs and gates](launch/go-live-checklist.md): what the owner must provide, provider setup and engineering work still required.
- [UI and game research](research/08-game-ui-research.md): official-source findings, alternatives, palette, type and product decisions.
- [Milestone 07: bright community](progress/07-bright-community.md): introduction of light styling, public and personal walls, posts, likes, comments, sharing and Supabase verification. Its palette and type are historical.
- [Milestone 06: dark Explore and navigation](progress/06-dark-explore-and-navigation.md): historical dark palette (superseded), expandable panels, mall shop directory, centred Explore, Passport and external directions.
- [Milestone 05: approved Explore map and database validation](progress/05-approved-map-and-database.md): prototype fidelity, interactive controls, screenshots and actual hosted database test results.
- [Milestone 04: complete project analysis](progress/04-project-analysis.md): shared-chat requirements, current Supabase state, connected work and remaining product scope.
- [Email and SMS setup](integrations/messaging.md): Brevo SMTP, Mobile Message hook and Australian mobile sign-in.
- [Milestone 03: Supabase connection](progress/03-supabase-connection.md): actual SDK checks, local configuration and remaining management access.
- [Milestone 02: redesign and identity](progress/02-redesign-and-identity.md): revised interface, account foundation, screenshots and latest checks.
- [Illustrated Word report](deliverables/Food-Go-Development-Report.docx): simple English walkthrough, subscriptions and client actions.
- [Identity setup and release requirements](security/identity.md): account configuration, security boundaries and work required before public registration.
- [Identity verification](progress/02-identity-verification.md): actual source and test evidence.
- [Revised mobile verification](progress/02-mobile-verification.md): Android, iOS and Expo web export results and remaining device checks.
- [Milestone 01: foundation](progress/01-foundation.md): work delivered, screenshots, checks, and limitations.
- [Mobile toolchain verification](progress/01-mobile-verification.md): Android and iOS JavaScript export evidence and the native checks still required.
- [Architecture](architecture.md): how the mobile apps, website, portals, and shared data fit together.
- [Roadmap](roadmap.md): staged delivery and acceptance criteria.
- [Decisions](decisions.md): the reasons behind important technical and product choices.
- [Security documentation](security/): threat model, database controls, and release requirements.
- [Foundation source review](security/review-01.md): reviewed access boundaries and remaining live verification.
- [Web security controls](security/web-controls.md): browser policy, response headers, and their limitations.
- [Dependency review](security/dependency-review.md): patched dependency overrides, clean-install results, and compatibility evidence.
- [Production gate](security/production-gate.md): requirements that must be met before real accounts and production use.

## How each milestone is documented

Every milestone should record:

1. The user problem and agreed scope.
2. The completed behavior, with clear separation between examples and connected services.
3. Screenshots of the relevant desktop and mobile layouts.
4. The checks actually run and their results.
5. Known limitations, security implications, and follow-up work.

Screenshots are evidence of a particular state. They do not establish that authentication, payments, location verification, or data security works. Those flows require their own tests.

## Writing and interface conventions

- Use plain English and Australian spelling in product copy.
- Do not use emojis or em dashes.
- Keep a single main vertical scroll area per screen. Avoid separately scrolling panels inside a page.
- Use readable contrast, descriptive labels, generous touch targets, and consistent spacing.
- Describe security controls precisely. Never describe a system as impossible to hack.
- Do not include passwords, access tokens, private customer records, or production environment values in documentation or screenshots.

## Evidence status

Milestone 12 is the current browser UI and deployment-handoff delivery. Milestone 11 records viewport-fit maps and inline walking; Milestone 10 records the neighbourhood-guide redesign. Milestone 09 records avatar behaviour; Milestone 08 records the unified demo game and connected social XP work. Milestone 05 records the approved-map integration and earlier database validation. Milestone 04 is the complete foundation analysis. Each page preserves the checks at its delivery date. A prepared deployment configuration does not establish successful remote CI, public deployment or live account readiness. Future capabilities described in the roadmap are not claims that those capabilities are available today.
