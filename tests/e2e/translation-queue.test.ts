/** Checks translation progress and pause recovery in an isolated Electron profile. */
import { test, expect } from '@playwright/test';
import { launchApp, temporaryProfile, removeProfile, type LaunchedApp } from './support/app';

test('translation queue can be paused from the Russian UI, restored after restart and resumed', async () => {
  const profile = temporaryProfile('nodewise-translation-controls-'); let current: LaunchedApp | undefined;
  const open = async () => {
    current = await launchApp({ userData: profile, viewport: { width: 1440, height: 1000 }, env: { LANGUAGE: 'ru' } });
    const page = current.page;
    await page.locator('.document-bar').getByRole('menuitem', { name: 'Файл', exact: true }).click();
    await page.getByRole('menu').getByRole('menuitem', { name: 'Настройки…', exact: true }).click();
    await page.locator('.settings-dialog').getByRole('tab', { name: 'Синхронизация', exact: true }).click();
    return page;
  };
  try {
    let page = await open(); let queue = page.locator('[data-translation-queue]');
    await expect(queue).toContainText('Выберите или возобновите помощника');
    await queue.getByRole('button', { name: 'Приостановить перевод', exact: true }).click();
    await expect(queue).toContainText('Перевод на паузе');
    expect(current!.pageErrors).toEqual([]); await current!.close();
    page = await open(); queue = page.locator('[data-translation-queue]');
    await expect(queue).toContainText('Перевод на паузе');
    await queue.getByRole('button', { name: 'Продолжить перевод', exact: true }).click();
    await expect(queue).toContainText('Выберите или возобновите помощника');
    expect((await page.evaluate(() => window.electronAPI.modelTranslationStatus())).state).toBe('unavailable');
    expect(current!.pageErrors).toEqual([]);
  } finally { await current?.close(); removeProfile(profile); }
});
