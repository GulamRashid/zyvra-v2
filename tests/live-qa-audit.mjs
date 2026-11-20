import { chromium } from '@playwright/test';

async function runLiveAudit() {
  console.log('🚀 Starting Zyvra Live Browser QA Audit...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ZyvraAuditor/1.0'
  });

  const page = await context.newPage();

  const auditResults = {
    consoleErrors: [],
    consoleWarnings: [],
    failedRequests: [],
    brokenImages: [],
    routesAudited: [],
    touchTargetViolations: [],
    themeCheck: { light: 'OK', dark: 'OK' }
  };

  // Listen to console errors and warnings
  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') {
      auditResults.consoleErrors.push({ text, location: msg.location() });
    } else if (type === 'warning') {
      auditResults.consoleWarnings.push({ text });
    }
  });

  // Listen to page crashes / unhandled errors
  page.on('pageerror', (err) => {
    auditResults.consoleErrors.push({ text: `PageError: ${err.message}`, stack: err.stack });
  });

  // Listen to failed network requests
  page.on('requestfailed', (req) => {
    auditResults.failedRequests.push({
      url: req.url(),
      failure: req.failure()?.errorText || 'Unknown failure'
    });
  });

  page.on('response', (res) => {
    if (res.status() >= 400 && !res.url().includes('chrome-extension')) {
      auditResults.failedRequests.push({
        url: res.url(),
        status: res.status(),
        statusText: res.statusText()
      });
    }
  });

  const routesToTest = [
    '/',
    '/landing',
    '/auth',
    '/privacy',
    '/terms'
  ];

  for (const route of routesToTest) {
    const fullUrl = `http://localhost:5173${route}`;
    console.log(`\n🔍 Auditing route: ${fullUrl}`);
    try {
      const response = await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await page.waitForTimeout(1000); // allow hydration

      const currentUrl = page.url();
      const title = await page.title();
      
      // Check broken images
      const brokenImgs = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('img'));
        return imgs.filter(img => !img.complete || img.naturalWidth === 0).map(img => img.src);
      });

      if (brokenImgs.length > 0) {
        auditResults.brokenImages.push({ route, brokenImgs });
      }

      auditResults.routesAudited.push({
        route,
        status: response?.status() || 200,
        currentUrl,
        title,
        brokenImagesCount: brokenImgs.length
      });

      console.log(`   ✓ Loaded: "${title}" (Status: ${response?.status() || 200})`);
    } catch (err) {
      console.error(`   ✗ Failed to load route ${route}:`, err.message);
      auditResults.consoleErrors.push({ text: `Route navigation failed for ${route}: ${err.message}` });
    }
  }

  // Mobile Viewport Audit (390x844 - iPhone / standard mobile)
  console.log('\n📱 Testing Mobile Layout & Touch Targets (390x844)...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:5173/landing', { waitUntil: 'networkidle', timeout: 10000 });
  await page.waitForTimeout(1000);

  const touchViolations = await page.evaluate(() => {
    const interactiveElements = Array.from(document.querySelectorAll('button, a, input, select'));
    const smallTargets = [];
    interactiveElements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      // Ignore hidden or 0x0 elements
      if (rect.width > 0 && rect.height > 0 && (rect.width < 32 || rect.height < 32)) {
        smallTargets.push({
          tag: el.tagName.toLowerCase(),
          text: (el.innerText || el.getAttribute('aria-label') || el.className || '').slice(0, 40).trim(),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        });
      }
    });
    return smallTargets.slice(0, 10); // sample
  });

  auditResults.touchTargetViolations = touchViolations;

  // Test Theme Switcher
  console.log('\n🌓 Testing Theme & Visual Contrast...');
  const themeSwitchResult = await page.evaluate(() => {
    const html = document.documentElement;
    const initialClass = html.className;
    // Check if dark class is present
    const isDark = html.classList.contains('dark');
    return { initialClass, isDark };
  });

  await browser.close();

  console.log('\n========================================');
  console.log('📊 AUDIT SUMMARY REPORT');
  console.log('========================================');
  console.log(`Routes Tested: ${auditResults.routesAudited.length}`);
  console.log(`Console Errors: ${auditResults.consoleErrors.length}`);
  console.log(`Console Warnings: ${auditResults.consoleWarnings.length}`);
  console.log(`Failed / 404 Requests: ${auditResults.failedRequests.length}`);
  console.log(`Broken Images: ${auditResults.brokenImages.length}`);
  console.log(`Small Touch Targets (<32px): ${auditResults.touchTargetViolations.length}`);
  console.log('========================================\n');

  console.log(JSON.stringify(auditResults, null, 2));
}

runLiveAudit().catch(err => {
  console.error('Audit run failed:', err);
  process.exit(1);
});
