import { test, expect, _electron as electron } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { Page } from '@playwright/test';
import { useEnglish } from './locale';
import { INNER_ID, OUTER_ID, nestedSubgraphWorkflow } from './fixtures/nestedSubgraphWorkflow';

const SHOTS = process.env.WP6_SHOTS_DIR ?? '';

/**
 * The nested fixture with the inner CLIPTextEncode's value keyed by name: without a catalog, Properties lists
 * fields only for keyed values (positional ones need the node's widget order, which is WP1's catalog work).
 */
function keyedNested(): typeof nestedSubgraphWorkflow {
  const copy = structuredClone(nestedSubgraphWorkflow);
  const inner = copy.definitions.subgraphs.find((item) => item.id === INNER_ID)!;
  (inner.nodes[0] as Record<string, unknown>).widgets_values = { text: 'a cat' };
  return copy;
}

async function exportDocument(window: Page): Promise<Record<string, any>> {
  const exported = await window.evaluate(() => (window as unknown as {
    electronAPI: { exportWorkflowDocument: () => Promise<{ ok: boolean; workflow: Record<string, unknown> }> };
  }).electronAPI.exportWorkflowDocument());
  expect(exported.ok).toBe(true);
  return exported.workflow as Record<string, any>;
}

function definition(workflow: Record<string, any>, id: string): Record<string, any> {
  return workflow.definitions.subgraphs.find((item: { id: string }) => item.id === id);
}

async function importNested(window: Page, workflow: unknown = nestedSubgraphWorkflow) {
  const current = await window.evaluate(() => (window as unknown as {
    electronAPI: { readProjection: (id: string) => Promise<{ currentRevisionId: string }> };
  }).electronAPI.readProjection('desktop'));
  const imported = await window.evaluate(async (input) => (window as unknown as {
    electronAPI: { commitCommand: (request: unknown) => Promise<{ status: string }> };
  }).electronAPI.commitCommand({
    projectId: 'desktop',
    actionId: 'import-wp6',
    expectedRevisionId: input.expected,
    actor: 'manual',
    runId: null,
    payload: { type: 'import-workflow', document: input.workflow },
  }), { expected: current.currentRevisionId, workflow });
  expect(imported.status).toBe('applied');
}

test('a group is renamed in place on the canvas, and undo brings the old title back', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'group-rename-'));
  const app = await electron.launch({
    args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  const window = await app.firstWindow();
  await useEnglish(window);
  await window.locator('#chat-provider').waitFor();
  await importNested(window);
  await window.reload();
  await window.locator('#chat-provider').waitFor();

  const title = window.locator('[data-group-id="1"] > div[data-group-id="1"]');
  await expect(title).toHaveText('Generation');
  // Escape leaves the title as it was.
  await title.dblclick();
  const field = window.getByRole('textbox', { name: 'Group title' });
  await expect(field).toBeFocused();
  await field.fill('Throwaway');
  await field.press('Escape');
  await expect(field).toHaveCount(0);
  await expect(title).toHaveText('Generation');

  // Enter saves through the engine.
  await title.dblclick();
  await field.fill('Prompt and sampling');
  await field.press('Enter');
  await expect(field).toHaveCount(0);
  await expect(title).toHaveText('Prompt and sampling');
  expect((await exportDocument(window)).groups[0].title).toBe('Prompt and sampling');
  if (SHOTS) await window.screenshot({ path: path.join(SHOTS, 'group-renamed.png') });

  await window.locator('.react-flow__pane').click({ position: { x: 5, y: 5 } });
  await window.keyboard.press('Control+z');
  await expect(title).toHaveText('Generation');
  expect((await exportDocument(window)).groups[0].title).toBe('Generation');
  await app.close();
});

