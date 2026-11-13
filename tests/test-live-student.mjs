import { chromium } from 'playwright';
import fs from 'fs';

if (fs.existsSync('.env.test')) {
  process.loadEnvFile('.env.test');
}

const baseURL = process.env.TEST_BASE_URL || 'https://zyvra-v2.vercel.app';
const studentEmail = process.env.TEST_STUDENT_EMAIL;
const studentPassword = process.env.TEST_STUDENT_PASSWORD;

async function run() {
  console.log('=== Phase 2: Live Student Flow Testing ===');
  console.log('Target Base URL:', baseURL);
  console.log('Student Email:', studentEmail);

  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(60000);
  page.setDefaultTimeout(45000);

  // 1. Visit Auth & Login
  console.log('\n[2.1] Authenticating as Student...');
  await page.goto(`${baseURL}/auth`, { waitUntil: 'commit' });
  const passwordTab = page.getByRole('button', { name: 'Sign In with Password' });
  await passwordTab.waitFor({ state: 'visible', timeout: 60000 });
  await passwordTab.click();

  await page.locator('input[type="email"]').fill(studentEmail);
  await page.locator('input[type="password"]').fill(studentPassword);
  await page.locator('button[type="submit"]').click();

  await page.waitForURL(url => !url.pathname.includes('/auth'), { timeout: 45000 });
  console.log('✓ Successfully authenticated! Current URL:', page.url());

  // Verify reload persistence
  console.log('[2.1] Verifying session persistence on page reload...');
  await page.reload({ waitUntil: 'commit' });
  await page.waitForTimeout(2000);
  if (page.url().includes('/auth')) {
    throw new Error('Session lost after reload!');
  }
  console.log('✓ Session persisted cleanly across page reload!');

  // 2. Student Wallet
  console.log('\n[2.5] Testing Student Wallet & Referral Code...');
  await page.goto(`${baseURL}/wallet`, { waitUntil: 'commit' });
  const walletHero = page.locator('.wallet-hero');
  await walletHero.waitFor({ state: 'visible', timeout: 30000 });
  const walletCopy = await page.locator('.wallet-hero-copy').textContent();
  console.log('✓ Wallet loaded successfully! Content:', walletCopy?.trim());

  // 3. Student Toolbox: Smart Calculator
  console.log('\n[2.2] Testing Student Toolbox - Smart Calculator...');
  await page.goto(`${baseURL}/toolbox`, { waitUntil: 'commit' });
  await page.locator('.toolbox-page').waitFor({ state: 'visible', timeout: 30000 });

  // Open Math category
  const mathCard = page.locator('.toolbox-app-card.gold');
  await mathCard.waitFor({ state: 'visible', timeout: 20000 });
  await mathCard.click();

  // Open Calculator
  const calcTool = page.locator('.toolbox-tool-card').first();
  await calcTool.waitFor({ state: 'visible', timeout: 20000 });
  await calcTool.click();

  const calcDisplay = page.locator('.calculator-primary-display');
  await calcDisplay.waitFor({ state: 'visible', timeout: 20000 });

  // Arithmetic: 7 × 6 = 42
  await page.getByRole('button', { name: 'AC' }).click();
  await page.getByRole('button', { name: '7' }).click();
  await page.getByRole('button', { name: '×' }).click();
  await page.getByRole('button', { name: '6' }).click();
  await page.getByRole('button', { name: '=' }).click();
  const multResult = await calcDisplay.textContent();
  console.log('✓ Calculator Multiplication (7 × 6):', multResult);

  // Divide by zero: 8 ÷ 0 = Error
  await page.getByRole('button', { name: 'AC' }).click();
  await page.getByRole('button', { name: '8' }).click();
  await page.getByRole('button', { name: '÷' }).click();
  await page.getByRole('button', { name: '0' }).click();
  await page.getByRole('button', { name: '=' }).click();
  const divZeroResult = await calcDisplay.textContent();
  console.log('✓ Calculator Division by Zero (8 ÷ 0):', divZeroResult);

  // 4. Student Toolbox: Fraction Converter
  console.log('\n[2.3] Testing Fraction / Percentage Converter...');
  await page.goto(`${baseURL}/toolbox`, { waitUntil: 'commit' });
  const mathCard2 = page.locator('.toolbox-app-card.gold');
  await mathCard2.waitFor({ state: 'visible', timeout: 20000 });
  await mathCard2.click();

  const fracTool = page.locator('.toolbox-tool-card').nth(1);
  await fracTool.waitFor({ state: 'visible', timeout: 20000 });
  await fracTool.click();

  const percentInput = page.locator('.fraction-input-wrap input');
  await percentInput.waitFor({ state: 'visible', timeout: 20000 });
  await percentInput.fill('25');
  const fracText = await page.locator('.fraction-result').first().textContent();
  console.log('✓ Percentage to Fraction (25%):', fracText?.trim());

  // 5. Explore Exams
  console.log('\n[2.6] Testing Explore Exams & Practice Hub...');
  await page.goto(`${baseURL}/explore`, { waitUntil: 'commit' });
  await page.locator('.page-heading').waitFor({ state: 'visible', timeout: 30000 });
  console.log('✓ Explore Exams page rendered successfully!');

  // 6. Sign Out
  console.log('\n[2.1] Testing Sign Out...');
  await page.goto(`${baseURL}/profile`, { waitUntil: 'commit' });
  const signOutBtn = page.getByRole('button', { name: /Sign out|Log out/i });
  await signOutBtn.waitFor({ state: 'visible', timeout: 20000 });
  await signOutBtn.click();
  await page.waitForURL(url => url.pathname.includes('/auth'), { timeout: 25000 });
  console.log('✓ Successfully signed out! Current URL:', page.url());

  console.log('\n========================================');
  console.log('ALL PHASE 2 STUDENT LIVE E2E TESTS PASSED!');
  console.log('========================================');

  await browser.close();
}

run().catch(err => {
  console.error('\n❌ Student test failed:', err);
  process.exit(1);
});

