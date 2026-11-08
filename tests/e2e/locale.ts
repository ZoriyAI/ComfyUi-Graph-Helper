import { expect, type Page } from '@playwright/test';

export async function useEnglish(window: Page) {
  await window.locator('.app-shell').waitFor({ timeout: 20000 });
  if ((await window.locator('html').getAttribute('lang')) === 'en') return;
  const saved = await window.evaluate(async () => {
    const api = (window as unknown as {
      electronAPI: {
        getSettings: () => Promise<{ values?: Record<string, unknown> }>;
        saveSettings: (input: unknown) => Promise<{ ok: boolean; error?: string }>;
      };
    }).electronAPI;
    const read = await api.getSettings();
    return api.saveSettings({ ...(read.values ?? {}), language: 'en' });
  });
  if (!saved.ok) throw new Error(saved.error || 'English locale could not be saved');
  await window.reload();
  await window.locator('.app-shell').waitFor({ timeout: 20000 });
  await expect(window.locator('html')).toHaveAttribute('lang', 'en');
}
