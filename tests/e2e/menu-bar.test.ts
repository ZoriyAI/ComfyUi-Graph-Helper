import { test, expect, _electron as electron } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { useEnglish } from './locale';

const focusedText = (window: import('@playwright/test').Page) => window.evaluate(() => document.activeElement?.textContent?.trim() ?? '');

test('desktop menu bar: mouse, Alt and arrows, shortcuts, and the toolbar run the same commands', async () => {
  const errors: string[] = [];
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'menu-bar-'));
  const electronApp = await electron.launch({
    args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  const window = await electronApp.firstWindow();
  window.on('pageerror', (error) => errors.push(error instanceof Error ? error.message : String(error)));
  await useEnglish(window);
  await window.locator('#chat-provider').waitFor();
  await window.setViewportSize({ width: 1280, height: 800 });

  // There is one menu: Electron's default application menu is gone.
  const appMenu = await electronApp.evaluate(({ Menu }) => Menu.getApplicationMenu());
  expect(appMenu).toBeNull();

  // The import file dialog is stubbed in main and counted, so a command that reaches it is visible here.
  await electronApp.evaluate(({ dialog }) => {
    const state = globalThis as unknown as { __openDialogs: number };
    state.__openDialogs = 0;
    dialog.showOpenDialog = async () => {
      state.__openDialogs += 1;
      return { canceled: true, filePaths: [] };
    };
  });
  const openDialogs = () => electronApp.evaluate(() => (globalThis as unknown as { __openDialogs: number }).__openDialogs);

  const bar = window.locator('.document-bar');
  await expect(bar.getByRole('menubar', { name: 'Main menu' })).toBeVisible();
  const height = await bar.evaluate((element) => Math.round(element.getBoundingClientRect().height));
  expect(height).toBe(32);

  // Mouse: File opens, Import is there with its shortcut, Escape closes.
  await bar.getByRole('menuitem', { name: 'File', exact: true }).click();
  const menu = window.getByRole('menu');
  await expect(menu).toBeVisible();
  const importItem = menu.getByRole('menuitem', { name: 'Import', exact: true });
  await expect(importItem).toBeVisible();
  await expect(importItem).toContainText('Ctrl+I');
  await expect(menu.getByRole('menuitem', { name: 'Save project', exact: true })).toContainText('Ctrl+S');
  await window.keyboard.press('Escape');
  await expect(window.getByRole('menu')).toHaveCount(0);

  // Choosing an item runs the command: File ▸ Settings… opens the settings dialog with focus inside it.
  await bar.getByRole('menuitem', { name: 'File', exact: true }).click();
  await window.getByRole('menu').getByRole('menuitem', { name: 'Settings…' }).click();
  const settings = window.locator('[role="dialog"].settings-dialog');
  await expect(settings).toHaveAttribute('data-state', 'open');
  await expect.poll(() => window.evaluate(() => Boolean(document.activeElement?.closest('.settings-dialog')))).toBe(true);
  await window.keyboard.press('Escape');
  await expect(settings).toHaveCount(0);

  // Keyboard: Alt focuses the menu bar, arrows move between menus, ArrowDown opens one, Escape closes it.
  await window.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
  await window.keyboard.press('Alt');
  await expect.poll(() => focusedText(window)).toBe('File');
  await window.keyboard.press('ArrowRight');
  await expect.poll(() => focusedText(window)).toBe('Edit');
  await window.keyboard.press('ArrowRight');
  await expect.poll(() => focusedText(window)).toBe('View');
  await window.keyboard.press('ArrowLeft');
  await expect.poll(() => focusedText(window)).toBe('Edit');
  await window.keyboard.press('ArrowDown');
  await expect(window.getByRole('menu')).toBeVisible();
  await expect(window.getByRole('menu').getByRole('menuitem', { name: 'Undo' })).toHaveAttribute('data-disabled', '');
  await window.keyboard.press('ArrowRight');
  await expect(window.getByRole('menu').getByRole('menuitem', { name: 'Fit to view' })).toBeVisible();
  await window.keyboard.press('Escape');
  await expect(window.getByRole('menu')).toHaveCount(0);
  // Escape leaves focus on the menu title (as a desktop menu bar does); Alt then gives it back.
  await expect.poll(() => focusedText(window)).toBe('View');
  await window.keyboard.press('Alt');
  await expect.poll(() => window.evaluate(() => Boolean(document.activeElement?.closest('[role="menubar"]')))).toBe(false);
  await window.keyboard.press('F10');
  await expect.poll(() => focusedText(window)).toBe('File');
  await window.keyboard.press('F10');

  // Ctrl+I runs File ▸ Import: the import file dialog opens (stubbed above).
  await window.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
  const before = await openDialogs();
  await window.keyboard.press('Control+i');
  await expect.poll(openDialogs).toBe(before + 1);
  // The same shortcut typed in a text field stays with the field.
  await window.getByRole('tab', { name: 'Assistant' }).click();
  await window.getByRole('textbox', { name: 'Chat message' }).focus();
  await window.keyboard.press('Control+i');
  await window.waitForTimeout(300);
  expect(await openDialogs()).toBe(before + 1);

  // F1 opens the shortcuts dialog, which lists Ctrl+S.
  await window.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
  await window.keyboard.press('F1');
  const shortcuts = window.locator('[role="dialog"].shortcuts-dialog');
  await expect(shortcuts).toBeVisible();
  await expect(shortcuts.getByRole('heading', { name: 'Keyboard shortcuts' })).toBeVisible();
  const saveRow = shortcuts.locator('div').filter({ hasText: /^Save project/ }).first();
  await expect(saveRow).toContainText('Ctrl+S');
  await window.keyboard.press('Escape');
  await expect(shortcuts).toHaveCount(0);

  // The toolbar runs the same command; its icon button is named by the command label.
  const toolbar = window.locator('.workspace-toolbar');
  const toolbarHeight = await toolbar.evaluate((element) => Math.round(element.getBoundingClientRect().height));
  expect(toolbarHeight).toBe(36);
  const importButton = toolbar.getByRole('button', { name: 'Import', exact: true });
  await expect(importButton).toBeVisible();
  await importButton.click();
  await expect.poll(openDialogs).toBe(before + 2);

  // View ▸ Tools panel is a check item that agrees with the dock header's "Hide tools".
  await window.getByRole('button', { name: 'Hide tools' }).click();
  await bar.getByRole('menuitem', { name: 'View', exact: true }).click();
  await expect(window.getByRole('menuitemcheckbox', { name: 'Tools panel' })).toHaveAttribute('aria-checked', 'false');
  await window.getByRole('menuitemcheckbox', { name: 'Tools panel' }).click();
  await expect(window.locator('#tool-dock')).toBeVisible();

  expect(errors).toEqual([]);
  await electronApp.close();
});
