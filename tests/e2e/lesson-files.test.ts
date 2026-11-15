/**
 * Lessons as files in the real app: a lesson file dropped on the lesson list lands in "My lessons" with the mark
 * "From a file" and is still there after a restart of the page; a refused file says why; every built-in lesson card
 * and group has its export button; "Make a lesson from this graph" opens the editor with steps from the canvas, the
 * lesson is tried and saved, and a lesson of the person can be removed.
 */

import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { useEnglish } from './locale';
import { sampleDoc } from '../fixtures/lessons/sampleLesson';

type Bridge = (name: string, args?: unknown[]) => Promise<any>;

async function launch(): Promise<{ app: ElectronApplication; page: Page; api: Bridge }> {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'lesson-files-'));
  const env: Record<string, string | undefined> = { ...process.env, NODE_ENV: 'production' };
  delete env.DBUS_SESSION_BUS_ADDRESS;
  delete env.GNOME_KEYRING_CONTROL;
  const app = await electron.launch({ args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`], env: env as Record<string, string> });
  const page = await app.firstWindow();
  await page.locator('.app-shell').waitFor({ timeout: 20_000 });
  await page.setViewportSize({ width: 1400, height: 860 });
  await useEnglish(page);
  const api: Bridge = (name, args = []) => page.evaluate(async ({ name, args }) => {
    const bridge = (window as unknown as { electronAPI: Record<string, (...input: unknown[]) => Promise<unknown>> }).electronAPI;
    return bridge[name](...args);
  }, { name, args });
  return { app, page, api };
}

async function openLearn(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Assistant' }).click();
  await page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Learn', exact: true }).click();
  await expect(page.locator('.lesson-panel')).toBeVisible();
}

/** Drops a file with this text on the lesson list, the way the window receives a file from the file manager. */
async function drop(page: Page, name: string, text: string): Promise<void> {
  const list = page.locator('.lesson-panel > div').first();
  const handle = await page.evaluateHandle(({ name, text }) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([text], name, { type: 'application/json' }));
    return transfer;
  }, { name, text });
  await list.dispatchEvent('dragover', { dataTransfer: handle });
  await list.dispatchEvent('drop', { dataTransfer: handle });
}

const fileText = (lessons: unknown[]) => JSON.stringify({ format: 'nodewise-studio/lessons', version: 1, lessons });

test('lessons as files: drop, keep, export buttons, make from the graph, remove', async () => {
  const { app, page, api } = await launch();
  try {
    await openLearn(page);
    const mine = page.locator('[data-lesson-group="mine"]');
    await expect(mine).toBeVisible();
    // Every built-in card and group can be exported.
    await expect(page.locator('[data-lesson-export="image"]')).toBeVisible();
    await expect(page.locator('[data-group-export]').first()).toBeVisible();

    // A refused file says why, in words.
    await drop(page, 'broken.lesson.json', '{"format": "something else"}');
    await expect(page.getByText('The file is not a lesson file of this app.')).toBeVisible();

    await drop(page, 'first.lesson.json', fileText([sampleDoc()]));
    const card = mine.locator('[data-lesson-card="my:my-first"]');
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('data-lesson-origin', 'file');
    await expect(card.getByText('From a file')).toBeVisible();

    // After a restart of the page it is still there.
    await page.reload();
    await page.locator('.app-shell').waitFor({ timeout: 20_000 });
    await expect(page.locator('.lesson-panel')).toBeVisible({ timeout: 15_000 }).catch(async () => { await openLearn(page); });
    await expect(page.locator('[data-lesson-card="my:my-first"]')).toBeVisible();

    // A graph on the canvas becomes a lesson: two nodes and a link.
    const projection = await api('readProjection', ['desktop']) as { currentRevisionId: string };
    let revision = projection.currentRevisionId;
    for (const [index, nodeType] of ['CheckpointLoaderSimple', 'KSampler'].entries()) {
      const outcome = await api('commitCommand', [{ projectId: 'desktop', actionId: `lesson-files-${index}`, expectedRevisionId: revision, actor: 'manual', runId: null, payload: { type: 'add-node', nodeType, x: index * 400, y: 0 } }]) as { status: string; projection: { currentRevisionId: string } };
      expect(outcome.status).toBe('applied');
      revision = outcome.projection.currentRevisionId;
    }
    await page.reload();
    await page.locator('.app-shell').waitFor({ timeout: 20_000 });
    await expect(page.locator('.lesson-panel')).toBeVisible({ timeout: 15_000 }).catch(async () => { await openLearn(page); });
    await page.locator('[data-lesson-group="mine"]').getByRole('button', { name: 'Make from this graph' }).click();
    const editor = page.locator('[data-lesson-editor="new"]');
    await expect(editor).toBeVisible();
    await expect(editor.locator('[data-editor-step]')).toHaveCount(3);
    await editor.getByLabel('Title', { exact: true }).fill('Two nodes');
    await editor.getByRole('button', { name: 'Try the lesson' }).click();
    await expect(editor.locator('[data-editor-verdict="ok"]')).toBeVisible();
    await editor.getByRole('button', { name: 'Save to My lessons' }).click();
    const made = page.locator('[data-lesson-card="my:two-nodes"]');
    await expect(made).toBeVisible();
    await expect(made).toHaveAttribute('data-lesson-origin', 'made');

    // Removed after a confirmation.
    await page.locator('[data-lesson-remove="my:my-first"]').click();
    await page.locator('[data-lesson-card="my:my-first"]').getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(page.locator('[data-lesson-card="my:my-first"]')).toHaveCount(0);
    expect((await api('listMyLessons')).map((lesson: { id: string }) => lesson.id)).toEqual(['my:two-nodes']);
  } finally {
    await app.close();
  }
});
