# Check shared pantry items — independent verification 5

## Verdict: FAIL

- Findings: **5** — 1 high, 1 medium, 3 low
- Untested public claims: **2**
- Implementation reviewed: `e0e30c560b98a5db9f2967e30cf21904c03056c0`
- Documentation baseline reviewed: `b547e555665d071315158ff5dcbe28a7e1bb19f1`
- Live URL: <https://pantry-reconcile.sociobot.in>
- Verified: 2026-09-06 UTC
- Product code changed during verification: no

The live product serves the candidate's files and the main pantry workflow works. The two findings from verification 4 are fixed. This candidate still fails because an in-progress check does not survive reload, app views do not set distinct titles, unknown URLs return HTTP 200, prohibited metaphor and mood copy remains, and two public claims have no declared claim test.

## Job, audience, and first action before scrolling

- Job: check what remains in the fridge, freezer, and pantry without recording every meal.
- Audience: busy people who share a kitchen.
- First action: **Add your first item**. **Try it with sample data** is beside it.

Fresh 1440×900 desktop and 390×844 phone contexts showed all three before scrolling. The phone had no horizontal overflow. The live title was `Pantry Check — check the pantry` and the h1 was `Check the pantry without tracking every bite.`

## Findings

### High — two public claims have no declared claim test

The required claim registry has five entries, and all five commands pass. It does not cover these public claims:

1. Settings says, “The passphrase never leaves this device and cannot be recovered.” The `encrypted-backup` test only checks that plaintext is absent from the downloaded file. The `local-only` test records requests during one demo check, not during backup creation. Neither proves the displayed security claim.
2. README says, “The service worker controls the root scope and updates via an in-app reload prompt.” The update flow works in the independent controlled check, but there is no `.factory/claims.json` entry or `@claim:` test for this public promise.

The claims contract makes each missing or incompletely tested public claim release blocking. Untested claim count: **2**.

### Medium — reloading an in-progress check reports a false completion

Reproduction on the live site:

1. Open `/demo`.
2. Select **Start a check**. Red lentils appears first and the progress maximum is 3.
3. Reload `/demo?view=reconcile` before recording an outcome.

Actual: the URL remains `/demo?view=reconcile`, but the item card disappears and the h1 says **Your pantry is current.**

Expected: the three active sample items are restored into the check queue. The same defect affects a real pantry loaded directly or reloaded at `/?view=reconcile`. **Check again** recovers the queue, but the first recovered state is false and interrupts the job.

### Low — app views do not set their own page titles

The live Pantry, Check, Shopping, and Settings views all use `Pantry Check — check the pantry`. Their demo equivalents all use `Demo — Pantry Check`. The address bar and h1 change, but `document.title` does not. The route contract requires a title that identifies every real place, including SPA navigation states.

### Low — the designed unknown-route page is a soft 404

`GET /missing-verification-5` returns HTTP 200 with the app shell. JavaScript then renders the designed not-found page with one h1 and a working return link. The route contract requires an actual HTTP 404 for an unknown path. The hosting configuration has a navigation fallback but no 404 response override.

### Low — product copy still uses prohibited metaphor and mood labels

Examples on the live product include **A calmer shared kitchen**, **Current landscape**, **This pantry shelf is empty**, and “Come back when real life makes the picture fuzzy.” The supplied plain-words contract prohibits mood headings, decorative labels, and metaphor copy. `.factory/copy-audit.md` omits these strings, so its statement that the copy passes is incomplete.

## Declared claim commands

The checkout was clean before `npm ci`. Each command below was run independently after installation.

| Claim | Command | Result |
| --- | --- | --- |
| Isolated sample | `npm run test:e2e -- --grep @claim:demo-isolated` | PASS — 2/2 browser projects |
| Offline reload | `npm run test:e2e -- --grep @claim:offline-reload` | PASS — 2/2 browser projects |
| Local-only use | `npm run test:e2e -- --grep @claim:local-only` | PASS — 2/2 browser projects |
| CSV export | `npm run test:e2e -- --grep @claim:csv-export` | PASS — 2/2 browser projects |
| Encrypted backup | `npm run test:e2e -- --grep @claim:encrypted-backup` | PASS — 2/2 browser projects |

Each declared claim tag occurs exactly once in the browser suite. The two unlisted claims above prevent a zero-untested-claims result.

## Clean setup and quality gates

| Check | Result |
| --- | --- |
| `npm ci` | PASS — 164 packages, 0 vulnerabilities |
| `npm test` | PASS — 10/10 Vitest tests |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS — `dist/index.html` produced |
| `npm run test:e2e` | PASS — 36/36 Playwright tests |
| Factory `verify-url.sh` | PASS — HTTPS 200, 609 ms to network idle, no console errors, title/lang/main/h1/alt/button checks clean |

Production output stayed within the static budgets: JavaScript 32.67 KB raw and 11.40 KB gzip; CSS 21.68 KB raw and 5.69 KB gzip; self-hosted fonts 84.88 KB total; mobile artwork 22.77 KB.

Fresh Lighthouse 13.4.1 mobile results were Performance 98, Accessibility 100, Best Practices 100, and SEO 100. FCP was 1.36 s, LCP 1.51 s, TBT 0 ms, CLS 0.078, and total transfer was 134,484 bytes.

## Demo and main workflow

