/**
 * Playwright config for the end-to-end specs in tests/e2e, which start the built Electron app.
 */
import { defineConfig } from '@playwright/test';

/**
 * A fresh profile starts in the system's language (src/main/systemLanguage.ts). The specs were written for a Russian
 * first start, so the app under test is told the system speaks Russian unless a run asks otherwise
 * (E2E_SYSTEM_LANGUAGE=en). A spec that tests the first-run language sets LANGUAGE in its own launch env.
 */
process.env.LANGUAGE = process.env.E2E_SYSTEM_LANGUAGE ?? 'ru';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120000,
  use: {
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/e2e-tests.json' }],
  ],
});
