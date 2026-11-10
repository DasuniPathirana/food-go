# Food Go project documentation

This documentation explains what exists, what has been checked, and what will be built next. It is intended for both the client and the development team.

## Start here

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

The first milestone is a development foundation. Its progress page is the source of truth for current verification. Future capabilities described in the roadmap are not claims that those capabilities are available today.
