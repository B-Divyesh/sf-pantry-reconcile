# Pantry Check — build handoff

## Independent verification — FAIL (2026-08-28 UTC)

Candidate `d10afe8c84a31d5a1f9eead9f7035b6f16b52bc1` was independently tested at <https://pantry-reconcile.sociobot.in>. The live HTML, hashed bundles, fonts, PWA files, icons, imagery, robots, and sitemap are byte-for-byte identical to the candidate build, so this is not a stale-deployment result.

Blocking findings:

- **High:** the advertised ₹799 Household Plus checkout returns HTTP 404 (`{"error":"enabled factory product","status":404}`), so purchase cannot complete.
- **Medium:** adding a replacement while the old record is in Shopping and then restocking the old record creates two active duplicates.
- **Medium:** whitespace-only item names are accepted and produce unnamed records.
- **Medium:** axe reports one serious `aria-prohibited-attr` violation on the reconcile progress `div` (WCAG 4.1.2).
- **Medium:** the 390 px header Add item button is 48×42 and footer Privacy/Terms links are 44×19.5 and 38×19.5, below the required 44×44 target.
- **Low:** hashed assets use a 30-second revalidating cache instead of long-lived immutable caching; CSP, Permissions-Policy, and framing protection are absent; the manifest uses `application/octet-stream` (Chromium still parses it without errors).

Repository gates remain green: `npm ci` (0 vulnerabilities), `npm test` (5/5), `npm run build`, and `npm run test:e2e` (8/8). Independent end-to-end coverage passed for the free flow, encrypted export/import and wrong-password recovery, keyboard and swipe use, persistence, 390 px layout, privacy/network behavior, offline reload, and a controlled service-worker update. Lighthouse scored 99 Performance / 100 Accessibility / 100 Best Practices / 100 SEO with LCP 1.5 s, TBT 20 ms, and CLS 0.056. Initial transfer was 127,664 bytes with no third-party requests. See [`.factory/verification.md`](verification.md) for exact evidence and retest criteria.

## What shipped

- A production Vite + TypeScript offline PWA for confidence-based pantry reconciliation.
- Local IndexedDB records for zones, rough amounts, notes, confirmation age, item state, and a visible action timeline.
- Add/edit/remove flows with duplicate validation and specific destructive confirmation.
- Uncertainty-first reconciliation across all items or one zone, with labelled actions, S/U/E keyboard shortcuts, touch swipes, progress, completion state, and undo.
- Shopping delta created by “used up” and “expired,” with Web Share/clipboard sharing, CSV export, and restocking.
- Advisory expiry language in both reconcile and shopping contexts; the product makes no food-safety claim.
- AES-256-GCM encrypted export/import using PBKDF2 (250,000 SHA-256 iterations). Import is validated and explicitly replaces local data only after confirmation.
- One-time Household Plus UI at ₹799, production Sociobot checkout link, checkout-return license capture, daily cached verification, offline optimistic cache behavior, and paste-to-restore. Paid features are starter templates and extended local history; all core, export, safety, and accessibility features remain free.
- PWA manifest, hand-authored maskable icons, versioned shell cache, offline navigation fallback, asset cache, and an in-app update notice.
- Privacy and terms routes, MIT license, product README, and the product-specific design thesis.
- Original generated pantry landscape. Source PNG, factory sidecar, review record, and prompt are under `assets/src/`; optimized WebP variants are 54 KB desktop and 23 KB mobile.

## How to run and verify

```bash
npm install
npm test
npm run build
npm run test:e2e
```

The required deploy command is `npm run build`; output is `dist/` and `dist/index.html` is present at its root.

Verification completed 2026-08-28:

- `npm test`: 5/5 unit tests passed (confidence ordering and encrypted backup round-trip/failure).
- `npm run test:e2e`: 8/8 Playwright scenarios passed across desktop Chromium and Pixel 5 emulation.
- Offline test: service worker acquired control, the network was disabled with `context.setOffline(true)`, the page reloaded, and stored pantry data plus the offline status remained available.
- Axe via Playwright: no serious or critical violations on the empty app, privacy page, or terms page in desktop and mobile projects.
- Console smoke: no console or page errors on the empty app load.
- `npm audit --omit=dev`: 0 vulnerabilities. Full install audit was also 0 after pinned upgrades.
- Production payload: 31.55 KB JS (11.32 KB gzip), 19.71 KB CSS (5.37 KB gzip), 84.88 KB total self-hosted variable fonts, 54 KB desktop hero / 23 KB mobile hero.
- Lighthouse 12.8.2, mobile/default throttling after the robots/sitemap fix: Performance 99, Accessibility 100, Best Practices 100, SEO 100. Metrics: LCP 1.8 s, TBT 0 ms, CLS 0.049.
- Factory `verify-url.sh`: HTTP 200, 773 ms network-idle load, title/lang/main present, exactly one h1, zero missing image alt attributes, zero unlabelled buttons, and zero console/page errors.

## Operational notes and known gaps

- The factory must register the `pantry-reconcile` paid product and confirm the ₹799 price/return URL in Sociobot before checkout can complete. No product ID or payment-provider integration is embedded.
- Sharing between devices is deliberately manual and encrypted; there is no account or live multi-device merge. Imports use last imported state as an explicit whole-household replacement.
- Expiry is user-declared, not calculated from a food database. This is intentional: Pantry Check avoids barcode/catalog dependence and does not provide food-safety advice.
- Static hosting must route extensionless `/privacy` and `/terms` requests to `index.html`, as noted in the README.
- No analytics or page-count integration was added; there are no tracking requests.
