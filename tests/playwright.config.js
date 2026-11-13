import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// Load .env.test natively with Node 20+
const envTestPath = path.resolve(process.cwd(), '.env.test');
if (fs.existsSync(envTestPath)) {
  process.loadEnvFile(envTestPath);
} else {
  const envDefault = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envDefault)) process.loadEnvFile(envDefault);
}

const baseURL = process.env.TEST_BASE_URL || 'http://localhost:5173';

export default defineConfig({
  testDir: './',
  testMatch: /.*\.spec\.js/,
  timeout: 90000,
  expect: {
    timeout: 15000
  },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    launchOptions: {
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        }
      }
    }
  ]
});

