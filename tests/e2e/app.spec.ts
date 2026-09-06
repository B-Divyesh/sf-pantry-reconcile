import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import type { AddressInfo } from 'node:net';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('adds, reconciles, and persists an item', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Check pantry items');
  await page.getByRole('button', { name: 'Add item' }).click();
  await page.getByLabel('Item name').fill('Oat milk');
  await page.getByLabel('Zone').selectOption('fridge');
  await page.getByLabel('Rough amount').fill('half a carton');
  await page.getByRole('button', { name: 'Save item' }).click();
  await expect(page.getByText('Oat milk', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add item' }).click();
  await page.getByLabel('Item name').fill('Do not save');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByText('Do not save', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Start a check' }).click();
  await expect(page.locator('.check-card')).toContainText('Oat milk');
  await page.keyboard.press('s');
  await expect(page.getByRole('heading', { name: '1 item checked.' })).toBeVisible();
  await page.getByRole('button', { name: 'View pantry' }).click();
  await page.reload();
  await expect(page.getByText('Oat milk', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('used items become a restockable shopping delta', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add item' }).click();
  await page.getByLabel('Item name').fill('Pasta');
  await page.getByLabel('Zone').selectOption('pantry');
  await page.getByRole('button', { name: 'Save item' }).click();
  await page.getByRole('button', { name: 'Start a check' }).click();
  await page.getByRole('button', { name: /Used up/ }).click();
  await page.getByRole('link', { name: /Shopping/ }).click();
  await expect(page.getByRole('heading', { name: 'Shopping list' })).toBeVisible();
  await expect(page.getByText('Pasta', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mark restocked' }).click();
  await expect(page.getByText('Nothing to replace.')).toBeVisible();
});

test('rejects whitespace-only names and keeps focus on the item name', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add item' }).click();
  const name = page.getByLabel('Item name');
  await name.fill('   ');
  await page.getByRole('button', { name: 'Save item' }).click();
  await expect(page.getByText('Enter an item name, not only spaces.')).toBeVisible();
  await expect(name).toBeFocused();
  await expect(page.locator('.item-dialog[open]')).toBeVisible();
});

test('does not restock into a case-insensitive active duplicate', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add item' }).click();
  await page.getByLabel('Item name').fill('Pasta');
  await page.getByLabel('Zone').selectOption('pantry');
  await page.getByRole('button', { name: 'Save item' }).click();
  await page.getByRole('button', { name: 'Start a check' }).click();
  await page.getByRole('button', { name: /Used up/ }).click();
  await page.getByRole('link', { name: 'Pantry', exact: true }).click();
  await page.getByRole('button', { name: 'Add item' }).click();
  await page.getByLabel('Item name').fill(' pasta ');
  await page.getByRole('button', { name: 'Save item' }).click();
  await page.getByRole('link', { name: /Shopping/ }).click();
  await page.getByRole('button', { name: 'Mark restocked' }).click();
  await expect(page.locator('.toast')).toContainText(/already active in your pantry/i);
  await expect(page.getByRole('button', { name: 'Mark restocked' })).toBeVisible();
  await page.getByRole('link', { name: 'Pantry', exact: true }).click();
  await expect(page.locator('.item-list strong')).toHaveCount(1);
  await expect(page.locator('.item-list strong')).toHaveText('pasta');
});

test('uses a valid labelled progress element with no serious reconcile axe findings', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add item' }).click();
  await page.getByLabel('Item name').fill('Rice');
  await page.getByRole('button', { name: 'Save item' }).click();
  await page.getByRole('button', { name: 'Start a check' }).click();
  await expect(page.getByRole('progressbar', { name: 'Check progress' })).toHaveAttribute('value', '0');
  const results = await new AxeBuilder({ page: page as never }).analyze();
  expect(results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
});

test('restores an interrupted check across reloads and records completion only after every outcome', async ({ page }) => {
  await page.goto('/demo');
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await page.getByRole('button', { name: 'Start a check' }).click();
  await expect(page.locator('.check-card h2')).toHaveText('Red lentils');
  await expect(page.getByRole('progressbar', { name: 'Check progress' })).toHaveAttribute('value', '0');
  await expect(page.getByRole('progressbar', { name: 'Check progress' })).toHaveAttribute('max', '3');

  await page.reload();
  await expect(page.getByRole('heading', { name: 'What do you see?' })).toBeVisible();
  await expect(page.locator('.check-card h2')).toHaveText('Red lentils');
  await expect(page.getByRole('progressbar', { name: 'Check progress' })).toHaveAttribute('value', '0');

  await page.getByRole('button', { name: 'Seen' }).click();
  await expect(page.locator('.check-card h2')).toHaveText('Oat milk');
  await page.reload();
  await expect(page.locator('.check-card h2')).toHaveText('Oat milk');
  await expect(page.getByRole('progressbar', { name: 'Check progress' })).toHaveAttribute('value', '1');
  await expect(page.getByRole('progressbar', { name: 'Check progress' })).toHaveAttribute('max', '3');

  await page.getByRole('button', { name: 'Finish for now' }).click();
  await expect(page.getByRole('heading', { name: '2 items left in this check' })).toBeVisible();
  await page.getByRole('link', { name: 'Check', exact: true }).click();
  await expect(page.locator('.check-card h2')).toHaveText('Oat milk');
  await page.getByRole('button', { name: 'Seen' }).click();
  await page.getByRole('button', { name: 'Seen' }).click();
  await expect(page.getByRole('heading', { name: '3 items checked.' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: '3 items checked.' })).toBeVisible();
  await expect(page.locator('.check-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'View pantry' }).click();
  await expect(page.getByRole('heading', { name: 'All items were checked recently' })).toBeVisible();
  await expect(page.getByText('Checked today')).toHaveCount(3);
});

test('preserves existing version-one pantry data and starts a direct check after the storage upgrade', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await new Promise<void>((resolveDelete, reject) => {
      const deletion = indexedDB.deleteDatabase('pantry-check');
      deletion.onsuccess = () => resolveDelete();
      deletion.onerror = () => reject(deletion.error);
    });
    await new Promise<void>((resolveSeed, reject) => {
      const open = indexedDB.open('pantry-check', 1);
      open.onupgradeneeded = () => {
        open.result.createObjectStore('items', { keyPath: 'id' });
        open.result.createObjectStore('events', { keyPath: 'id' });
      };
      open.onsuccess = () => {
        const db = open.result;
        const transaction = db.transaction('items', 'readwrite');
        transaction.objectStore('items').put({
          id: 'existing-rice', name: 'Existing rice', zone: 'pantry', quantity: 'one jar', note: '', status: 'active',
          addedAt: Date.now() - 86_400_000, lastConfirmedAt: null, updatedAt: Date.now() - 86_400_000,
        });
        transaction.oncomplete = () => { db.close(); resolveSeed(); };
        transaction.onerror = () => reject(transaction.error);
      };
      open.onerror = () => reject(open.error);
    });
  });
  await page.goto('/?view=reconcile');
  await expect(page.locator('.check-card h2')).toHaveText('Existing rice');
  await expect(page.getByRole('progressbar', { name: 'Check progress' })).toHaveAttribute('max', '1');
  const stores = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolveOpen, reject) => {
      const open = indexedDB.open('pantry-check');
      open.onsuccess = () => resolveOpen(open.result);
      open.onerror = () => reject(open.error);
    });
    const names = Array.from(database.objectStoreNames);
    database.close();
    return names;
  });
  expect(stores).toEqual(['checkSessions', 'events', 'items']);
});

