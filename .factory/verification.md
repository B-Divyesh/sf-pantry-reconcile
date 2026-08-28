# Pantry Check — independent product verification

## Verdict: FAIL

- Tested candidate: `d10afe8c84a31d5a1f9eead9f7035b6f16b52bc1`
- Tested deployment: <https://pantry-reconcile.sociobot.in>
- Test date: 2026-08-28 UTC
- Contract: researched brief, repository `AGENTS.md`, and the supplied PWA, accessibility, performance, and paid-unlock requirements

The free, local-first pantry workflow is useful and largely polished, and the deployed bytes match the candidate. It does not pass the acceptance contract because the advertised paid checkout is unavailable, core flows can create invalid or duplicate records, and the reconcile screen has a serious axe finding.

## Defects

### High

1. **The advertised Household Plus purchase cannot be completed.**
   - Reproduction: open Settings and follow “Buy once for ₹799”, or request `GET https://api.sociobot.in/api/v1/products/pantry-reconcile/checkout`.
   - Actual: HTTP 404 with `{"error":"enabled factory product","status":404}`.
   - Expected: redirect to the hosted Sociobot/Dodo checkout.
   - Impact: every prospective customer reaches a dead endpoint; the paid path is not end to end.

### Medium

1. **A normal restock sequence can create duplicate active inventory records.**
   - Add `Pasta`, mark it Used up, use Add item to add replacement `pasta`, then open Shopping and mark the original restocked.
   - Actual: two active, case-insensitively identical Pasta records appear. Duplicate validation only considers currently active items and the restock action performs no duplicate check.
   - Impact: this undermines the product’s primary job of reducing duplicate purchases and makes later reconciliation ambiguous.

2. **Whitespace-only item names are accepted.**
   - Enter three spaces in Item name and save.
   - Actual: an unnamed row is stored with an accessible button name of `Edit `.
   - Expected: a visible validation error after trimming, with focus retained on Item name.

3. **The reconcile screen has one serious axe violation.**
   - Rule: `aria-prohibited-attr` / WCAG 4.1.2.
   - Target: `.progress-track`.
   - Cause: `aria-label="Check progress"` is placed on a `div` with no semantic role. Use a native `progress` element or provide a valid progressbar role and value attributes.

4. **Three visible 390 px controls miss the contract’s 44×44 CSS-pixel target.**
   - Header Add item: 48×42.
   - Footer Privacy: 44×19.5.
   - Footer Terms: 38×19.5.
   - There was no horizontal overflow at 390 px and the remaining measured controls met the target.

### Low

1. **Production caching does not use long-lived immutable headers for hashed assets.** Hashed JS, CSS, fonts, and images all return `cache-control: public, must-revalidate, max-age=30`, rather than a long immutable lifetime. The service worker’s cache-first path mitigates repeat use after installation, but ordinary browser/CDN caching does not meet the performance contract.

2. **Response hardening is incomplete.** HTTPS and HSTS are present, along with `Referrer-Policy: strict-origin-when-cross-origin` and `X-Content-Type-Options: nosniff`; CSP, Permissions-Policy, and a framing restriction are absent. The manifest is served as `application/octet-stream` rather than `application/manifest+json`, although Chromium parsed it with no manifest errors.

## Clean checkout and repository gates

The worktree was clean and `HEAD` equalled the candidate before installation.

| Check | Result | Evidence |
| --- | --- | --- |
| `npm ci` | PASS | 61 packages installed; full audit reported 0 vulnerabilities. |
| `npm test` | PASS | 2 files, 5/5 tests passed. |
| Type check | PASS | `tsc --noEmit` runs as the first stage of the production build. |
| Lint | N/A | No lint script or lint configuration is present. |
| `npm run build` | PASS | Vite 7.3.6 produced `dist/index.html`; exact deployment command succeeded. |
| `npm run test:e2e` | PASS | 8/8 shipped Playwright tests passed in desktop Chromium and Pixel 5 emulation. |
| Independent Playwright suite | PASS with expected defect assertions | 9/9 scenarios passed after explicitly asserting the four observed product defects; the temporary QA file was removed and product code was not changed. |
| Factory `verify-url.sh` | PASS | HTTP 200; 716 ms to network idle; title/lang/main present; one h1; 0 missing image alts; 0 unlabeled buttons; 0 console/page errors. |

## End-to-end coverage

