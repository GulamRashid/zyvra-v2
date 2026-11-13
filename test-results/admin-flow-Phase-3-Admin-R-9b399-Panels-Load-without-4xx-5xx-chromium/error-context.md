# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin-flow.spec.js >> Phase 3: Admin Role End-to-End & Logic Testing >> 3.2: Admin Dashboard - Metrics and Management Panels Load without 4xx/5xx
- Location: tests\admin-flow.spec.js:38:3

# Error details

```
Test timeout of 90000ms exceeded.
```

```
Error: page.goto: Test timeout of 90000ms exceeded.
Call log:
  - navigating to "https://zyvra-v2.vercel.app/admin", waiting until "domcontentloaded"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import fs from 'fs';
  3  | 
  4  | if (fs.existsSync('.env.test')) {
  5  |   process.loadEnvFile('.env.test');
  6  | }
  7  | 
  8  | const adminEmail = process.env.TEST_ADMIN_EMAIL || '';
  9  | const adminPassword = process.env.TEST_ADMIN_PASSWORD || '';
  10 | const hasAdminCredentials = Boolean(adminEmail && adminPassword);
  11 | 
  12 | async function loginAsAdmin(page) {
  13 |   await page.goto('/auth', { waitUntil: 'domcontentloaded' });
  14 |   const passwordTab = page.getByRole('button', { name: 'Sign In with Password' });
  15 |   await passwordTab.waitFor({ state: 'visible', timeout: 20000 });
  16 |   await passwordTab.click();
  17 | 
  18 |   const emailInput = page.locator('input[type="email"]');
  19 |   await emailInput.waitFor({ state: 'visible', timeout: 15000 });
  20 |   await emailInput.fill(adminEmail);
  21 | 
  22 |   const passwordInput = page.locator('input[type="password"]');
  23 |   await passwordInput.waitFor({ state: 'visible', timeout: 15000 });
  24 |   await passwordInput.fill(adminPassword);
  25 | 
  26 |   await page.locator('button[type="submit"]').click();
  27 |   await page.waitForURL((url) => !url.pathname.includes('/auth'), { timeout: 30000 });
  28 | }
  29 | 
  30 | test.describe('Phase 3: Admin Role End-to-End & Logic Testing', () => {
  31 | 
  32 |   test('3.1: RBAC Security Guard - Unauthenticated visitor cannot access /admin', async ({ page }) => {
  33 |     await page.context().clearCookies();
  34 |     await page.goto('/admin', { waitUntil: 'domcontentloaded' });
  35 |     await expect(page).toHaveURL(/\/auth/);
  36 |   });
  37 | 
  38 |   test('3.2: Admin Dashboard - Metrics and Management Panels Load without 4xx/5xx', async ({ page }) => {
  39 |     test.skip(!hasAdminCredentials, 'Requires TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD in .env.test');
  40 | 
  41 |     const networkFailures = [];
  42 |     page.on('response', response => {
  43 |       if (response.status() >= 400 && !response.url().includes('favicon') && !response.url().includes('sw.js')) {
  44 |         networkFailures.push({ url: response.url(), status: response.status() });
  45 |       }
  46 |     });
  47 | 
  48 |     // 1. Log in as Admin
  49 |     await loginAsAdmin(page);
  50 | 
  51 |     // 2. Navigate to /admin
> 52 |     await page.goto('/admin', { waitUntil: 'domcontentloaded' });
     |                ^ Error: page.goto: Test timeout of 90000ms exceeded.
  53 |     await expect(page).toHaveURL(/\/admin/);
  54 | 
  55 |     // Verify metrics grid
  56 |     await expect(page.locator('.metrics-grid')).toBeVisible({ timeout: 25000 });
  57 |     await expect(page.locator('.admin-dashboard')).toBeVisible();
  58 | 
  59 |     // Verify sub-panels can load
  60 |     const panels = ['/admin/content', '/admin/qbank', '/admin/tests', '/admin/users', '/admin/pricing'];
  61 |     for (const panel of panels) {
  62 |       await page.goto(panel, { waitUntil: 'domcontentloaded' });
  63 |       await expect(page.locator('.page-loading')).not.toBeVisible({ timeout: 20000 });
  64 |       await expect(page.locator('.page-heading')).toBeVisible({ timeout: 15000 });
  65 |     }
  66 | 
  67 |     expect(networkFailures).toHaveLength(0);
  68 |   });
  69 | 
  70 |   test('3.3: Platform Settings CRUD - Read and update reward slabs with rollback', async ({ page }) => {
  71 |     test.skip(!hasAdminCredentials, 'Requires TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD in .env.test');
  72 | 
  73 |     // 1. Log in as Admin
  74 |     await loginAsAdmin(page);
  75 | 
  76 |     // 2. Navigate to /admin/settings
  77 |     await page.goto('/admin/settings', { waitUntil: 'domcontentloaded' });
  78 |     const settingsPreview = page.locator('.settings-preview');
  79 |     await expect(settingsPreview).toBeVisible({ timeout: 25000 });
  80 | 
  81 |     // Read initial slab value
  82 |     const firstThresholdInput = page.locator('.reward-row input[aria-label="Minimum percentage"]').first();
  83 |     await expect(firstThresholdInput).toBeVisible({ timeout: 15000 });
  84 |     const originalValue = await firstThresholdInput.inputValue();
  85 | 
  86 |     // Mutate to test update
  87 |     const testValue = originalValue === '90' ? '92' : '90';
  88 |     await firstThresholdInput.fill(testValue);
  89 |     await page.getByRole('button', { name: /Save settings/i }).click();
  90 |     await expect(page.locator('.settings-success')).toBeVisible({ timeout: 15000 });
  91 | 
  92 |     // Revert back immediately to keep read-only audit contract safe
  93 |     await firstThresholdInput.fill(originalValue);
  94 |     await page.getByRole('button', { name: /Save settings/i }).click();
  95 |     await expect(page.locator('.settings-success')).toBeVisible({ timeout: 15000 });
  96 |   });
  97 | });
  98 | 
```