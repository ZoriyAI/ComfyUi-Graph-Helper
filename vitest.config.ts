import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    reporters: ['default', 'json'],
    outputFile: {
      json: 'test-results/unit-tests.json',
    },
  },
});
