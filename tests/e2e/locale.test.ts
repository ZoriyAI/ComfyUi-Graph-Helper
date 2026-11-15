/**
 * E2E spec for the interface language: a new profile on a Russian system starts in Russian (the first start follows
 * the system's language, docs/wiki/start/First-Hour.md), English chosen in Preferences persists through a reopen, and no visible text, label, tooltip or placeholder shows a raw translation key or a phrase of the
 * other language (checked against the i18n catalog). A person should never meet half-translated screens.
 */
import { test, expect, _electron as electron, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { catalogLeaves, en, ru, type Catalog } from '../../src/shared/i18n';
import { denseWorkflow } from './fixtures/denseWorkflow';

// Texts that are the same in both catalogs on purpose, so seeing them is not a sign of the other language.
const ALLOWED_COPY = new Set([
  '{{app}}',
  'English',
  'OpenAI',
  // Provider brand names: the Preferences window shows them on the provider cards in both languages.
  'Anthropic',
  'Google Gemini',
  'TEST',
  'Русский',
  // Product names read the same in every language; they are not untranslated copy.
  'ComfyUI', 'MCP', 'Ollama', 'OpenAI', 'Anthropic', 'Google',
]);

function leaf(catalog: Catalog, key: string): string {
  const value = key.split('.').reduce<unknown>((current, part) => {
    if (current == null || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[part];
  }, catalog);
  return typeof value === 'string' ? value : '';
}

/** Phrases of the other language's catalog that differ from this language (placeholders split out, 2+ letters). */
function foreignPhrases(active: 'en' | 'ru'): string[] {
  const own = active === 'en' ? en : ru;
  const other = active === 'en' ? ru : en;
  const phrases = new Set<string>();
  for (const key of catalogLeaves(en)) {
    const foreign = leaf(other, key);
    const local = leaf(own, key);
    if (!foreign || foreign === local || ALLOWED_COPY.has(foreign)) continue;
    for (const part of foreign.split(/\{\{[^}]+\}\}/g)) {
      const segment = part.trim();
      const letters = segment.match(/\p{L}/gu)?.length ?? 0;
      if (letters >= 2 && !ALLOWED_COPY.has(segment)) phrases.add(segment);
    }
  }
  return [...phrases];
}

/** A one-word phrase must match as a whole word; a longer phrase as a substring. */
function phraseAppears(haystack: string, phrase: string): boolean {
  if (/^[\p{L}\p{N}]+$/u.test(phrase)) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'u').test(haystack);
  }
  return haystack.includes(phrase);
}

function unexpectedCopy(text: string, language: 'en' | 'ru'): string[] {
  const hits: string[] = [];
  for (const key of catalogLeaves(en)) {
    if (text.includes(key)) hits.push(`raw key ${key}`);
  }
  // Command-line flags (vLLM's --api-key) are written the same in every language; their parts are not English copy.
  const prose = text.replace(/(?<!\S)--[A-Za-z][\w-]*/g, ' ');
  for (const phrase of foreignPhrases(language)) {
    if (phraseAppears(prose, phrase)) hits.push(phrase);
  }
  return hits;
}

/** Every visible text of the page plus aria-label, title, placeholder and aria-description of visible elements. */
async function collectSurface(window: Page): Promise<string> {
  return window.locator('body').evaluate((root) => {
    const shown = (element: Element) => {
      if (!(element instanceof HTMLElement)) return false;
      if (element.closest('[hidden]')) return false;
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      return element.getClientRects().length > 0;
    };
    const parts: string[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const parent = node.parentElement;
      const text = node.textContent?.replace(/\s+/g, ' ').trim();
      if (parent && text && shown(parent)) parts.push(text);
      node = walker.nextNode();
    }
    root.querySelectorAll<HTMLElement>('*').forEach((element) => {
      if (!shown(element)) return;
      for (const name of ['aria-label', 'title', 'placeholder', 'aria-description']) {
        const value = element.getAttribute(name)?.replace(/\s+/g, ' ').trim();
        if (value) parts.push(value);
      }
    });
    return parts.join('\n');
  });
}

async function assertChromeLanguage(window: Page, language: 'en' | 'ru') {
  const text = await collectSurface(window);
  expect(unexpectedCopy(text, language), `${language} chrome`).toEqual([]);
}

