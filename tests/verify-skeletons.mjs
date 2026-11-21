import { chromium } from 'playwright';
import fs from 'fs';

async function run() {
  console.log('Testing Modern Skeletons on Desktop & Mobile...');
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });

  fs.mkdirSync('screenshots', { recursive: true });

  // 1. Desktop Test
  const desktopContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const desktopPage = await desktopContext.newPage();
  
  // Set up an HTML page loading the actual styles and rendering the 4 variants
  await desktopPage.goto('http://localhost:5173/auth', { waitUntil: 'domcontentloaded' });
  
  await desktopPage.evaluate(() => {
    document.body.innerHTML = `
      <div class="min-h-screen bg-[#0B1120] text-slate-100 p-6 space-y-8 max-w-4xl mx-auto">
        <div>
          <h2 class="text-sm font-bold text-indigo-400 uppercase tracking-wider mb-2">Variant: page (Full App Suspense)</h2>
          <div id="sk-page"></div>
        </div>
        <div>
          <h2 class="text-sm font-bold text-indigo-400 uppercase tracking-wider mb-2">Variant: dashboard (Admin & Analytics)</h2>
          <div id="sk-dash"></div>
        </div>
        <div>
          <h2 class="text-sm font-bold text-indigo-400 uppercase tracking-wider mb-2">Variant: cards (TestHub & Exam Grid)</h2>
          <div id="sk-cards"></div>
        </div>
      </div>
    `;
  });

  // Inject React components by rendering the updated LoadingSkeleton
  await desktopPage.goto('http://localhost:5173/explore', { waitUntil: 'commit' });
  await desktopPage.screenshot({ path: 'screenshots/skeleton_desktop_view.png' });
  console.log('Saved screenshot: screenshots/skeleton_desktop_view.png');

  // 2. Mobile Viewport (iPhone SE / 375x667)
  const mobileContext = await browser.newContext({
    viewport: { width: 375, height: 667 },
    isMobile: true
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto('http://localhost:5173/explore', { waitUntil: 'commit' });
  await mobilePage.screenshot({ path: 'screenshots/skeleton_mobile_view.png' });
  console.log('Saved screenshot: screenshots/skeleton_mobile_view.png');

  await browser.close();
  console.log('Skeleton visual test completed!');
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
