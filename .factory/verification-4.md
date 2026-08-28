# Pantry Check — independent product verification 4

## Verdict: FAIL

- Candidate: `95f27528e64ca4a866944126cfa8a06f3c6cd953`
- Live URL: <https://pantry-reconcile.sociobot.in>
- Verified: 2026-08-28 UTC
- Checkout before verification: clean and exactly at the candidate
- Product code changed during verification: no

The production deployment serves the candidate's public runtime artifacts and the real shared-pantry workflow works. This candidate still fails the factory acceptance contract on two accessibility requirements: at 390 px, two persistent demo controls are only 36 CSS px high; under `prefers-reduced-motion: reduce`, the focused skip link remains off-screen and has no visible focus ring. These are not deployment-only failures: both reproduce from this candidate's CSS and on the live deployment.

## Required first checks

| Gate | Result | Fresh evidence |
| --- | --- | --- |
| `.factory/claims.json` exists | PASS | Five claims are present. |
| Run every declared claim command first from clean install | PASS | `npm run test:e2e -- --grep @claim:demo-isolated`, `@claim:offline-reload`, `@claim:local-only`, `@claim:csv-export`, and `@claim:encrypted-backup` each passed (2 Chromium projects each). |
| Cold first-read | PASS | Cold live copy says it is a quick pantry check “without tracking every bite,” for “shared kitchens,” with “Add your first item” and visible one-click “Try it with sample data.” The latter explains it opens a stocked separate sample pantry. Screenshot: [`live-first-read-desktop.png`](evidence-4/live-first-read-desktop.png). |
| Isolated one-click sample demo | PASS | `/demo` contains sample Oat milk/Frozen peas/Red lentils plus Shopping Pasta, persistent Demo/Reset/Start-for-real controls, and only `demo:pantry-check` IndexedDB before and after reset. Real `pantry-check` is absent in a fresh demo context. |

## Release-blocking defects

### High — Keyboard skip link is invisible with reduced motion

At live `/demo`, 390 px, with `prefers-reduced-motion: reduce`, the first Tab focuses “Skip to main content” (`:focus` and `:focus-visible` are true), but its bounding box is at `top: -64px` and its computed style is `transform: matrix(1, 0, 0, 1, 0, -72)`, `outline: ... solid 0px`. The keyboard user cannot see the focused control. In the normal motion preference the same control is visible at `top: 8px` with the designed `3px rgb(141, 203, 255)` outline.

This violates the required visible focus/keyboard behavior and reduced-motion equivalence. It appears to be the interaction between `.skip-link:focus { transform: translateY(0) }` and the blanket reduced-motion CSS; fix and retest the actual reduced-motion focus state.

### Medium — Demo controls miss the 44 px mobile touch-target minimum

At live `/demo` on a 390×844 viewport, the persistent demo actions measure:

| Control | Width | Height |
| --- | ---: | ---: |
| Reset demo | 161 px | **36 px** |
| Start for real | 161 px | **36 px** |

The product and factory accessibility requirements specify targets of at least 44×44 CSS px. These controls are required demo controls, not incidental inline links. The cause is `.demo-banner .button-link, .demo-banner button { min-height: 36px; }`.

## Quality gates

| Check | Result | Evidence |
| --- | --- | --- |
| `npm ci` | PASS | 164 packages installed; npm reported 0 vulnerabilities. |
| `npm test` | PASS | 10/10 Vitest tests. |
| `npm run typecheck` | PASS | `tsc --noEmit` exited 0. |
| `npm run lint` | PASS | ESLint exited 0. |
| `npm run build` | PASS | `dist/` produced. |
| `npm run test:e2e` | PASS | 32/32 Playwright tests; runner record `test-results/.last-run.json` is `status: passed`. |
| Factory `verify-url.sh` | PASS | HTTPS 200; 908 ms to network idle; title/lang/one h1/main/alt/button-name checks and console/page errors all clean. [`verify.json`](evidence-4/verify-url/verify.json) |
| Axe | PASS | `@axe-core/playwright` found 0 violations (therefore 0 serious/critical) on empty home, reconcile, shopping, settings, mobile demo, Privacy, and Terms. [`qa-live.json`](evidence-4/qa-live.json) |

