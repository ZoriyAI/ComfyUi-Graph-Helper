/**
 * E2E spec for the teaching aids on the canvas, on the dense fixture graph (fixtures/denseWorkflow.ts): the node
 * context menu with "What is this?", the guided tour, the connect assist that shows where a link may go, the subgraph
 * breadcrumb and the replay of how a graph was built. These are how a beginner learns a graph by pointing at it.
 */
import { test, expect, _electron as electron } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { denseWorkflow } from './fixtures/denseWorkflow';
import { useEnglish } from './locale';
import { pickOption } from './pickOption';

test('canvas explains: context menu, tour, connect assist, subgraph breadcrumb and replay', async () => {
  const errors: string[] = [];
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'canvas-explain-'));
  const app = await electron.launch({
    args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  const window = await app.firstWindow();
  window.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  window.on('pageerror', (error) => errors.push(error instanceof Error ? error.message : String(error)));
  await window.setViewportSize({ width: 1440, height: 900 });
  await useEnglish(window);
  const api = (name: string, args: unknown[]) => window.evaluate(async ({ name, args }) => {
    const bridge = (window as unknown as { electronAPI: Record<string, (...input: unknown[]) => Promise<unknown>> }).electronAPI;
    return bridge[name](...args);
  }, { name, args });
  const current = await api('readProjection', ['desktop']) as { currentRevisionId: string };
  const imported = await api('commitCommand', [{
    projectId: 'desktop', actionId: 'canvas-explain', expectedRevisionId: current.currentRevisionId, actor: 'manual', runId: null,
    payload: { type: 'import-workflow', document: denseWorkflow },
  }]) as { status: string };
  expect(imported.status).toBe('applied');
  await window.reload();
  await expect(window.locator('.react-flow__node')).toHaveCount(12);

  // Context menu on a node: questions and build actions; "What is this?" highlights the node (flow pulses).
  await window.getByText('Sample', { exact: true }).click({ button: 'right' });
  const menu = window.getByRole('menu');
  await expect(menu.getByRole('menuitem', { name: 'What is this?' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Make a subgraph from selection' })).toBeVisible();
  // The questions sit under a caption that says who answers; every row has an icon; the node is a "node".
  await expect(menu.getByText('Ask the assistant', { exact: true })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Note for this node…' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Delete node' })).toBeVisible();
  expect(await menu.getByRole('menuitem').evaluateAll((items) => items.every((item) => item.querySelector('svg') !== null))).toBe(true);
  await menu.getByRole('menuitem', { name: 'What is this?' }).click();
  await expect(window.getByRole('menu')).toHaveCount(0);
  await expect.poll(async () => window.locator('[data-flow]').count()).toBeGreaterThan(0);

  // Keyboard: Shift+F10 opens the same menu for the focused node.
  await window.locator('.react-flow__node').filter({ hasText: 'Decode' }).first().focus();
  await window.keyboard.press('Shift+F10');
  await expect(window.getByRole('menu').getByRole('menuitem', { name: 'Why is it here?' })).toBeVisible();
  await window.keyboard.press('Escape');
  await expect(window.getByRole('menu')).toHaveCount(0);

  // Guided tour: a callout per node, keyboard steps, Escape ends it.
  await window.getByRole('button', { name: 'Tour the graph' }).click();
  await expect(window.locator('[data-tour-step="0"]')).toBeVisible();
  await expect(window.getByText('Step 1 of 12').first()).toBeVisible();
  await window.keyboard.press('ArrowRight');
  await expect(window.locator('[data-tour-step="1"]')).toBeVisible();
  await window.keyboard.press('Escape');
  await expect(window.locator('[data-tour-step]')).toHaveCount(0);

  // What to connect: compatible ports light up and a hint names the best candidate.
  // Descriptions stay in their default mode (own notes only): the seeded class knowledge waits behind dots,
  // and a card that does open never covers a port, so nothing blocks the handle.
  await expect(window.getByRole('button', { name: 'Descriptions on the canvas' })).toHaveAttribute('data-descriptions-mode', 'own');
  await expect(window.locator('[data-knowledge-dot]').first()).toBeVisible();
  const handle = window.locator('.react-flow__node').filter({ hasText: 'Sample' }).first().locator('.react-flow__handle.source').first();
  await handle.click({ button: 'right' });
  await window.getByRole('menuitem', { name: 'Suggest a link' }).click();
  await expect(window.getByText(/Enter links to/)).toBeVisible();
  await window.locator('.react-flow__pane').click({ position: { x: 20, y: 400 } });
  await expect(window.getByText(/Enter links to/)).toHaveCount(0);

  // Subgraph from selection, open it, see the boundary nodes, come back.
  await window.getByText('Positive', { exact: true }).click();
  await window.getByText('Negative', { exact: true }).click({ modifiers: ['Control'] });
  await window.getByText('Negative', { exact: true }).click({ button: 'right' });
  await window.getByRole('menuitem', { name: 'Make a subgraph from selection' }).click();
  await expect(window.locator('[data-node-kind="subgraph-instance"]')).toHaveCount(1);
  await expect(window.locator('.react-flow__node')).toHaveCount(11);
  await window.locator('[data-node-kind="subgraph-instance"]').dblclick();
  const crumbs = window.getByRole('navigation', { name: 'Subgraph path' });
  await expect(crumbs).toBeVisible();
  await expect(window.locator('[data-boundary="input"]')).toBeVisible();
  await expect(window.locator('[data-boundary="output"]')).toBeVisible();
  await expect(window.locator('.react-flow__node')).toHaveCount(4);
  await crumbs.getByRole('button', { name: 'Whole graph', exact: true }).click();
  await expect(window.locator('.react-flow__node')).toHaveCount(11);

  // Replay: read-only overlay of an older revision; the current revision does not change.
  const before = await api('readProjection', ['desktop']) as { currentRevisionId: string };
  await window.getByRole('button', { name: 'Replay history' }).click();
  const slider = window.getByRole('slider', { name: 'Version' });
  await expect(slider).toBeVisible();
  await slider.focus();
  await window.keyboard.press('Home');
  await expect(window.getByText(/Read-only\./)).toBeVisible();
  await expect(window.locator('[data-canvas-mode="replay"]')).toHaveCount(1);
  await window.keyboard.press('Escape');
  await expect(window.locator('[data-canvas-mode="root"]')).toHaveCount(1);
  const after = await api('readProjection', ['desktop']) as { currentRevisionId: string };
  expect(after.currentRevisionId).toBe(before.currentRevisionId);
  await expect(window.locator('.react-flow__node')).toHaveCount(11);

  // Ghost: the TEST fixture proposes a node; it stays a ghost until accepted, then becomes a real node.
  await pickOption(window, 'Choose the assistant', 'TEST mode');
  await window.getByRole('tab', { name: 'Assistant' }).click();
  await window.locator('textarea[aria-label="Chat message"]').fill('propose a sampler');
  await window.getByRole('button', { name: 'Send' }).click();
  const ghost = window.locator('[data-ghost-kind="add-node"]');
  await expect(ghost).toBeVisible({ timeout: 15000 });
  await expect(window.locator('.react-flow__node')).toHaveCount(11);
  await ghost.getByRole('button', { name: 'Accept' }).click();
  await expect(window.locator('.react-flow__node')).toHaveCount(12);
  await expect(ghost).toHaveCount(0);

  expect(errors).toEqual([]);
  await app.close();
});
