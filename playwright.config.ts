import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  use: {
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  reporter: 'list',
});
