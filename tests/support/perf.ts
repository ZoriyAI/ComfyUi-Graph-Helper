/**
 * Time budget helper for unit tests that measure speed (largeCatalog.test.ts).
 * It keeps a slow machine from failing the normal run while still letting a perf run enforce the budget.
 */
import { expect } from 'vitest';

/**
 * Time budgets are a benchmark, not a correctness check: a busy machine (CI, a laptop running a build) makes any
 * fixed limit fail now and then. `npm test` therefore only records the time; `npm run test:perf` (PERF_BUDGETS=1)
 * also holds the code to the budget.
 */
export const PERF_BUDGETS = process.env.PERF_BUDGETS === '1';

/** Fails only when PERF_BUDGETS is on and `elapsedMs` is at or over `budgetMs`; the label names the step. */
export function expectWithinBudget(label: string, elapsedMs: number, budgetMs: number): void {
  if (!PERF_BUDGETS) return;
  expect(elapsedMs, `${label}: ${elapsedMs.toFixed(0)} ms, budget ${budgetMs} ms`).toBeLessThan(budgetMs);
}
