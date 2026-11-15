/**
 * Shared e2e step: save the workflow for ComfyUI and get past the export guard dialog.
 * Used by first-run-sync, prerelease-journey, workflow-import-export and node-fields. The guard only shows when the
 * check has findings, so specs that do not care about it call this instead of repeating the branch.
 * After the save the app opens the "Run it in ComfyUI" card (docs/wiki/graph/Running-In-ComfyUI.md); the step closes
 * it, so the spec goes on with the window as it was. journey-files tests the card itself.
 */
import { expect, type Page } from '@playwright/test';
import { createTranslator } from '../../src/shared/i18n';

const EN = createTranslator('en');

/**
 * Clicks Export and, when the export guard lists check findings, confirms "Export anyway".
 * With `guard: true` the guard must show (the graph is known to have findings); otherwise it is confirmed when
 * it shows. Resolves once the export toast shows and the run card, which opens with it unless the profile turned it
 * off, is closed again.
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
  // The toast and the run card come from the same step of the save (renderer/commands/actions.ts), so the card is on
  // screen by the time the toast is, or not at all.
  const runCard = window.locator('[role="dialog"].journey-run-dialog');
  if (await runCard.isVisible()) {
    await runCard.getByRole('button', { name: EN('journey.run.done'), exact: true }).click();
    await expect(runCard).toHaveCount(0);
  }
}
