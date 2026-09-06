# Pantry Check — repair handoff

## Release status: PASS

- Work order: `pantry-reconcile-repair-4`
- Live product: <https://pantry-reconcile.sociobot.in>
- Runtime implementation SHA: `e0e30c560b98a5db9f2967e30cf21904c03056c0`
- Earlier failed candidate: `95f27528e64ca4a866944126cfa8a06f3c6cd953`
- Documentation began at SHA: `877f4666bf937fbc483b6341f0f6925167864dea`; this handoff is committed separately after verification.
- Verified and deployed: 2026-09-06 UTC

Pantry Check is an offline, local-first pantry review tool for shared kitchens. The first action is **Add your first item**; the adjacent **Try it with sample data** action opens the isolated sample pantry.

## Fixed in this repair

1. With reduced motion enabled, the first keyboard Tab now exposes the skip link at the top of the viewport with a 3 px visible focus outline. The reduced-motion rule explicitly preserves the focused state and removes its transition.
2. The persistent demo actions now retain the product-wide 44 px minimum control height. At a 390 px viewport, **Reset demo** and **Start for real** both measure 161×44 px.
3. Browser regression coverage checks the visible reduced-motion focus outcome and the mobile target geometry plus functional reset/leave-demo behavior. These are user-facing tests, not stylesheet-string assertions.

## Verification

From the documented clean setup:

```bash
npm ci
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

All passed: 10 Vitest tests, typecheck, ESLint, production build, and 36 Playwright tests across desktop Chromium and Pixel 5.

Every declared claim command in [`.factory/claims.json`](claims.json) also passed independently (two browser projects each):

```bash
npm run test:e2e -- --grep @claim:demo-isolated
npm run test:e2e -- --grep @claim:offline-reload
npm run test:e2e -- --grep @claim:local-only
npm run test:e2e -- --grep @claim:csv-export
npm run test:e2e -- --grep @claim:encrypted-backup
```

Live deployment used the existing `sf-pantry-reconcile` Static Web App and the built `dist/` directory. No backend, data volume, environment setting, or replica configuration exists for this static PWA. All 17 public runtime files in `dist/` match the live bytes by SHA-256.

Fresh browser checks on the live HTTPS origin passed:

- Desktop and 390×844 phone first reads showed the job, audience, and **Add your first item** before scrolling; phone had no horizontal overflow.
- One-click demo showed Oat milk, Frozen peas, Red lentils, and the Pasta shopping change, kept its persistent sample-data label, reset successfully, and left the real pantry with zero items when **Start for real** was used.
- Normal use made only same-origin requests and had no console or page errors.
- Reduced-motion phone check: focused skip link `top: 8`, `bottom: 56`, outline width `3`; demo controls were both 161×44 px.
- Demo data reloaded while offline after the first visit and displayed the offline notice.
- A controlled service-worker update showed **A fresh version is ready**, activated through **Reload to update**, replaced `pantry-v7` with `pantry-v7-qa-update`, and produced no errors.
- Live Axe scans reported zero violations on Home, Demo, Check, Shopping, Settings, Privacy, and Terms.
- `verify-url.sh` passed: HTTPS 200, 632 ms network-idle load, title, `lang`, one `h1`, `main`, image alt text, labelled buttons, and no console errors. Evidence is in [`evidence-5/verify-url`](evidence-5/verify-url).
- Privacy, Terms, and the designed unknown-route page have their own title, one heading, and usable navigation back to the app.

The current build is 32.67 KB JavaScript raw (11.40 KB gzip) and 21.68 KB CSS raw (5.69 KB gzip), within the static-product budgets.

## Earlier findings

- The original whitespace, case-insensitive duplicate/restock, progress semantics, CSP console-error, mobile header/footer target, empty-state dock, cache-policy, response-hardening, claims, demo isolation, history, metadata, and route-design findings remain covered by the existing unit and browser suite. Current live checks found no regression.
- The former advertised billing path was removed in an earlier candidate because no offer was registered. This repair did not add, remove, or represent a paid offer. No checkout or price is currently advertised, so no billing-offer registration metadata applies; the free local-first core remains available.

## Known limits

No known product defect remains in the tested Chromium paths. Hardware installation flows in Safari/iOS and Firefox were not available in this environment. Pantry Check has no account, backend, external integration, or server-side product state, so tenant isolation, restart persistence, health endpoints, and API rate-limit checks do not apply.

## Next steps

The factory can release this deployed revision. If a paid unlock is later registered, add the actual offer metadata and the Sociobot billing verification/restore flow without reducing the free core.
