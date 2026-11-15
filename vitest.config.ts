/**
 * Vitest config for `npm test`: the unit and integration suites under tests/, in Node. The e2e specs are left to
 * Playwright (playwright.config.ts). The JSON report in test-results/ is what CI keeps as the run's record.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // The default 5 s is a speed check in disguise: a sync against the fake servers (syncAddress) or the first import
    // of the main-process modules (logPrivacy) takes 1–3 s on a quiet machine and more than 5 s on a busy one.
    // A hang still fails, a little later.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    reporters: ['default', 'json'],
    outputFile: {
      json: 'test-results/unit-tests.json',
    },
  },
});