test('uses a distinct title for every real and demo app view', async ({ page }) => {
  const expected = [
    ['Pantry', 'Pantry Check — review pantry items'],
    ['Check', 'Check items — Pantry Check'],
    ['Shopping', 'Shopping list — Pantry Check'],
    ['Settings', 'Settings — Pantry Check'],
  ] as const;
  for (const demo of [false, true]) {
    await page.goto(demo ? '/demo' : '/');
    for (const [label, realTitle] of expected) {
      const link = page.getByRole('link', { name: label === 'Shopping' ? /^Shopping/ : label, exact: label !== 'Shopping' });
      await link.click();
      const expectedTitle = demo ? `Demo ${label.toLocaleLowerCase()} — Pantry Check` : realTitle;
      await expect(page).toHaveTitle(expectedTitle);
    }
  }
});

test('keeps header and footer controls at least 44 pixels at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  for (const control of [page.locator('.brand'), page.locator('.topbar .add-button'), page.locator('footer a[href="/privacy"]'), page.locator('footer a[href="/terms"]')]) {
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.locator('html').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
});

test('keeps persistent demo actions touch-sized at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/demo');
  for (const control of [page.getByRole('button', { name: 'Reset demo' }), page.getByRole('link', { name: 'Start for real' })]) {
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await expect(page.getByText('Sample pantry reset.')).toBeVisible();
  await page.getByRole('link', { name: 'Start for real' }).click();
  await expect(page).toHaveURL('/');
});

test('shows a focused skip link when reduced motion is enabled', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/demo');
  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();
  const result = await skipLink.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return { top: box.top, bottom: box.bottom, outlineWidth: Number.parseFloat(style.outlineWidth) };
  });
  expect(result.top).toBeGreaterThanOrEqual(0);
  expect(result.bottom).toBeLessThanOrEqual(844);
  expect(result.outlineWidth).toBeGreaterThanOrEqual(3);
});

