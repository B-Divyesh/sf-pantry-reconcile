# Pantry Check

Pantry Check helps shared kitchens review what is still there. Add familiar items, run a check, and keep the shopping change small.

Live product: <https://pantry-reconcile.sociobot.in>

## Try the sample

Open [the isolated demo](https://pantry-reconcile.sociobot.in/demo). It opens sample data in `demo:pantry-check`, separate from a real pantry. **Reset demo** rebuilds the sample. **Start for real** opens the real local pantry without copying sample data.

## Tested product promises

- Works offline after the first visit.
- Pantry data stays on this device; normal use makes no third-party or cross-origin application requests.
- Exports the shopping change as CSV.
- Downloads an encrypted pantry backup.

Every promise is mapped to a deterministic `/demo` browser test in [`.factory/claims.json`](.factory/claims.json).

Expiry status is a household reminder. It is not food-safety advice.

## Run locally

Requirements: Node.js 20+ and npm.

```bash
npm ci
npm run dev
```

Open the local URL printed by Vite. No environment variables are required.

## Test and build

```bash
npm test
npm run lint
npm run build
npm run test:e2e
```

`npm run build` writes the static product to `dist/`, with `dist/index.html` at its root. Browser tests use Playwright 1.58.2. Run every command in `.factory/claims.json` before release.

## Data and privacy

See [`/privacy`](https://pantry-reconcile.sociobot.in/privacy) and [`/terms`](https://pantry-reconcile.sociobot.in/terms).

Generated image provenance, palette, type, spacing, and motion decisions are recorded in [`.factory/design.md`](.factory/design.md). The original prompt and source are in `assets/src/`.

## Deploy

Publish `dist/` as a static site and route extensionless paths such as `/privacy` and `/terms` to `index.html`. `public/staticwebapp.config.json` is copied into `dist/` and provides the required CSP, feature policy, manifest MIME type, and immutable cache policy for Vite-fingerprinted assets. Do not deploy `assets/src/`; it contains production-source artwork only. The service worker controls the root scope and updates via an in-app reload prompt.

## License

MIT. See [LICENSE](LICENSE).
