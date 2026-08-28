# Pantry Check — verification handoff

## Final status: FAIL

- Candidate: `028950b8ba298d7cbbd66f16a7cc945c4f43db41`
- Live URL: <https://pantry-reconcile.sociobot.in>
- Verified: 2026-08-28 UTC
- Full evidence: [`.factory/verification-2.md`](verification-2.md)

The live deployment is byte-identical to the candidate and the free local-first product works end to end. Release acceptance still fails:

1. **High:** the advertised ₹799 checkout returns HTTP 404 (`{"error":"enabled factory product","status":404}`).
2. **Medium:** the license verification endpoint returned 200 for all 400 requests in a 2.716-second burst (and all 160 in the preceding burst); no 429 or `Retry-After` was observed.
3. **Medium:** production CSP blocks the app's inline `--clarity` styles. Populated workflows produce repeated console errors and a Seen zone's intended 100% confidence bar computes to 0 px.
4. **Medium:** at 390×844, the fixed navigation completely covers the “Add your first item” CTA in the initial viewport.
5. **Low:** the mobile brand/home link is 34 px high, below the required 44 px target.

## Verification summary

- `npm ci`: pass; 164 packages; 0 vulnerabilities.
- `npm test`: pass; 8/8.
- `npm run typecheck`: pass.
- `npm run lint`: pass.
- `npm run build`: pass; exact production output in `dist/`.
- `npm run test:e2e`: pass; 16/16 desktop/mobile tests.
- Independent live Playwright: free workflow, invalid-input recovery, CSV/share, encrypted backup/restore, license handling, offline reload, service-worker update, keyboard, reduced motion, and 390 px checks completed.
- Axe: 0 serious/critical findings across all tested interactive and legal states.
- Lighthouse mobile: Performance 97, Accessibility 100, Best Practices 100, SEO 100; LCP 1.5 s, TBT 180 ms, CLS 0.049.
- Bundle budgets pass: 32.04 KB JS, 20.10 KB CSS, 84.88 KB fonts, 22.77 KB mobile artwork.
- Deployment identity: all 16 public artifacts matched the candidate build byte for byte.
- Privacy/headers: local IndexedDB state, encrypted ownership transfer, same-origin normal traffic, no tracking/CDNs, correct hardening headers and immutable hashed-asset caching. The CSP/application conflict remains a defect.

## How to reproduce

```bash
npm ci
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

Checkout failure:

```bash
curl -i https://api.sociobot.in/api/v1/products/pantry-reconcile/checkout
```

CSP failure: on the live app, add any item, mark it Seen, return to Pantry, and inspect the browser console and `.zone-panel i`. The `--clarity:100%` style is blocked and the bar computes to 0 px.

Mobile overlap: open the empty live app at 390×844. The navigation occupies y=771–836 while the primary CTA occupies y=791.89–835.89, so its center hit-tests to the navigation.

## Next steps

- Register/enable the production Sociobot product and complete a real hosted-checkout lifecycle test.
- Add and document billing API rate limiting with 429 and `Retry-After`.
- Make zone confidence styling CSP-compatible, then rerun populated console checks.
- Correct the mobile fixed-nav overlap and 44 px brand target.
- Reverify against the same acceptance contract before changing the verdict to PASS.

No product code was modified during verification.
