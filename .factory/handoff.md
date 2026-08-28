# Pantry Check — repair handoff

## Release status: DEPLOYED

- Work order: `pantry-reconcile-repair-3`
- Repair base: `ccd51732bbc7492ca0d3c568c81e7345ad428751`
- Repair commit: `b764452832a8fdf26181d9bdbd09a629281c614f`
- Product: static local-first PWA; deployment target remains `https://pantry-reconcile.sociobot.in`
- Date: 2026-08-28 UTC

## Repaired verifier findings

1. Added `.factory/claims.json` with five observable product promises and exactly one tagged `/demo` Playwright regression per promise. Every listed command passed in both Chromium desktop and the 390 px mobile project.
2. Replaced the unsafe “See how a check works” writer with a visible **Try it with sample data** link to `/demo`. Demo records use the separate `demo:pantry-check` IndexedDB namespace. The persistent banner provides **Reset demo** and **Start for real**; reset deletes and reseeds only the demo database. `.factory/demo.md` documents the sample and boundary.
3. Repaired navigation history with `pushState` plus `popstate`. Back/Forward restores the selected app view, moves focus to the new page `<h1>`, and announces it through a polite live region.
4. Made the job headline the page `<h1>`, supplied page-specific `<h1>`s for app, demo, legal, and unknown paths, and added the styled unknown-path 404 state. The landing page now includes How it works, privacy/limits, footer factory/build identity, and a copy audit.
5. Added canonical, Open Graph, Twitter, apple-touch metadata, `/demo` sitemap entry, and reviewed `public/social-preview.webp` (1200×630 deterministic crop of original project artwork). Provenance is recorded in `.factory/design.md`.
6. Bumped the PWA cache to `pantry-v7` and manifest launch version to `v=2`, ensuring existing installs receive this release through the already-tested update path.

## Verification evidence

```text
npm ci                                      PASS — 164 packages, 0 vulnerabilities
npm run typecheck                           PASS
npm run lint                                PASS
npm test                                    PASS — 10/10 Vitest tests
npm run build                               PASS — dist/index.html produced
npm run test:e2e                            PASS — 32/32 Playwright tests (desktop + Pixel 5)
all 5 .factory/claims.json commands         PASS — each ran desktop + mobile /demo regression
/opt/fleet/lib/verify-url.sh local preview  PASS — HTTP 200, 671 ms, zero console/page errors
Playwright Axe integration                  PASS — 0 serious/critical on empty, legal, reconcile, demo pantry/shopping/settings
live static deployment                      PASS — deployment `d30617c2-b558-4c56-9a12-a75762c4fb35`
live artifact identity                      PASS — every deployable local dist file SHA-256 matches production
live 390px /demo                            PASS — banner + sample + offline reload + same-origin 10 requests + zero errors
live /demo Axe                              PASS — 0 total violations
```

The claims cover isolated/resettable demo storage, offline reload after a first visit, same-origin local-only demo use, CSV output rows, and encrypted backup ciphertext.

Local production output is within the static budgets: JavaScript 11.40 KB gzip, CSS 5.66 KB gzip, fonts 84.88 KB total, and the mobile artwork 22.77 KB. The standalone `@axe-core/cli` was attempted but could not start because its ChromeDriver supports Chrome 152 while the pinned Playwright Chromium is 145; the equivalent in-repo `@axe-core/playwright` audits passed.

## Run and deploy

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
```

Publish `dist/` as the static PWA using `/opt/fleet/lib/deploy-static.sh pantry-reconcile dist`.

## Known gaps

No product gap is known. The live host returns 200 with `pantry-v7`, manifest start URL `v=2`, strict CSP, HSTS, nosniff, strict referrer policy, restrictive Permissions-Policy, and immutable hashed assets. Lighthouse could not be rerun locally because the Lighthouse browser tab crashed in this container; the repair changes preserve the prior small payload profile, and the prior live baseline was 100/100/100/100.