test('inside a subgraph, moving an inner node and editing its field are saved and survive a reload', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'subgraph-inner-'));
  const app = await electron.launch({
    args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  const window = await app.firstWindow();
  await useEnglish(window);
  await window.locator('#chat-provider').waitFor();
  await importNested(window, keyedNested());
  await window.reload();
  await window.locator('#chat-provider').waitFor();

  // Open "Prompt block" (root node 2), then drag its inner ConditioningZeroOut (inner node 2).
  await window.locator('.react-flow__node[data-id="2"]').dblclick();
  await expect(window.locator('[data-canvas-mode="definition"]')).toBeVisible();
  const zero = window.locator('.react-flow__node[data-id="2"]');
  await expect(zero).toContainText('ConditioningZeroOut');
  const before = definition(await exportDocument(window), OUTER_ID).nodes.find((node: { id: number }) => node.id === 2).pos;
  // Entering a level fits the camera with an animation; a drag started meanwhile can miss under load, so the
  // drag is repeated until the saved position changes.
  await expect(async () => {
    const box = (await zero.boundingBox())!;
    await window.mouse.move(box.x + box.width / 2, box.y + 14);
    await window.mouse.down();
    await window.mouse.move(box.x + box.width / 2 + 60, box.y + 14 + 90, { steps: 12 });
    await window.mouse.up();
    await expect.poll(async () => definition(await exportDocument(window), OUTER_ID).nodes.find((node: { id: number }) => node.id === 2).pos, { timeout: 3000 }).not.toEqual(before);
  }).toPass({ timeout: 20000 });
  const moved = definition(await exportDocument(window), OUTER_ID).nodes.find((node: { id: number }) => node.id === 2).pos as number[];
  expect(moved[1]).toBeGreaterThan(before[1]);

  // Into the nested "Encode" definition (inner node 1), select its CLIPTextEncode and change the text.
  await window.locator('.react-flow__node[data-id="1"]').dblclick();
  const encode = window.locator('.react-flow__node[data-id="1"]');
  await expect(encode).toContainText('CLIPTextEncode');
  await encode.click();
  await window.getByRole('tab', { name: 'Inspector' }).click();
  const text = window.getByRole('textbox', { name: 'Value of text' });
  await expect(text).toHaveValue('a cat');
  await text.fill('a dog in the rain');
  await text.press('Enter');
  await expect.poll(async () => definition(await exportDocument(window), INNER_ID).nodes[0].widgets_values).toEqual({ text: 'a dog in the rain' });

  // The root node 1 (the checkpoint loader, same id) did not change.
  const exported = await exportDocument(window);
  const rootLoader = exported.nodes.find((node: { id: number }) => node.id === 1);
  expect(rootLoader.widgets_values).toEqual(['model.safetensors']);
  expect(rootLoader.pos).toEqual([20, 40]);

  // A reload reads the saved revision: the edits are there.
  await window.reload();
  await window.locator('#chat-provider').waitFor();
  const again = await exportDocument(window);
  expect(definition(again, OUTER_ID).nodes.find((node: { id: number }) => node.id === 2).pos).toEqual(moved);
  expect(definition(again, INNER_ID).nodes[0].widgets_values).toEqual({ text: 'a dog in the rain' });
  await window.locator('.react-flow__node[data-id="2"]').dblclick();
  await window.locator('.react-flow__node[data-id="1"]').dblclick();
  await window.locator('.react-flow__node[data-id="1"]').click();
  await window.getByRole('tab', { name: 'Inspector' }).click();
  await expect(window.getByRole('textbox', { name: 'Value of text' })).toHaveValue('a dog in the rain');
  if (SHOTS) await window.screenshot({ path: path.join(SHOTS, 'subgraph-after-reload.png') });

  // Removing an inner node is not supported yet: the canvas says so and the node stays.
  await window.locator('.react-flow__node[data-id="1"]').click();
  await window.locator('.react-flow__node[data-id="1"]').focus();
  await window.keyboard.press('Backspace');
  await expect(window.getByText('Nodes inside a subgraph cannot be removed here yet')).toBeVisible();
  await expect(window.locator('.react-flow__node[data-id="1"]')).toHaveCount(1);
  await app.close();
});
