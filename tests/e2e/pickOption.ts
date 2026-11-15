/**
 * Shared e2e step for the app's custom select fields (a combobox that opens a list of options).
 * Used by the specs that change a setting or a node field through such a list, for example preferences,
 * graph-layout and strict-chat-to-graph.
 */
import type { Locator, Page } from '@playwright/test';

/**
 * Opens the combobox named `name` (inside `scope` when given) and clicks the option named `option`.
 * The option list is looked up on the whole page because it opens in a popup outside the field.
 */
export async function pickOption(page: Page, name: string, option: string, scope?: Locator) {
  const root = scope ?? page;
  await root.getByRole('combobox', { name, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}
