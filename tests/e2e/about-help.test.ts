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

    // Licence: the Commons Clause condition with the MIT text, and the sentence about commercial use.
    await dialog.getByRole('button', { name: RU('appInfo.licence'), exact: true }).click();
    await expect(dialog.locator('[data-about-view="licence"] pre')).toContainText('“Commons Clause” License Condition v1.0');
    await expect(dialog.locator('[data-about-view="licence"] pre')).toContainText('Copyright (c) 2026 ZoriyAI');
    await expect(dialog.locator('[data-about-commercial]')).toContainText(RU('appInfo.commercial'));
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

    // The project links wait for the project address: greyed out in this build.
    for (const key of ['projectLinks.site', 'projectLinks.report', 'projectLinks.releases']) {
      await expect(dialog.locator('[data-about-project]').getByRole('button', { name: RU(key) })).toBeDisabled();
    }

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

test('Help opens the wiki: sections, links between pages, search, What is new, and both languages', async () => {
  const { app, window, errors } = await launch();
  try {
    const reader = window.locator('.help-reader-dialog');
    const body = reader.locator('[data-help-body]');

    // Help ▸ User guide opens the wiki's front page, in Russian here.
    await helpItem(window, RU('menu.help'), RU('helpReader.guide'));
    await expect(reader).toBeVisible();
    await expect(reader).toHaveAttribute('data-help-page', 'Home');
    await expect(reader.getByRole('navigation', { name: RU('helpReader.sections') })).toBeVisible();
    // No language link on the page: the reader follows the interface language.
    await expect(body.getByText('English', { exact: true })).toHaveCount(0);

    // A section in the tree, then a link inside a page, then Back.
    await reader.getByRole('navigation').getByRole('button', { name: 'Справочник' }).click();
    await expect(reader).toHaveAttribute('data-help-page', 'reference/README');
    await body.locator('[data-link="Glossary.ru.md"]').click();
    await expect(reader).toHaveAttribute('data-help-page', 'reference/Glossary');
    await expect(reader.getByRole('heading', { name: 'Словарь' }).first()).toBeVisible();
    await reader.getByRole('button', { name: RU('helpReader.back') }).click();
    await expect(reader).toHaveAttribute('data-help-page', 'reference/README');

    // Search finds a page by a word and opens it.
    await reader.getByRole('searchbox', { name: RU('helpReader.searchPlaceholder') }).fill('приватность');
    const results = reader.locator('[data-help-results]');
    await expect(results.getByRole('button').first()).toBeVisible();
    await results.getByRole('button', { name: /Приватность/ }).first().click();
    await expect(reader).toHaveAttribute('data-help-page', /Privacy$/);
    await reader.getByRole('searchbox').fill('qqqzzzxxx');
    await expect(reader.getByText(RU('helpReader.noResults'))).toBeVisible();
    await window.keyboard.press('Escape');
    await expect(reader).toBeHidden();

    // Help ▸ Glossary and Troubleshooting open their pages directly.
    await helpItem(window, RU('menu.help'), RU('helpReader.glossary'));
    await expect(reader).toHaveAttribute('data-help-page', 'reference/Glossary');
    await window.keyboard.press('Escape');
    await helpItem(window, RU('menu.help'), RU('helpReader.troubleshooting'));
    await expect(reader).toHaveAttribute('data-help-page', 'reference/Troubleshooting');
    await window.keyboard.press('Escape');

    // What is new: the notes of the running version, in the interface language.
    await helpItem(window, RU('menu.help'), RU('helpReader.whatsNew'));
    await expect(reader).toHaveAttribute('data-help-page', '@whats-new');
    await expect(body).toContainText('45 уроков по темам');
    await window.keyboard.press('Escape');

    // The project links wait for the project address.
    await window.locator('.document-bar').getByRole('menuitem', { name: RU('menu.help'), exact: true }).click();
    await expect(window.getByRole('menu').getByRole('menuitem', { name: RU('projectLinks.report') })).toBeDisabled();
    await window.keyboard.press('Escape');

    // The content rules, in the same words as everywhere else in the app.
    await helpItem(window, RU('menu.help'), RU('helpReader.content'));
    await expect(reader).toHaveAttribute('data-help-page', 'trust/Content-Rules');
    await expect(reader.getByText(RU('contentRules.lead'))).toBeVisible();
    await expect(reader.getByText(RU('contentRules.animals'))).toBeVisible();
    await window.keyboard.press('Escape');

    await useEnglish(window);
    await helpItem(window, EN('menu.help'), EN('helpReader.content'));
    await expect(reader.getByText(EN('contentRules.minors'))).toBeVisible();
    await expect(reader.getByText(EN('contentRules.after'))).toBeVisible();
    await window.keyboard.press('Escape');
    await helpItem(window, EN('menu.help'), EN('helpReader.guide'));
    await expect(reader).toHaveAttribute('data-help-page', 'Home');
    await expect(reader.getByRole('navigation').getByRole('button', { name: 'Reference' })).toBeVisible();
    await window.keyboard.press('Escape');
    await helpItem(window, EN('menu.help'), EN('helpReader.whatsNew'));
    await expect(body).toContainText('45 lessons grouped by topic');
    await window.keyboard.press('Escape');
    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});
