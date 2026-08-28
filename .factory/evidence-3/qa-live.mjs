import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

const base = 'https://pantry-reconcile.sociobot.in';
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const results = {};

async function idbItems(page) {
  return page.evaluate(async () => new Promise((resolve, reject) => {
    const open = indexedDB.open('pantry-check');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const request = open.result.transaction('items').objectStore('items').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    };
  }));
}

async function axe(page, label) {
  const report = await new AxeBuilder({ page }).analyze();
  return {
    label,
    total: report.violations.length,
    seriousCritical: report.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? '')).map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })),
  };
}

const browser = await chromium.launch({ headless: true });

{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  const consoleErrors = [];
  const requests = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  page.on('request', (request) => requests.push(request.url()));
  await page.goto(base, { waitUntil: 'networkidle' });

  const axeReports = [await axe(page, 'empty-home')];
  const initialHistory = await page.evaluate(() => history.length);
  await page.getByRole('button', { name: 'Shopping' }).click();
  const shoppingHistory = await page.evaluate(() => ({ length: history.length, url: location.href }));
  await page.getByRole('button', { name: 'Settings' }).click();
  const settingsHistory = await page.evaluate(() => ({ length: history.length, url: location.href }));
  await page.getByRole('button', { name: 'Pantry' }).click();

  const opener = page.getByRole('button', { name: 'Add item' });
  await opener.focus();
  await opener.click();
  assert(await page.getByLabel('Item name').evaluate((el) => el === document.activeElement), 'Item name did not receive dialog focus');
  await page.keyboard.press('Escape');
  assert(await opener.evaluate((el) => el === document.activeElement), 'Dialog opener did not regain focus after Escape');

  const records = [
    { name: '<Oats & "Honey">', zone: 'pantry', quantity: 'q'.repeat(40), note: 'n'.repeat(160) },
    { name: 'Beans, "red"', zone: 'pantry', quantity: 'two tins', note: 'Lower shelf' },
    { name: 'Milk', zone: 'fridge', quantity: 'half a carton', note: 'Opened Tuesday' },
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
  await page.getByLabel('Item name').fill('   ');
  await page.getByRole('button', { name: 'Save item' }).click();
  const whitespaceError = await page.getByText('Enter an item name, not only spaces.').isVisible();
  const whitespaceFocus = await page.getByLabel('Item name').evaluate((el) => el === document.activeElement);
  await page.getByRole('button', { name: 'Cancel' }).click();

  await page.getByRole('button', { name: 'Add item' }).click();
  await page.getByLabel('Item name').fill('  milk  ');
  await page.getByRole('button', { name: 'Save item' }).click();
  const duplicateError = await page.getByText('That active item is already in your pantry. Edit it instead.').isVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();

  await page.reload({ waitUntil: 'networkidle' });
  for (const record of records) assert(await page.getByText(record.name, { exact: true }).isVisible(), `Missing persisted ${record.name}`);
  await page.getByPlaceholder('Search your pantry').fill('not-a-real-item');
  const noResults = await page.getByText(/No items match/).isVisible();
  await page.getByRole('button', { name: 'Clear search' }).click();

  await page.getByRole('button', { name: 'Start a check' }).click();
  axeReports.push(await axe(page, 'reconcile'));
  const actions = { '<Oats & "Honey">': 'seen', 'Beans, "red"': 'used', Milk: 'expired' };
  for (let index = 0; index < records.length; index += 1) {
    const current = await page.locator('.check-card h3').textContent();
    const action = actions[current];
    assert(action, `Unexpected reconcile item ${current}`);
    if (action === 'seen') await page.keyboard.press('s');
    if (action === 'used') await page.getByRole('button', { name: /Used up/ }).click();
    if (action === 'expired') await page.getByRole('button', { name: /Expired/ }).click();
    await page.waitForFunction((previous) => {
      const next = document.querySelector('.check-card h3')?.textContent;
      return next !== previous;
    }, current);
  }
  await page.getByText(/confirmations made/).waitFor();
  await page.getByRole('button', { name: 'Shopping' }).click();
  axeReports.push(await axe(page, 'shopping'));
  assert(await page.getByText('Beans, "red"', { exact: true }).isVisible(), 'Used item missing from shopping');
  assert(await page.getByText('Milk', { exact: true }).isVisible(), 'Expired item missing from shopping');
  const csvDownload = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export CSV' }).click(),
  ]).then(([download]) => download);
  const csvPath = await csvDownload.path();
  const csv = await readFile(csvPath, 'utf8');
  assert(csv.includes('"Beans, ""red"""'), 'CSV did not escape quotes and comma');
  assert(csv.split('\n').length === 3, 'CSV row count did not match shopping delta');

  const beforeRestock = (await idbItems(page)).filter((item) => item.status !== 'active').length;
  await page.getByRole('button', { name: 'Mark restocked' }).first().click();
  await page.getByRole('button', { name: 'Undo' }).click();
  const afterUndo = (await idbItems(page)).filter((item) => item.status !== 'active').length;

  await page.getByRole('button', { name: 'Settings' }).click();
  axeReports.push(await axe(page, 'settings'));
  await page.locator('#export-pass').fill('shared-kitchen-pass');
  const backupDownload = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download encrypted backup' }).click(),
  ]).then(([download]) => download);
  const backupPath = await backupDownload.path();
  const backupText = await readFile(backupPath, 'utf8');
  assert(!backupText.includes('Milk') && !backupText.includes('shared-kitchen-pass'), 'Encrypted backup leaked plaintext');
  await page.getByLabel('Restore encrypted backup').setInputFiles(backupPath);
  await page.locator('#import-pass').fill('wrong-passphrase');
  await page.getByRole('button', { name: 'Restore and replace local data' }).click();
  await page.getByText('The passphrase is wrong or this backup is damaged.').waitFor({ timeout: 10_000 });
  const wrongPassError = true;

  await page.locator('#import-pass').fill('shared-kitchen-pass');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Restore and replace local data' }).click();
  await page.getByText('Encrypted backup restored.').waitFor();

  await page.goto(`${base}/privacy`, { waitUntil: 'networkidle' });
  axeReports.push(await axe(page, 'privacy'));
  const privacy = { title: await page.title(), h1: await page.locator('h1').allTextContents(), h2: await page.locator('h2').allTextContents() };
  await page.goto(`${base}/terms`, { waitUntil: 'networkidle' });
  axeReports.push(await axe(page, 'terms'));
  const terms = { title: await page.title(), h1: await page.locator('h1').allTextContents(), h2: await page.locator('h2').allTextContents() };

  results.desktop = {
    history: { initialHistory, shoppingHistory, settingsHistory },
    dialogFocus: true,
    whitespaceError,
    whitespaceFocus,
    duplicateError,
    persistence: true,
    noResults,
    csv,
    undo: { beforeRestock, afterUndo },
    backup: { plaintextAbsent: true, wrongPassError, restoreSucceeded: true },
    axeReports,
    privacy,
    terms,
    consoleErrors,
    requestCount: requests.length,
    crossOriginRequests: [...new Set(requests.filter((url) => new URL(url).origin !== base))],
  };
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.screenshot({ path: '.factory/evidence-3/live-cold-mobile-390.png', fullPage: true });
  const dimensions = await page.evaluate(() => {
    const controls = [...document.querySelectorAll('a,button,input,select,textarea')].filter((el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
    }).map((el) => {
      const rect = el.getBoundingClientRect();
      return { text: el.getAttribute('aria-label') || el.textContent?.trim() || el.getAttribute('name'), tag: el.tagName, width: rect.width, height: rect.height };
    });
    const cta = document.querySelector('.empty-hero .primary').getBoundingClientRect();
    const dock = document.querySelector('.app-nav').getBoundingClientRect();
    return {
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      below44: controls.filter((item) => item.width < 44 || item.height < 44),
      ctaBottom: cta.bottom,
      dockTop: dock.top,
      ctaHit: document.elementFromPoint(cta.x + cta.width / 2, cta.y + cta.height / 2)?.closest('button')?.textContent?.trim(),
    };
  });
  await page.keyboard.press('Tab');
  await page.waitForTimeout(50);
  const focus = await page.evaluate(() => {
    const el = document.activeElement;
    const style = getComputedStyle(el);
    return { text: el?.textContent?.trim(), outlineWidth: style.outlineWidth, outlineStyle: style.outlineStyle, outlineColor: style.outlineColor };
  });
  const reducedMotion = await page.evaluate(() => {
    const hero = document.querySelector('.hero');
    const button = document.querySelector('button');
    return { matches: matchMedia('(prefers-reduced-motion: reduce)').matches, animationDuration: getComputedStyle(hero).animationDuration, transitionDuration: getComputedStyle(button).transitionDuration };
  });
  const emptyAxe = await axe(page, 'mobile-empty');
  await page.getByRole('button', { name: 'See how a check works' }).click();
  await page.screenshot({ path: '.factory/evidence-3/live-mobile-after-example.png', fullPage: true });
  const demoItems = await idbItems(page);
  const demo = {
    url: page.url(),
    bodyText: await page.locator('body').innerText(),
    bannerCount: await page.getByText(/Demo — sample data, nothing is saved/i).count(),
    resetDemoCount: await page.getByRole('button', { name: /Reset demo/i }).count(),
    startRealCount: await page.getByRole('button', { name: /Start for real/i }).count(),
    indexedDbItems: demoItems,
    localStorage: await page.evaluate(() => Object.fromEntries(Object.entries(localStorage))),
    axe: await axe(page, 'mobile-example-reconcile'),
  };
  results.mobile = { dimensions, focus, reducedMotion, emptyAxe, demo, errors };
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Add item' }).click();
  await page.getByLabel('Item name').fill('Offline lentils QA');
  await page.locator('#item-zone').selectOption('pantry');
  await page.getByRole('button', { name: 'Save item' }).click();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), null, { timeout: 10_000 });
  const cachesBefore = await page.evaluate(() => caches.keys());
  await page.reload({ waitUntil: 'networkidle' });
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  const itemVisible = await page.getByText('Offline lentils QA', { exact: true }).isVisible();
  const offlineVisible = await page.getByText(/Offline · changes stay here/).isVisible();
  await page.screenshot({ path: '.factory/evidence-3/live-offline-reload.png', fullPage: false });
  results.offline = { cachesBefore, itemVisible, offlineVisible, errors };
  await context.setOffline(false);
  await context.close();
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
