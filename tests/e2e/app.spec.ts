import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('adds, reconciles, and persists an item', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pantry Check');
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
  await expect(page.getByText(/confirmation made/i)).toBeVisible();
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
  await page.getByRole('button', { name: /Shopping/ }).click();
  await expect(page.getByRole('heading', { name: 'Shopping delta' })).toBeVisible();
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
  await page.getByRole('button', { name: 'Pantry' }).click();
  await page.getByRole('button', { name: 'Add item' }).click();
  await page.getByLabel('Item name').fill(' pasta ');
  await page.getByRole('button', { name: 'Save item' }).click();
  await page.getByRole('button', { name: /Shopping/ }).click();
  await page.getByRole('button', { name: 'Mark restocked' }).click();
  await expect(page.locator('.toast')).toContainText(/already active in your pantry/i);
  await expect(page.getByRole('button', { name: 'Mark restocked' })).toBeVisible();
  await page.getByRole('button', { name: 'Pantry' }).click();
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
  for (const path of ['/', '/privacy', '/terms']) {
    await page.goto(path);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('h1')).toHaveCount(1);
    // Axe ships its own Playwright type range; runtime uses the pinned browser API.
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
  await expect.poll(() => page.evaluate(() => caches.keys())).toContain('pantry-v6');
  await page.reload();
  await expect(page.getByText('Frozen corn', { exact: true })).toBeVisible();
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Frozen corn', { exact: true })).toBeVisible();
  await expect(page.getByText(/Offline · changes stay here/)).toBeVisible();
  await context.setOffline(false);
});
