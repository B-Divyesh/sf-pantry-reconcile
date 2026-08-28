import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

const base = 'https://pantry-reconcile.sociobot.in';
const assert = (value, message) => { if (!value) throw new Error(message); };
const axe = async (page, label) => {
  const report = await new AxeBuilder({ page }).analyze();
  return { label, total: report.violations.length, seriousCritical: report.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? '')).map((v) => v.id) };
};
const idbNames = (page) => page.evaluate(async () => (await indexedDB.databases()).map((db) => db.name).sort());
const results = {};
const browser = await chromium.launch({ headless: true });

{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [], requests = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => requests.push(r.url()));
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.screenshot({ path: '.factory/evidence-4/live-desktop-empty.png', fullPage: true });
  const initialAxe = await axe(page, 'empty-home');
  await page.getByRole('button', { name: 'Add item' }).click();
  assert(await page.getByLabel('Item name').evaluate((e) => e === document.activeElement), 'Dialog did not focus Item name');
  await page.getByLabel('Item name').fill('   ');
  await page.getByRole('button', { name: 'Save item' }).click();
  const whitespaceError = await page.getByText('Enter an item name, not only spaces.').isVisible();
  const whitespaceFocus = await page.getByLabel('Item name').evaluate((e) => e === document.activeElement);
  await page.getByRole('button', { name: 'Cancel' }).click();

  const records = [
    { name: '<Oats & "Honey">', zone: 'pantry', quantity: 'q'.repeat(40), note: 'n'.repeat(160), action: 'seen' },
    { name: 'Beans, "red"', zone: 'pantry', quantity: 'two tins', note: 'Lower shelf', action: 'used' },
    { name: 'Milk', zone: 'fridge', quantity: 'half a carton', note: 'Opened Tuesday', action: 'expired' },
  ];
  for (const record of records) {
    await page.getByRole('button', { name: 'Add item' }).click();
    await page.getByLabel('Item name').fill(`  ${record.name}  `);
    await page.locator('#item-zone').selectOption(record.zone);
    await page.getByLabel('Rough amount').fill(record.quantity);
    await page.getByLabel('Household note').fill(record.note);
    await page.getByRole('button', { name: 'Save item' }).click();
    await page.getByText(record.name, { exact: true }).waitFor();
  }
  await page.getByRole('button', { name: 'Add item' }).click();
  await page.getByLabel('Item name').fill(' milk ');
  await page.getByRole('button', { name: 'Save item' }).click();
  const duplicateError = await page.getByText('That active item is already in your pantry. Edit it instead.').isVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.reload({ waitUntil: 'networkidle' });
  const persisted = await page.getByText('Beans, "red"', { exact: true }).isVisible();
  await page.getByPlaceholder('Search your pantry').fill('nothing-here');
  const noResults = await page.getByText(/No items match/).isVisible();
  await page.getByRole('button', { name: 'Clear search' }).click();
  await page.getByRole('button', { name: 'Start a check' }).click();
  const reconcileAxe = await axe(page, 'reconcile');
  while (await page.locator('.check-card').count()) {
    const name = (await page.locator('.check-card h2').textContent()).trim();
    const record = records.find((r) => r.name === name);
    assert(record, `Unexpected check item ${name}`);
    if (record.action === 'seen') await page.keyboard.press('s');
    if (record.action === 'used') await page.keyboard.press('u');
    if (record.action === 'expired') await page.keyboard.press('e');
    await page.waitForTimeout(100);
  }
  await page.getByText(/confirmations made/).waitFor();
  await page.getByRole('link', { name: 'Shopping' }).click();
  const shoppingAxe = await axe(page, 'shopping');
  const download = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export CSV' }).click()]).then(([d]) => d);
  const csv = await readFile(await download.path(), 'utf8');
  assert(csv.includes('"Beans, ""red"""'), 'CSV did not quote embedded comma/quotes');
  await page.getByRole('button', { name: 'Mark restocked' }).first().click();
  await page.getByRole('button', { name: 'Undo' }).waitFor();
  const undoVisible = await page.getByRole('button', { name: 'Undo' }).isVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await page.getByRole('link', { name: 'Settings' }).click();
  const settingsAxe = await axe(page, 'settings');
  await page.locator('#export-pass').fill('shared-kitchen-pass');
  const backupDownload = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download encrypted backup' }).click()]).then(([d]) => d);
  const backup = await readFile(await backupDownload.path(), 'utf8');
  const ciphertext = !backup.includes('Milk') && !backup.includes('shared-kitchen-pass');
  const historyBefore = await page.evaluate(() => history.length);
  await page.getByRole('link', { name: 'Pantry', exact: true }).click();
  await page.getByRole('link', { name: 'Shopping' }).click();
  await page.goBack();
  const backRestoresPantry = /view=/.test(page.url()) === false && await page.getByRole('heading', { level: 1 }).count() === 1;
  results.desktop = { whitespaceError, whitespaceFocus, duplicateError, persisted, noResults, csv, undoVisible, ciphertext, historyBefore, backRestoresPantry, axe: [initialAxe, reconcileAxe, shoppingAxe, settingsAxe], errors, requests: [...new Set(requests)], crossOrigin: [...new Set(requests.filter((u) => new URL(u).origin !== base))] };
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage(); const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); }); page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/demo`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: '.factory/evidence-4/live-mobile-demo.png', fullPage: true });
  const mobileAxe = await axe(page, 'mobile-demo');
  const dimensions = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, smallControls: [...document.querySelectorAll('a,button,input,select,textarea')].map((e) => { const s = getComputedStyle(e), r = e.getBoundingClientRect(); return { text: e.getAttribute('aria-label') || e.textContent?.trim(), width: r.width, height: r.height, visible: s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0 }; }).filter((e) => e.visible && (e.width < 44 || e.height < 44)), reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, animation: getComputedStyle(document.querySelector('.item-row')).animationDuration, transition: getComputedStyle(document.querySelector('button')).transitionDuration }));
  await page.keyboard.press('Tab');
  const focus = await page.evaluate(() => { const e = document.activeElement, s = getComputedStyle(e); return { text: e.textContent?.trim(), outlineWidth: s.outlineWidth, outlineStyle: s.outlineStyle, outlineColor: s.outlineColor, outline: s.outline }; });
  const beforeReset = await idbNames(page);
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await page.getByText('Sample pantry reset.').waitFor();
  const afterReset = await idbNames(page);
  const demoText = await page.locator('body').innerText();
  results.mobile = { dimensions, focus, beforeReset, afterReset, demoBanner: /Demo — sample data, nothing is saved/.test(demoText), items: ['Oat milk', 'Frozen peas', 'Red lentils', 'Pasta'].map(async (name) => ({ name, visible: await page.getByText(name, { exact: true }).isVisible() })), axe: mobileAxe, errors };
  results.mobile.items = await Promise.all(results.mobile.items);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), null, { timeout: 10000 });
  const cacheNames = await page.evaluate(() => caches.keys());
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  results.offline = { cacheNames, sampleVisible: await page.getByText('Oat milk', { exact: true }).isVisible(), offlineNotice: await page.getByText('Offline · changes stay here').isVisible(), errors };
  await context.setOffline(false); await context.close();
}

{
  const context = await browser.newContext(); const page = await context.newPage();
  await page.goto(`${base}/privacy`, { waitUntil: 'networkidle' }); const privacy = { title: await page.title(), h1: await page.locator('h1').allTextContents(), axe: await axe(page, 'privacy') };
  await page.goto(`${base}/terms`, { waitUntil: 'networkidle' }); const terms = { title: await page.title(), h1: await page.locator('h1').allTextContents(), axe: await axe(page, 'terms') };
  await page.goto(`${base}/not-a-real-route`, { waitUntil: 'networkidle' }); const notFound = { title: await page.title(), h1: await page.locator('h1').allTextContents(), homeLink: await page.getByRole('link', { name: 'Go to Pantry Check' }).count() };
  results.routes = { privacy, terms, notFound }; await context.close();
}
await browser.close();
console.log(JSON.stringify(results, null, 2));
