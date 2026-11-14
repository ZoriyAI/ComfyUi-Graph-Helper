import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createTranslator } from '../../src/shared/i18n';
import { useEnglish } from './locale';

const RU = createTranslator('ru');
const EN = createTranslator('en');
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8')) as { version: string };

async function launch(): Promise<{ app: ElectronApplication; window: Page; userData: string; errors: string[] }> {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'about-help-'));
  const app = await electron.launch({
    args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  const window = await app.firstWindow();
  const errors: string[] = [];
  window.on('pageerror', (error) => errors.push(error.message));
  await window.locator('.app-shell').waitFor({ timeout: 30000 });
  return { app, window, userData, errors };
}

async function helpItem(window: Page, menu: string, item: string): Promise<void> {
  await window.locator('.document-bar').getByRole('menuitem', { name: menu, exact: true }).click();
  await window.getByRole('menu').getByRole('menuitem', { name: item }).click();
}

test('Help ▸ About: icon, name, version, licence, components, copy details, data folder', async () => {
  const { app, window, userData, errors } = await launch();
  try {
    await app.evaluate(({ shell }) => {
      const state = globalThis as unknown as { __opened: string[] };
      state.__opened = [];
      shell.openPath = async (target: string) => {
        state.__opened.push(target);
        return '';
      };
    });
    // About stays the last item of Help (the layout walk opens it that way).
    await window.locator('.document-bar').getByRole('menuitem', { name: RU('menu.help'), exact: true }).click();
    await window.getByRole('menu').getByRole('menuitem').last().click();
    const dialog = window.locator('.about-dialog');
    await expect(dialog).toBeVisible();

    // The real icon has loaded, at 64 px; the name is the dialog's title; the version is the package's.
    const icon = dialog.locator('img').first();
    await expect.poll(() => icon.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth)).toBeGreaterThan(0);
    expect(await icon.evaluate((image: HTMLImageElement) => image.getBoundingClientRect().width)).toBe(64);
    await expect(dialog.getByRole('heading', { name: 'Graph Helper for ComfyUI' })).toBeVisible();
    await expect(dialog.locator('[data-about-version]')).toHaveText(RU('appInfo.version', { version: pkg.version }));

    // Details: runtime, system and the data folder, folded until asked for.
    await expect(dialog.getByText(RU('appInfo.dataFolder', { path: userData }))).toBeHidden();
    await dialog.getByText(RU('appInfo.details'), { exact: true }).click();
    await expect(dialog.getByText(RU('appInfo.dataFolder', { path: userData }))).toBeVisible();
    await expect(dialog.getByText(/^Среда: Electron /)).toBeVisible();

    // Licence: the app's MIT text.
    await dialog.getByRole('button', { name: RU('appInfo.licence'), exact: true }).click();
    await expect(dialog.locator('[data-about-view="licence"] pre')).toContainText('Copyright (c) 2026 ZoriyAI');
    await dialog.getByRole('button', { name: RU('appInfo.back') }).click();

    // Third-party components: the list built at build time, React Flow credited, a licence text opens.
    await dialog.getByRole('button', { name: RU('appInfo.components'), exact: true }).click();
    const list = dialog.locator('[data-about-components]');
    await expect(list.locator('li').first()).toBeVisible();
    expect(await list.locator('li').count()).toBeGreaterThan(50);
    await expect(dialog.getByText(RU('appInfo.canvasCredit'), { exact: false })).toBeVisible();
    const flow = list.locator('li', { hasText: '@xyflow/react' });
    await flow.locator('summary').click();
    await expect(flow.locator('pre')).toContainText('MIT');
    await expect(list.locator('li', { hasText: '@fontsource/geist' })).toContainText('OFL-1.1');
    await expect(list.locator('li', { hasText: /^electron/ }).first()).toBeVisible();
    // Nothing in the list sticks out of the dialog sideways.
    const overflow = await list.evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await dialog.getByRole('button', { name: RU('appInfo.back') }).click();

    // Copy details: version, runtime and system for a bug report.
    await dialog.getByRole('button', { name: RU('appInfo.copyInfo') }).click();
    await expect(window.getByText(RU('appInfo.copied'))).toBeVisible();
    const clipboard = await app.evaluate(({ clipboard }) => clipboard.readText());
    expect(clipboard).toContain(`Graph Helper for ComfyUI ${pkg.version}`);
    expect(clipboard).toMatch(/Electron \d+/);
    expect(clipboard).toMatch(/Chromium \d+/);

    // Open data folder reaches shell.openPath with the profile folder (stubbed).
    await dialog.getByRole('button', { name: RU('appInfo.openData') }).click();
    await expect.poll(() => app.evaluate(() => (globalThis as unknown as { __opened: string[] }).__opened)).toEqual([userData]);

    await dialog.getByRole('button', { name: RU('menu.close') }).click();
    await expect(dialog).toBeHidden();

    // Settings ▸ About shows the same view.
    await window.keyboard.press('Control+Comma');
    await window.getByRole('tab', { name: RU('preferences.nav.about') }).click();
    const section = window.locator('[role="tabpanel"]:visible [data-about-view="main"]');
    await expect(section).toBeVisible();
    await expect(section.locator('[data-about-version]')).toHaveText(RU('appInfo.version', { version: pkg.version }));
    await expect(section.getByRole('button', { name: RU('appInfo.components'), exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});

test('Help ▸ User guide, Troubleshooting, What is new open the bundled pages in both languages', async () => {
  const { app, window, errors } = await launch();
  try {
    const reader = window.locator('.help-reader-dialog');

    await helpItem(window, RU('menu.help'), RU('helpReader.guide'));
    await expect(reader).toBeVisible();
    await expect(reader.getByRole('heading', { name: RU('helpReader.guide') }).first()).toBeVisible();
    await expect(reader.getByRole('heading', { name: 'Где лежат данные' })).toBeVisible();
    await expect(reader.getByText('sudo apt install ./comfyui-graph-builder_*.deb').first()).toBeVisible();
    // A long page scrolls inside the reader; the window itself does not grow past the screen.
    const body = reader.locator('div[tabindex="0"]');
    expect(await body.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
    const box = await reader.boundingBox();
    const viewport = await window.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
    expect(box && box.y >= 0 && box.y + box.height <= viewport.height + 1).toBe(true);
    await window.keyboard.press('Escape');
    await expect(reader).toBeHidden();

    await helpItem(window, RU('menu.help'), RU('helpReader.troubleshooting'));
    await expect(reader.getByText('После синхронизации библиотека пустая')).toBeVisible();
    await window.keyboard.press('Escape');

    await helpItem(window, RU('menu.help'), RU('helpReader.whatsNew'));
    await expect(reader).toHaveAttribute('data-help-topic', 'whatsnew');
    await expect(reader.getByText(`v${pkg.version}`).first()).toBeVisible();
    await window.keyboard.press('Escape');

    await useEnglish(window);
    await helpItem(window, EN('menu.help'), EN('helpReader.guide'));
    await expect(reader.getByRole('heading', { name: 'Where your data lives' })).toBeVisible();
    await window.keyboard.press('Escape');
    await helpItem(window, EN('menu.help'), EN('helpReader.whatsNew'));
    await expect(reader.getByText(EN('helpReader.russianOnly'))).toBeVisible();
    await window.keyboard.press('Escape');
    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});
