import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './offline-tests', outputDir: './offline-test-results', timeout: 90000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:5180', channel: process.platform === 'win32' ? 'msedge' : undefined, screenshot: 'only-on-failure' },
  webServer: { command: 'npm run preview -w @agritwin/web -- --host 127.0.0.1 --port 5180 --strictPort', url: 'http://127.0.0.1:5180', reuseExistingServer: false },
});
