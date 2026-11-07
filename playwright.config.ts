import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120000,
  use: {
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  reporter: [
    ['list'],
    ['json', { outputFile: '/opt/cursor/artifacts/e2e-tests.json' }],
  ],
});
