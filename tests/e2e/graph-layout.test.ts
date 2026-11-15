/**
 * E2E spec for layout: nodes never land on each other and a graph stays readable.
 * - a helper build on a canvas that already has nodes ends with no two node cards overlapping on screen;
 * - "Arrange the graph" moves nodes in one commit, and one Undo puts every node back;
 * - zoomed far out, the canvas switches to its overview level (data-zoom="overview") and back.
 * LAYOUT_SHOTS=<dir> saves screenshots of the end of the build, for a person to look at.
 */
import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { useEnglish } from './locale';
import { pickOption } from './pickOption';

type Bridge = Record<string, (...args: unknown[]) => Promise<any>>;
type Box = { id: string; x: number; y: number; width: number; height: number };

async function launch(prefix: string): Promise<{ app: ElectronApplication; window: Page; userData: string }> {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const app = await electron.launch({
    args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  const window = await app.firstWindow();
  await window.setViewportSize({ width: 1440, height: 900 });
  await useEnglish(window);
  await window.locator('#chat-provider').waitFor();
  return { app, window, userData };
}

async function manual(window: Page, actionId: string, payload: unknown) {
  return window.evaluate(async ({ actionId, payload }) => {
    const bridge = (window as unknown as { electronAPI: Bridge }).electronAPI;
    const current = await bridge.readProjection('desktop');
    return bridge.commitCommand({ projectId: 'desktop', actionId, expectedRevisionId: current.currentRevisionId, actor: 'manual', runId: null, payload });
  }, { actionId, payload });
}

async function positions(window: Page): Promise<Record<string, { x: number; y: number }>> {
  return window.evaluate(async () => {
    const projection = await (window as unknown as { electronAPI: Bridge }).electronAPI.readProjection('desktop');
    return Object.fromEntries((projection.snapshot.nodes as Array<{ id: string; position: { x: number; y: number } }>).map((node) => [node.id, node.position]));
  });
}

async function nodeBoxes(window: Page): Promise<Box[]> {
  return window.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('.react-flow__node')).map((node) => {
    const box = node.getBoundingClientRect();
    return { id: node.dataset.id ?? '', x: box.x, y: box.y, width: box.width, height: box.height };
  }));
}

function overlaps(boxes: Box[]): string[] {
  const found: string[] = [];
  for (let a = 0; a < boxes.length; a += 1) {
    for (let b = a + 1; b < boxes.length; b += 1) {
      const p = boxes[a];
      const q = boxes[b];
      if (p.x < q.x + q.width && p.x + p.width > q.x && p.y < q.y + q.height && p.y + p.height > q.y) found.push(`${p.id}×${q.id}`);
    }
  }
  return found;
}

async function shot(window: Page, name: string): Promise<void> {
  const dir = process.env.LAYOUT_SHOTS;
  if (!dir) return;
  fs.mkdirSync(dir, { recursive: true });
  await window.screenshot({ path: path.join(dir, `${name}.png`) });
}

/** Node cards at 100 % zoom (the overview level folds them, which would hide an overlap of the full cards). */
async function fullSizeBoxes(window: Page): Promise<Box[]> {
  await window.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
  await window.keyboard.press('Control+0');
  await expect(window.locator('[data-canvas-mode="root"]')).not.toHaveAttribute('data-zoom', 'overview');
  await window.waitForTimeout(500);
  return nodeBoxes(window);
}

async function buildWithHelper(window: Page, expectedNodes: number): Promise<void> {
  await pickOption(window, 'Choose the assistant', 'TEST mode');
  await window.getByText('TEST mode is on').first().waitFor();
  await window.getByRole('tab', { name: 'Assistant' }).click();
  await window.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Build', exact: true }).click();
  const input = window.locator('textarea[aria-label="Chat message"]');
  await input.fill('build a text to image graph');
  await input.press('Enter');
  await expect(window.locator('.react-flow__node')).toHaveCount(expectedNodes, { timeout: 60000 });
  await expect(window.locator('[data-build-pending="true"]')).toHaveCount(0, { timeout: 60000 });
  await expect(window.locator('[data-live-build]')).toHaveCount(0, { timeout: 30000 });
  // The tidy glides and the view fits after it; give both time to settle.
  await window.waitForTimeout(1500);
}

