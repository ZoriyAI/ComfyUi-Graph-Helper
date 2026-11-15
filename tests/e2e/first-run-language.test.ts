/**
 * E2E spec for the first-run language: a first start speaks the system's language, Russian for a Russian system and
 * English for any other. The welcome card offers the other language in one click, and the choice is kept for the next
 * start. Each test sets LANGUAGE in its own launch env, overriding playwright.config.ts.
 */
import { test, expect, _electron as electron } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

async function launch(userData: string, systemLanguage: string) {
  const env = { ...process.env, NODE_ENV: 'production', LANGUAGE: systemLanguage, LANG: '' } as Record<string, string>;
  // No session bus and no keyring daemon, so Electron does not talk to the desktop's keyring during the run.
  delete env.DBUS_SESSION_BUS_ADDRESS;
  delete env.GNOME_KEYRING_CONTROL;
  const app = await electron.launch({ args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`], env });
  const window = await app.firstWindow();
  await window.locator('.app-shell').waitFor({ timeout: 30000 });
  return { app, window };
}

test('a German or English system starts in English, and the welcome card switches to Russian in one click', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'first-run-language-'));
  try {
    const first = await launch(userData, 'de:en');
    await expect(first.window.locator('html')).toHaveAttribute('lang', 'en');
    const welcome = first.window.locator('[aria-labelledby="canvas-onboard-title"]');
    await expect(welcome.getByRole('heading', { name: 'Welcome' })).toBeVisible();
    const toRussian = welcome.getByRole('button', { name: 'Interface language: English. Switch to Русский' });
    await expect(toRussian).toHaveText('Русский');
    await toRussian.click();
    await expect(first.window.locator('html')).toHaveAttribute('lang', 'ru');
    await expect(welcome.getByRole('heading', { name: 'Добро пожаловать' })).toBeVisible();
    await expect(welcome.getByRole('button', { name: 'Язык интерфейса: Русский. Переключить на English' })).toBeVisible();
    await first.app.close();

    // The choice is stored: the next start keeps Russian although the system still speaks German.
    const second = await launch(userData, 'de:en');
    await expect(second.window.locator('html')).toHaveAttribute('lang', 'ru');
    await second.app.close();
  } finally {
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

test('a Russian system starts in Russian', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'first-run-language-'));
  try {
    const { app, window } = await launch(userData, 'ru');
    await expect(window.locator('html')).toHaveAttribute('lang', 'ru');
    await expect(window.getByRole('button', { name: 'Язык интерфейса: Русский. Переключить на English' })).toHaveText('English');
    await app.close();
  } finally {
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
