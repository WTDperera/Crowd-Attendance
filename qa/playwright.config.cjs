const { defineConfig } = require('@playwright/test');
const { getQaConfig } = require('../web_app/admin-portal/server/qaConfig');
if (!getQaConfig()) throw new Error('Run Playwright using the guarded QA launcher');
module.exports = defineConfig({
  testDir: './browser', testMatch: '**/*.spec.cjs', workers: 1, retries: 0,
  timeout: 120000, expect: { timeout: 15000 },
  outputDir: './artifacts/p09/browser',
  snapshotPathTemplate: '{testDir}/baselines/{arg}-{platform}{ext}',
  reporter: [['list']],
  use: {
    browserName: 'chromium', baseURL: 'http://127.0.0.1:5173', headless: true,
    viewport: { width: 1280, height: 900 }, locale: 'en-GB', timezoneId: 'Asia/Colombo',
    screenshot: 'only-on-failure', trace: 'retain-on-failure',
  },
});
