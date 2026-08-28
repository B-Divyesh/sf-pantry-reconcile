# Pantry Check

Pantry Check is an offline-first pantry confidence tool for busy shared households. Instead of asking everyone to record every meal, it turns an occasional fridge, freezer, or pantry scan into a quick “seen / used up / expired” pass. Old and unconfirmed items rise to the front, and anything that left the house becomes a small, shareable shopping delta.

Live product: <https://pantry-reconcile.sociobot.in>

## What it does

- Keeps fridge, freezer, and pantry items locally in IndexedDB—no account required.
- Orders reconciliation passes by uncertainty and zone-specific age.
- Supports touch swipes, labelled buttons, and `S` / `U` / `E` keyboard shortcuts.
- Builds a shareable or CSV shopping delta and returns restocked items to inventory.
- Creates password-protected AES-GCM backups for moving household data between devices.
- Installs as a PWA and reloads the app shell and local data offline.
- Keeps every current feature available without an account, purchase, or subscription.

Expiry status is a household reminder, not food-safety advice or a guarantee that an item is safe to consume.

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

`npm run build` is the deployment command and writes the static product to `dist/`, with `dist/index.html` at its root. Browser tests use Playwright 1.58.2 and cover desktop, mobile, accessibility, persistence, and an explicitly offline reload.

## Data and privacy

Pantry contents and history stay in the browser. Normal use makes no application API requests, analytics calls, or checkout requests. See [`/privacy`](https://pantry-reconcile.sociobot.in/privacy) and [`/terms`](https://pantry-reconcile.sociobot.in/terms).

Generated image provenance, palette, type, spacing, and motion decisions are recorded in [`.factory/design.md`](.factory/design.md). The original prompt and source are in `assets/src/`.

## Deploy

Publish `dist/` as a static site and route extensionless paths such as `/privacy` and `/terms` to `index.html`. `public/staticwebapp.config.json` is copied into `dist/` and provides the required CSP, feature policy, manifest MIME type, and immutable cache policy for Vite-fingerprinted assets. Do not deploy `assets/src/`; it contains production-source artwork only. The service worker controls the root scope and updates via an in-app reload prompt.

## License

MIT. See [LICENSE](LICENSE).
