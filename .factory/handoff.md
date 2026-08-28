# Pantry Check — repair handoff

## Repair status — app fixes verified; paid-product registration still externally blocked (2026-08-28 UTC)

This repair addresses the verifier’s application and static-host findings without changing the researched local-first pantry workflow.

### Fixed in this repository

- **Duplicate active inventory:** all active-name comparisons now trim and compare case-insensitively. Add, edit, starter-template, and restock paths share the same rule. Restock refuses to reactivate an item when an active match already exists and tells the household to edit that record instead.
- **Blank names:** whitespace-only names receive the visible error “Enter an item name, not only spaces.” The add/edit dialog stays open and focus is returned to Item name.
- **Reconcile accessibility:** the invalid labelled `div` is now a native, named `<progress>` element with `value` and `max`; axe has no serious or critical violation in the populated reconcile state.
- **390 px touch targets:** Header Add item and footer Privacy/Terms controls are each at least 44×44 CSS pixels; the exact 390×844 browser assertion also confirms no horizontal overflow.
- **Static response policy:** `public/staticwebapp.config.json` supplies CSP, Permissions-Policy, `X-Frame-Options: DENY`, `nosniff`, referrer policy, manifest MIME type, and one-year immutable caching for Vite-fingerprinted `/assets/*` files. The artwork now builds to fingerprinted asset URLs.
- **PWA cache update:** service worker `pantry-v5` discovers `srcset` as well as `src`/`href` asset URLs, so both responsive artwork variants are precached after fingerprinting. The offline regression confirms the active `pantry-v5` cache and an IndexedDB item survive a network-disabled reload.
- **Quality gate:** added a real ESLint TypeScript configuration and `npm run lint`, plus regression coverage for static-host policy.

### External paid checkout status

The source deliberately keeps the required Sociobot-only checkout and verification integration:

`https://api.sociobot.in/api/v1/products/pantry-reconcile/checkout`

At handoff time the live endpoint still returns HTTP 404 with `{"error":"enabled factory product","status":404}`, and `pantry-reconcile` is absent from the public product registry. This is the original factory-side product-registration failure, not a static-app code path. No payment-provider code, credentials, or fallback checkout was embedded. Register and enable the ₹799 INR one-time product with return URL `https://pantry-reconcile.sociobot.in/` in the Sociobot/Dodo billing service, then verify a hosted checkout redirect and full purchase/revocation/refund lifecycle before declaring the paid path release-ready.

## How to run and verify

```bash
npm ci
npm run lint
npm test
npm run build
npm run test:e2e
```

The deployment command is `npm run build`. It writes `dist/` with `dist/index.html` at its root; `dist/staticwebapp.config.json` must ship alongside it.

## Evidence recorded locally

- Clean `npm ci`: 164 packages installed; `npm audit` reported 0 vulnerabilities.
- `npm run lint`: passed.
- `npm test`: 3 files and 8/8 tests passed. They cover encryption plus shared duplicate-name and static-host/PWA-cache invariants.
- `npm run build`: passed (`tsc --noEmit` then Vite). Output: JS 32.04 KB raw / 11.49 KB gzip; CSS 20.10 KB raw / 5.42 KB gzip; fonts 84.88 KB; mobile/desktop artwork 22.77/54.07 KB.
- `npm run test:e2e`: 16/16 passed: Desktop Chromium and mobile Chromium cover add/edit/reconcile/shopping/restock, whitespace validation and retained focus, duplicate-restock refusal, populated reconcile axe, 390 px targets/no overflow, legal/empty axe, IndexedDB persistence, service-worker `pantry-v5`, and offline reload.
- A targeted production-billing retest returned the 404 above; it is the only remaining release blocker.

## Deployment and post-deploy checks

Deployed through the factory static configuration to <https://pantry-reconcile.sociobot.in> on 2026-08-28 UTC. The deployed artifact is byte-identical to local `dist/` for every deployable file (HTML, hashed JS/CSS/fonts/WebP, service worker, manifest, offline page, icons, robots, and sitemap).

- Factory `verify-url.sh`: HTTP 200, 1030 ms to network idle, no page/console errors, title/lang/main present, one h1, zero missing image alt attributes, and zero unlabelled buttons.
- Live header checks: CSP, Permissions-Policy, `X-Frame-Options: DENY`, `nosniff`, referrer policy, and HSTS are present. A hashed asset returns `Cache-Control: public, max-age=31536000, immutable`; the manifest returns `Content-Type: application/manifest+json` and `Cache-Control: public, max-age=300`.
- Live normal-use privacy check at 390 px: the only request origin was `https://pantry-reconcile.sociobot.in`; no console or page errors occurred while saving a local item.
- Lighthouse 12.8.2 against the live URL: Performance 96, Accessibility 100, Best Practices 100, SEO 100; LCP 2.5 s, TBT 0 ms, CLS 0.056. Lighthouse emitted a browser-shutdown/BFCache warning after writing the complete JSON report; category scores and audit results were present.

## Known gaps / next step

- The paid checkout must not be advertised as production-ready until the factory registers the missing billing product. The free product, export, privacy, offline, update, and accessibility paths remain local-first and fully usable.
- Hardware install testing on Safari/iOS and Firefox remains outside the available Chromium environment.
