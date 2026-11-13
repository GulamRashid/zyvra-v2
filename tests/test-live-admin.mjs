import { chromium } from 'playwright';
import fs from 'fs';

if (fs.existsSync('.env.test')) {
  process.loadEnvFile('.env.test');
}

const baseURL = process.env.TEST_BASE_URL || 'https://zyvra-v2.vercel.app';
const adminEmail = process.env.TEST_ADMIN_EMAIL;
const adminPassword = process.env.TEST_ADMIN_PASSWORD;

async function run() {
  console.log('Launching Chrome against:', baseURL);
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(60000);
  page.setDefaultTimeout(45000);

  console.log('Navigating to /auth...');
  await page.goto(`${baseURL}/auth`, { waitUntil: 'commit' });

  console.log('Waiting for Sign In with Password tab...');
  const passwordTab = page.getByRole('button', { name: 'Sign In with Password' });
  await passwordTab.waitFor({ state: 'visible', timeout: 60000 });
  await passwordTab.click();
  console.log('Password tab clicked!');

  console.log('Filling admin credentials...');
  await page.locator('input[type="email"]').fill(adminEmail);
  await page.locator('input[type="password"]').fill(adminPassword);
  
  console.log('Submitting login...');
  await page.locator('button[type="submit"]').click();

  console.log('Waiting for redirect away from /auth...');
  await page.waitForURL(url => !url.pathname.includes('/auth'), { timeout: 45000 });
  console.log('Redirected to:', page.url());

  console.log('Navigating to /admin via page.goto with commit...');
  await page.goto(`${baseURL}/admin`, { waitUntil: 'commit' });
  console.log('On page:', page.url());

  console.log('Waiting for .metrics-grid...');
  await page.locator('.metrics-grid').waitFor({ state: 'visible', timeout: 45000 });
  console.log('SUCCESS! Admin metrics grid is visible!');

  console.log('Navigating to /admin/settings...');
  await page.goto(`${baseURL}/admin/settings`, { waitUntil: 'commit' });
  await page.locator('.settings-preview').waitFor({ state: 'visible', timeout: 45000 });
  console.log('SUCCESS! Settings preview is visible!');

  const firstInput = page.locator('.reward-row input[aria-label="Minimum percentage"]').first();
  await firstInput.waitFor({ state: 'visible', timeout: 30000 });
  const val = await firstInput.inputValue();
  console.log('Current reward slab percentage:', val);

  console.log('Admin panels test: testing sub-panels...');
  const panels = ['/admin/content', '/admin/qbank', '/admin/tests', '/admin/users', '/admin/pricing'];
  for (const panel of panels) {
    console.log(`Checking panel: ${panel}`);
    await page.goto(`${baseURL}${panel}`, { waitUntil: 'commit' });
    await page.locator('.page-heading').waitFor({ state: 'visible', timeout: 30000 });
    console.log(`Panel ${panel} rendered successfully!`);
  }

  console.log('ALL Phase 3 Admin tests passed successfully on live app!');
  await browser.close();
}

run().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
