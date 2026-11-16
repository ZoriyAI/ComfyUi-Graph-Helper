/** Complete the visible native subgraph constructor, preserving the selected boundary links. */
import { expect, type Page } from '@playwright/test';
import { createTranslator } from '../../src/shared/i18n';
export async function finishSubgraphWizard(page: Page): Promise<void> {
  const t = createTranslator((await page.locator('html').getAttribute('lang')) === 'ru' ? 'ru' : 'en');
  const dialog = page.getByRole('dialog', { name: t('subgraphWizard.title'), exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('textbox', { name: t('subgraphWizard.name'), exact: true }).fill('Reusable block');
  const upgrade = dialog.getByRole('checkbox', { name: t('subgraphWizard.upgrade'), exact: true });
  if (await upgrade.count()) await upgrade.check();
  for (let step = 0; step < 3; step++) await dialog.getByRole('button', { name: t('subgraphWizard.next'), exact: true }).click();
  await dialog.getByRole('checkbox', { name: t('subgraphWizard.enter'), exact: true }).uncheck();
  await dialog.getByRole('button', { name: t('subgraphWizard.create'), exact: true }).click();
  await expect(dialog).toBeHidden();
}