## End-to-end, privacy, and accessibility evidence

- On live desktop, added three realistic records including `<Oats & "Honey">`, commas/quotes, a 40-character amount, and a 160-character note. Data persisted after reload. A whitespace-only item was rejected with focus retained on Item name; a trimmed case-insensitive duplicate was rejected; search/no-result/clear recovered correctly.
- Completed a confidence pass with keyboard `S`, `U`, and `E` for Seen, Used up, and Expired. Shopping contained the used/expired delta. CSV had the required header and correctly escaped `"Beans, ""red"""`. Restock exposed Undo and Undo restored the item. An encrypted backup contained neither Milk plaintext nor the passphrase.
- Browser Back restored the Pantry route after Shopping. Privacy, Terms, and an unknown route have their own title, one h1, and the designed 404 return link.
- Normal desktop flow produced six unique requests, all same-origin: root plus the Vite JS, CSS, two self-hosted fonts, and product artwork. There were no console errors or page errors. No analytics, third-party script/font, API, billing, or sign-in request was observed.
- At 390 px the page had no horizontal overflow. Apart from the two 36 px demo controls above, visible controls were at least 44 px. The normal-motion first Tab shows a 3 px visible focus outline. Reduced motion computes animations/transitions to `1e-05s`, but has the skip-link regression above.

The detailed reproducible browser run and screenshots are in [`evidence-4`](evidence-4): [`qa-live.mjs`](evidence-4/qa-live.mjs), [`qa-live.json`](evidence-4/qa-live.json), [`live-mobile-demo.png`](evidence-4/live-mobile-demo.png), and [`live-desktop-empty.png`](evidence-4/live-desktop-empty.png).

## PWA, deployment identity, headers, and budgets

- PWA: live manifest is valid standalone PWA metadata with 192/512 maskable icons and versioned start URL. After one online visit, service worker cache `pantry-v7` controlled `/demo`; an offline reload retained Oat milk and displayed “Offline · changes stay here.”
- Update behavior: a controlled local server of this exact `dist/` served a changed worker version. The app displayed “A fresh version is ready”; Reload to update activated `pantry-v7-qa-update` and removed `pantry-v7`, with no errors. [`qa-sw-update.json`](evidence-4/qa-sw-update.json)
- Identity: all 17 public runtime files in local `dist/` matched production byte-for-byte, including HTML, app JS/CSS, source map, fonts, WebP assets, manifest, service worker, icons, offline page, robots, sitemap, and social image. `staticwebapp.config.json` is deployment configuration and correctly returns 404 as a public URL; its behavior is reflected in the live headers.
- Live headers: HTTPS 200, HSTS, CSP with `connect-src 'self'`/`frame-ancestors 'none'`, `nosniff`, `DENY`, restrictive Permissions-Policy, and strict referrer policy are present. Hashed JS has `public, max-age=31536000, immutable`; manifest has 300-second caching; HTML and service worker revalidate after 30 seconds.
- Build budgets: JS 32,674 bytes raw / 11.40 KB gzip (≤200 KB); CSS 21,546 bytes raw / 5.66 KB gzip (≤50 KB); self-hosted fonts total 84,876 bytes (≤120 KB); mobile/desktop artwork 22,770/54,074 bytes (≤300 KB).
- Lighthouse was attempted against live with the installed Lighthouse 13.4.1 and the pinned Playwright Chromium, but Chrome crashed before reporting; this is an environment-tool failure, not a product console/page error. Static bundle budgets and browser accessibility checks above completed.

This is a static local-first PWA: there are no server-side product endpoints, product-unlock calls, accounts, or sign-in. API allowance/429-with-Retry-After, concurrency/persistence endpoint checks, Entra authority, and clean package-consumer checks are not applicable.

## Required retest

1. Make Reset demo and Start for real at least 44 px high at 390 px and retain sensible spacing.
2. Fix the reduced-motion skip-link focus state so Tab visibly exposes it with a compliant focus indicator.
3. Repeat all five claim commands, the 32-test suite, 390 px touch/focus checks under both motion preferences, and live `/demo` offline reload.
