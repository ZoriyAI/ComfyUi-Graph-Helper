/**
 * Shared e2e step that switches the running app to English. Most specs read English names, while the Playwright
 * config starts the app as if the system spoke Russian (see playwright.config.ts). Used by almost every e2e spec and
 * by support/app.ts (`english: true`).
 */
import { expect, type Page } from '@playwright/test';

/**
 * Saves `language: 'en'` through the preload API and reloads the window, unless the page is already English.
 * Settings are saved whole, so the current values are read first and only the language is replaced.
 */
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
