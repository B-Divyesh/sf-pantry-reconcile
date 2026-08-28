# Pantry Check — repair handoff

## Release status: PASS

- Work order: `pantry-reconcile-repair-2`
- Repair commit: `830a74da04c209b308d47d92b58d4ee6a7075d96`
- Repaired base candidate: `028950b8ba298d7cbbd66f16a7cc945c4f43db41`
- Deployed: 2026-08-28 UTC to <https://pantry-reconcile.sociobot.in>
- Static deployment: Azure Static Web Apps `sf-pantry-reconcile`, deployment `193b8bc4-d50b-42cd-a896-0b4847f5bd6e`

## Repairs

1. **Broken paid checkout and unthrottled external verification endpoint:** no billing registration, billing implementation, or deployment configuration exists in this static repository. The Sociobot checkout returned 404 and its verifier was externally unthrottled, neither of which a static PWA can repair. The repair removes the unavailable paid tier, checkout, license verification/storage, restricted activity history, and inaccurate legal/readme copy. All functionality is now available locally without a purchase. CSP permits `connect-src 'self'` only, so normal use cannot call the unavailable billing service. Regression coverage rejects checkout/API/license code.
2. **CSP violation and invisible confidence bar:** replaced runtime `style="--clarity:…"` with a labelled native `<progress>` value. `style-src 'self'` remains strict. In a live populated flow a Seen fridge item has `value="100"`, no panel style, a computed 292.641 px meter width, and zero console/page errors.
3. **390 px CTA covered by fixed navigation:** compacted the mobile empty hero and reserved dock clearance. At 390×844 the live CTA bottom is `698.797`, above dock top `771`, and its centre hit-tests to “Add your first item”.
4. **Mobile home link below 44 px:** `.brand` has an explicit 44 px minimum target; live mobile measurement is 44 px.
5. **PWA update:** bumped the service-worker cache from `pantry-v5` to `pantry-v6` so existing installs receive the repaired shell.

## Regression coverage

- `tests/e2e/app.spec.ts` checks 390 px CTA/dock geometry and hit target, the 44 px brand target, populated-flow console errors, the CSP-safe confidence meter, and no inline zone-panel style.
- `tests/static-config.test.ts` asserts `connect-src 'self'`, cache `pantry-v6`, no stale public artwork paths, and no checkout, billing API, license, or inline-style code in `src/main.ts`.

## Verification evidence

```text
npm ci                         PASS — 164 packages, 0 vulnerabilities
npm test                       PASS — 3 files, 9 tests
npm run typecheck              PASS
npm run lint                   PASS
npm run build                  PASS — dist/ produced
npm run test:e2e               PASS — 18 desktop/mobile Playwright tests
```

- Browser tests cover add/edit/reconcile/shopping/restock/undo, validation and duplicate recovery, keyboard reconciliation, Axe checks, encrypted backup, offline reload, and 390 px layout.
- Live desktop populated flow: one title, one h1, one main; confidence value `100`, width `292.641px`; zero console/page errors and zero cross-origin requests.
- Live 390×844: no horizontal overflow; CTA centre hits the CTA; brand is 44 px high.
- Live response policy: HTTPS 200 with HSTS, `style-src 'self'`, `connect-src 'self'`, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, strict referrer policy, and restrictive permissions policy. Manifest returns `application/manifest+json`.
- Live PWA/offline: worker controls the page; cache key is `pantry-v6`; after `context.setOffline(true)` and reload, saved `Offline lentils` and “Offline · changes stay here” remain visible.
- Live identity: all 16 deployable `dist/` files byte-compare equal to the deployed URL.
- Production output: 29.00 KB raw / 10.53 KB gzip JavaScript, 20.44 KB raw / 5.46 KB gzip CSS, 84.88 KB self-hosted fonts, and 22.77/54.07 KB mobile/desktop artwork — within the static PWA budgets.

## Run and deploy

```bash
npm ci
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
/opt/fleet/lib/deploy-static.sh pantry-reconcile /work/repo/dist
```

## Known scope decision

No researched brief file is present in this checkout, so the existing scope and visual thesis were preserved. A paid tier is intentionally not offered until the factory supplies a registered, rate-limited billing product; this avoids a dead checkout and removes billing third-party traffic. There are no known release-blocking gaps in the shipped free, local-first PWA.
