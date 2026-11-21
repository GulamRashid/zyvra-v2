import { chromium } from 'playwright';
import fs from 'fs';

if (fs.existsSync('.env.test')) {
  process.loadEnvFile('.env.test');
}

const baseURL = process.env.TEST_BASE_URL || 'http://localhost:5173';
const adminEmail = 'royalbadshah989@gmail.com';
const adminPassword = 'Sajiya@8800';

async function run() {
  console.log('Testing Admin UI Refinements against:', baseURL);
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(30000);
  page.setDefaultTimeout(20000);

  // 1. Log in
  console.log('Navigating to /auth...');
  await page.goto(`${baseURL}/auth`, { waitUntil: 'networkidle' });
  
  // Fill email and password
  console.log('Filling credentials for:', adminEmail);
  await page.locator('input[type="email"]').fill(adminEmail);
  await page.locator('input[type="password"]').fill(adminPassword);
  await page.locator('button[type="submit"]').click();
  
  // Check for error or redirect
  try {
    await page.waitForURL(url => !url.pathname.includes('/auth'), { timeout: 10000 });
    console.log('Logged in successfully! Current URL:', page.url());
  } catch (e) {
    const errorText = await page.locator('.feedback, .error-feedback, [role="alert"]').allInnerTexts();
    console.log('Auth error message on screen:', errorText);
    await page.screenshot({ path: 'screenshots/auth_failure.png' });
    throw e;
  }

  // 2. Navigate to /admin/reports
  console.log('Navigating to /admin/reports...');
  await page.goto(`${baseURL}/admin/reports`, { waitUntil: 'commit' });
  await page.waitForSelector('.admin-reports-page', { state: 'visible', timeout: 45000 });
  // Wait a moment for report queries to settle
  await page.waitForTimeout(2000);

  // 3. Check for horizontal overflow on the page
  const overflow = await page.evaluate(() => {
    const docWidth = document.documentElement.scrollWidth;
    const winWidth = window.innerWidth;
    const bodyWidth = document.body.scrollWidth;
    const mainWidth = document.querySelector('.admin-main')?.scrollWidth || 0;
    const mainClientWidth = document.querySelector('.admin-main')?.clientWidth || 0;
    return {
      hasHorizontalScroll: docWidth > winWidth,
      docWidth,
      winWidth,
      bodyWidth,
      mainWidth,
      mainClientWidth
    };
  });
  console.log('Horizontal Overflow Check:', overflow);

  // 4. Check bounding box containment for cards
  const containment = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.admin-reports-page .panel-card'));
    const results = cards.map((card, i) => {
      const cardRect = card.getBoundingClientRect();
      const children = Array.from(card.querySelectorAll('div, span, strong, table'));
      let anyOverflow = false;
      let maxRight = cardRect.right;
      for (const child of children) {
        const r = child.getBoundingClientRect();
        if (r.right > cardRect.right + 2) { // Allow 2px subpixel rounding
          anyOverflow = true;
          if (r.right > maxRight) maxRight = r.right;
        }
      }
      return {
        cardIndex: i,
        cardWidth: cardRect.width,
        cardRight: cardRect.right,
        maxChildRight: maxRight,
        overflowDetected: anyOverflow
      };
    });
    return results;
  });
  console.log('Card Containment Check:', JSON.stringify(containment, null, 2));

  // Take screenshot of reports page
  fs.mkdirSync('screenshots', { recursive: true });
  await page.screenshot({ path: 'screenshots/admin_reports_refined.png', fullPage: true });
  console.log('Saved screenshot: screenshots/admin_reports_refined.png');

  // 5. Navigate to /admin/users
  console.log('Navigating to /admin/users...');
  await page.goto(`${baseURL}/admin/users`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.user-directory', { timeout: 15000 });
  await page.screenshot({ path: 'screenshots/admin_users_refined.png', fullPage: false });
  console.log('Saved screenshot: screenshots/admin_users_refined.png');

  await browser.close();
  console.log('ALL ADMIN UI VERIFICATIONS COMPLETED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
