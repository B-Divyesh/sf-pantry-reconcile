# Pantry Check — independent product verification 2

## Verdict: FAIL

- Tested candidate: `028950b8ba298d7cbbd66f16a7cc945c4f43db41`
- Tested deployment: <https://pantry-reconcile.sociobot.in>
- Test date: 2026-08-28 UTC
- Contract: supplied researched brief, repository `AGENTS.md`, and the supplied PWA, accessibility, performance, and paid-unlock requirements
- Repository state: clean at the candidate before `npm ci`; no product code was changed

The free local-first reconciliation workflow is useful and works end to end. The live deploy is byte-identical to the candidate, the prior app-level validation/accessibility/cache repairs are present, and the main test, offline, privacy, accessibility, and performance gates pass. The candidate is not release-ready because the advertised paid purchase still returns 404, the product-unlock endpoint has no observable required rate limiting, the production CSP blocks the app's confidence-bar styles and creates console errors, and the primary mobile empty-state action is covered by the fixed navigation.

## Defects

### High

1. **The advertised ₹799 Household Plus purchase cannot be completed.**
   - Reproduction: Settings → “Buy once for ₹799”, or `GET https://api.sociobot.in/api/v1/products/pantry-reconcile/checkout`.
   - Actual: HTTP 404 with `{"error":"enabled factory product","status":404}`.
   - Expected: a redirect to the hosted Sociobot/Dodo checkout.
   - Impact: every prospective customer reaches a dead endpoint. A real purchase, valid-license return, refund, and revocation lifecycle cannot be verified.

### Medium

1. **The production CSP blocks product-generated inline styles and emits console errors after inventory is added.**
   - The live response correctly sets `style-src 'self'`, but `src/main.ts` renders each zone bar with `style="--clarity:…"`.
   - Reproduction: add an item, mark it Seen, and return to Pantry.
   - Actual: Chromium logs CSP errors such as “Applying inline style violates … `style-src 'self'`”; 30 messages (two unique forms) occurred during the complete desktop workflow and three during the focused mobile flow.
   - Functional evidence: after a Seen fridge item, the element retained `style="--clarity:100%"`, but computed `--clarity` was empty and computed width was `0px`. The confidence bar therefore does not communicate the intended state.
   - Expected: no load/runtime console errors and a CSP-compatible confidence indicator.

2. **The required API rate limit is absent or above a non-defensive threshold.**
   - A parallel burst of 400 requests to `GET https://api.sociobot.in/api/v1/products/pantry-reconcile/verify?license=qa-rate-limit-invalid-2` completed in 2.716 seconds.
   - Actual: 400/400 responses were HTTP 200; zero were 429 and no `Retry-After` value was observed. An immediately preceding burst of 160 requests in 1.157 seconds was also 160/160 HTTP 200.
   - Expected: rapid requests begin returning HTTP 429 with `Retry-After`. No threshold was observed through 400 requests in one burst (560 across the two consecutive bursts).

3. **The primary empty-state action is fully obscured at the required 390 px mobile size.**
   - At 390×844, `.app-nav` occupies `y=771..836`; “Add your first item” occupies `y=791.89..835.89`.
   - `document.elementFromPoint()` at the CTA center returns the navigation, not the CTA. The initial viewport screenshot confirms the action is hidden behind the fixed navigation.
   - The header plus button remains usable and the obscured action becomes available after scrolling, but the screen violates the requirement that content not hide behind fixed bars and conceals the primary empty-state action on first view.

### Low

1. **The mobile home/brand link misses the 44 px target-height rule.**
   - At 390×844, the visible brand link measured 164.45×34 CSS px.
   - All other visible buttons/links on the empty home screen met 44×44; the header Add button and footer legal links repaired after the first verification now pass.

## Clean-checkout quality gates

| Check | Result | Evidence |
| --- | --- | --- |
| Candidate and worktree | PASS | `HEAD` was exactly `028950b8ba298d7cbbd66f16a7cc945c4f43db41`; `git status --short` was empty before install. |
| `npm ci` | PASS | 164 packages installed; audit found 0 vulnerabilities. |
| `npm test` | PASS | 3 files; 8/8 tests passed. |
| `npm run typecheck` | PASS | `tsc --noEmit` exited 0. |
| `npm run lint` | PASS | ESLint exited 0. |
| `npm run build` | PASS | Exact production build (`tsc --noEmit && vite build`) produced `dist/`. |
| `npm run test:e2e` | PASS | 16/16 shipped Playwright tests passed in desktop Chromium and Pixel 5 projects. |
| Independent browser coverage | PASS with defects above | Functional assertions completed on the live URL; temporary QA code was removed afterward. |
| Factory `verify-url.sh` | PASS on empty state | HTTP 200; 849 ms to network idle; title/lang/main/one h1/alt/button names passed; 0 console/page errors before inventory existed. The populated-state CSP issue is not exercised by this smoke test. |

## End-to-end product coverage

- Verified the empty Check, Shopping, and Settings states at 390 px.
- Added normal records in fridge, freezer, and pantry, plus HTML-special characters and exact 80-character name, 40-character amount, and 160-character note boundaries.
- Rejected a whitespace-only name with retained focus, rejected a case-insensitive/trimmed duplicate, and recovered by entering a unique name.
- Exercised search/no-result/clear, edit, delete cancellation, confirmed delete, and persistence after reload.
- Completed reconciliation using the `S` shortcut, labelled action button, and touch/pointer swipe. Verified completion, Used/Expired shopping delta, duplicate-restock refusal, normal restock, and Undo.
- Downloaded and validated the CSV, including correct quote escaping, and copied the shareable delta using the clipboard fallback.
- Downloaded an AES-GCM encrypted backup and confirmed neither pantry plaintext nor passphrase appeared. Verified native short-passphrase rejection, wrong-passphrase recovery, malformed-file recovery, confirmation before replacement, and successful restore.
- Verified invalid-license recovery and URL encoding. A checkout-return token was stored in `sb_license:pantry-reconcile` and removed from the URL. Real valid-license behavior remains blocked by the missing paid product.
- Confirmed expiry language is advisory in the workflow and legal copy.

