# Check shared pantry items — independent verification 6

## Verdict: FAIL

- Findings: **1** — 0 high, 1 medium, 0 low
- Untested public claims: **0**
- Implementation reviewed: `7df5787136a1d0b8a0fce5812a6288da86742739`
- Documentation baseline reviewed: `2c53e7ec62526feb1b86f9757cfd1b17e9d835ef`
- Live URL: <https://pantry-reconcile.sociobot.in>
- Verified: 2026-09-06 UTC
- Product code changed during verification: no

Direct reloads on Check now restore zero-action and partial queues, and completed checks stay complete. The release still fails because the normal recovery path breaks after the user leaves an incomplete check and reloads Pantry. **Resume check** then shows a false completed-check screen with no pending item.

## Job, audience, and first action before scrolling

- Job: check pantry items without tracking every meal.
- Audience: people who share a kitchen and need a quick view of what remains.
- First action: **Add your first item**. **Try it with sample data** is beside it and explains that it opens a stocked separate sample.

A fresh 1440×900 desktop and 390×844 phone showed the job, audience, both actions, and three facts before scrolling. Phone content stayed above the fixed navigation and had no horizontal overflow.

## Finding

### Medium — Resume loses the active queue after Pantry reload

This affects both zero-action and partial checks on the live site.

Zero-action reproduction:

1. Open `/demo`, choose **Reset demo**, then **Start a check**.
2. Confirm Red lentils is shown with progress 0 of 3.
3. Choose **Finish for now**. Pantry truthfully says **3 items left in this check**.
4. Reload Pantry. The remaining count still says 3.
5. Choose **Resume check**.

Actual: `/demo?view=reconcile` shows **0 items checked.** and no item card.

Expected: Red lentils returns with progress 0 of 3.

The same sequence after marking Red lentils Seen reproduces the defect. Pantry truthfully retains **2 items left in this check** across reload, but **Resume check** then shows **0 items checked.** Expected: Oat milk with progress 1 of 3.

The stored queue is not lost. Reloading `/demo?view=reconcile` directly restores the right item and progress, and **Check again** can start a new pass. Pantry does not show the fresh state until all three required outcomes are recorded. The defect is release blocking because the visible recovery action reports completion and hides saved pending work.

The implementation cause matches the result: startup restores a saved session only when the initial view is Check. After startup on Pantry, `setView('reconcile')` sees that a session exists but does not rebuild the in-memory queue before rendering.

Evidence: [live-qa.json](evidence-verification-6/live-qa.json) and [live-qa.mjs](evidence-verification-6/live-qa.mjs).

## Declared claims

The checkout was clean at `2c53e7e` before `npm ci`. Every command in `.factory/claims.json` was run separately and exactly as declared.

| Claim | Command | Result |
| --- | --- | --- |
| Isolated sample | `npm run test:e2e -- --grep @claim:demo-isolated` | PASS — 2/2 projects |
| Offline reload | `npm run test:e2e -- --grep @claim:offline-reload` | PASS — 2/2 projects |
| Local-only use | `npm run test:e2e -- --grep @claim:local-only` | PASS — 2/2 projects |
| CSV export | `npm run test:e2e -- --grep @claim:csv-export` | PASS — 2/2 projects |
| Encrypted backup | `npm run test:e2e -- --grep @claim:encrypted-backup` | PASS — 2/2 projects |
| Private passphrase | `npm run test:e2e -- --grep @claim:passphrase-private` | PASS — 2/2 projects |
| Update prompt | `npm run test:e2e -- --grep @claim:update-prompt` | PASS — 2/2 projects |

Each claim tag occurs exactly once in the browser source. A cross-check of the landing page, demo, app views, Privacy, Terms, and README found no unlisted public promise. Untested claim count: **0**.

## Clean setup and quality gates

| Check | Result |
| --- | --- |
| `npm ci` | PASS — 164 packages, 0 vulnerabilities |
| `npm test` | PASS — 11/11 Vitest tests |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS — `dist/index.html` produced |
| `npm run test:e2e` | PASS — 46/46 Playwright tests |
| Factory `verify-url.sh` | PASS — HTTPS 200, title, `lang=en`, one h1, main, alt text, button names, and console checks clean |
| Axe CLI 4.10.3 | PASS — 0 violations on the live root after installing a matching Chrome 145 test browser and driver |

The shipped suite does not cover Finish → Pantry reload → Resume. Its interrupted-check test reloads while already on Check, then leaves and resumes without reloading Pantry. That gap explains why 46 tests pass while the live recovery path fails.

## Demo and complete workflow

- The landing sample action opened `/demo` in one click.
- Oat milk, Frozen peas, and Red lentils populated Pantry. Pasta populated Shopping.
- **Demo — sample data, nothing is saved** remained visible on Pantry, Shopping, Settings, and Check.
- Seen, Used up, and Expired produced realistic Shopping output. CSV contained the expected header and three current rows.
- Restock and Undo worked. **Reset demo** restored the original sample.
- Demo state used `demo:pantry-check`. **Start for real** opened an empty `pantry-check`; sample actions left its item count at zero.
- Direct zero-action and partial Check reloads restored the correct item and progress. A full three-outcome check showed **3 items checked.**, survived reload, and only then showed **All items were checked recently** with three **Checked today** labels.