test('renders CSP-safe zone confidence and keeps the empty-state action above the mobile dock', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const cta = page.getByRole('button', { name: 'Add your first item' });
  const ctaBox = await cta.boundingBox();
  const dockBox = await page.locator('.app-nav').boundingBox();
  expect(ctaBox).not.toBeNull();
  expect(dockBox).not.toBeNull();
  expect(ctaBox!.y + ctaBox!.height).toBeLessThanOrEqual(dockBox!.y);
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('button')?.textContent?.includes('Add your first item'), { x: ctaBox!.x + ctaBox!.width / 2, y: ctaBox!.y + ctaBox!.height / 2 })).toBe(true);
  await cta.click();
  await page.getByLabel('Item name').fill('Oat milk');
  await page.getByRole('button', { name: 'Save item' }).click();
  await page.getByRole('button', { name: 'Start a check' }).click();
  await page.keyboard.press('s');
  await page.getByRole('button', { name: 'View pantry' }).click();
  const clarity = page.locator('.zone-panel.fridge .zone-clarity');
  await expect(clarity).toHaveAttribute('value', '100');
  await expect(clarity).toHaveJSProperty('value', 100);
  expect(await page.locator('.zone-panel.fridge').getAttribute('style')).toBeNull();
  expect(errors).toEqual([]);
});

test('empty and legal pages have no serious accessibility violations', async ({ page }) => {
  for (const path of ['/', '/privacy', '/terms', '/does-not-exist-a11y']) {
    await page.goto(path);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('h1')).toHaveCount(1);
    // Axe ships its own Playwright type range; runtime uses the pinned browser API.
    const results = await new AxeBuilder({ page: page as never }).analyze();
    expect(results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
  }
});

test('demo pantry, shopping, and settings have no serious accessibility violations', async ({ page }) => {
  await page.goto('/demo');
  for (const destination of ['Pantry', 'Shopping', 'Settings'] as const) {
    if (destination !== 'Pantry') await page.getByRole('link', { name: destination === 'Shopping' ? /^Shopping/ : destination, exact: destination !== 'Shopping' }).click();
    const results = await new AxeBuilder({ page: page as never }).analyze();
    expect(results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
  }
});

test('app shell and local data survive offline reload', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add item' }).click();
  await page.getByLabel('Item name').fill('Frozen corn');
  await page.getByLabel('Zone').selectOption('freezer');
  await page.getByRole('button', { name: 'Save item' }).click();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), null, { timeout: 10_000 });
  await expect.poll(() => page.evaluate(() => caches.keys())).toContain('pantry-v8');
  await page.reload();
  await expect(page.getByText('Frozen corn', { exact: true })).toBeVisible();
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Frozen corn', { exact: true })).toBeVisible();
  await expect(page.getByText(/Offline · changes stay here/)).toBeVisible();
  await context.setOffline(false);
});

test('@claim:demo-isolated opens a stocked, resettable pantry without touching real storage', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Try it with sample data' }).click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.getByText('Demo — sample data, nothing is saved.')).toBeVisible();
  await expect(page.getByText('Oat milk', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start a check' }).click();
  await page.getByRole('button', { name: 'Seen' }).click();
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await expect(page.getByText('Oat milk', { exact: true })).toBeVisible();
  const databases = await page.evaluate(async () => {
    const names = (await indexedDB.databases()).map((database) => database.name);
    const real = indexedDB.open('pantry-check');
    const realItems = await new Promise<number>((resolve, reject) => {
      real.onsuccess = () => { const transaction = real.result.transaction('items'); const request = transaction.objectStore('items').count(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); };
      real.onerror = () => reject(real.error);
    });
    return { names, realItems };
  });
  expect(databases.names).toContain('demo:pantry-check');
  expect(databases.realItems).toBe(0);
});

test('@claim:offline-reload keeps the demo usable offline after its first visit', async ({ page, context }) => {
  await page.goto('/demo');
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), null, { timeout: 10_000 });
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Oat milk', { exact: true })).toBeVisible();
  await expect(page.getByText('Offline · changes stay here')).toBeVisible();
  await context.setOffline(false);
});

test('@claim:local-only keeps normal demo use on the same origin', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/demo');
  await page.getByRole('button', { name: 'Start a check' }).click();
  await page.getByRole('button', { name: 'Seen' }).click();
  expect(requests.every((url) => new URL(url).origin === 'http://127.0.0.1:4173')).toBe(true);
  const names = await page.evaluate(async () => (await indexedDB.databases()).map((database) => database.name));
  expect(names).toContain('demo:pantry-check');
  expect(names).not.toContain('pantry-check');
});

