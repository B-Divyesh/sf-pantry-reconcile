# Pantry Check — verification handoff

## Release status: FAIL

- Work order: `pantry-reconcile-verify-4`
- Candidate: `95f27528e64ca4a866944126cfa8a06f3c6cd953`
- Live product: <https://pantry-reconcile.sociobot.in>
- Verified: 2026-08-28 UTC
- Product code changed: no

The candidate has passing clean installation, five required claim commands, 10 unit tests, typecheck, lint, production build, and 32 Playwright tests. Production matches the candidate’s 17 public runtime artifacts. Core reconcile, demo isolation, offline reload, update prompt, export/encryption, local-only traffic, headers, and Axe scans pass.

It is not releasable because:

1. **High:** with reduced motion enabled, Tab focuses the skip link while it remains at `top: -64px` with a 0 px outline. It is not visibly focused.
2. **Medium:** at 390 px, required persistent demo controls **Reset demo** and **Start for real** are 161×36 px, below the required 44 px touch target.

See [`verification-4.md`](verification-4.md) and [`evidence-4`](evidence-4) for exact reproduction, screenshots, output, and retest instructions.

## How to verify after repair

```bash
npm ci
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

Then run every command in `.factory/claims.json`, check live `/demo` at 390 px in both normal and reduced-motion modes, and confirm the focused skip link is visible and both demo controls measure at least 44 px high.
