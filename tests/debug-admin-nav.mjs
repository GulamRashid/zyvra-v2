import { chromium } from 'playwright';

async function debug() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err));
  page.on('requestfailed', req => console.log('REQ FAILED:', req.url(), req.failure()?.errorText));

  console.log('Navigating directly to /admin...');
  try {
    await page.goto('https://zyvra-v2.vercel.app/admin', { waitUntil: 'commit', timeout: 30000 });
    console.log('Navigation committed! Current URL:', page.url());
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 });
    console.log('DOM content loaded! Current URL:', page.url());
  } catch (e) {
    console.error('Navigation error:', e.message);
  }

  await browser.close();
}

debug().catch(console.error);

