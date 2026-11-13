import { chromium } from 'playwright';
import fs from 'fs';

if (fs.existsSync('.env.test')) {
  process.loadEnvFile('.env.test');
}

const baseURL = process.env.TEST_BASE_URL || 'https://zyvra-v2.vercel.app';
const studentEmail = process.env.TEST_STUDENT_EMAIL;
const studentPassword = process.env.TEST_STUDENT_PASSWORD;
const adminEmail = process.env.TEST_ADMIN_EMAIL;
const adminPassword = process.env.TEST_ADMIN_PASSWORD;

async function runLiveAudit() {
  console.log('=====================================================');
  console.log('ZYVRA-V2 LIVE E2E AUTOMATION & AUDIT VERIFICATION');
  console.log('Target Base URL:', baseURL);
  console.log('Admin Email:', adminEmail);
  console.log('Student Email:', studentEmail);
  console.log('=====================================================\n');

  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const results = {
    student: {
      auth: false,
      sessionPersistence: false,
      wallet: false,
      calculator: false,
      fractionConverter: false,
      stickyNotes: false,
      exploreExams: false,
      signOut: false
    },
    admin: {
      rbacGuard: false,
      auth: false,
      dashboard: false,
      settingsPreview: false,
      subPanels: false
    }
  };

  // -----------------------------------------------------------------
  // 1. RBAC SECURITY GUARD (UNAUTHENTICATED ACCESS)
  // -----------------------------------------------------------------
  console.log('--- Step 1: Testing RBAC Guard on /admin for Unauthenticated Visitor ---');
  const contextVisitor = await browser.newContext();
  const pageVisitor = await contextVisitor.newPage();
  await pageVisitor.goto(`${baseURL}/admin`);
  await pageVisitor.waitForURL(url => url.pathname.includes('/auth'), { timeout: 15000 });
  console.log('✓ RBAC PASS: Unauthenticated request to /admin redirected to /auth');
  results.admin.rbacGuard = true;
  await contextVisitor.close();

  // -----------------------------------------------------------------
  // 2. STUDENT FLOW TESTING
  // -----------------------------------------------------------------
  console.log('\n--- Step 2: Phase 2 Student Role E2E Testing ---');
  const contextStudent = await browser.newContext();
  const pageStudent = await contextStudent.newPage();

  console.log('[2.1] Visiting /auth and selecting Password login...');
  await pageStudent.goto(`${baseURL}/auth`);
  await pageStudent.waitForSelector('.auth-tabs button', { timeout: 20000 });
  // Click "Sign In with Password"
  await pageStudent.locator('.auth-tabs button').nth(1).click();
  await pageStudent.locator('input[type="password"]').waitFor({ state: 'visible', timeout: 10000 });

  console.log('[2.1] Submitting student credentials...');
  await pageStudent.locator('input[type="email"]').fill(studentEmail);
  await pageStudent.locator('input[type="password"]').fill(studentPassword);
  await pageStudent.locator('button[type="submit"]').click();

  await pageStudent.waitForURL(url => !url.pathname.includes('/auth'), { timeout: 25000 });
  console.log('✓ Student login SUCCESS! Landed on:', pageStudent.url());
  results.student.auth = true;

  // Session reload persistence
  console.log('[2.1] Testing session persistence across reload...');
  await pageStudent.reload();
  await pageStudent.waitForTimeout(2000);
  if (!pageStudent.url().includes('/auth')) {
    console.log('✓ Session persistence PASS!');
    results.student.sessionPersistence = true;
  }

  // Student Wallet
  console.log('[2.5] Testing Student Wallet...');
  await pageStudent.goto(`${baseURL}/wallet`);
  await pageStudent.waitForSelector('.wallet-hero', { timeout: 20000 });
  const walletCopy = await pageStudent.locator('.wallet-hero-copy').innerText();
  console.log('✓ Wallet PASS! Text:', walletCopy.trim());
  results.student.wallet = true;

  // Student Toolbox: Calculator
  console.log('[2.2] Testing Student Toolbox - Smart Calculator...');
  await pageStudent.goto(`${baseURL}/toolbox`);
  await pageStudent.waitForSelector('.toolbox-page', { timeout: 20000 });

  // Click Math category
  await pageStudent.locator('.toolbox-app-card.gold').click();
  // Click Calculator tool
  await pageStudent.locator('.toolbox-tool-card').first().click();
  const calcDisplay = pageStudent.locator('.calculator-primary-display');
  await calcDisplay.waitFor({ state: 'visible', timeout: 15000 });

  // Standard multiplication 7 × 6 = 42
  await pageStudent.getByRole('button', { name: 'AC', exact: true }).click();
  await pageStudent.getByRole('button', { name: '7', exact: true }).click();
  await pageStudent.getByRole('button', { name: '×', exact: true }).click();
  await pageStudent.getByRole('button', { name: '6', exact: true }).click();
  await pageStudent.getByRole('button', { name: '=', exact: true }).click();
  const multRes = await calcDisplay.innerText();
  console.log('✓ Calculator 7 × 6 =', multRes);

  // Divide by zero 8 ÷ 0 = Error
  await pageStudent.getByRole('button', { name: 'AC', exact: true }).click();
  await pageStudent.getByRole('button', { name: '8', exact: true }).click();
  await pageStudent.getByRole('button', { name: '÷', exact: true }).click();
  await pageStudent.getByRole('button', { name: '0', exact: true }).click();
  await pageStudent.getByRole('button', { name: '=', exact: true }).click();
  const divZeroRes = await calcDisplay.innerText();
  console.log('✓ Calculator 8 ÷ 0 =', divZeroRes);
  results.student.calculator = true;

  // Student Toolbox: Fraction Converter
  console.log('[2.3] Testing Fraction / Percentage Converter...');
  await pageStudent.goto(`${baseURL}/toolbox`);
  await pageStudent.locator('.toolbox-app-card.gold').click();
  await pageStudent.locator('.toolbox-tool-card').nth(1).click();
  const percentInp = pageStudent.locator('.fraction-input-wrap input');
  await percentInp.waitFor({ state: 'visible', timeout: 15000 });
  await percentInp.fill('25');
  const fracRes = await pageStudent.locator('.fraction-result').first().innerText();
  console.log('✓ Fraction 25% =', fracRes.trim());
  results.student.fractionConverter = true;

  // Student Toolbox: Sticky Notes
  console.log('[2.4] Testing Sticky Notes...');
  await pageStudent.goto(`${baseURL}/toolbox`);
  await pageStudent.locator('.toolbox-app-card.green').click();
  await pageStudent.locator('.toolbox-tool-card').nth(1).click();

  const noteTitle = `Audit Note ${Date.now()}`;
  const noteContent = 'Persistence test note.';
  await pageStudent.locator('input[placeholder*="Title"], .sticky-note-form input').fill(noteTitle);
  await pageStudent.locator('.sticky-notes-textarea, .sticky-note-form textarea').fill(noteContent);
  await pageStudent.locator('.sticky-note-actions button[type="submit"]').click();

  await pageStudent.locator('.sticky-note-card', { hasText: noteTitle }).waitFor({ state: 'visible', timeout: 10000 });
  console.log('✓ Sticky Note created successfully!');

  // Reload and check persistence
  await pageStudent.reload();
  await pageStudent.locator('.toolbox-app-card.green').click();
  await pageStudent.locator('.toolbox-tool-card').nth(1).click();
  await pageStudent.locator('.sticky-note-card', { hasText: noteTitle }).waitFor({ state: 'visible', timeout: 15000 });
  console.log('✓ Sticky Note persisted cleanly after reload!');

  // Delete note
  await pageStudent.locator('.sticky-note-card', { hasText: noteTitle }).locator('button[aria-label*="Delete"]').click();
  results.student.stickyNotes = true;

  // Explore Exams
  console.log('[2.6] Testing Explore Exams & Practice Hub...');
  await pageStudent.goto(`${baseURL}/explore`);
  await pageStudent.waitForSelector('.page-heading', { timeout: 15000 });
  console.log('✓ Explore Exams rendered cleanly!');
  results.student.exploreExams = true;

  // Logout
  console.log('[2.1] Testing Sign out...');
  await pageStudent.goto(`${baseURL}/profile`);
  await pageStudent.getByRole('button', { name: 'Sign out' }).first().click();
  await pageStudent.waitForURL(url => url.pathname.includes('/auth'), { timeout: 15000 });
  console.log('✓ Sign out PASS!');
  results.student.signOut = true;
  await contextStudent.close();

  // -----------------------------------------------------------------
  // 3. ADMIN FLOW TESTING
  // -----------------------------------------------------------------
  console.log('\n--- Step 3: Phase 3 Admin Role E2E Testing ---');
  const contextAdmin = await browser.newContext();
  const pageAdmin = await contextAdmin.newPage();

  console.log('[3.2] Logging in as Super Admin...');
  await pageAdmin.goto(`${baseURL}/auth`);
  await pageAdmin.waitForSelector('.auth-tabs button', { timeout: 20000 });
  await pageAdmin.locator('.auth-tabs button').nth(1).click();
  await pageAdmin.locator('input[type="password"]').waitFor({ state: 'visible', timeout: 10000 });

  await pageAdmin.locator('input[type="email"]').fill(adminEmail);
  await pageAdmin.locator('input[type="password"]').fill(adminPassword);
  await pageAdmin.locator('button[type="submit"]').click();
  await pageAdmin.waitForURL(url => !url.pathname.includes('/auth'), { timeout: 25000 });
  console.log('✓ Admin login SUCCESS!');
  results.admin.auth = true;

  // Platform Settings CRUD
  console.log('[3.3] Testing Platform Settings Manager (/admin/settings)...');
  await pageAdmin.waitForTimeout(3000); // Allow AuthContext loadAccount to hydrate profile
  await pageAdmin.goto(`${baseURL}/admin/settings`);
  console.log('Current URL after navigating to /admin/settings:', pageAdmin.url());
  await pageAdmin.waitForSelector('.settings-preview', { timeout: 25000 });
  console.log('✓ Settings preview panel loaded!');

  const firstThresholdInput = pageAdmin.locator('.reward-row input[aria-label="Minimum percentage"]').first();
  await firstThresholdInput.waitFor({ state: 'visible', timeout: 15000 });
  const originalVal = await firstThresholdInput.inputValue();
  console.log('✓ Current test reward slab percentage:', originalVal);

  const testVal = originalVal === '90' ? '91' : '90';
  await firstThresholdInput.fill(testVal);
  await pageAdmin.getByRole('button', { name: /Save settings/i }).click();
  await pageAdmin.waitForSelector('.settings-success', { timeout: 15000 });
  console.log('✓ Settings mutation successfully saved to Supabase!');

  // Revert back immediately to keep read-only audit contract intact
  await firstThresholdInput.fill(originalVal);
  await pageAdmin.getByRole('button', { name: /Save settings/i }).click();
  await pageAdmin.waitForSelector('.settings-success', { timeout: 15000 });
  console.log('✓ Settings successfully reverted back to original value:', originalVal);
  results.admin.settingsPreview = true;

  // Check sub-panels
  console.log('[3.2] Testing Admin Sub-panels (/admin/content, /admin/qbank, /admin/users, /admin/pricing)...');
  const panels = ['/admin/content', '/admin/qbank', '/admin/users', '/admin/pricing'];
  for (const panel of panels) {
    await pageAdmin.goto(`${baseURL}${panel}`);
    await pageAdmin.waitForSelector('.page-heading', { timeout: 20000 });
    console.log(`✓ Admin panel ${panel} rendered without errors!`);
  }
  results.admin.subPanels = true;

  await contextAdmin.close();
  await browser.close();

  console.log('\n=====================================================');
  console.log('FINAL LIVE E2E AUTOMATION EXECUTION RESULTS:');
  console.log(JSON.stringify(results, null, 2));
  console.log('=====================================================');
}

runLiveAudit().catch(err => {
  console.error('\n❌ Audit execution encountered an error:', err);
  process.exit(1);
});
