import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFileSync } from 'node:fs';

const base = 'https://pantry-reconcile.sociobot.in';
const output = '.factory/evidence-repair-5';
const report = { checkedAt: new Date().toISOString(), base, desktop: {}, phone: {}, offline: {}, errors: [] };
const check = (condition, message) => { if (!condition) throw new Error(message); };
const browser = await chromium.launch({ headless: true });

try {
  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await desktopContext.newPage();
  const requests = [];
  let expectingNotFound = false;
  page.on('request', request => requests.push(request.url()));
  page.on('console', message => {
    if (message.type() === 'error' && !(expectingNotFound && message.text().includes('Failed to load resource'))) report.errors.push(`desktop console: ${message.text()}`);
  });
  page.on('pageerror', error => report.errors.push(`desktop page: ${error.message}`));

  await page.goto(base, { waitUntil: 'networkidle' });
  const first = {
    title: await page.title(),
    h1: await page.locator('h1').innerText(),
    audience: await page.locator('.hero-copy > p:not(.eyebrow)').first().innerText(),
    firstAction: await page.getByRole('button', { name: 'Add your first item' }).innerText(),
    sampleAction: await page.getByRole('link', { name: 'Try it with sample data' }).innerText(),
  };
  for (const locator of [page.locator('h1'), page.locator('.hero-copy > p:not(.eyebrow)').first(), page.getByRole('button', { name: 'Add your first item' }), page.getByRole('link', { name: 'Try it with sample data' }), page.locator('.proof-list')]) {
    const box = await locator.boundingBox();
    check(box && box.y + box.height <= 900, 'desktop first-read content is below the fold');
  }
  check(first.h1.includes('Check pantry items'), 'desktop job is unclear');
  check(first.audience.includes('shared kitchens'), 'desktop audience is unclear');
  await page.screenshot({ path: `${output}/live-desktop-first-screen.png`, fullPage: false });

  await page.getByRole('link', { name: 'Try it with sample data' }).click();
  await page.getByRole('button', { name: 'Reset demo' }).click();
  check(await page.getByText('Demo — sample data, nothing is saved.').isVisible(), 'demo label is missing');
  check(await page.getByText('Oat milk', { exact: true }).isVisible(), 'sample pantry is not populated');
  const namesBeforeReal = await page.evaluate(async () => (await indexedDB.databases()).map(database => database.name));
  check(namesBeforeReal.includes('demo:pantry-check'), 'demo storage namespace is missing');

  await page.getByRole('button', { name: 'Start a check' }).click();
  const zeroAction = { item: await page.locator('.check-card h2').innerText(), value: await page.getByRole('progressbar').getAttribute('value'), max: await page.getByRole('progressbar').getAttribute('max') };
  await page.reload();
  check(await page.locator('.check-card h2').innerText() === zeroAction.item, 'zero-action reload did not restore the first item');
  check(await page.getByRole('progressbar').getAttribute('value') === '0', 'zero-action reload changed progress');

  await page.getByRole('button', { name: 'Seen' }).click();
  await page.waitForFunction(previous => document.querySelector('.check-card h2')?.textContent !== previous, zeroAction.item);
  const partialItem = await page.locator('.check-card h2').innerText();
  await page.reload();
  check(await page.locator('.check-card h2').innerText() === partialItem, 'partial reload did not restore the pending item');
  check(await page.getByRole('progressbar').getAttribute('value') === '1', 'partial reload did not restore progress');
  await page.getByRole('button', { name: 'Finish for now' }).click();
  check((await page.locator('h1').innerText()).includes('2 items left'), 'home does not report the incomplete check');
  await page.getByRole('button', { name: 'Resume check' }).click();
  await page.getByRole('button', { name: 'Seen' }).click();
  await page.waitForFunction(previous => document.querySelector('.check-card h2')?.textContent !== previous, partialItem);
  await page.getByRole('button', { name: 'Seen' }).click();
  await page.waitForFunction(() => document.querySelector('h1')?.textContent?.trim() === '3 items checked.');
  check(await page.locator('h1').innerText() === '3 items checked.', 'complete state is not tied to all outcomes');
  await page.reload();
  check(await page.locator('h1').innerText() === '3 items checked.', 'complete state did not survive reload');
  check(await page.title() === 'Demo check — Pantry Check', 'check view title is wrong');
  await page.screenshot({ path: `${output}/live-desktop-check-complete.png`, fullPage: true });

  await page.getByRole('button', { name: 'View pantry' }).click();
  check(await page.locator('h1').innerText() === 'All items were checked recently', 'fresh status was not shown after completion');
  await page.getByRole('button', { name: 'Reset demo' }).click();
  check(await page.getByText('Red lentils', { exact: true }).isVisible(), 'demo reset did not restore sample data');
  await page.getByRole('link', { name: 'Start for real' }).click();
  check((await page.locator('h1').innerText()).includes('Check pantry items'), 'Start for real did not open the real pantry');
  const realCount = await page.evaluate(async () => {
    const open = indexedDB.open('pantry-check');
    return new Promise((resolve, reject) => {
      open.onsuccess = () => {
        const request = open.result.transaction('items').objectStore('items').count();
        request.onsuccess = () => { open.result.close(); resolve(request.result); };
        request.onerror = () => reject(request.error);
      };
      open.onerror = () => reject(open.error);
    });
  });
  check(realCount === 0, 'demo changed real pantry data');

  const titles = {};
  const expectedTitles = { Pantry: 'Pantry Check — review pantry items', Check: 'Check items — Pantry Check', Shopping: 'Shopping list — Pantry Check', Settings: 'Settings — Pantry Check' };
  for (const name of ['Pantry', 'Check', 'Shopping', 'Settings']) {
    await page.getByRole('link', { name: name === 'Shopping' ? /^Shopping/ : name, exact: name !== 'Shopping' }).click();
    await page.waitForFunction(expected => document.title === expected, expectedTitles[name]);
    titles[name] = await page.title();
  }
  check(new Set(Object.values(titles)).size === 4, 'app view titles are not distinct');
  for (const route of ['/privacy', '/terms']) {
    const response = await page.goto(`${base}${route}`);
    check(response?.status() === 200, `${route} did not return 200`);
    check(await page.locator('h1').count() === 1, `${route} does not have one h1`);
    const axe = await new AxeBuilder({ page }).analyze();
    check(!axe.violations.some(item => ['serious', 'critical'].includes(item.impact ?? '')), `${route} has a serious axe violation`);
  }
  expectingNotFound = true;
  const missing = await page.goto(`${base}/missing-repair-5`);
  check(missing?.status() === 404, 'unknown route did not return HTTP 404');
  check(await page.locator('h1').innerText() === 'That page does not exist.', 'unknown route did not show designed 404');
  const missingAxe = await new AxeBuilder({ page }).analyze();
  check(!missingAxe.violations.some(item => ['serious', 'critical'].includes(item.impact ?? '')), '404 has a serious axe violation');
  expectingNotFound = false;
  check(requests.every(value => new URL(value).origin === base), 'desktop flow made a cross-origin request');
  report.desktop = { first, zeroAction, partialItem, titles, realCount, requestCount: requests.length, unknownStatus: missing.status() };
  await desktopContext.close();

  const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const phone = await phoneContext.newPage();
  phone.on('console', message => { if (message.type() === 'error') report.errors.push(`phone console: ${message.text()}`); });
  phone.on('pageerror', error => report.errors.push(`phone page: ${error.message}`));
  await phone.goto(base, { waitUntil: 'networkidle' });
  const phoneLocators = [phone.locator('h1'), phone.locator('.hero-copy > p:not(.eyebrow)').first(), phone.getByRole('button', { name: 'Add your first item' }), phone.getByRole('link', { name: 'Try it with sample data' }), phone.locator('.proof-list')];
  const phoneBoxes = [];
  for (const locator of phoneLocators) phoneBoxes.push(await locator.boundingBox());
  const phoneNav = await phone.locator('.app-nav').boundingBox();
  check(phoneBoxes.every(box => box && box.y + box.height <= 844), 'phone first-screen content is below the fold');
  check(phoneNav && phoneBoxes.every(box => box && box.y + box.height <= phoneNav.y), 'phone navigation covers first-screen content');
  check(await phone.locator('html').evaluate(element => element.scrollWidth <= element.clientWidth), 'phone has horizontal overflow');
  await phone.screenshot({ path: `${output}/live-phone-first-screen.png`, fullPage: false });
  await phone.getByRole('link', { name: 'Try it with sample data' }).click();
  await phone.screenshot({ path: `${output}/live-phone-demo.png`, fullPage: false });
  for (const control of [phone.getByRole('button', { name: 'Reset demo' }), phone.getByRole('link', { name: 'Start for real' })]) {
    const box = await control.boundingBox();
    check(box && box.width >= 44 && box.height >= 44, 'phone demo control is below 44px');
  }
  await phone.emulateMedia({ reducedMotion: 'reduce' });
  await phone.keyboard.press('Tab');
  const skip = phone.getByRole('link', { name: 'Skip to main content' });
  check(await skip.evaluate(element => { const box = element.getBoundingClientRect(); return box.top >= 0 && Number.parseFloat(getComputedStyle(element).outlineWidth) >= 3; }), 'reduced-motion skip link is not visible');
  const phoneAxe = await new AxeBuilder({ page: phone }).analyze();
  check(!phoneAxe.violations.some(item => ['serious', 'critical'].includes(item.impact ?? '')), 'phone demo has a serious axe violation');
  report.phone = { titles: { demo: await phone.title() }, boxes: phoneBoxes, noHorizontalOverflow: true };
  await phoneContext.close();

  const offlineContext = await browser.newContext();
  const offline = await offlineContext.newPage();
  await offline.goto(`${base}/demo`);
  await offline.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 15_000 });
  await offlineContext.setOffline(true);
  await offline.reload({ waitUntil: 'domcontentloaded' });
  check(await offline.getByText('Oat milk', { exact: true }).isVisible(), 'offline reload lost sample data');
  check(await offline.getByText('Offline · changes stay here').isVisible(), 'offline status is missing');
  report.offline = { sampleRetained: true, statusShown: true };
  await offlineContext.setOffline(false);
  await offlineContext.close();

  check(report.errors.length === 0, report.errors.join('\n'));
  writeFileSync(`${output}/qa-live.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
