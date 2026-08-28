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
  await page.reload();
  await expect(page.getByText('Frozen corn', { exact: true })).toBeVisible();
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Frozen corn', { exact: true })).toBeVisible();
  await expect(page.getByText(/Offline · changes stay here/)).toBeVisible();
  await context.setOffline(false);
});
