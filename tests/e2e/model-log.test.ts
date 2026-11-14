import { test, expect, _electron as electron } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { pickOption } from './pickOption';
import { useEnglish } from './locale';

/**
 * The conversation log as a person uses it (scripted TEST transport, not a live model): a question is recorded,
 * the answer in the chat leads to its record, the window lists it, a short report goes to the clipboard, a file
 * is saved with what a reader needs, and nothing secret is in it. Switching the log off stops recording; clearing
 * removes the records.
 */

const FAKE_KEY = 'sk-proj-E2ELOGKEY0123456789abcdef';

test('conversation log: record, open from the answer, copy a report, save a file, switch off, clear', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'model-log-'));
  const saved = path.join(userData, 'saved-log.jsonl');
  const electronApp = await electron.launch({
    args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  const window = await electronApp.firstWindow();
  const pageErrors: string[] = [];
  window.on('pageerror', (error) => pageErrors.push(error.message));
  await window.waitForLoadState('domcontentloaded');
  await useEnglish(window);

  // A key held for a cloud provider must never land in a record, even when a person pastes it into a question.
  await window.evaluate(async (key) => {
    const api = (window as unknown as { electronAPI: { llmSetSessionKey: (provider: string, value: string) => Promise<unknown> } }).electronAPI;
    await api.llmSetSessionKey('openai', key);
  }, FAKE_KEY);

  await pickOption(window, 'Chat provider', 'TEST mode');
  await window.getByText('TEST mode is on').first().waitFor();
  await window.getByRole('tab', { name: 'Assistant' }).click();
  const input = window.locator('textarea[aria-label="Chat message"]');
  await input.fill(`explain this ${FAKE_KEY}`);
  await input.press('Enter');
  await expect(window.locator('[data-tool-name="explain"]')).toHaveAttribute('data-tool-status', 'success', { timeout: 30000 });
  await expect(input).toBeEnabled();

  // One record on disk, closed with its end line.
  const folder = path.join(userData, 'logs', 'model');
  await expect.poll(() => (fs.existsSync(folder) ? fs.readdirSync(folder).filter((name) => name.endsWith('.jsonl')).length : 0)).toBe(1);
  const turnFile = path.join(folder, fs.readdirSync(folder)[0]);
  await expect.poll(() => fs.readFileSync(turnFile, 'utf8').includes('"type":"turn-end"')).toBe(true);
  const recorded = fs.readFileSync(turnFile, 'utf8');
  expect(recorded).not.toContain(FAKE_KEY);
  expect(recorded).toContain('"type":"prompt"');
  expect(recorded).toContain('"type":"tool-call"');

  // The answer in the chat leads to its own record.
  const answer = window.locator('.message-row[data-role="assistant"]').last();
  await answer.hover();
  await answer.locator('.message-log').click();
  const dialog = window.locator('.model-log-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Conversation log' })).toBeVisible();
  const rows = dialog.locator('.model-log-turn');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toHaveAttribute('data-outcome', 'ok');
  await expect(rows.first()).toContainText('explain this');
  await expect(rows.first()).not.toContainText(FAKE_KEY);
  await expect(rows.first().locator('.model-log-outcome')).toHaveText('Answered');
  await expect(rows.first()).toContainText('test mode');
  await expect(rows.first().getByRole('checkbox')).toBeChecked();
  await expect(dialog).toContainText('1 record');

  // A short report for pasting into a message.
  // What an action did is said inside the window: a toast behind a modal could not be clicked or heard.
  const notice = dialog.locator('.model-log-notice');
  await rows.first().getByRole('button', { name: 'Copy report' }).click();
  await expect(notice).toContainText('Report copied');
  const report = await electronApp.evaluate(({ clipboard }) => clipboard.readText());
  expect(report).toContain('explain');
  expect(report).toContain('test');
  expect(report).not.toContain(FAKE_KEY);

  // The file: app facts first, then the turn as recorded. The save dialog is the system's; here it is stubbed.
  await electronApp.evaluate(({ dialog: systemDialog, shell }, target) => {
    const state = globalThis as unknown as { __revealed: string[] };
    state.__revealed = [];
    systemDialog.showSaveDialog = (async () => ({ canceled: false, filePath: target })) as unknown as typeof systemDialog.showSaveDialog;
    shell.showItemInFolder = (file: string) => {
      state.__revealed.push(file);
    };
  }, saved);
  await dialog.getByRole('button', { name: 'Save to a file (1)…' }).click();
  await expect(notice).toContainText('The log is saved: 1 question');
  await expect(notice).toContainText(saved);
  const lines = fs.readFileSync(saved, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line) as Record<string, unknown>);
  expect(lines[0].type).toBe('bundle');
  expect(String(lines[0].diagnostics)).toContain('# Graph Helper for ComfyUI diagnostics');
  expect(lines[0].turns).toBe(1);
  const types = lines.map((line) => line.type);
  expect(types).toContain('turn-start');
  expect(types).toContain('prompt');
  expect(types).toContain('tool-call');
  expect(types).toContain('tool-result');
  expect(types[types.length - 1]).toBe('turn-end');
  expect(lines[lines.length - 1]).toMatchObject({ outcome: 'ok' });
  expect(lines.find((line) => line.type === 'turn-start')).toMatchObject({ provider: 'test', language: 'en' });
  expect(fs.readFileSync(saved, 'utf8')).not.toContain(FAKE_KEY);

  // "Show the file" takes the person to what they just saved.
  await notice.getByRole('button', { name: 'Show the file' }).click();
  await expect.poll(() => electronApp.evaluate(() => (globalThis as unknown as { __revealed: string[] }).__revealed)).toEqual([saved]);

  // Switched off: the next question is not recorded, and the window says why nothing new appears.
  await dialog.getByRole('switch', { name: 'Keep the log' }).click();
  await expect(dialog.getByText('The log is off: new questions are not recorded.', { exact: false })).toBeVisible();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
  await input.fill('explain this');
  await input.press('Enter');
  await expect(window.locator('.message-row[data-role="assistant"]')).toHaveCount(2, { timeout: 30000 });
  await expect(input).toBeEnabled();
  expect(fs.readdirSync(folder).filter((name) => name.endsWith('.jsonl'))).toHaveLength(1);
  // An answer that was not recorded offers no log link.
  await expect(window.locator('.message-row[data-role="assistant"]').last().locator('.message-log')).toHaveCount(0);

  // Help ▸ Conversation log opens the same window; clearing asks first and then says the log is empty.
  await window.locator('.document-bar').getByRole('menuitem', { name: 'Help', exact: true }).click();
  await window.getByRole('menu').getByRole('menuitem', { name: 'Conversation log…' }).click();
  await expect(dialog).toBeVisible();
  await expect(rows).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Clear the log' }).click();
  await expect(dialog.getByText('Delete 1 record? It cannot be undone.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(rows).toHaveCount(0);
  await expect(dialog.getByText('Nothing recorded yet')).toBeVisible();
  expect(fs.readdirSync(folder).filter((name) => name.endsWith('.jsonl'))).toHaveLength(0);

  await electronApp.close();
  expect(pageErrors).toEqual([]);
});
