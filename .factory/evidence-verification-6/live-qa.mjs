import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const base = 'https://pantry-reconcile.sociobot.in';
const out = '.factory/evidence-verification-6';
const report = {
  checkedAt: new Date().toISOString(), base, candidate: '7df5787136a1d0b8a0fce5812a6288da86742739',
  firstScreen: {}, interruptedCheck: {}, demo: {}, realFlow: {}, routes: {}, phone: {}, offline: {}, recovery: {}, findings: [], errors: [],
};
const check = (condition, message) => { if (!condition) throw new Error(message); };
const seriousAxe = async (page, name) => {
  const result = await new AxeBuilder({ page }).analyze();
  const violations = result.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''));
  check(violations.length === 0, `${name}: ${violations.map((item) => item.id).join(', ')}`);
  return result.violations.length;
};
const countItems = async (page, databaseName) => page.evaluate(async (name) => {
  const database = await new Promise((resolve, reject) => {
    const request = indexedDB.open(name);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const value = await new Promise((resolve, reject) => {
    const request = database.transaction('items').objectStore('items').count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return value;
}, databaseName);

const browser = await chromium.launch({ headless: true });
try {
  // Fresh desktop: first-read contract, one-click demo, and the verifier 5 core recovery defect.
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  const requests = [];
  let expected404 = false;
  page.on('request', (request) => requests.push(request.url()));
  page.on('console', (message) => {
    if (message.type() === 'error' && !(expected404 && message.text().includes('404'))) report.errors.push(`desktop console: ${message.text()}`);
  });
  page.on('pageerror', (error) => report.errors.push(`desktop page: ${error.message}`));
  await page.goto(base, { waitUntil: 'networkidle' });
  const firstLocators = [
    page.locator('h1'), page.locator('.hero-copy > p:not(.eyebrow)').first(),
    page.getByRole('button', { name: 'Add your first item' }), page.getByRole('link', { name: 'Try it with sample data' }),
    page.locator('.proof-list'),
  ];
  const firstBoxes = await Promise.all(firstLocators.map((locator) => locator.boundingBox()));
  check(firstBoxes.every((box) => box && box.y + box.height <= 900), 'desktop first-read content is below the fold');
  const first = {
    title: await page.title(), h1: await page.locator('h1').innerText(),
    audience: await page.locator('.hero-copy > p:not(.eyebrow)').first().innerText(),
    realAction: await page.getByRole('button', { name: 'Add your first item' }).innerText(),
    sampleAction: await page.getByRole('link', { name: 'Try it with sample data' }).innerText(),
    facts: await page.locator('.proof-list li').allInnerTexts(),
  };
  check(first.h1.includes('Check pantry items'), 'job is not stated in the first h1');
  check(first.audience.includes('shared kitchens'), 'audience is not stated');
  check(first.facts.length === 3, 'first screen does not show three facts');
  report.firstScreen = first;
  await page.screenshot({ path: `${out}/desktop-first-screen.png`, fullPage: false });

  await page.getByRole('link', { name: 'Try it with sample data' }).click();
  check(new URL(page.url()).pathname === '/demo', 'sample action did not open /demo');
  await page.getByRole('button', { name: 'Reset demo' }).click();
  const sample = await page.locator('.item-list strong').allInnerTexts();
  check(['Oat milk', 'Frozen peas', 'Red lentils'].every((name) => sample.includes(name)), 'sample pantry is not realistically populated');
  check(await page.getByText('Demo — sample data, nothing is saved.').isVisible(), 'persistent demo label is absent');
  check(await page.getByText('Pasta', { exact: true }).count() === 0, 'used sample item should start in Shopping, not active pantry');
  check(await countItems(page, 'pantry-check') === 0, 'opening the demo changed the real pantry');

  await page.getByRole('button', { name: 'Start a check' }).click();
  const zero = {
    item: await page.locator('.check-card h2').innerText(),
    value: await page.getByRole('progressbar').getAttribute('value'),
    max: await page.getByRole('progressbar').getAttribute('max'),
  };
  check(zero.item === 'Red lentils' && zero.value === '0' && zero.max === '3', 'zero-action check state is wrong');
  await page.reload();
  check(await page.locator('.check-card h2').innerText() === 'Red lentils', 'zero-action reload lost the current item');
  check(await page.getByRole('progressbar').getAttribute('value') === '0', 'zero-action reload changed progress');
  check(!(await page.locator('h1').innerText()).toLowerCase().includes('current'), 'zero-action reload falsely marked pantry current');
  await page.getByRole('button', { name: 'Finish for now' }).click();
  check(await page.locator('h1').innerText() === '3 items left in this check', 'zero-action exit did not preserve all required items');
  await page.reload();
  check(await page.locator('h1').innerText() === '3 items left in this check', 'zero-action exit did not survive reload');
  await page.getByRole('button', { name: 'Resume check' }).click();
  await page.waitForTimeout(500);
  const zeroResume = { cardCount: await page.locator('.check-card h2').count(), heading: await page.locator('h1').innerText(), url: page.url() };
  if (zeroResume.cardCount !== 1) {
    report.findings.push({ id: 'active-check-resume-after-home-reload', severity: 'medium', state: 'zero-action', expected: 'Red lentils with 0 of 3 complete', actual: zeroResume });
    await page.goto(`${base}/demo?view=reconcile`);
  }
  check(await page.locator('.check-card h2').count() === 1, 'direct check recovery did not restore a card');
  check(await page.locator('.check-card h2').innerText() === 'Red lentils', 'resume did not restore the first item');
  await page.keyboard.press('s');
  await page.waitForFunction(() => document.querySelector('.check-card h2')?.textContent === 'Oat milk');
  check(await page.locator('.check-card h2').innerText() === 'Oat milk', 'keyboard Seen did not move to the next item');
  await page.reload();
  check(await page.locator('.check-card h2').innerText() === 'Oat milk', 'partial reload lost the next item');
  check(await page.getByRole('progressbar').getAttribute('value') === '1', 'partial reload lost completed progress');
  await page.getByRole('button', { name: 'Finish for now' }).click();
  check(await page.locator('h1').innerText() === '2 items left in this check', 'partial exit reported the wrong remaining count');
  await page.reload();
  check(await page.locator('h1').innerText() === '2 items left in this check', 'partial home state did not survive reload');
  await page.getByRole('button', { name: 'Resume check' }).click();
  await page.waitForTimeout(500);
  const partialResume = { cardCount: await page.locator('.check-card h2').count(), heading: await page.locator('h1').innerText(), url: page.url() };
  if (partialResume.cardCount !== 1) {
    const existing = report.findings.find((item) => item.id === 'active-check-resume-after-home-reload');
    if (existing) existing.partial = { expected: 'Oat milk with 1 of 3 complete', actual: partialResume };
    await page.goto(`${base}/demo?view=reconcile`);
  }
  check(await page.locator('.check-card h2').innerText() === 'Oat milk', 'direct partial-check recovery did not restore Oat milk');
  check(await page.getByRole('progressbar').getAttribute('value') === '1', 'direct partial-check recovery did not restore progress');
  await page.getByRole('button', { name: 'Seen' }).click();
  await page.waitForFunction(() => document.querySelector('.check-card h2')?.textContent === 'Frozen peas');
  await page.getByRole('button', { name: 'Seen' }).click();
  await page.waitForFunction(() => document.querySelector('h1')?.textContent?.trim() === '3 items checked.');
  check(await page.locator('h1').innerText() === '3 items checked.', 'completion was not tied to all three outcomes');
  await page.reload();
  check(await page.locator('h1').innerText() === '3 items checked.', 'completed check did not survive reload');
  check(await page.locator('.check-card').count() === 0, 'completed check still contains a pending item');
  await page.getByRole('button', { name: 'View pantry' }).click();
  check(await page.locator('h1').innerText() === 'All items were checked recently', 'fresh state was not shown after full completion');
  check(await page.getByText('Checked today').count() === 3, 'all active sample items were not refreshed');
  report.interruptedCheck = { zero, zeroReload: 'restored', zeroExit: 3, partialReload: { item: 'Oat milk', completed: 1, remaining: 2 }, completedReload: 3, freshnessAfterCompletionOnly: true };
  await page.screenshot({ path: `${out}/desktop-completed-check.png`, fullPage: true });

  // Outcome variety, Shopping delta, export, reset, persistent label, and sandbox exit.
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await page.getByRole('button', { name: 'Start a check' }).click();
  await page.getByRole('button', { name: /Expired/ }).click();
  await page.waitForFunction(() => document.querySelector('.check-card h2')?.textContent === 'Oat milk');
  await page.getByRole('button', { name: /Used up/ }).click();
  await page.waitForFunction(() => document.querySelector('.check-card h2')?.textContent === 'Frozen peas');
  await page.getByRole('button', { name: /Seen/ }).click();
  await page.waitForFunction(() => document.querySelector('h1')?.textContent?.trim() === '3 items checked.');
  await page.getByRole('link', { name: /^Shopping/ }).click();
  for (const name of ['Pasta', 'Red lentils', 'Oat milk']) check(await page.getByText(name, { exact: true }).isVisible(), `${name} missing from populated Shopping output`);
  check(await page.getByText('Demo — sample data, nothing is saved.').isVisible(), 'demo label disappeared on Shopping');
  const csvDownload = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export CSV' }).click()]).then(([download]) => download);
  const csv = readFileSync(await csvDownload.path(), 'utf8');
  check(csv.includes('"Item","Zone","Reason","Rough amount"') && csv.includes('"Red lentils"'), 'live CSV output is incomplete');
  const firstRestock = page.getByRole('button', { name: 'Mark restocked' }).first();
  const restockedName = await firstRestock.locator('xpath=..').locator('strong').innerText();
  await firstRestock.click();
  await page.getByRole('button', { name: 'Undo' }).click();
  await page.getByText(restockedName, { exact: true }).waitFor();
  check(await page.getByText(restockedName, { exact: true }).isVisible(), 'restock undo did not restore the shopping item');
  await page.getByRole('button', { name: 'Reset demo' }).click();
  check(await page.getByText('Oat milk', { exact: true }).isVisible(), 'Reset demo did not restore the original sample');
  await page.getByRole('link', { name: 'Settings' }).click();
  check(await page.getByText('Demo — sample data, nothing is saved.').isVisible(), 'demo label disappeared on Settings');
  const databases = await page.evaluate(async () => (await indexedDB.databases()).map((entry) => entry.name));
  check(databases.includes('demo:pantry-check'), 'demo database namespace is absent');
  await page.getByRole('link', { name: 'Start for real' }).click();
  check(new URL(page.url()).pathname === '/', 'Start for real did not return to the real pantry');
  check(await countItems(page, 'pantry-check') === 0, 'sample activity changed real pantry data');
  report.demo = { sample, shoppingOutput: ['Pasta', 'Red lentils', 'Oat milk'], csvRows: csv.split('\n').length, reset: true, labelPersistent: true, databases, realItemsAfterExit: 0 };

  // Distinct route titles, history focus, legal structure, designed HTTP 404, links, and Axe.
  const realTitles = {};
  const expectedTitles = { Pantry: 'Pantry Check — review pantry items', Check: 'Check items — Pantry Check', Shopping: 'Shopping list — Pantry Check', Settings: 'Settings — Pantry Check' };
  for (const name of ['Pantry', 'Check', 'Shopping', 'Settings']) {
    await page.getByRole('link', { name: name === 'Shopping' ? /^Shopping/ : name, exact: name !== 'Shopping' }).click();
    await page.waitForFunction((title) => document.title === title, expectedTitles[name]);
    check(await page.title() === expectedTitles[name], `${name} title is not distinct`);
    realTitles[name] = await page.title();
  }
  await page.getByRole('link', { name: 'Pantry', exact: true }).click();
  await page.getByRole('link', { name: /^Shopping/ }).click();
  await page.goBack();
  check(await page.title() === expectedTitles.Pantry && await page.locator('h1').evaluate((node) => node === document.activeElement), 'Back did not restore Pantry title and h1 focus');
  const axe = {};
  for (const route of ['/privacy', '/terms']) {
    const response = await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
    check(response?.status() === 200, `${route} did not return 200`);
    check(await page.locator('main').count() === 1 && await page.locator('h1').count() === 1, `${route} structure is incomplete`);
    axe[route] = await seriousAxe(page, route);
  }
  expected404 = true;
  const missing = await page.goto(`${base}/missing-verification-6`, { waitUntil: 'domcontentloaded' });
  check(missing?.status() === 404, 'unknown path did not return HTTP 404');
  check(await page.locator('h1').innerText() === 'That page does not exist.', 'designed 404 heading is absent');
  check(await page.getByRole('link', { name: 'Go to Pantry Check' }).isVisible(), '404 return action is absent');
  axe['404'] = await seriousAxe(page, '404');
  expected404 = false;
  await page.goto(`${base}/demo`);
  for (const destination of ['Pantry', 'Check', 'Shopping', 'Settings']) {
    await page.getByRole('link', { name: destination === 'Shopping' ? /^Shopping/ : destination, exact: destination !== 'Shopping' }).click();
    await page.waitForFunction((title) => document.title === title, `Demo ${destination.toLowerCase()} — Pantry Check`);
    check(await page.title() === `Demo ${destination.toLowerCase()} — Pantry Check`, `demo ${destination} title is wrong`);
    axe[`demo-${destination.toLowerCase()}`] = await seriousAxe(page, `demo ${destination}`);
  }
  const hrefs = await page.locator('a[href]').evaluateAll((anchors) => [...new Set(anchors.map((anchor) => anchor.href))]);
  const linkStatuses = {};
  for (const href of hrefs) {
    const url = new URL(href);
    if (url.origin !== base || !['http:', 'https:'].includes(url.protocol)) continue;
    const response = await context.request.get(href);
    linkStatuses[url.pathname + url.search] = response.status();
    check(response.status() < 400, `internal link failed: ${href} (${response.status()})`);
  }
  check(requests.every((url) => new URL(url).origin === base), 'live desktop flow made a cross-origin request');
  report.routes = { realTitles, legalTitles: { privacy: 'Privacy — Pantry Check', terms: 'Terms — Pantry Check' }, unknownStatus: missing.status(), axe, linkStatuses };
  await context.close();

  // Fresh real-data context: validation, exact field limits, dialog focus, search, encrypted backup, and restore recovery.
  const realContext = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
  const real = await realContext.newPage();
  real.on('console', (message) => { if (message.type() === 'error') report.errors.push(`real console: ${message.text()}`); });
  real.on('pageerror', (error) => report.errors.push(`real page: ${error.message}`));
  await real.goto(base);
  await real.getByRole('button', { name: 'Add your first item' }).click();
  check(await real.getByLabel('Item name').evaluate((node) => node === document.activeElement), 'add dialog did not focus Item name');
  await real.getByLabel('Item name').fill('   ');
  await real.getByRole('button', { name: 'Save item' }).click();
  check(await real.getByText('Enter an item name, not only spaces.').isVisible(), 'whitespace item was not rejected');
  check(await real.getByLabel('Item name').evaluate((node) => node === document.activeElement), 'invalid name did not retain focus');
  await real.keyboard.press('Escape');
  check(await real.locator('dialog[open]').count() === 0, 'Escape did not close the item dialog');
  const boundary = { name: 'N'.repeat(80), amount: 'Q'.repeat(40), note: 'T'.repeat(160) };
  await real.getByRole('button', { name: 'Add your first item' }).click();
  await real.getByLabel('Item name').fill(boundary.name);
  await real.getByLabel('Zone').selectOption('pantry');
  await real.getByLabel('Rough amount').fill(boundary.amount);
  await real.getByLabel('Note').fill(boundary.note);
  check(await real.getByLabel('Item name').getAttribute('maxlength') === '80', 'name limit is not 80');
  check(await real.getByLabel('Rough amount').getAttribute('maxlength') === '40', 'amount limit is not 40');
  check(await real.getByLabel('Note').getAttribute('maxlength') === '160', 'note limit is not 160');
  await real.getByRole('button', { name: 'Save item' }).click();
  await real.getByText(boundary.name, { exact: true }).waitFor();
  check(await real.getByText(boundary.name, { exact: true }).isVisible(), 'boundary item did not save');
  await real.reload();
  check(await real.getByText(boundary.name, { exact: true }).isVisible(), 'boundary item did not persist');
  await real.getByRole('button', { name: 'Add item' }).click();
  await real.getByLabel('Item name').fill(boundary.name.toLowerCase());
  await real.getByRole('button', { name: 'Save item' }).click();
  check(await real.getByText('That active item is already in your pantry. Edit it instead.').isVisible(), 'case-insensitive duplicate was accepted');
  await real.keyboard.press('Escape');
  await real.getByRole('searchbox', { name: 'Search items' }).fill('not-here');
  await real.getByText(/No items match/).waitFor();
  check(await real.getByText(/No items match/).isVisible(), 'search no-results state is absent');
  await real.getByRole('button', { name: 'Clear search' }).click();
  check(await real.getByText(boundary.name, { exact: true }).isVisible(), 'Clear search did not restore the item');
  await real.getByRole('link', { name: 'Settings' }).click();
  const passphrase = 'verification-six-secret';
  await real.locator('.export-form').getByLabel('Backup passphrase').fill(passphrase);
  const backupDownload = await Promise.all([real.waitForEvent('download'), real.getByRole('button', { name: 'Download encrypted backup' }).click()]).then(([download]) => download);
  const backup = readFileSync(await backupDownload.path());
  const backupText = backup.toString('utf8');
  check(!backupText.includes(boundary.name) && !backupText.includes(passphrase), 'backup contains plaintext data or passphrase');
  check(await real.locator('.export-form').getByLabel('Backup passphrase').inputValue() === '', 'passphrase field was not cleared');
  await real.locator('.import-form').getByLabel('Restore encrypted backup').setInputFiles({ name: 'valid.pantry', mimeType: 'application/json', buffer: backup });
  await real.locator('.import-form').getByLabel('Backup passphrase').fill('wrong-passphrase');
  await real.getByRole('button', { name: 'Restore and replace local data' }).click();
  await real.getByText('The passphrase is wrong or this backup is damaged.').waitFor();
  check(await real.getByText('The passphrase is wrong or this backup is damaged.').isVisible(), 'wrong passphrase error is missing');
  await real.locator('.import-form').getByLabel('Restore encrypted backup').setInputFiles({ name: 'broken.pantry', mimeType: 'application/json', buffer: Buffer.from('{broken') });
  await real.locator('.import-form').getByLabel('Backup passphrase').fill(passphrase);
  await real.getByRole('button', { name: 'Restore and replace local data' }).click();
  await real.getByText('That file is not a Pantry Check backup.').waitFor();
  check(await real.getByText('That file is not a Pantry Check backup.').isVisible(), 'malformed backup error is missing');
  await real.getByRole('link', { name: 'Pantry', exact: true }).click();
  await real.getByRole('button', { name: `Edit ${boundary.name}` }).click();
  real.once('dialog', async (dialog) => dialog.dismiss());
  await real.getByRole('button', { name: 'Remove item' }).click();
  check(await real.getByText(boundary.name, { exact: true }).isVisible(), 'cancelled deletion removed the item');
  await real.getByRole('button', { name: 'Cancel' }).click();
  await real.getByRole('button', { name: `Edit ${boundary.name}` }).click();
  real.once('dialog', async (dialog) => dialog.accept());
  await real.getByRole('button', { name: 'Remove item' }).click();
  await real.getByText(boundary.name, { exact: true }).waitFor({ state: 'detached' });
  check(await real.getByText(boundary.name, { exact: true }).count() === 0, 'confirmed deletion did not remove the item');
  await real.getByRole('link', { name: 'Settings' }).click();
  await real.locator('.import-form').getByLabel('Restore encrypted backup').setInputFiles({ name: 'valid.pantry', mimeType: 'application/json', buffer: backup });
  await real.locator('.import-form').getByLabel('Backup passphrase').fill(passphrase);
  real.once('dialog', async (dialog) => dialog.accept());
  await real.getByRole('button', { name: 'Restore and replace local data' }).click();
  await real.getByRole('link', { name: 'Pantry', exact: true }).click();
  await real.getByText(boundary.name, { exact: true }).waitFor();
  check(await real.getByText(boundary.name, { exact: true }).isVisible(), 'valid backup did not restore deleted data');
  report.realFlow = { whitespaceRejected: true, dialogFocusAndEscape: true, boundaries: { name: 80, amount: 40, note: 160 }, duplicateRejected: true, searchAndClear: true };
  report.recovery = { encryptedPlaintextAbsent: true, passphraseCleared: true, wrongPassphraseRejected: true, malformedBackupRejected: true, cancelledDeleteSafe: true, confirmedDelete: true, validRestore: true };
  await realContext.close();

  // Fresh phone: first-read content, touch sizes, keyboard focus, reduced motion, and 200% browser zoom smoke check.
  const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const phone = await phoneContext.newPage();
  phone.on('console', (message) => { if (message.type() === 'error') report.errors.push(`phone console: ${message.text()}`); });
  phone.on('pageerror', (error) => report.errors.push(`phone page: ${error.message}`));
  await phone.goto(base, { waitUntil: 'networkidle' });
  const phoneBoxes = await Promise.all(firstLocators.map((_, index) => [phone.locator('h1'), phone.locator('.hero-copy > p:not(.eyebrow)').first(), phone.getByRole('button', { name: 'Add your first item' }), phone.getByRole('link', { name: 'Try it with sample data' }), phone.locator('.proof-list')][index].boundingBox()));
  const dock = await phone.locator('.app-nav').boundingBox();
  check(phoneBoxes.every((box) => box && box.y + box.height <= 844 && (!dock || box.y + box.height <= dock.y)), 'phone first-read content is clipped or covered');
  check(await phone.locator('html').evaluate((node) => node.scrollWidth <= node.clientWidth), 'phone root has horizontal overflow');
  await phone.screenshot({ path: `${out}/phone-first-screen.png`, fullPage: false });
  await phone.getByRole('link', { name: 'Try it with sample data' }).click();
  const touch = {};
  for (const [name, locator] of [['Reset demo', phone.getByRole('button', { name: 'Reset demo' })], ['Start for real', phone.getByRole('link', { name: 'Start for real' })]]) {
    const box = await locator.boundingBox();
    check(box && box.width >= 44 && box.height >= 44, `${name} is below 44px`);
    touch[name] = { width: box.width, height: box.height };
  }
  await phone.emulateMedia({ reducedMotion: 'reduce' });
  await phone.keyboard.press('Tab');
  const skip = phone.getByRole('link', { name: 'Skip to main content' });
  const focus = await skip.evaluate((node) => { const box = node.getBoundingClientRect(); const style = getComputedStyle(node); return { focused: node === document.activeElement, top: box.top, bottom: box.bottom, outline: parseFloat(style.outlineWidth), transition: style.transitionDuration, animation: style.animationDuration }; });
  check(focus.focused && focus.top >= 0 && focus.bottom <= 844 && focus.outline >= 3, 'phone skip-link focus is not visible');
  await seriousAxe(phone, 'phone demo');
  const phoneCdp = await phoneContext.newCDPSession(phone);
  await phoneCdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 });
  await phone.waitForTimeout(250);
  const zoom = { scale: await phone.evaluate(() => visualViewport?.scale), h1: await phone.locator('h1').isVisible(), banner: await phone.getByText('Demo — sample data, nothing is saved.').isVisible(), controls: await phone.getByRole('button', { name: 'Reset demo' }).isVisible() };
  check(zoom.scale === 2 && zoom.h1 && zoom.banner && zoom.controls, '200% zoom smoke check lost required content');
  report.phone = { firstScreenAboveDock: true, noHorizontalOverflow: true, touch, reducedMotionFocus: focus, zoom200: zoom };
  await phoneContext.close();

  // Explicit offline demo reload in its own browser context.
  const offlineContext = await browser.newContext();
  const offline = await offlineContext.newPage();
  await offline.goto(`${base}/demo`);
  await offline.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 15_000 });
  const cacheBefore = await offline.evaluate(() => caches.keys());
  await offlineContext.setOffline(true);
  await offline.reload({ waitUntil: 'domcontentloaded' });
  check(await offline.getByText('Oat milk', { exact: true }).isVisible(), 'offline reload lost sample data');
  check(await offline.getByText('Offline · changes stay here').isVisible(), 'offline state is not shown');
  report.offline = { cacheBefore, sampleRetained: true, statusShown: true };
  await offlineContext.setOffline(false);
  await offlineContext.close();

  // Storage failure is isolated to a disposable context and must produce an actionable recovery screen.
  const blockedContext = await browser.newContext();
  await blockedContext.addInitScript(() => { indexedDB.open = () => { throw new Error('QA blocked local storage'); }; });
  const blocked = await blockedContext.newPage();
  await blocked.goto(base);
  check(await blocked.getByRole('heading', { name: 'Pantry Check could not open local storage.' }).isVisible(), 'blocked storage error screen is absent');
  check(await blocked.getByRole('button', { name: 'Try again' }).isVisible(), 'blocked storage recovery action is absent');
  report.recovery.storageBlocked = true;
  await blockedContext.close();

  check(report.errors.length === 0, report.errors.join('\n'));
  writeFileSync(`${out}/live-qa.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
