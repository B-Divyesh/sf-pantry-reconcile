import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const root = join(process.cwd(), 'dist');
let worker = await readFile(join(root, 'sw.js'));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain' };
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/sw.js') {
      response.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-cache' });
      response.end(worker);
      return;
    }
    const requested = pathname === '/' ? 'index.html' : pathname.slice(1);
    let body;
    let file = join(root, requested);
    try { body = await readFile(file); }
    catch { file = join(root, 'index.html'); body = await readFile(file); }
    response.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' });
    response.end(body);
  } catch (error) {
    response.writeHead(500); response.end(String(error));
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const url = `http://127.0.0.1:${address.port}`;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
page.on('pageerror', (error) => errors.push(error.message));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 10_000 });
const before = await page.evaluate(() => caches.keys());
worker = Buffer.from(worker.toString().replace("const VERSION = 'pantry-v6'", "const VERSION = 'pantry-v6-qa-update'"));
await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
await page.getByText('A fresh version is ready.').waitFor({ timeout: 10_000 });
await page.screenshot({ path: '.factory/evidence-3/local-sw-update-ready.png', fullPage: false });
await page.getByRole('button', { name: 'Reload to update' }).click();
await page.waitForFunction(async () => (await caches.keys()).includes('pantry-v6-qa-update'), null, { timeout: 10_000 });
const after = await page.evaluate(() => caches.keys());
console.log(JSON.stringify({ before, updateToast: true, after, oldCacheRemoved: !after.includes('pantry-v6'), errors }, null, 2));
await context.close();
await browser.close();
await new Promise((resolve) => server.close(resolve));
