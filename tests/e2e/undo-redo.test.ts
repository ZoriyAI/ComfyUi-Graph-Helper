import { test, expect, _electron as electron, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { useEnglish } from './locale';

type Bridge = Record<string, (...args: unknown[]) => Promise<any>>;

async function manual(window: Page, actionId: string, payload: unknown) {
  return window.evaluate(async ({ actionId, payload }) => {
    const bridge = (window as unknown as { electronAPI: Bridge }).electronAPI;
    const current = await bridge.readProjection('desktop');
    return bridge.commitCommand({ projectId: 'desktop', actionId, expectedRevisionId: current.currentRevisionId, actor: 'manual', runId: null, payload });
  }, { actionId, payload });
}

async function revSeq(window: Page): Promise<number> {
  return window.evaluate(async () => (await (window as unknown as { electronAPI: Bridge }).electronAPI.readProjection('desktop')).revSeq);
}

test('Ctrl+Z and Ctrl+Shift+Z step through the person\'s edits; the revision number only grows', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'undo-redo-'));
  const electronApp = await electron.launch({
    args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  const window = await electronApp.firstWindow();
  await useEnglish(window);
  await window.locator('#chat-provider').waitFor();
  const undo = window.locator('.workspace-toolbar [data-command="edit.undo"]');
  const redo = window.locator('.workspace-toolbar [data-command="edit.redo"]');
  await expect(undo).toBeDisabled();

  expect((await manual(window, 'loader', { type: 'add-node', nodeType: 'CheckpointLoaderSimple', x: 0, y: 0 })).status).toBe('applied');
  expect((await manual(window, 'sampler', { type: 'add-node', nodeType: 'KSampler', x: 400, y: 0 })).status).toBe('applied');
  expect((await manual(window, 'link', { type: 'connect', source: '1', sourceHandle: 'out-0', target: '2', targetHandle: 'in-0' })).status).toBe('applied');
  await window.reload();
  await window.locator('#chat-provider').waitFor();
  const nodes = window.locator('.react-flow__node');
  const edges = window.locator('.react-flow__edge');
  await expect(nodes).toHaveCount(2);
  await expect(edges).toHaveCount(1);
  const start = await revSeq(window);
  await expect(undo).toBeEnabled();
  await expect(redo).toBeDisabled();

  // The menu says what will be undone.
  await window.getByRole('menubar').getByRole('menuitem', { name: 'Edit' }).click();
  await expect(window.getByRole('menu').getByRole('menuitem', { name: 'Undo' })).toHaveAttribute('title', 'Undo: connect 1 → 2');
  await window.keyboard.press('Escape');
  await window.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));

  await window.keyboard.press('Control+z');
  await expect(edges).toHaveCount(0);
  await expect(nodes).toHaveCount(2);
  await expect.poll(() => revSeq(window)).toBe(start + 1);
  await expect(undo).toBeEnabled();
  await window.keyboard.press('Control+z');
  await expect(nodes).toHaveCount(1);
  await expect.poll(() => revSeq(window)).toBe(start + 2);
  await expect(redo).toBeEnabled();

  await window.keyboard.press('Control+Shift+z');
  await expect(nodes).toHaveCount(2);
  await expect(edges).toHaveCount(0);
  await expect.poll(() => revSeq(window)).toBe(start + 3);
  // One more redo is still there (the connection); a new edit clears it.
  await expect(redo).toBeEnabled();
  expect((await window.evaluate(async () => (await (window as unknown as { electronAPI: Bridge }).electronAPI.listRevisions('desktop')).map((item: { revSeq: number }) => item.revSeq))))
    .toEqual(Array.from({ length: start + 3 }, (_, index) => index + 1));

  await electronApp.close();
});
