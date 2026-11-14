import { test, expect, _electron as electron, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { useEnglish } from './locale';
import { startFakeLlm, FAKE_MODEL, type FakeLlm } from '../fixtures/llm/fakeLlmServer';

/**
 * The assistant on the person's own server (a labelled fake model server, not a live model):
 * - a build paused in the middle holds its next step and, after Continue, every step lands; undo then
 *   takes the whole build back in one step and redo brings it back;
 * - grey drafts accepted with "Accept all" twice land on no node;
 * - a failed answer says what happened in one sentence, with Ask again.
 */

type Bridge = Record<string, (...args: unknown[]) => Promise<any>>;

async function launch(llm: FakeLlm) {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'assistant-runs-'));
  const app = await electron.launch({ args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`], env: { ...process.env, NODE_ENV: 'production' } });
  const page = await app.firstWindow();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await useEnglish(page);
  const saved = await page.evaluate(async ({ base, model }) => {
    const api = (window as unknown as { electronAPI: Bridge }).electronAPI;
    const read = await api.getSettings();
    return api.saveSettings({ ...(read.values ?? {}), provider: 'local', baseURL: base, model });
  }, { base: `${llm.origin}/v1`, model: FAKE_MODEL });
  expect(saved.ok).toBe(true);
  await page.reload();
  await page.locator('.app-shell').waitFor({ timeout: 30_000 });
  await page.getByRole('tab', { name: 'Assistant' }).click();
  return { app, page, userData, errors };
}

const graph = (page: Page) => page.evaluate(async () => {
  const projection = await (window as unknown as { electronAPI: Bridge }).electronAPI.readProjection('desktop');
  return { nodes: projection.snapshot.nodes.length as number, edges: projection.snapshot.edges.length as number };
});

async function nodeOverlaps(page: Page): Promise<string[]> {
  await page.keyboard.press('Control+0');
  await page.waitForTimeout(500);
  return page.evaluate(() => {
    const boxes = Array.from(document.querySelectorAll<HTMLElement>('.react-flow__node')).map((node) => ({ id: node.dataset.id ?? '', box: node.getBoundingClientRect() }));
    const found: string[] = [];
    for (let a = 0; a < boxes.length; a += 1) for (let b = a + 1; b < boxes.length; b += 1) {
      const p = boxes[a].box;
      const q = boxes[b].box;
      if (p.x < q.x + q.width && p.x + p.width > q.x && p.y < q.y + q.height && p.y + p.height > q.y) found.push(`${boxes[a].id}×${boxes[b].id}`);
    }
    return found;
  });
}

async function ask(page: Page, text: string) {
  const input = page.locator('textarea[aria-label="Chat message"]');
  await input.fill(text);
  await input.press('Enter');
}

test('a paused build holds its steps, Continue lands all of them, and undo takes the build back in one step', async () => {
  test.setTimeout(240_000);
  const llm = await startFakeLlm();
  const { app, page, userData, errors } = await launch(llm);
  try {
    await page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Build', exact: true }).click();
    await ask(page, 'build slowly please');
    await expect.poll(async () => (await graph(page)).nodes, { timeout: 30_000 }).toBeGreaterThanOrEqual(2);
    await page.locator('.pause-button').click();
    const held = await graph(page);
    // Paused for longer than several steps take: nothing lands and nothing fails.
    await page.waitForTimeout(5000);
    expect(await graph(page)).toEqual(held);
    await expect(page.locator('[data-tool-status="error"]')).toHaveCount(0);
    await page.locator('.pause-button').click();
    await expect(page.locator('textarea[aria-label="Chat message"]')).toBeEnabled({ timeout: 60_000 });
    await expect.poll(() => graph(page), { timeout: 30_000 }).toEqual({ nodes: 6, edges: 2 });
    await expect(page.locator('[data-tool-status="error"]')).toHaveCount(0);
    // The turn ended: nothing says the assistant is paused any more.
    await expect(page.getByText('Assistant paused')).toHaveCount(0);

    // One undo takes the whole build back, one redo brings it back.
    await page.locator('.react-flow__pane').click({ position: { x: 20, y: 500 } });
    await page.keyboard.press('Control+z');
    await expect.poll(() => graph(page), { timeout: 15_000 }).toEqual({ nodes: 0, edges: 0 });
    await page.keyboard.press('Control+Shift+z');
    await expect.poll(() => graph(page), { timeout: 15_000 }).toEqual({ nodes: 6, edges: 2 });
    expect(errors).toEqual([]);
  } finally {
    await app.close();
    await llm.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

test('grey drafts accepted with Accept all twice land on no node; a failed answer says what to do', async () => {
  test.setTimeout(240_000);
  const llm = await startFakeLlm();
  const { app, page, userData, errors } = await launch(llm);
  try {
    for (let round = 0; round < 2; round += 1) {
      await ask(page, 'propose nodes for a picture');
      await expect(page.locator('[data-ghost]')).toHaveCount(3, { timeout: 30_000 });
      await page.getByRole('button', { name: /Accept all/ }).first().click();
      await expect(page.locator('[data-ghost]')).toHaveCount(0, { timeout: 15_000 });
    }
    await expect.poll(async () => (await graph(page)).nodes).toBe(6);
    expect(await nodeOverlaps(page)).toEqual([]);

    // Failures: one plain sentence and the next step; the server's words fold away.
    await ask(page, 'please error429');
    const failure = page.locator('[data-turn-error="rate"]');
    await expect(failure).toContainText('20', { timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Ask again' }).last()).toBeVisible();
    await ask(page, 'html reply');
    await expect(page.locator('[data-turn-error="not-a-model"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Open the assistant settings' }).last()).toBeVisible();
    await expect(page.locator('.chat-log')).not.toContainText('AI_APICallError');
    expect(errors).toEqual([]);
  } finally {
    await app.close();
    await llm.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
