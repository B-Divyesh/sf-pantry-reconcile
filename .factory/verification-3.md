# Pantry Check — independent product verification 3

## Verdict: FAIL

- Candidate: `3e59b51db84eb05f7225d216298750b5f0358466`
- Live deployment: <https://pantry-reconcile.sociobot.in>
- Test date: 2026-08-28 UTC
- Repository state before installation: clean; `HEAD` exactly matched the candidate
- Product code changed during verification: no

The deployment is healthy and byte-identical to the candidate. The core local-first pantry workflow, offline reload, service-worker update, accessibility, privacy behavior, response policy, and performance all tested well. The release nevertheless fails the supplied acceptance contract: the mandatory claims manifest does not exist, and the visible one-click example is not an isolated or resettable demo. These are candidate defects, not a deployment-only failure.

## Mandatory acceptance gates

| Gate | Result | Fresh evidence |
| --- | --- | --- |
| Run every `.factory/claims.json` test first | **FAIL — release blocking** | The first repository command after `pwd` was `sed -n '1,240p' .factory/claims.json`; it returned `No such file or directory`. `rg "@claim:"` found no claim-tagged tests. No claim commands exist to run. |
| Cold first-read: what it does | PASS | The page presents a quick fridge/freezer/pantry confidence pass without logging every meal. |
| Cold first-read: for whom | PASS | “A calmer shared kitchen” and the supporting copy identify people sharing a kitchen. |
| Cold first-read: what to click first | PASS with a copy-structure defect | “Add your first item” is visually primary and understandable. However, the semantic `<h1>` is only “Pantry Check”; the job headline is an `<h2>`, contrary to the supplied first-screen contract. |
| One-click sample-data demo in an isolated sandbox | **FAIL — release blocking** | There is no “Try it with sample data” action, `/demo` and `?demo=1` both open an empty real app, and `.factory/demo.md` is absent. “See how a check works” creates Milk in the production `pantry-check` IndexedDB. There is no demo banner, Reset demo, Start for real, or separate storage namespace. |

Cold-read screenshots: [`live-cold-desktop.png`](evidence-3/live-cold-desktop.png), [`live-cold-mobile-390.png`](evidence-3/live-cold-mobile-390.png). The contaminated example state is shown in [`live-mobile-after-example.png`](evidence-3/live-mobile-after-example.png).

## Defects

### High

1. **The required claims registry and claim tests are missing.**
   - `.factory/claims.json` does not exist, which the work order explicitly defines as release blocking.
   - There are no `@claim:<id>` tests anywhere in the repository.
   - Live and README claims therefore have no registry entries or required demo-sandbox tests. Examples include “Works offline,” “Lives on this device,” “Take a two-minute confidence pass,” encrypted backups, CSV/share behavior, and “Nothing during normal pantry use.”
   - Independent QA proved several of these behaviors, but ad hoc verifier evidence is not a substitute for the required every-build claim contract.

2. **The one-click example is not the required demo sandbox and writes sample data into real user storage.**
   - From a fresh 390 px context, click “See how a check works.”
   - Actual: the URL becomes `/?view=reconcile`; a Milk record and Added event are written to the normal `pantry-check` IndexedDB. The same database is used by real pantry data.
   - There is no persistent “Demo — sample data, nothing is saved” banner, no Reset demo, no Start for real, no isolated `demo:` namespace, and no documented `/demo` or `?demo=1` entry point.
   - Direct requests to `/demo` and `/?demo=1` both show the empty production app with zero sample records.
   - Impact: the acceptance demo cannot be tested from a clean deterministic sandbox, and trying the example can mix sample Milk/history into a household’s real local data.

### Medium

1. **Main navigation does not work with browser history.**
   - Pantry → Shopping → Settings changes the address bar, but `history.length` remained `2` throughout because `setView()` uses `history.replaceState()`.
   - Pressing Back from Settings navigated to `about:blank` instead of Shopping.
   - No `popstate` handler restores a view. Route changes focus `<main>` and leave the live region empty rather than focusing and announcing the new heading.
   - Impact: standard Back/Forward behavior and screen-reader route orientation required by the site contract are absent.

