# Community acknowledgement and consent

Version: `food-go-community-2026-11-15`. Public wording is available at `/acknowledgement` and maintained in `apps/web/src/lib/community-policy-copy.ts`. The same wording appears in registration and the verified-account prompt.

## Client request and implemented wording

Food Go aims to support hospitality and agriculture, economic activity and employment. The acknowledgement asks users to act respectfully, take service disputes to the business and serious concerns to the relevant authority, and remain responsible for their own unlawful conduct under applicable law. Breaches can lead to content removal, restrictions or suspension after review.

The supplied draft was revised rather than published verbatim:

| Draft provision | Implemented approach |
| --- | --- |
| Ban every negative post about any party | Prohibit abuse, threats, harassment, personal attacks, false allegations and misleading or unlawful content. Allow truthful, respectful first-hand criticism. Moderation and XP eligibility do not depend on positive sentiment. |
| All issues must be resolved outside Food Go | Direct service disputes to the business and relevant authorities while preserving Food Go reporting/blocking tools and lawful complaints. Food Go does not determine these disputes. |
| Automatic ban from every sister platform | State possible Food Go restrictions or suspension after review. No other service is connected to an enforcement system in this repository. |
| All damages and legal consequences automatically fall on the user | State responsibility for one's content and unlawful conduct under applicable law, preserving rights that cannot legally be excluded. A checkbox does not determine liability. |

The ACCC says suppressing genuine negative reviews may mislead consumers and that publication/removal policies should be clearly displayed. It also warns that incentives for reviews must not depend on whether a review is positive or negative. [ACCC review guidance](https://www.accc.gov.au/business/advertising-and-promotions/online-reviews-for-product-and-services). Consumer guarantees cannot be removed by a business's statements. [ACCC consumer rights](https://www.accc.gov.au/consumers/buying-products-and-services/consumer-rights-and-guarantees).

The final terms, business-specific liability provisions and any proposed sister-platform enforcement need an Australian legal review before publication as contractual terms. This implementation supplies a conduct acknowledgement, not a conclusion about the enforceability of the client's original draft.

## Consent journey

- Registration includes an unchecked required acknowledgement box and readable expandable wording. Server validation rejects a missing, false, string-valued or stale-version choice for either account type.
- After email confirmation, first verified sign-in asks the account holder to confirm the rules. Phone-created and existing accounts receive the same prompt. This second step creates a receipt tied to verified identity; the signup checkbox is not treated as database proof.
- Accept remains disabled until the box is ticked. No receipt is recorded by loading, scrolling or continuing to browse. Escape and Continue browsing dismiss the prompt. An unaccepted account sees a review entry in Feed and Passport.
- Successful acceptance records one receipt per account/version with the database's timestamp. Retrying does not overwrite the original time. Reloaded accepted accounts are not prompted again. No local-storage flag or editable Auth metadata can grant acceptance.
- Posting, commenting, liking and sharing require the current receipt. Browser controls reflect this rule; the database independently enforces it even through direct RPC calls. Reports, blocking and deletion remain usable without consent. Browsing and other non-social features are not withdrawn for declining.
- New or amended wording requires a new version in the client contract and a migration updating the database's current version. Preserve old wording in version control and old receipts. Do not silently edit an already accepted policy.

No additional IP address, device fingerprint or user-agent record is collected as acceptance evidence. Receipt access is restricted to the caller through narrow functions; clients cannot read or write the private table directly.

## Moderation and account restrictions

Public posts and comments continue to require independent operator approval. The operator decision form links the policy and explains that a negative experience alone is not a reason for removal. Existing decision notes and audit records remain in place. No keyword filter automatically labels criticism a breach or imposes a ban.

Project administrators manage Auth account suspensions through their existing Supabase administration process. All community-write actions now check Auth's banned-until state. The new feature does not provide a cross-platform ban service or promise that every previously issued token and every private-read endpoint is immediately revoked. Review account-wide suspension/session-revocation controls separately before making broader enforcement claims.

## Deployment and verification

Apply `20261115163751_food_go_community_acknowledgement.sql` after earlier pending migrations. Deploy the matching application version. If the migration is missing or the current version differs, acknowledgement checks and contribution writes fail closed. No existing account is silently marked accepted. The release remains PR-only; no hosted migration was applied for this change.

The API has trusted-origin checks, body/operation deadlines, no-store responses and bounded strict input. SQL tests cover caller isolation, explicit/current-version acceptance, metadata forgery, idempotent timestamps, direct-table/function bypass, consent gates, banned-account writes, and safety actions before acceptance. The isolated signup-to-XP workflow checks rejection before consent, first acceptance and retry receipts, then the existing post moderation and social XP journey.
