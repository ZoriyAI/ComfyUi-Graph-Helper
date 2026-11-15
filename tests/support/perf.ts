import { expect } from 'vitest';

/**
 * Time budgets are a benchmark, not a correctness check: a busy machine (CI, a laptop running a build) makes any
 * fixed limit fail now and then. `npm test` therefore only records the time; `npm run test:perf` (PERF_BUDGETS=1)
 * also holds the code to the budget.
 */
export const PERF_BUDGETS = process.env.PERF_BUDGETS === '1';

export function expectWithinBudget(label: string, elapsedMs: number, budgetMs: number): void {
  if (!PERF_BUDGETS) return;
  expect(elapsedMs, `${label}: ${elapsedMs.toFixed(0)} ms, budget ${budgetMs} ms`).toBeLessThan(budgetMs);
}