## Accessibility, responsive behavior, and motion

- Axe 4.10.2 reported **0 serious or critical findings** (indeed 0 total findings) on empty and populated home, populated reconcile, shopping, settings, privacy, and terms states.
- Desktop keyboard checks covered the skip link, 3 px visible focus outline, Enter activation, keyboard-only add, native dialog Escape, focus return to the opener, form traversal, and the `S` reconciliation shortcut. No keyboard trap was found.
- At 390×844 there was no horizontal overflow. Navigation, swipe reconciliation, forms, and persisted content remained operable, subject to the obscured CTA and 34 px brand link noted above.
- With `prefers-reduced-motion: reduce`, the measured hero animation and transition duration were both `0.00001s`.
- The visual review found a coherent product-specific dark pantry system with legible hierarchy, original artwork, explicit dimensions/alt text, and no generic framework appearance. Only the documented single dark treatment is required by the visual thesis.

## PWA and offline evidence

- Chromium parsed the live manifest with zero errors: `display=standalone`, versioned `start_url=/?source=installed&v=1`, root scope, 192/512 icons, maskable purpose, and shortcuts.
- After a successful first load, `pantry-v5` controlled the page. With network disabled, a reload restored the app shell and the IndexedDB record and displayed “Offline · changes stay here.”
- A controlled candidate-build server changed only the served worker version from `pantry-v5` to `pantry-v6-qa`. The app displayed “A fresh version is ready,” “Reload to update” activated the worker, the page reloaded, and the `pantry-v6-qa` cache replaced the old cache.
- The live service worker is update-friendly (`Cache-Control: public, must-revalidate, max-age=30`).

## Privacy, network, and response policies

- Normal use requested only `https://pantry-reconcile.sociobot.in`; no analytics, advertising, remote font, CDN script, or third-party byte was observed.
- The only cross-origin app call occurred after explicit license verification and went to the required Sociobot endpoint. It returned `Cache-Control: no-store`, `{valid:false,reason:"invalid"}`, and origin-specific CORS for the product origin; a request from `https://example.com` received no `Access-Control-Allow-Origin`.
- Pantry and history state remained in IndexedDB. License data used the documented localStorage keys. Exports required an explicit user action.
- Live root headers include HSTS, CSP, Permissions-Policy, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, and `X-Frame-Options: DENY`.
- Hashed assets return `Cache-Control: public, max-age=31536000, immutable`; the manifest returns `application/manifest+json` with a 300-second cache lifetime; HTML and the service worker revalidate after 30 seconds.
- The CSP itself is appropriately restrictive, but conflicts with the app's inline style attributes as described in the defect above.

## Deployment identity

The deployment exposes no commit/build header, so identity was established by rebuilding the candidate and byte-comparing every deployable file. All 16 public artifacts matched local `dist/` exactly: HTML, hashed JS/CSS/source map, both fonts, both WebP images, service worker, manifest, offline page, SVG/192/512 icons, robots, and sitemap. `staticwebapp.config.json` is hosting configuration and is not publicly served. The live root references candidate assets `index-Dttypays.js` and `index-D-N8CgY1.css`.

## Performance and budgets

Lighthouse 12.8.2, mobile/default throttling against the live URL:

- Performance 97; Accessibility 100; Best Practices 100; SEO 100.
- FCP 1.4 s; LCP 1.5 s; TBT 180 ms; CLS 0.049; Speed Index 1.6 s; TTI 1.6 s.
- Initial transfer 131 KiB across 9 requests; no third-party bytes.

Production output:

- JavaScript 32.04 KB raw / 11.49 KB gzip (≤200 KB budget).
- CSS 20.10 KB raw / 5.42 KB gzip (≤50 KB budget).
- Fonts 84.88 KB total (≤120 KB budget).
- Mobile/desktop artwork 22.77/54.07 KB (≤300 KB hero budget).

## Documentation and scope

- README, MIT license, product-specific `.factory/design.md`, privacy page, terms page, manifest, icons, service worker, and offline fallback are present.
- The free tier remains genuinely useful; core reconciliation, safety guidance, data export, and accessibility are not paywalled.
- No sign-in exists, so the Microsoft Entra authority requirement is not applicable. This is neither a library/CLI nor a backend, so consumer-package and backend concurrency/health checks are not applicable.

## Required retest before PASS

1. Register and enable the Sociobot billing product; verify checkout redirect and a real test purchase, valid return, daily-verdict cache, revocation, and refund lifecycle.
2. Add server-side rate limiting to the verification endpoint and demonstrate the observed 429 threshold plus `Retry-After`.
3. Remove or CSP-authorize the dynamic zone-bar styling without weakening policy; verify visible 0–100% state and zero console/page errors in populated flows.
4. Keep the mobile navigation from covering the primary empty-state CTA and enlarge the brand link target to at least 44 px high.
5. Repeat artifact identity, populated-state console monitoring, axe, 390 px, offline/update, and Lighthouse checks.