2. **Required route and page-shell behavior is incomplete.**
   - `GET /does-not-exist-qa` returns HTTP 200 and renders the pantry home screen; there is no designed 404 route or path handling for unknown locations.
   - Root, Privacy, and Terms each contain one `<h1>`, but it is always the wordmark “Pantry Check.” Their actual page headlines are `<h2>` elements.
   - The landing page omits the required “How it works” and explicit limits/privacy sections, and its footer omits “Built by Param Factory” and a build/version identifier.

### Low

1. **Required metadata and copy-audit artifacts are incomplete.**
   - `index.html` has no canonical URL, Open Graph metadata, Twitter card, 1200×630 social image, or apple-touch icon.
   - `.factory/copy-audit.md` is absent. The README sentence beginning “Instead of asking everyone…” is 25 words, over the supplied 22-word hard cap.

## Clean-checkout quality gates

| Check | Result | Evidence |
| --- | --- | --- |
| Candidate/worktree | PASS | Clean `main...origin/main`; `HEAD` was exactly `3e59b51db84eb05f7225d216298750b5f0358466`. |
| `npm ci` | PASS | 164 packages installed; audit reported 0 vulnerabilities. |
| Claims tests | **FAIL** | `.factory/claims.json` is missing, so no required claim commands can be run. |
| `npm test` | PASS | 3 files, 9/9 tests. |
| `npm run typecheck` | PASS | `tsc --noEmit` exited 0. |
| `npm run lint` | PASS | ESLint exited 0. |
| `npm run build` | PASS | Exact `tsc --noEmit && vite build` command produced `dist/`. |
| `npm run test:e2e` | PASS | 18/18 Playwright tests passed across desktop Chromium and Pixel 5 projects. |
| Factory `verify-url.sh` | PASS | HTTP 200, 806 ms to network idle, title/lang/main/one h1/alt/button names passed, zero console/page errors. See [`verify.json`](evidence-3/verify-url/verify.json). |

## Independent end-to-end coverage

- Added realistic fridge and pantry records, including `<`, `&`, quotes, commas, surrounding whitespace, and exact 80/40/160-character boundaries. Attempts at 81/41/161 characters were truncated to their declared maxima.
- Rejected a whitespace-only name and retained focus on Item name. Rejected a trimmed, case-insensitive active duplicate and allowed recovery.
- Confirmed search/no-results/clear, edit-dialog focus, Escape close, opener focus return, persistence after reload, and the IndexedDB-unavailable recovery screen.
- Completed a pass with Seen, Used up, and Expired outcomes through keyboard and labelled controls. Confirmed advisory food-safety copy.
- Confirmed Used/Expired shopping delta, restock, Undo, CSV download with correct comma/quote escaping and one row per item, and clipboard fallback text: `Pantry Check — shopping delta` plus the item and amount.
- Exported an encrypted backup and confirmed neither item plaintext nor passphrase appeared. Wrong-passphrase and malformed-file errors recovered cleanly; the correct passphrase restored the backup after explicit replacement confirmation.
- Normal desktop flow made 22 same-origin requests, zero cross-origin requests, and emitted zero console/page errors.

The reproducible verifier is [`qa-live.mjs`](evidence-3/qa-live.mjs).

## Accessibility, responsive behavior, and motion

- Axe 4.10.2 found **0 total violations**, therefore 0 serious/critical findings, on empty home, populated reconcile, shopping, settings, privacy, terms, 390 px empty home, and the 390 px example reconcile screen.
- Keyboard smoke confirmed the skip link is first, visible, and has a 3 px `rgb(141, 203, 255)` focus outline. The item dialog receives focus, closes with Escape, and returns focus to its opener. `S` reconciliation works keyboard-only; labelled action buttons cover the other outcomes.
- At 390×844 there was no horizontal overflow, no visible interactive target below 44×44, and the primary CTA bottom (`698.797`) stayed above the fixed dock top (`771`). Its center hit-tested to the CTA.
- Reflow-equivalent 640 px and minimum 320 px viewports had no horizontal overflow and retained the primary action.
- Under `prefers-reduced-motion: reduce`, the hero animation and control transitions computed to `0.00001s`.
- The single-mode design is product-specific, readable, consistent with `.factory/design.md`, and uses self-hosted fonts and disclosed original generated artwork.