async function expectLocalizedChrome(window: Page, language: 'en' | 'ru') {
  const copy = language === 'ru'
    ? {
      settings: 'Настройки',
      inspector: 'Свойства',
      assistant: 'Помощник',
      tabs: ['Подключение', 'Помощник', 'Оформление и анимация'],
      model: 'Модель',
      localProvider: 'Свой сервер',
      discard: 'Закрыть без сохранения',
    }
    : {
      settings: 'Settings',
      inspector: 'Properties',
      assistant: 'Assistant',
      tabs: ['Connection', 'Assistant', 'Appearance & Motion'],
      model: 'Model',
      localProvider: 'Your own server',
      discard: 'Close without saving',
    };
  await window.setViewportSize({ width: 1280, height: 800 });
  await assertChromeLanguage(window, language);
  await window.getByRole('tab', { name: copy.assistant, exact: true }).click();
  await assertChromeLanguage(window, language);
  await window.getByRole('tab', { name: copy.inspector, exact: true }).click();
  await assertChromeLanguage(window, language);
  await window.getByRole('button', { name: copy.settings, exact: true }).click();
  const dialog = window.locator('[role="dialog"].settings-dialog');
  await expect(dialog).toHaveAttribute('data-state', 'open');
  for (const tab of copy.tabs) {
    await dialog.getByRole('tab', { name: tab, exact: true }).click();
    await assertChromeLanguage(window, language);
  }
  await dialog.getByRole('tab', { name: copy.tabs[1], exact: true }).click();
  // The model field appears once a helper is chosen.
  await dialog.getByRole('radio', { name: copy.localProvider, exact: true }).click();
  const model = dialog.getByRole('textbox', { name: copy.model, exact: true });
  await model.fill('sk-example-secret');
  await assertChromeLanguage(window, language);
  await model.fill('');
  await window.keyboard.press('Escape');
  // The draft changed (a helper was chosen): Escape asks before throwing it away.
  const discard = window.locator('[role="dialog"].settings-discard');
  await discard.getByRole('button', { name: copy.discard, exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

/** Starts the built app on a system that speaks Russian, whatever language the run itself was given. */
function launch(userData: string) {
  return electron.launch({
    args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`],
    env: { ...process.env, NODE_ENV: 'production', LANGUAGE: 'ru', LANG: 'ru_RU.UTF-8' },
  });
}

async function toolbarFit(window: import('@playwright/test').Page) {
  return window.locator('.workspace-toolbar').evaluate((element) => {
    const trigger = element.querySelector('#chat-provider');
    const value = trigger?.querySelector('span');
    const range = document.createRange();
    if (value) range.selectNodeContents(value);
    return {
      overflow: element.scrollWidth - element.clientWidth,
      height: Math.round(element.getBoundingClientRect().height),
      lines: value ? range.getClientRects().length : 0,
      label: value?.textContent ?? '',
    };
  });
}

test('Russian is the new-profile default on a Russian system and English persists through reopen', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'locale-'));
  const app = await launch(userData);
  const window = await app.firstWindow();
  await window.locator('.app-shell').waitFor();
  await expect(window.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(window.getByRole('button', { name: 'Настройки', exact: true })).toBeVisible();
  await expect(window.getByRole('button', { name: 'Settings', exact: true })).toHaveCount(0);
  const body = await window.locator('body').innerText();
  expect(body).not.toContain('settings.title');
  expect(body).not.toContain('toolbar.import');
  expect(body).not.toContain('Save settings');

  for (const width of [1024, 1280]) {
    await window.setViewportSize({ width, height: 800 });
    const toolbar = await toolbarFit(window);
    console.log(`LOCALE_TOOLBAR_${width} ${JSON.stringify(toolbar)}`);
    expect(toolbar.overflow).toBe(0);
    expect(toolbar.height).toBe(36);
    expect(toolbar.lines).toBe(1);
    expect(toolbar.label).toBe('Помощник: не выбран');
  }

  await expectLocalizedChrome(window, 'ru');

  await window.setViewportSize({ width: 1024, height: 800 });
  await window.getByRole('button', { name: 'Настройки', exact: true }).click();
  const dialog = window.locator('[role="dialog"].settings-dialog');
  await expect(dialog).toHaveAttribute('data-state', 'open');
  await dialog.getByRole('tab', { name: 'Оформление и анимация' }).click();
  const language = dialog.getByRole('combobox', { name: 'Язык', exact: true });
  await expect(language).toHaveAttribute('data-value', 'ru');
  const languageBox = await language.boundingBox();
  const dialogBox = await dialog.boundingBox();
  expect(languageBox).toBeTruthy();
  expect(dialogBox).toBeTruthy();
  expect(languageBox!.x).toBeGreaterThanOrEqual(dialogBox!.x);
  expect(languageBox!.x + languageBox!.width).toBeLessThanOrEqual(dialogBox!.x + dialogBox!.width + 1);
  await language.focus();
  await window.keyboard.press('Enter');
  await expect(window.getByRole('option', { name: 'English', exact: true })).toBeVisible();
  await expect(window.getByRole('option', { name: 'Русский', exact: true })).toBeVisible();
  await window.keyboard.press('Escape');
  await expect(dialog).toHaveAttribute('data-state', 'open');
  await expect(window.getByRole('option', { name: 'English', exact: true })).toHaveCount(0);

  await language.click();
  await window.getByRole('option', { name: 'English', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(window.locator('html')).toHaveAttribute('lang', 'en');
  await window.keyboard.press('Escape');
  // The previewed language is a change: Escape asks before discarding it, and the language returns.
  await window.locator('[role="dialog"].settings-discard').getByRole('button', { name: 'Close without saving', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(window.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(window.getByRole('button', { name: 'Настройки', exact: true })).toBeVisible();

  await window.getByRole('button', { name: 'Настройки', exact: true }).click();
  await dialog.getByRole('tab', { name: 'Помощник' }).click();
  // The model field appears once an assistant is chosen.
  await dialog.getByRole('radio', { name: 'Свой сервер', exact: true }).click();
  await dialog.getByRole('textbox', { name: 'Модель', exact: true }).fill('sk-example-secret');
  await expect(dialog.getByText('В настройки нельзя записать ключ или пароль. Уберите его из поля.')).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Модель', exact: true })).toHaveAttribute('aria-invalid', 'true');
  await dialog.getByRole('textbox', { name: 'Модель', exact: true }).fill('');
  await dialog.getByRole('radio', { name: 'Не выбран', exact: true }).click();
  await dialog.getByRole('tab', { name: 'Оформление и анимация' }).click();
  await window.setViewportSize({ width: 1280, height: 800 });
  const wideLanguage = dialog.getByRole('combobox', { name: 'Язык', exact: true });
  await expect(wideLanguage).toBeVisible();
  const wideBox = await wideLanguage.boundingBox();
  expect(wideBox && wideBox.width).toBeGreaterThan(120);

  const current = await window.evaluate(async () => {
    const bridge = (window as unknown as { electronAPI: { readProjection: (id: string) => Promise<{ currentRevisionId: string }> } }).electronAPI;
    return bridge.readProjection('desktop');
  });
  const imported = await window.evaluate(async (payload) => {
    const bridge = (window as unknown as { electronAPI: { commitCommand: (input: unknown) => Promise<{ status: string }> } }).electronAPI;
    return bridge.commitCommand(payload);
  }, {
    projectId: 'desktop',
    actionId: 'locale-graph',
    expectedRevisionId: current.currentRevisionId,
    actor: 'manual',
    runId: null,
    payload: { type: 'import-workflow', document: denseWorkflow },
  });
  expect(imported.status).toBe('applied');
  await window.reload();
  await window.locator('.app-shell').waitFor();
  await expect(window.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(window.locator('.react-flow__node')).toHaveCount(12);
  await window.locator('.react-flow__node').first().click();
  await expect.poll(async () => window.locator('.graph-node.is-selected').count()).toBeGreaterThanOrEqual(1);
  await window.getByRole('button', { name: 'Настройки', exact: true }).click();
  await expect(dialog).toHaveAttribute('data-state', 'open');
  await window.keyboard.press('Backspace');
  const started = Date.now();
  await expect.poll(async () => {
    const count = await window.locator('.react-flow__node').count();
    const selected = await window.locator('.graph-node.is-selected').count();
    if (count !== 12 || selected < 1) return `count=${count} selected=${selected}`;
    return Date.now() - started >= 1500 ? 'kept' : 'pending';
  }).toBe('kept');
  await window.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await window.locator('.react-flow__node').first().focus();
  await window.keyboard.press('Backspace');
  await expect.poll(async () => window.locator('.react-flow__node').count()).toBe(11);

  await window.getByRole('button', { name: 'Настройки', exact: true }).click();
  await dialog.getByRole('tab', { name: 'Оформление и анимация' }).click();
  await dialog.getByRole('combobox', { name: 'Язык', exact: true }).click();
  await window.getByRole('option', { name: 'English', exact: true }).click();
  await dialog.getByRole('button', { name: 'Save settings' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(window.locator('html')).toHaveAttribute('lang', 'en');
  await window.getByRole('tab', { name: 'Assistant' }).click();
  await expect(window.getByRole('textbox', { name: 'Chat message' })).toBeVisible();
  await app.close();

  const reopened = await launch(userData);
  const again = await reopened.firstWindow();
  await again.locator('.app-shell').waitFor();
  await expect(again.locator('html')).toHaveAttribute('lang', 'en');
  await expect(again.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
  await expectLocalizedChrome(again, 'en');
  await again.getByRole('button', { name: 'Settings', exact: true }).click();
  const restored = again.locator('[role="dialog"].settings-dialog');
  await restored.getByRole('tab', { name: 'Appearance & Motion' }).click();
  await restored.getByRole('combobox', { name: 'Language', exact: true }).click();
  await again.getByRole('option', { name: 'Русский', exact: true }).click();
  await restored.getByRole('button', { name: 'Сохранить настройки' }).click();
  await expect(restored).toHaveCount(0);
  await expect(again.locator('html')).toHaveAttribute('lang', 'ru');
  await reopened.close();

  const russianAgain = await launch(userData);
  const finalWindow = await russianAgain.firstWindow();
  await finalWindow.locator('.app-shell').waitFor();
  await expect(finalWindow.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(finalWindow.getByRole('button', { name: 'Настройки', exact: true })).toBeVisible();
  await expect(finalWindow.locator('.workspace-toolbar')).toHaveAttribute('aria-label', 'Рабочая область');
  await russianAgain.close();
});
