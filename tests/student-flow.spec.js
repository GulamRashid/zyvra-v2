import { test, expect } from '@playwright/test';
import fs from 'fs';

if (fs.existsSync('.env.test')) {
  process.loadEnvFile('.env.test');
}

const studentEmail = process.env.TEST_STUDENT_EMAIL || '';
const studentPassword = process.env.TEST_STUDENT_PASSWORD || '';
const hasCredentials = Boolean(studentEmail && studentPassword);

async function loginAsStudent(page) {
  await page.goto('/auth');
  await page.waitForSelector('.auth-tabs button', { timeout: 25000 });
  await page.locator('.auth-tabs button').nth(1).click();
  await page.locator('input[type="password"]').waitFor({ state: 'visible', timeout: 15000 });

  await page.locator('input[type="email"]').fill(studentEmail);
  await page.locator('input[type="password"]').fill(studentPassword);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.includes('/auth'), { timeout: 30000 });
  await page.waitForTimeout(2000);
}

test.describe('Phase 2: Student Role End-to-End & Logic Testing', () => {

  test('2.1: Authentication - Login, reload persistence, and logout', async ({ page }) => {
    test.skip(!hasCredentials, 'Requires TEST_STUDENT_EMAIL and TEST_STUDENT_PASSWORD in .env.test');

    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // 1. Visit Auth Page and log in
    await loginAsStudent(page);

    // Verify session persistence on reload
    await page.reload();
    await expect(page).not.toHaveURL(/\/auth/);

    // Filter non-fatal console noise
    const criticalErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('sw.js') && !e.includes('manifest'));
    expect(criticalErrors).toHaveLength(0);

    // Logout
    await page.goto('/profile');
    const signOutButton = page.getByRole('button', { name: 'Sign out' }).first();
    await signOutButton.waitFor({ state: 'visible', timeout: 15000 });
    await signOutButton.click();
    await expect(page).toHaveURL(/\/auth/, { timeout: 15000 });
  });

  test('2.2: Student Toolbox - Smart Calculator edge cases and operations', async ({ page }) => {
    test.skip(!hasCredentials, 'Requires student session');
    await loginAsStudent(page);

    await page.goto('/toolbox');
    await expect(page.locator('.toolbox-page')).toBeVisible({ timeout: 25000 });

    // Open Math category
    const mathCategory = page.locator('.toolbox-app-card.gold');
    await mathCategory.waitFor({ state: 'visible', timeout: 15000 });
    await mathCategory.click();

    // Open Calculator tool
    const calcTool = page.locator('.toolbox-tool-card').first();
    await calcTool.waitFor({ state: 'visible', timeout: 15000 });
    await calcTool.click();

    // Verify Calculator display
    const calcDisplay = page.locator('.calculator-primary-display');
    await expect(calcDisplay).toBeVisible({ timeout: 15000 });

    // Test 1: Standard arithmetic (7 × 6 = 42)
    await page.getByRole('button', { name: 'AC', exact: true }).click();
    await page.getByRole('button', { name: '7', exact: true }).click();
    await page.getByRole('button', { name: '×', exact: true }).click();
    await page.getByRole('button', { name: '6', exact: true }).click();
    await page.getByRole('button', { name: '=', exact: true }).click();
    await expect(calcDisplay).toHaveText('42');

    // Test 2: Division by zero -> Error
    await page.getByRole('button', { name: 'AC', exact: true }).click();
    await page.getByRole('button', { name: '8', exact: true }).click();
    await page.getByRole('button', { name: '÷', exact: true }).click();
    await page.getByRole('button', { name: '0', exact: true }).click();
    await page.getByRole('button', { name: '=', exact: true }).click();
    await expect(calcDisplay).toHaveText(/Error|NaN/i);
  });

  test('2.3: Student Toolbox - Fraction / Percentage Converter bidirectional calculation', async ({ page }) => {
    test.skip(!hasCredentials, 'Requires student session');
    await loginAsStudent(page);

    await page.goto('/toolbox');
    await expect(page.locator('.toolbox-page')).toBeVisible({ timeout: 25000 });

    // Open Math category
    const mathCategory = page.locator('.toolbox-app-card.gold');
    await mathCategory.waitFor({ state: 'visible', timeout: 15000 });
    await mathCategory.click();

    // Open Fraction Converter tool
    const fractionTool = page.locator('.toolbox-tool-card').nth(1);
    await fractionTool.waitFor({ state: 'visible', timeout: 15000 });
    await fractionTool.click();

    // Test Percentage to Fraction input (25% -> 1/4)
    const percentInput = page.locator('.fraction-input-wrap input');
    await percentInput.waitFor({ state: 'visible', timeout: 15000 });
    await percentInput.fill('25');
    const fracResult = page.locator('.fraction-result').first();
    await expect(fracResult).toContainText('1');
    await expect(fracResult).toContainText('4');

    // Test Fraction to Percentage (1/2 -> 50%)
    const numInput = page.locator('label:has-text("Numerator") input, .fraction-parts input').first();
    const denInput = page.locator('label:has-text("Denominator") input, .fraction-parts input').nth(1);
    await numInput.fill('1');
    await denInput.fill('2');
    const percentResult = page.locator('.fraction-result').nth(1);
    await expect(percentResult).toContainText('50%');

    // Edge case: Denominator 0
    await denInput.fill('0');
    await expect(percentResult).toContainText(/Invalid|Denominator/i);
  });

  test('2.4: Student Toolbox - Sticky Notes persistence across page reload', async ({ page }) => {
    test.skip(!hasCredentials, 'Requires student session');
    await loginAsStudent(page);

    await page.goto('/toolbox');
    await expect(page.locator('.toolbox-page')).toBeVisible({ timeout: 25000 });

    // Open Productivity category
    const prodCategory = page.locator('.toolbox-app-card.green');
    await prodCategory.waitFor({ state: 'visible', timeout: 15000 });
    await prodCategory.click();

    // Open Sticky Notes tool (second tool in productivity)
    const notesTool = page.locator('.toolbox-tool-card').nth(1);
    await notesTool.waitFor({ state: 'visible', timeout: 15000 });
    await notesTool.click();

    const noteTitle = `Test Note ${Date.now()}`;
    const noteContent = 'Comprehensive QA Audit verification note.';

    const titleInput = page.locator('input[placeholder*="Title"], .sticky-note-form input');
    const contentTextarea = page.locator('.sticky-notes-textarea, .sticky-note-form textarea');
    const saveBtn = page.locator('.sticky-note-actions button[type="submit"]');

    await titleInput.waitFor({ state: 'visible', timeout: 15000 });
    await titleInput.fill(noteTitle);
    await contentTextarea.fill(noteContent);
    await saveBtn.click();

    // Verify note card rendered
    await expect(page.locator('.sticky-note-card', { hasText: noteTitle })).toBeVisible({ timeout: 10000 });

    // Reload page and verify persistence from localStorage
    await page.reload();
    const prodCategoryAfterReload = page.locator('.toolbox-app-card.green');
    await prodCategoryAfterReload.waitFor({ state: 'visible', timeout: 15000 });
    await prodCategoryAfterReload.click();
    const notesToolAfterReload = page.locator('.toolbox-tool-card').nth(1);
    await notesToolAfterReload.waitFor({ state: 'visible', timeout: 15000 });
    await notesToolAfterReload.click();

    await expect(page.locator('.sticky-note-card', { hasText: noteTitle })).toBeVisible({ timeout: 15000 });

    // Clean up: delete note
    const deleteBtn = page.locator('.sticky-note-card', { hasText: noteTitle }).locator('button[aria-label*="Delete"]');
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
      await expect(page.locator('.sticky-note-card', { hasText: noteTitle })).not.toBeVisible();
    }
  });

  test('2.5: Student Wallet - Balance & Referral code rendering', async ({ page }) => {
    test.skip(!hasCredentials, 'Requires TEST_STUDENT credentials in .env.test');
    await loginAsStudent(page);

    await page.goto('/wallet');
    await expect(page.locator('.wallet-hero')).toBeVisible({ timeout: 25000 });
    await expect(page.locator('.wallet-hero-copy')).toContainText(/coins/i);
    await expect(page.locator('.referral-card, .referral-code-display, .referral-box')).toBeVisible({ timeout: 15000 });
  });

  test('2.6: Student Explore Exams & Mock Tests flow', async ({ page }) => {
    test.skip(!hasCredentials, 'Requires student session');
    await loginAsStudent(page);

    await page.goto('/explore');
    await expect(page.locator('.page-heading')).toBeVisible({ timeout: 25000 });

    const examCards = page.locator('.exam-card, .explore-card, .category-card');
    await expect(examCards.first()).toBeVisible({ timeout: 15000 });

    await page.goto('/tests');
    await expect(page.locator('.page-heading')).toBeVisible({ timeout: 25000 });
  });
});
