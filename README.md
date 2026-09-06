# Pantry Check

Pantry Check helps shared kitchens review what is still there. Add familiar items, run a check, and keep the shopping list short.

Live product: <https://pantry-reconcile.sociobot.in>

## Try the sample

Open [the isolated demo](https://pantry-reconcile.sociobot.in/demo). It opens sample data in `demo:pantry-check`, separate from a real pantry. **Reset demo** rebuilds the sample. **Start for real** opens the real local pantry without copying sample data.

## Tested product promises

- Works offline after the first visit.
- Pantry data stays on this device; normal use makes no third-party or cross-origin application requests.
- Exports the shopping list as CSV.
- Downloads an encrypted pantry backup.
- Does not send or save the backup passphrase, so Pantry Check cannot recover it.
- Shows an in-app reload prompt when a service-worker update is ready.

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

Publish `dist/` as a static site. `public/staticwebapp.config.json` rewrites `/demo`, `/privacy`, and `/terms` to the app, while unknown paths use the designed HTTP 404 page. It also provides the CSP, feature policy, manifest MIME type, and immutable cache policy for fingerprinted assets. Do not deploy `assets/src/`; it contains production-source artwork only.

## License

MIT. See [LICENSE](LICENSE).
