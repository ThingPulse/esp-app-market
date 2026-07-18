import { expect, test, type Page } from '@playwright/test';

async function openCatalog(page: Page): Promise<void> {
  await page.route('https://www.clarity.ms/**', route => route.abort());
  await page.goto('/');
  await expect(page.locator('.device-card')).toHaveCount(3);
}

async function openFirstDevice(page: Page): Promise<void> {
  await openCatalog(page);
  await page.locator('.device-card').first().getByRole('link', { name: /Browse firmware/i }).click();
  await expect(page.locator('.device-hero')).toBeVisible();
  await expect(page.locator('.app-card').first()).toBeVisible();
}

test('device catalog visual', async ({ page }) => {
  await openCatalog(page);
  await expect(page).toHaveScreenshot('device-catalog.png', { fullPage: true });
});

test('firmware catalog visual', async ({ page }) => {
  await openFirstDevice(page);
  await expect(page).toHaveScreenshot('firmware-catalog.png', { fullPage: true });
});

test('installer visual', async ({ page }) => {
  await openFirstDevice(page);
  await page.locator('.app-card').first().getByRole('link', { name: /Install/i }).click();
  await expect(page.getByRole('heading', { name: /Install to device/i })).toBeVisible();
  await expect(page.locator('.console-title')).toHaveCSS('color', 'rgb(226, 232, 240)');
  await expect(page.locator('.console-count')).toHaveCSS('color', 'rgb(148, 163, 184)');
  await expect(page).toHaveScreenshot('firmware-installer.png', { fullPage: true });
});

test('device search filters the catalog', async ({ page }) => {
  await openCatalog(page);
  await page.getByRole('searchbox', { name: /Search devices/i }).fill('Icon256');
  await expect(page.locator('.device-card')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Icon256' })).toBeVisible();
});

test('read-only diagnostics visual', async ({ page }) => {
  await openCatalog(page);
  await page.getByRole('link', { name: /Diagnostics/i }).click();
  await expect(page.getByRole('heading', { name: 'ESP diagnostics' })).toBeVisible();
  await expect(page.getByText('Local and read-only')).toBeVisible();
  await expect(page).toHaveScreenshot('diagnostics.png', { fullPage: true });
});