The finding above applies specifically to leaving an incomplete check, reloading Pantry, and using its normal Resume action.

## Invalid, boundary, and recovery paths

- A whitespace-only name was rejected with focus retained on Item name.
- A case-insensitive duplicate was rejected.
- Exact limits of 80 characters for names, 40 for amounts, and 160 for notes saved and survived reload.
- Search, no-results, and clear-search states worked.
- The add dialog focused Item name and closed with Escape.
- Cancelled deletion kept the record; confirmed deletion removed it.
- An encrypted backup contained neither the item name nor passphrase, and the passphrase field cleared after download.
- Wrong-passphrase and malformed-file errors were direct and recoverable. The correct backup restored the deleted record after confirmation.
- A forced IndexedDB failure showed the storage error and **Try again** action.

## Accessibility, phone, keyboard, and motion

- Axe found no serious or critical violations on Privacy, Terms, 404, populated demo Pantry, Check, Shopping, Settings, or the 390 px demo. Standalone Axe found zero violations on the live root.
- At 390×844 there was no horizontal overflow. Reset demo and Start for real each measured 161×44 CSS px.
- Under reduced motion, the first Tab focused the visible skip link at top 8 px with a 3 px outline. Animation and transition durations were effectively instant.
- The `S` keyboard shortcut recorded Seen. Native dialog focus and Escape behavior worked without a trap.
- At 200% page scale, the h1, demo label, and demo controls remained available.
- Each checked page had one h1, a main landmark, named controls, and route-specific titles.

## Offline, privacy, links, routes, and deployment identity

- After one online visit, `/demo` reloaded offline from `pantry-v8`, retained Oat milk, and displayed **Offline · changes stay here**.
- The controlled `@claim:update-prompt` test installed a changed worker through **Reload to update** in both browser projects.
- The complete live desktop run made only same-origin requests and emitted no console or page errors. No analytics, remote fonts, third-party scripts, account, billing, or product API request appeared.
- Privacy and Terms returned 200 with distinct titles, one h1, one main, and clean Axe scans.
- All internal links tested returned 200. The unknown test path deliberately returned HTTP 404 and displayed the designed page with a working return link; this expected 404 is not a defect.
- The manifest has standalone display, root scope, a versioned start URL, 192/512 icons, and a maskable icon. Live headers include CSP, HSTS, `nosniff`, frame protection, restrictive Permissions-Policy, and strict referrer policy.
- All 20 public files in local `dist/`, excluding only deployment configuration, matched the live bytes by SHA-256. The live runtime is implementation `7df5787`; later commit `2c53e7e` contains reports only.

## Performance

Fresh Lighthouse 13.4.1 mobile results:

- Performance 100, Accessibility 100, Best Practices 100, SEO 100.
- FCP 1.35 s, LCP 1.50 s, TBT 0 ms, CLS 0.037.
- Total transfer 135,009 bytes.

Production output remains within budget: JavaScript 34.99 KB raw and 11.87 KB gzip; CSS 21.70 KB raw and 5.70 KB gzip; self-hosted fonts 84.88 KB total; mobile artwork 22.77 KB.

## Earlier finding disposition

| Earlier finding | Current disposition |
| --- | --- |
| Broken paid checkout | Resolved by removing the unavailable offer; no payment or paid feature is advertised. |
| Missing paid-verification rate limit | Not applicable after removing the product API and paid path. |
| Whitespace names and duplicate restock | Fixed; validation and recovery pass. |
| Invalid progress semantics and reconcile Axe issue | Fixed with a labelled native progress element; fresh Axe checks are clean. |
| Small header, footer, and demo touch targets | Fixed; measured targets meet 44×44. |
| Weak caching, manifest MIME, and missing response headers | Fixed live. |
| CSP-blocked confidence display | Fixed; the full live run has no CSP or console error. |
| Mobile action hidden behind navigation | Fixed; first actions are visible above the dock. |
| Missing claims registry and unsafe sample data | Fixed; seven claim tests pass and demo data remains isolated. |
| History, heading, landing structure, footer, metadata, and copy audit | Fixed; routing, structure, metadata, and direct copy pass. |
| Reduced-motion skip link and 36 px demo actions | Fixed live and covered by measurements. |
| Verification 5 passphrase and update claims | Fixed; both are declared and pass in both projects. |
| Verification 5 view titles | Fixed; all real and demo app views have distinct titles. |
| Verification 5 soft 404 | Fixed; the designed unknown route returns HTTP 404. |
| Verification 5 metaphor and mood copy | Fixed; prohibited strings are absent from product copy and the audit records replacements. |
| Verification 5 active-check reload | **Partly fixed.** Direct Check reloads pass, but Pantry reload followed by Resume fails as reported above. |

## Applicability

Pantry Check is a static local-first PWA. It has no backend, tenant, server state, health endpoint, API allowance, package consumer, sign-in, or paid offer. Backend isolation, server restart persistence, 429/`Retry-After`, CLI/library installation, and payment tests do not apply. The brief's short deterministic check does not need an AI step.

## Required repair

When navigation enters Check with a saved incomplete session, rebuild the in-memory queue and completed count before rendering. Add regression cases for both zero-action and partial sessions after Finish → Pantry reload → Resume. Then repeat the live recovery sequence; direct Check reload tests alone are insufficient.