test('a helper build on a canvas with two nodes ends with no overlapping nodes', async () => {
  test.setTimeout(150000);
  const { app, window, userData } = await launch('layout-build-');
  // Two nodes right where the fixture's empty-canvas coordinates would put its loader and first prompt.
  expect((await manual(window, 'lora', { type: 'add-node', nodeType: 'LoraLoader', title: 'Load LoRA', x: 0, y: 220 })).status).toBe('applied');
  expect((await manual(window, 'prompt', { type: 'add-node', nodeType: 'CLIPTextEncode', title: 'Old prompt', x: 380, y: 40 })).status).toBe('applied');
  await window.reload();
  await window.locator('#chat-provider').waitFor();
  await expect(window.locator('.react-flow__node')).toHaveCount(2);
  const before = await positions(window);

  await buildWithHelper(window, 9);
  await shot(window, 'build-on-two-nodes');
  expect(overlaps(await nodeBoxes(window))).toEqual([]);
  // The person's nodes stayed where they were.
  const after = await positions(window);
  expect(after['1']).toEqual(before['1']);
  expect(after['2']).toEqual(before['2']);
  // The last revision is the helper's tidy; Undo may take it back.
  const revisions = await window.evaluate(async () => (await (window as unknown as { electronAPI: Bridge }).electronAPI.listRevisions('desktop')) as Array<{ description: string; actor: string }>);
  expect(revisions.at(-1)).toMatchObject({ description: 'move-nodes', actor: 'ai' });

  await window.locator('.react-flow__controls-fitview').click();
  await window.waitForTimeout(600);
  await shot(window, 'build-on-two-nodes-fit');
  expect(overlaps(await fullSizeBoxes(window))).toEqual([]);
  await shot(window, 'build-on-two-nodes-100');

  await app.close();
  fs.rmSync(userData, { recursive: true, force: true });
});

test('a helper build on an empty canvas is tidied and shown whole', async () => {
  test.setTimeout(150000);
  const { app, window, userData } = await launch('layout-empty-');
  await buildWithHelper(window, 7);
  await shot(window, 'build-on-empty');
  expect(overlaps(await nodeBoxes(window))).toEqual([]);
  // Every node is on screen after the closing fit.
  const pane = await window.locator('.react-flow').boundingBox();
  for (const box of await nodeBoxes(window)) {
    expect(box.x).toBeGreaterThanOrEqual(pane!.x - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(pane!.x + pane!.width + 1);
  }
  await window.locator('.react-flow__controls-fitview').click();
  await window.waitForTimeout(600);
  await shot(window, 'build-on-empty-fit');
  expect(overlaps(await fullSizeBoxes(window))).toEqual([]);
  await shot(window, 'build-on-empty-100');
  await app.close();
  fs.rmSync(userData, { recursive: true, force: true });
});

test('Arrange the graph moves nodes in one commit and one Undo puts them back; far out the canvas is an overview', async () => {
  test.setTimeout(120000);
  const { app, window, userData } = await launch('layout-arrange-');
  expect((await manual(window, 'a', { type: 'add-node', nodeType: 'CheckpointLoaderSimple', x: 600, y: 300 })).status).toBe('applied');
  expect((await manual(window, 'b', { type: 'add-node', nodeType: 'KSampler', x: 0, y: 0 })).status).toBe('applied');
  expect((await manual(window, 'c', { type: 'add-node', nodeType: 'VAEDecode', x: 300, y: 600 })).status).toBe('applied');
  expect((await manual(window, 'l1', { type: 'connect', source: '1', sourceHandle: 'out-0', target: '2', targetHandle: 'in-0' })).status).toBe('applied');
  await window.reload();
  await window.locator('#chat-provider').waitFor();
  await expect(window.locator('.react-flow__node')).toHaveCount(3);
  const before = await positions(window);

  const arrange = window.getByRole('button', { name: 'Arrange the graph' });
  await expect(arrange).toBeEnabled();
  await arrange.click();
  await expect.poll(async () => JSON.stringify(await positions(window))).not.toBe(JSON.stringify(before));
  const arranged = await positions(window);
  // Left to right along the link: the loader before the sampler.
  expect(arranged['1'].x).toBeLessThan(arranged['2'].x);
  await window.waitForTimeout(900);
  expect(overlaps(await fullSizeBoxes(window))).toEqual([]);

  await window.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
  await window.keyboard.press('Control+z');
  await expect.poll(async () => positions(window)).toEqual(before);

  // The shortcut does the same.
  await window.keyboard.press('Control+Shift+L');
  await expect.poll(async () => JSON.stringify(await positions(window))).toBe(JSON.stringify(arranged));

  // Overview: below 50 % zoom the canvas root says so (lib/nodeSizes.ts OVERVIEW_ENTER); back in, it does not.
  // Handles stay in the DOM.
  const host = window.locator('[data-canvas-mode="root"]');
  const handles = await window.locator('.react-flow__handle').count();
  await window.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
  // Each click zooms by a step (animated under full motion), so step until the overview line is crossed.
  const zoom = () => window.evaluate(() => Number(/scale\(([\d.]+)\)/.exec(document.querySelector('.react-flow__viewport')?.getAttribute('style') ?? '')?.[1] ?? 1));
  for (let step = 0; step < 12 && (await zoom()) >= 0.5; step += 1) {
    await window.getByRole('button', { name: 'Zoom out' }).click();
    await window.waitForTimeout(260);
  }
  await expect(host).toHaveAttribute('data-zoom', 'overview');
  await expect(window.locator('.react-flow__handle')).toHaveCount(handles);
  await shot(window, 'overview');
  for (let step = 0; step < 12 && (await zoom()) <= 0.7; step += 1) {
    await window.getByRole('button', { name: 'Zoom in' }).click();
    await window.waitForTimeout(260);
  }
  await expect(host).not.toHaveAttribute('data-zoom', 'overview');

  await app.close();
  fs.rmSync(userData, { recursive: true, force: true });
});
