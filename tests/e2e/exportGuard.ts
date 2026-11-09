import { expect, type Page } from '@playwright/test';

/**
 * Clicks Export and, when the export guard lists check findings, confirms "Export anyway".
 * Resolves once the export toast shows.
 */
export async function exportPastGuard(window: Page): Promise<void> {
  await window.getByRole('button', { name: 'Export', exact: true }).click();
  const guard = window.locator('[role="dialog"].export-guard-dialog');
  const done = window.getByText('Exported the current workflow.');
  await expect(guard.or(done).first()).toBeVisible();
  if (await guard.isVisible()) await guard.getByRole('button', { name: 'Export anyway' }).click();
  await expect(done).toBeVisible();
}
