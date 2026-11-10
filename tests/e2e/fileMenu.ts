import type { Page } from '@playwright/test';

/**
 * Runs an item of the File menu by its name. For actions that live only in the menu, such as
 * "Load node list from file…", which is a fallback and has no toolbar button.
 */
export async function runFileMenu(window: Page, name: string) {
  await window.locator('.document-bar').getByRole('menuitem', { name: 'File', exact: true }).click();
  await window.getByRole('menu').getByRole('menuitem', { name, exact: true }).click();
}

/** File ▸ Load node list from file… (the object_info fallback). */
export function loadNodeList(window: Page) {
  return runFileMenu(window, 'Load node list from file…');
}