The semantic/routing issues in the Medium findings remain despite the clean axe result.

## PWA and offline

- Chromium parsed the live manifest with zero errors: standalone display, versioned start URL, root scope, 192/512 icons, maskable purpose, and shortcuts were present.
- After a first load, `pantry-v6` controlled the page. A saved `Offline lentils QA` item survived `context.setOffline(true)` and reload, and “Offline · changes stay here” was visible with no errors. See [`live-offline-reload.png`](evidence-3/live-offline-reload.png).
- A controlled local server served the candidate build, then changed only the in-memory worker cache version. The app showed “A fresh version is ready,” “Reload to update” activated it, `pantry-v6-qa-update` replaced `pantry-v6`, and no errors occurred. Reproducer: [`qa-sw-update.mjs`](evidence-3/qa-sw-update.mjs); screenshot: [`local-sw-update-ready.png`](evidence-3/local-sw-update-ready.png).

## Deployment identity, privacy, and response policy

- All 16 public deployable files were byte-for-byte identical to local `dist/`: HTML, JS, source map, CSS, two fonts, two WebP images, service worker, manifest, offline page, SVG/192/512 icons, robots, and sitemap. The root references candidate assets `index-3ooe_Gzk.js` and `index-DDeClvVP.css`.
- Root, `/privacy`, and `/terms` return HTTPS 200. HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, CSP with `connect-src 'self'` and `frame-ancestors 'none'`, restrictive Permissions-Policy, and `X-Frame-Options: DENY` are live.
- Hashed JS/CSS assets return `Cache-Control: public, max-age=31536000, immutable`; the manifest returns `application/manifest+json` with 300-second caching; HTML and `sw.js` revalidate after 30 seconds.
- Pantry/history records remained in IndexedDB. Normal use loaded no analytics, third-party scripts, remote fonts, or cross-origin application requests. Exports occurred only after explicit actions.
- The product is a static PWA with no sign-in and no server-side product/API or product-unlock endpoint. Entra authority, backend concurrency/health, package-consumer, and API rate-limit threshold tests are not applicable. No external billing endpoint is referenced by the candidate.

## Performance and budgets

Lighthouse 13.0.1 against the live mobile profile:

- Performance 100; Accessibility 100; Best Practices 100; SEO 100.
- FCP 1.1 s; LCP 1.2 s; TBT 0 ms; CLS 0.039; Speed Index 1.4 s.
- Initial transfer 130 KiB across 9 requests.

Production output:

- JavaScript: 29.00 KB raw / 10.53 KB gzip (budget ≤200 KB).
- CSS: 20.44 KB raw / 5.46 KB gzip (budget ≤50 KB).
- Fonts: 84.88 KB total (budget ≤120 KB).
- Mobile/desktop artwork: 22.77/54.07 KB (budget ≤300 KB).

Full report: [`lighthouse.json`](evidence-3/lighthouse.json).

## Retest requirements

Before PASS:

1. Add `.factory/claims.json`; list every claim in live copy and README; add exactly one demo-based `@claim:<id>` test per claim; run every listed command successfully.
2. Add a visible one-click “Try it with sample data” entry point at `/demo` or `?demo=1`, an isolated storage namespace, persistent demo banner, Reset demo, Start for real, and `.factory/demo.md`. Never write sample data into real IndexedDB.
3. Use real navigable routes/history entries with Back/Forward restoration, heading focus, and route announcements.
4. Add a real 404 and complete the required heading, landing skeleton, footer, metadata, social image, and copy-audit artifacts.
5. Repeat clean claim tests, complete E2E, live identity, axe, 390 px, offline/update, request interception, and Lighthouse checks.
