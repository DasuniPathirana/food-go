# Web security controls

## Scope

The browser controls are a first layer of defence, not proof that the application is secure. This milestone contains a labelled demo. Backend authentication, venue authority verification, real persistence, check-ins, payments and uploads need their own review and tests before use with real accounts.

## Content security policy

`apps/web/src/proxy.ts` generates a fresh, cryptographically random 32-byte nonce for every page request. It overwrites the inbound `x-nonce` header, forwards both that nonce and the content security policy to Next.js, and sends the matching policy on the response. Next.js reads the request policy to apply the nonce to framework scripts. The root layout opts into dynamic rendering so a cached static page cannot reuse an unrelated nonce.

The page policy permits scripts through that nonce and `strict-dynamic`, without `unsafe-inline`. Development alone permits `unsafe-eval` for Next.js debugging. Production does not. The policy blocks framing and objects, limits base and form URLs to the same origin, and uses local images and fonts. Connections are limited to the same origin, plus loopback WebSocket addresses in development for live reload. No external map, analytics, auth or payment origin has been allowed yet.

Inline CSS remains permitted through `style-src 'self' 'unsafe-inline'` because the current React components use style properties and responsive components. This is a documented exception for styles, not a permission to run inline scripts. A future stricter style policy requires moving style properties into reviewed classes or providing nonce-compatible style handling.

API requests receive a restrictive `default-src 'none'` policy and do not need a script nonce. The proxy matches API routes and prefetched route requests, and skips known static resource paths. Common response headers are also configured in `next.config.ts` for all paths, including static resources.

## Other headers

- `X-Content-Type-Options: nosniff` reduces content-type confusion.
- `X-Frame-Options: DENY` accompanies the CSP framing restriction.
- `Referrer-Policy: strict-origin-when-cross-origin` limits cross-origin referrer detail.
- The current permissions policy disables browser camera, microphone, geolocation and payment access because those live integrations are not implemented.
- `Cross-Origin-Opener-Policy: same-origin` restricts cross-origin opener interaction. Future external sign-in flows must be tested against it.
- HSTS is sent only for HTTPS requests in production. The local HTTP preview does not receive it. Subdomain and preload commitments require a separate deployment review.

## Verification and limitations

`npm run test:security` runs static source-convention checks for RLS declarations, restricted grant conventions, CSP wiring, recognisable credential patterns, tracked secret files and prohibited UI characters. The checks do not read local `.env` files, except `.env.example` templates. They do not print matched token values.

These tests are not a SQL parser, a complete secret scanner, a browser test, a deployed-header test or a security audit. They cannot prove tenant isolation, session validity, secure file uploads or payment correctness. Run the actual Supabase integration tests, inspect deployed response headers and browser console behaviour, and complete the production gate before launch.

The nonce policy requires dynamic rendering and therefore reduces static caching opportunities. Review performance and delivery costs against measured production behaviour. When adding a vendor, allow only its required origins and verify CSP, cookies, redirects and permissions together. Do not solve an integration failure by broadly allowing all script or network origins.

References: [Next.js CSP guide](https://nextjs.org/docs/app/guides/content-security-policy) and [Next.js proxy convention](https://nextjs.org/docs/app/api-reference/file-conventions/proxy).
