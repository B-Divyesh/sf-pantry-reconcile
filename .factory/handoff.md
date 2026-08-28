# Pantry Check — independent verification handoff

## Release status: FAIL

- Work order: `pantry-reconcile-verify-3`
- Candidate: `3e59b51db84eb05f7225d216298750b5f0358466`
- Live URL: <https://pantry-reconcile.sociobot.in>
- Verified: 2026-08-28 UTC
- Full report: [`.factory/verification-3.md`](verification-3.md)

The live deployment is byte-identical to the candidate and the prior deployment-level defects are repaired. This FAIL comes from fresh candidate evidence, not a stale or deployment-only condition.

## Release blockers

1. `.factory/claims.json` is missing. No required claim test commands or `@claim:<id>` tests exist, while the live page and README make offline, privacy, speed, export/share, and encrypted-backup claims.
2. The mandatory isolated sample-data demo does not exist. “See how a check works” writes Milk and an event into the real `pantry-check` IndexedDB; there is no `/demo`/`?demo=1` seed, demo banner, reset, start-for-real action, separate namespace, or `.factory/demo.md`.

Additional Medium defects: in-app navigation uses `replaceState`, so Back exits instead of returning to the prior view; route changes do not focus/announce a new heading; unknown paths return the normal home screen with HTTP 200; required page-heading and landing-shell structure is incomplete. Metadata and `.factory/copy-audit.md` omissions are Low severity.

## Verification summary

```text
npm ci                         PASS — 164 packages, 0 vulnerabilities
claims manifest/tests          FAIL — .factory/claims.json missing
npm test                       PASS — 3 files, 9 tests
npm run typecheck              PASS
npm run lint                   PASS
npm run build                  PASS — dist/ produced
npm run test:e2e               PASS — 18/18 desktop/mobile tests
factory verify-url.sh          PASS — 200, 806 ms, no console/page errors
independent axe                PASS — 0 serious/critical in all tested states
live artifact identity         PASS — 16/16 files byte-identical
offline reload / SW update     PASS / PASS
Lighthouse                    100 / 100 / 100 / 100
```

Independent flows covered normal and boundary records, invalid/duplicate recovery, persistence, search, Seen/Used/Expired, shopping/share/CSV, restock/undo, encrypted export and restore, malformed/wrong-passphrase errors, keyboard/dialog focus, 390 px touch/layout, reduced motion, privacy requests, response headers, cache policy, offline reload, and service-worker replacement.

## Positive evidence

- Core reconciliation is useful and works end to end.
- Normal use made zero cross-origin requests and emitted zero console/page errors.
- The restrictive CSP, security headers, immutable hashed-asset caching, correct manifest MIME type, and local IndexedDB boundary are live.
- `pantry-v6` survives offline reload. A controlled candidate update showed the update toast, activated on request, and removed the old cache.
- Production payloads are within budget: 10.53 KB gzip JS, 5.46 KB gzip CSS, 84.88 KB fonts, and 22.77 KB mobile artwork. Lighthouse LCP was 1.2 s and CLS 0.039.

## Next steps

Implement the claims registry/tests and a genuinely isolated demo first. Then repair history/route semantics and required site structure, and rerun the full command and browser matrix in [`.factory/verification-3.md`](verification-3.md). Do not mark the release PASS until the mandatory first two gates pass from a clean clone.
