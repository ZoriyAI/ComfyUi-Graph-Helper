import type { Locator, Page } from '@playwright/test';

export async function pickOption(page: Page, name: string, option: string, scope?: Locator) {
  const root = scope ?? page;
  await root.getByRole('combobox', { name, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}
