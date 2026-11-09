import { test, expect, _electron as electron } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { useEnglish } from './locale';
import { pickOption } from './pickOption';

test('preferences window: sections, appearance, a recorded shortcut, a canvas toggle, and Cancel', async () => {
  const errors: string[] = [];
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'preferences-'));
  const app = await electron.launch({
    args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  const window = await app.firstWindow();
  window.on('pageerror', (error) => errors.push(error instanceof Error ? error.message : String(error)));
  await useEnglish(window);
  await window.setViewportSize({ width: 1280, height: 800 });
  const html = window.locator('html');
  // A CSS locator: while the modal is open the canvas is aria-hidden, and the toggle is still checked under it.
  const descriptions = window.locator('button[aria-label="Descriptions on the canvas"]');
  await expect(descriptions).toHaveAttribute('aria-pressed', 'true');
  await expect(html).toHaveAttribute('data-accent', 'cyan');

  // File ▸ Settings… opens the Preferences window.
  const bar = window.locator('.document-bar');
  await bar.getByRole('menuitem', { name: 'File', exact: true }).click();
  await window.getByRole('menu').getByRole('menuitem', { name: 'Settings…' }).click();
  const dialog = window.locator('[role="dialog"].settings-dialog');
  await expect(dialog).toHaveAttribute('data-state', 'open');
  const nav = dialog.getByRole('tablist', { name: 'Settings sections' });
  await expect(nav.getByRole('tab')).toHaveText([
    'Assistant', 'Models & keys', 'Connection', 'Sync', 'Canvas', 'Appearance & Motion', 'Shortcuts', 'Privacy', 'About',
  ]);
  const box = await dialog.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(760);
  expect(box!.height).toBeGreaterThanOrEqual(520);

  // The left list moves between sections; each shows its own content.
  await nav.getByRole('tab', { name: 'Assistant' }).click();
  await expect(dialog.getByRole('radiogroup', { name: 'Provider' })).toBeVisible();
  await expect(dialog.getByRole('radio', { name: 'Not configured', exact: true })).toHaveAttribute('aria-checked', 'true');
  await expect(dialog.getByRole('button', { name: 'Check connection' })).toBeDisabled();
  await nav.getByRole('tab', { name: 'Models & keys' }).click();
  await expect(dialog.getByRole('textbox', { name: 'Session key', exact: true })).toBeVisible();
  await expect(dialog.getByRole('table', { name: 'Where secrets are' })).toBeVisible();
  await nav.getByRole('tab', { name: 'Sync' }).click();
  await expect(dialog.getByRole('spinbutton', { name: 'Models per batch' })).toHaveValue('50');
  await nav.getByRole('tab', { name: 'Privacy' }).click();
  await expect(dialog.getByRole('switch', { name: 'Send field values to the model' })).toHaveAttribute('aria-checked', 'true');
  await nav.getByRole('tab', { name: 'About' }).click();
  await expect(dialog.getByText(/^Version \d+\.\d+\.\d+/)).toBeVisible();

  // Appearance: density and accent are drafts until Save.
  await nav.getByRole('tab', { name: 'Appearance & Motion' }).click();
  await pickOption(window, 'Density', 'Compact', dialog);
  await dialog.getByRole('radio', { name: 'Violet', exact: true }).click();
  await expect(dialog.getByRole('radio', { name: 'Violet', exact: true })).toHaveAttribute('aria-checked', 'true');
  await expect(html).toHaveAttribute('data-accent', 'cyan');

  // Shortcuts: record Shift+2 for Fit to view.
  await nav.getByRole('tab', { name: 'Shortcuts' }).click();
  const fitRow = dialog.locator('tr[data-command="view.fit"]');
  await expect(fitRow).toContainText('Shift+1');
  await dialog.getByRole('button', { name: 'Change the shortcut for Fit to view' }).click();
  await expect(fitRow).toHaveAttribute('data-recording', 'true');
  await window.keyboard.press('Shift+2');
  await expect(fitRow).not.toHaveAttribute('data-recording', 'true');
  await expect(fitRow).toContainText('Shift+2');
  await expect(fitRow).toContainText('Default: Shift+1');
  await expect(dialog).toHaveAttribute('data-state', 'open');

  // Canvas: descriptions off.
  await nav.getByRole('tab', { name: 'Canvas' }).click();
  const showDescriptions = dialog.getByRole('switch', { name: 'Show descriptions' });
  await expect(showDescriptions).toHaveAttribute('aria-checked', 'true');
  await showDescriptions.click();
  await expect(showDescriptions).toHaveAttribute('aria-checked', 'false');
  await expect(descriptions).toHaveAttribute('aria-pressed', 'true');

  await dialog.getByRole('button', { name: 'Save settings' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(html).toHaveAttribute('data-accent', 'violet');
  await expect(html).toHaveAttribute('data-density', 'compact');
  await expect(descriptions).toHaveAttribute('aria-pressed', 'false');
  const stored = await window.evaluate(async () => (window as unknown as {
    electronAPI: { getSettings: () => Promise<{ preferences?: { appearance: unknown; shortcuts: unknown; canvas: { showDescriptions: boolean } } }> };
  }).electronAPI.getSettings());
  expect(stored.preferences).toMatchObject({
    appearance: { accent: 'violet', density: 'compact' },
    shortcuts: { 'view.fit': 'Shift+2' },
    canvas: { showDescriptions: false },
  });

  // Help ▸ Keyboard shortcuts shows the recorded shortcut, and the View menu draws it too.
  await window.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
  await window.keyboard.press('F1');
  const help = window.locator('[role="dialog"].shortcuts-dialog');
  await expect(help).toBeVisible();
  const fitHelp = help.locator('div').filter({ hasText: /^Fit to view/ }).first();
  await expect(fitHelp).toContainText('Shift+2');
  await window.keyboard.press('Escape');
  await expect(help).toHaveCount(0);
  await bar.getByRole('menuitem', { name: 'View', exact: true }).click();
  await expect(window.getByRole('menu').getByRole('menuitem', { name: 'Fit to view' })).toContainText('Shift+2');
  await window.keyboard.press('Escape');

  // The canvas toggle writes back to preferences: the Canvas section reflects it.
  await window.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
  await descriptions.click();
  await expect(descriptions).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => window.evaluate(async () => (window as unknown as {
    electronAPI: { getSettings: () => Promise<{ preferences?: { canvas: { showDescriptions: boolean } } }> };
  }).electronAPI.getSettings().then((read) => read.preferences?.canvas.showDescriptions))).toBe(true);

  // Cancel discards a draft: accent and the canvas switch stay as stored.
  await window.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(dialog).toHaveAttribute('data-state', 'open');
  await nav.getByRole('tab', { name: 'Canvas' }).click();
  await expect(dialog.getByRole('switch', { name: 'Show descriptions' })).toHaveAttribute('aria-checked', 'true');
  await dialog.getByRole('switch', { name: 'Show descriptions' }).click();
  await nav.getByRole('tab', { name: 'Appearance & Motion' }).click();
  await dialog.getByRole('radio', { name: 'Mint', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Save settings' })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(html).toHaveAttribute('data-accent', 'violet');
  await expect(descriptions).toHaveAttribute('aria-pressed', 'true');
  await window.getByRole('button', { name: 'Settings', exact: true }).click();
  await nav.getByRole('tab', { name: 'Appearance & Motion' }).click();
  await expect(dialog.getByRole('radio', { name: 'Violet', exact: true })).toHaveAttribute('aria-checked', 'true');
  await expect(dialog.getByRole('button', { name: 'Save settings' })).toBeDisabled();
  await window.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  // The menu opens the window on its section.
  await bar.getByRole('menuitem', { name: 'Sync', exact: true }).click();
  await window.getByRole('menu').getByRole('menuitem', { name: 'Sync settings…' }).click();
  await expect(nav.getByRole('tab', { name: 'Sync' })).toHaveAttribute('aria-selected', 'true');
  await window.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await bar.getByRole('menuitem', { name: 'Assistant', exact: true }).click();
  await window.getByRole('menu').getByRole('menuitem', { name: 'Assistant settings…' }).click();
  await expect(nav.getByRole('tab', { name: 'Assistant' })).toHaveAttribute('aria-selected', 'true');
  await window.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  // Preferences survive a relaunch.
  await app.close();
  const again = await electron.launch({
    args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  const reopened = await again.firstWindow();
  await reopened.locator('.app-shell').waitFor();
  await expect(reopened.locator('html')).toHaveAttribute('data-accent', 'violet');
  await expect(reopened.locator('html')).toHaveAttribute('data-density', 'compact');
  expect(errors).toEqual([]);
  await again.close();
  fs.rmSync(userData, { recursive: true, force: true });
});