- Added records across fridge, freezer, and pantry, including `&`/angle-bracket text and exact 80/40/160-character field boundaries.
- Confirmed case-insensitive active duplicate validation and successful recovery by choosing another name.
- Exercised search/no-results/clear, edit, delete cancellation, confirmed delete, and persistence after reload.
- Ran a full Seen/Used up/Expired reconciliation through keyboard shortcuts and buttons; tested right-swipe Seen at 390 px, completion, shopping delta, restock, undo, and CSV download contents.
- Confirmed advisory expiry language in reconcile, shopping, terms, and privacy copy.
- Exported an encrypted backup, confirmed it contained neither pantry plaintext nor passphrase, rejected a wrong passphrase with a useful error, then successfully restored and replaced local data with the correct passphrase.
- Confirmed a checkout-return license is saved and stripped from the URL, invalid verification is recoverable, tokens are URL-encoded, and the buy link uses only the Sociobot endpoint.
- Confirmed normal pantry use made no cross-origin requests. The only expected cross-origin application request was license verification; the live invalid-token endpoint returned `{valid:false,reason:"invalid"}` with origin-specific CORS and `cache-control: no-store`.
- Checked desktop at 1440×900 and mobile at exactly 390×844. Mobile had no horizontal overflow; responsive navigation, content, and safe bottom spacing remained operable.
- Keyboard smoke covered the skip link, visible 3 px focus outline, dialog open/Escape/return focus, and S/U/E reconcile shortcuts. Reduced motion produced near-instant animation and transition durations. Axe found 0 serious/critical issues on empty home, add dialog, populated home, populated shopping, settings, privacy, and terms; reconcile had the one serious issue listed above.
- Live offline reload retained an IndexedDB item and displayed offline status. A controlled candidate-build simulation installed a changed service worker, displayed “A fresh version is ready,” activated through “Reload to update,” reloaded, and replaced `pantry-v4` with the new cache.
- Chromium parsed the live manifest with no errors, including the standalone display mode, versioned start URL, 192/512 icons, maskable purpose, and shortcuts.

## Deployment identity and network evidence

The deployment exposes no explicit commit/build header, so identity was established by rebuilding the candidate and comparing SHA-256 hashes. All 16 deployed artifacts checked were byte-for-byte identical to local `dist/`: HTML, hashed JS/CSS/source map, two fonts, service worker, manifest, offline page, SVG/192/512 icons, both WebP images, robots, and sitemap. The deployed root references the candidate hashes `index-BQPxUzYw.js` and `index-hYOzypRo.css`.

The root, `/privacy`, and `/terms` return HTTP/2 200 over valid TLS. Extensionless routes receive the app shell. Normal first load contained 9 same-origin requests and no third-party request.

## Performance and budgets

Lighthouse 12.8.2, mobile/default throttling against the live URL:

- Performance 99; Accessibility 100; Best Practices 100; SEO 100.
- FCP 1.4 s; LCP 1.5 s; TBT 20 ms; CLS 0.056; Speed Index 1.4 s; interactive 1.5 s.
- Initial transfer: 127,664 bytes (about 125 KiB), 9 requests, 0 third-party bytes.

Production output:

- JavaScript: 31.55 KB raw / 11.32 KB gzip (budget ≤200 KB).
- CSS: 19.71 KB raw / 5.37 KB gzip (budget ≤50 KB).
- Fonts: 84.88 KB total (budget ≤120 KB).
- Mobile hero: 22.77 KB; desktop hero: 54.07 KB (budget ≤300 KB).

## Positive acceptance evidence

- Local-first IndexedDB state, encrypted ownership transfer, offline shell/data reload, and update behavior work.
- Normal use has no analytics, trackers, CDN scripts, or external fonts; all runtime assets are first-party and the generated artwork provenance is documented.
- One title, `lang="en"`, one h1, main/header/nav/footer landmarks, image alt text, designed focus, ≥16 px body text, single-mode dark palette, and reduced-motion handling are present.
- The project includes the product-specific design thesis, README, MIT license, privacy page, terms page, manifest, maskable icons, offline fallback, and service worker.

## Retest requirements

Before PASS: register/enable the paid product and prove the checkout redirect; reject trimmed-empty names; prevent duplicates on add and restock; fix the progress semantics; enlarge all mobile targets to 44×44; then rerun axe on every interactive state and the complete online/offline workflow. Long-lived immutable asset caching and the missing response policies should be corrected at hosting configuration level.

Untested because the broken checkout prevented it: a real purchase, valid-license return, revocation, and refund lifecycle. Hardware install flows on Safari/iOS and Firefox were outside the available Chromium environment.
