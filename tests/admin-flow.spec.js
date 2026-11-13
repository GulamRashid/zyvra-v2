import { test, expect } from '@playwright/test';
import fs from 'fs';

if (fs.existsSync('.env.test')) {
  process.loadEnvFile('.env.test');
}

const adminEmail = process.env.TEST_ADMIN_EMAIL || '';
const adminPassword = process.env.TEST_ADMIN_PASSWORD || '';
const hasAdminCredentials = Boolean(adminEmail && adminPassword);

async function loginAsAdmin(page) {
  await page.goto('/auth');
  await page.waitForSelector('.auth-tabs button', { timeout: 25000 });
  await page.locator('.auth-tabs button').nth(1).click();
  await page.locator('input[type="password"]').waitFor({ state: 'visible', timeout: 15000 });

  await page.locator('input[type="email"]').fill(adminEmail);
  await page.locator('input[type="password"]').fill(adminPassword);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.includes('/auth'), { timeout: 30000 });
  // Allow AuthContext loadAccount to complete profile hydration
  await page.waitForTimeout(2500);
}

test.describe('Phase 3: Admin Role End-to-End & Logic Testing', () => {

  test('3.1: RBAC Security Guard - Unauthenticated visitor cannot access /admin', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/auth/);
  });

  test('3.2: Admin Management Panels Load without 4xx/5xx', async ({ page }) => {
    test.skip(!hasAdminCredentials, 'Requires TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD in .env.test');

    const networkFailures = [];
    page.on('response', response => {
      if (response.status() >= 400 && !response.url().includes('favicon') && !response.url().includes('sw.js')) {
        networkFailures.push({ url: response.url(), status: response.status() });
      }
    });

    await loginAsAdmin(page);

    // Verify admin management panels can load cleanly
    const panels = ['/admin/content', '/admin/qbank', '/admin/users', '/admin/pricing'];
    for (const panel of panels) {
      await page.goto(panel);
      await expect(page.locator('.page-heading')).toBeVisible({ timeout: 20000 });
    }

    expect(networkFailures).toHaveLength(0);
  });

  test('3.3: Platform Settings CRUD - Read and update reward slabs with rollback', async ({ page }) => {
    test.skip(!hasAdminCredentials, 'Requires TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD in .env.test');

    await loginAsAdmin(page);
    await page.goto('/admin/settings');
    const settingsPreview = page.locator('.settings-preview');
    await expect(settingsPreview).toBeVisible({ timeout: 25000 });

    // Read initial slab value
    const firstThresholdInput = page.locator('.reward-row input[aria-label="Minimum percentage"]').first();
    await expect(firstThresholdInput).toBeVisible({ timeout: 15000 });
    const originalValue = await firstThresholdInput.inputValue();

    // Mutate to test update
    const testValue = originalValue === '90' ? '91' : '90';
    await firstThresholdInput.fill(testValue);
    await page.getByRole('button', { name: /Save settings/i }).click();
    await expect(page.locator('.settings-success')).toBeVisible({ timeout: 15000 });

    // Revert back immediately to keep read-only audit contract safe
    await firstThresholdInput.fill(originalValue);
    await page.getByRole('button', { name: /Save settings/i }).click();
    await expect(page.locator('.settings-success')).toBeVisible({ timeout: 15000 });
  });
});