test('@claim:csv-export downloads one row per shopping item', async ({ page }) => {
  await page.goto('/demo');
  await page.getByRole('link', { name: 'Shopping' }).click();
  const download = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export CSV' }).click(),
  ]).then(([value]) => value);
  const path = await download.path();
  expect(path).not.toBeNull();
  const csv = readFileSync(path!, 'utf8');
  expect(csv.split('\n')).toEqual(['"Item","Zone","Reason","Rough amount"', '"Pasta","Pantry","used","one box"']);
});

test('@claim:encrypted-backup downloads ciphertext rather than sample text or the passphrase', async ({ page }) => {
  await page.goto('/demo');
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.locator('.export-form').getByLabel('Backup passphrase').fill('sample-passphrase');
  const download = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download encrypted backup' }).click(),
  ]).then(([value]) => value);
  const path = await download.path();
  expect(path).not.toBeNull();
  const backup = readFileSync(path!, 'utf8');
  expect(backup).not.toContain('Oat milk');
  expect(backup).not.toContain('sample-passphrase');
});

test('@claim:passphrase-private does not send or save the backup passphrase', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/demo');
  await page.getByRole('link', { name: 'Settings' }).click();
  requests.length = 0;
  const secret = 'private-sample-passphrase';
  await page.locator('.export-form').getByLabel('Backup passphrase').fill(secret);
  await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download encrypted backup' }).click(),
  ]);
  expect(requests).toEqual([]);
  const storedData = await page.evaluate(async () => {
    const values = [...Object.values(localStorage), ...Object.values(sessionStorage)];
    for (const database of await indexedDB.databases()) {
      if (!database.name) continue;
      const open = indexedDB.open(database.name);
      const records = await new Promise<unknown[]>((resolveRecords, reject) => {
        open.onsuccess = async () => {
          const db = open.result;
          const result: unknown[] = [];
          for (const storeName of Array.from(db.objectStoreNames)) {
            const request = db.transaction(storeName).objectStore(storeName).getAll();
            result.push(...await new Promise<unknown[]>((resolveStore, rejectStore) => {
              request.onsuccess = () => resolveStore(request.result);
              request.onerror = () => rejectStore(request.error);
            }));
          }
          db.close();
          resolveRecords(result);
        };
        open.onerror = () => reject(open.error);
      });
      values.push(JSON.stringify(records));
    }
    return values.join('\n');
  });
  expect(storedData).not.toContain(secret);
  await expect(page.locator('.export-form').getByLabel('Backup passphrase')).toHaveValue('');
});

test('@claim:update-prompt installs a changed service worker through the reload prompt', async ({ browser }) => {
  const dist = resolve(process.cwd(), 'dist');
  let workerVersion = 1;
  const mimeTypes: Record<string, string> = {
    '.css': 'text/css', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json',
    '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
  };
  const server = createServer((request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    response.setHeader('Cache-Control', 'no-store');
    if (pathname === '/sw.js') {
      response.setHeader('Content-Type', 'text/javascript');
      response.end(`const VERSION='claim-update-v${workerVersion}';self.addEventListener('install',event=>event.waitUntil(caches.open(VERSION)));self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});self.addEventListener('fetch',event=>{if(event.request.mode==='navigate')event.respondWith(fetch(event.request))});`);
      return;
    }
    const requested = pathname === '/' || ['/demo', '/privacy', '/terms'].includes(pathname) ? 'index.html' : pathname.slice(1);
    const file = join(dist, requested);
    if (!existsSync(file)) { response.statusCode = 404; response.end('Not found'); return; }
    response.setHeader('Content-Type', mimeTypes[extname(file)] ?? 'application/octet-stream');
    response.end(readFileSync(file));
  });
  await new Promise<void>((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(`${origin}/demo`);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    workerVersion = 2;
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
    await expect(page.getByText('A fresh version is ready.')).toBeVisible();
    await Promise.all([
      page.waitForEvent('framenavigated'),
      page.getByRole('button', { name: 'Reload to update' }).click(),
    ]);
    await expect.poll(() => page.evaluate(() => caches.keys())).toContain('claim-update-v2');
    await expect(page.getByText('Oat milk', { exact: true })).toBeVisible();
  } finally {
    await context.close();
    await new Promise<void>((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
  }
});

test('uses history entries, route headings, and a designed unknown-path state', async ({ page }) => {
  await page.goto('/demo');
  await page.getByRole('link', { name: 'Shopping' }).click();
  await expect(page).toHaveURL(/view=shopping/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Shopping list');
  await page.goBack();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('item');
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  const response = await page.goto('/does-not-exist-qa');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('That page does not exist.');
  await expect(page.getByRole('link', { name: 'Go to Pantry Check' })).toBeVisible();
});
