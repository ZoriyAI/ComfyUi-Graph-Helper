import { expect, type Page } from '@playwright/test';

/**
 * Clicks Export and, when the export guard lists check findings, confirms "Export anyway".
 * With `guard: true` the guard must show (the graph is known to have findings); otherwise it is confirmed when
 * it shows. Resolves once the export toast shows.
 */
export async function exportPastGuard(window: Page, options: { guard?: boolean } = {}): Promise<void> {
  await window.getByRole('button', { name: 'Save workflow for ComfyUI…', exact: true }).click();
  const dialog = window.locator('[role="dialog"].export-guard-dialog');
  const done = window.getByText('Workflow saved for ComfyUI.');
  if (options.guard) {
    await expect(dialog).toBeVisible();
  } else {
    await expect(dialog.or(done).first()).toBeVisible();
  }
  if (await dialog.isVisible()) await dialog.getByRole('button', { name: 'Save anyway' }).click();
  await expect(done.first()).toBeVisible();
}