- The landing action opened `/demo` in one click.
- The persistent **Demo — sample data, nothing is saved** label remained visible.
- Oat milk, Frozen peas, and Red lentils populated the pantry. Shopping contained Pasta.
- Reset restored the sample. **Start for real** returned to an empty real pantry with no sample item visible.
- The claim test counted zero real pantry items after demo activity. Demo storage used `demo:pantry-check`; real storage used `pantry-check`.
- A full live flow added realistic records, persisted them across reload, ran Seen, Used up, and Expired outcomes, produced the shopping change, exported correctly escaped CSV, restocked, and undid the restock.
- Search, no-results, clear, delete cancellation, confirmed deletion, and empty states worked.

## Invalid, boundary, and recovery paths

- A whitespace-only item name was rejected and focus stayed on Item name.
- A trimmed, case-insensitive duplicate was rejected. Restocking into an active duplicate was also rejected.
- Exact boundaries of 80 characters for a name, 40 for an amount, and 160 for a note saved correctly; the fields declare those maxima.
- An encrypted backup contained neither the item name nor passphrase. A wrong passphrase reported `The passphrase is wrong or this backup is damaged.` A malformed file reported `That file is not a Pantry Check backup.` The correct passphrase restored the deleted boundary record after confirmation.
- Simulated blocked IndexedDB produced a clear storage error and a **Try again** action.
- Browser Back restored Pantry from Shopping and focused the restored h1. The reload defect described above remains.

## Accessibility, phone, keyboard, and motion

- Fresh Axe scans found zero violations on empty Pantry, populated Check, Shopping, Settings, Demo, Privacy, Terms, and the designed unknown-route screen.
- At 390×844, every visible control measured at least 44×44 CSS px and there was no horizontal overflow.
- The repaired demo controls each measured 161×44 px.
- With reduced motion enabled, the first Tab focused the skip link at `top: 8`, `bottom: 56`, with a 3 px visible outline. Animation and transition durations were effectively instant.
- The add-item dialog focused Item name, closed with Escape, and did not trap focus. Label, role, state, progress, keyboard shortcuts, and live-region checks passed.
- A 200% text-size smoke check retained the h1, demo label, and controls without horizontal overflow.

## Privacy, offline, update, links, and deployment identity

- The complete live desktop flow made only same-origin requests. It emitted no console or page errors and loaded no analytics, remote fonts, third-party scripts, billing calls, or account service.
- After one online visit, `/demo` reloaded offline from `pantry-v7`, retained Oat milk, and displayed **Offline · changes stay here**.
- A controlled candidate-build update displayed **A fresh version is ready**, activated through **Reload to update**, replaced `pantry-v7` with `pantry-v7-qa-update`, and emitted no errors.
- Privacy and Terms returned 200, set distinct titles, contained one h1 and one main landmark, and had zero Axe violations. All internal links resolved; the email link was explicit.
- The manifest had standalone display, root scope, versioned start URL, 192/512 icons, and a maskable icon. Live headers included CSP, HSTS, `nosniff`, `DENY`, restrictive Permissions-Policy, and strict referrer policy. Fingerprinted assets used one-year immutable caching.
- All 17 public files in local `dist/` matched the live bytes by SHA-256. The live HTML referenced `index-BFJ9UdxK.js` and `index-BnHY9rAh.css`, matching implementation `e0e30c5`.

## Earlier finding disposition

| Earlier finding | Current disposition |
| --- | --- |
| Broken advertised paid checkout | Resolved by removing the unregistered paid offer; no price, checkout, license, or paid feature is now advertised. |
| Missing API rate limit for paid verification | Not applicable after removal of the product API and paid path. |
| Whitespace item and duplicate restock | Fixed and covered by unit/browser tests plus fresh live checks. |
| Invalid progress semantics and Axe issue | Fixed with a labelled native progress element; fresh Axe scans are clean. |
| Header, footer, brand, and demo touch targets | Fixed. All visible phone controls pass 44×44 px; demo controls are 161×44 px. |
| Weak asset caching, manifest MIME, and response hardening | Fixed and confirmed in live headers. |
| CSP-blocked confidence styling | Fixed; populated use has no CSP or console error. |
| Mobile action hidden behind the dock | Fixed and covered by the browser suite. |
| Missing claims registry and isolated demo | Mostly fixed: five declared claims pass and the demo is isolated, but two public claims remain unlisted or incompletely tested. |
| History, headings, and route structure | Partly fixed: Back/Forward, focus, one h1, and the designed page work. Reloaded Check state, distinct view titles, and HTTP 404 status remain defective. |
| Metadata, landing sections, footer, and copy audit | Metadata, sections, and footer are present. Plain-words coverage remains incomplete as reported above. |
| Reduced-motion skip-link focus | Fixed live and in regression coverage. |

## Applicability

Pantry Check is a static local-first PWA. It has no backend, tenant, server-side state, health endpoint, API allowance, package consumer, sign-in, or paid offer. Backend isolation, restart persistence, 429/`Retry-After`, CLI/library installation, and paid checkout tests do not apply. AI would not improve the brief's short deterministic reconciliation job, so no AI feature is missing.

## Required repair

1. Rebuild `reconcileIds` after stored items load whenever the initial view is `reconcile`; add a reload/deep-link regression.
2. Set a distinct title for Pantry, Check, Shopping, and Settings in both real and demo modes.
3. Return HTTP 404 for unknown paths while keeping the designed page and working return link.
4. Replace metaphor and mood labels with direct task language, then make the copy audit complete.
5. Register and test the passphrase privacy claim and the service-worker update claim, or remove those promises.
