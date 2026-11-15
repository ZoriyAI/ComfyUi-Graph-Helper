/**
 * E2E spec for the editing journey of a learner (editing package): place a LoRA on an existing link from the link's
 * menu, bypass a node with its shortcut, replace a node keeping its links, add a note from the canvas menu and write
 * it, and see in the node search one line on what each node does. Each step is checked in the engine's graph, and one
 * Undo takes back exactly one step.
 */
import { test, expect, _electron as electron, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { useEnglish } from './locale';
import { startFakeMcp } from '../fixtures/mcp/fakeMcpServer';

type Node = { id: string; data: { comfyType: string; comfy?: { mode?: number; widgets_values?: unknown[] }; inputs: Array<{ id: string; name: string }> } };
type Edge = { id: string; source: string; target: string; targetHandle: string };

async function connectAndSync(window: Page, url: string) {
  await window.evaluate(async (mcpUrl) => {
    const api = (window as any).electronAPI;
    const read = await api.getSettings();
    await api.saveSettings({ ...(read.values ?? {}), mcpUrl, mcpAuth: 'none' });
    await api.syncNow();
  }, url);
  await expect(window.locator('.sync-indicator')).toHaveAttribute('data-sync-state', 'idle', { timeout: 30000 });
}

async function graph(window: Page): Promise<{ nodes: Node[]; edges: Edge[] }> {
  return window.evaluate(async () => {
    const projection = await (window as any).electronAPI.readProjection('desktop');
    return { nodes: projection.snapshot.nodes, edges: projection.snapshot.edges };
  });
}

async function manual(window: Page, payload: unknown) {
  return window.evaluate(async (input) => {
    const api = (window as any).electronAPI;
    const current = await api.readProjection('desktop');
    return api.commitCommand({ projectId: 'desktop', actionId: `e2e-${Math.random()}`, expectedRevisionId: current.currentRevisionId, actor: 'manual', runId: null, payload: input });
  }, payload);
}

/** Screen point of a link's middle, for a right-click. */
async function edgeMiddle(window: Page, edgeId: string) {
  return window.evaluate((id) => {
    const path = document.querySelector(`.react-flow__edge[data-id="${id}"] path`) as SVGPathElement | null;
    if (!path) return null;
    const point = path.getPointAtLength(path.getTotalLength() / 2);
    const matrix = path.getScreenCTM()!;
    return { x: point.x * matrix.a + matrix.e, y: point.y * matrix.d + matrix.f };
  }, edgeId);
}

test('editing: a node on a link, bypass, replace, a note, and a search that says what nodes do', async () => {
  test.setTimeout(240000);
  const fake = await startFakeMcp();
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'editing-'));
  const app = await electron.launch({
    args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  const errors: string[] = [];
  try {
    const window = await app.firstWindow();
    window.on('pageerror', (error) => errors.push(error.message));
    await window.setViewportSize({ width: 1440, height: 900 });
    await useEnglish(window);
    await connectAndSync(window, fake.url);

    await manual(window, { type: 'add-node', nodeType: 'CheckpointLoaderSimple', title: 'Load Checkpoint', x: 0, y: 0 });
    await manual(window, { type: 'add-node', nodeType: 'KSampler', title: 'KSampler', x: 700, y: 0 });
    await manual(window, { type: 'connect', source: '1', sourceHandle: 'out-0', target: '2', targetHandle: 'in-0' });
    // Edits made through the bridge reach the canvas on the next load.
    await window.reload();
    await window.locator('#chat-provider').waitFor();
    await window.keyboard.press('Shift+1');
    await expect(window.locator('.react-flow__node')).toHaveCount(2);
    const link = (await graph(window)).edges[0];

    // A LoRA on the link, from the link's menu.
    const middle = await edgeMiddle(window, link.id);
    expect(middle).not.toBeNull();
    // A right-click on the link itself (a thin line: the event goes to its path, where a person's click lands).
    await window.evaluate(({ id, x, y }) => {
      const path = document.querySelector(`.react-flow__edge[data-id="${id}"] path`)!;
      path.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 2 }));
    }, { id: link.id, x: middle!.x, y: middle!.y });
    await window.getByRole('menuitem', { name: 'Insert node…' }).click();
    const box = window.locator('[data-purpose="insert"]');
    await expect(box).toContainText('Node to place on the link (MODEL)');
    await box.getByRole('textbox').fill('lora');
    await expect(box.getByRole('option').first()).toBeVisible();
    await box.getByRole('textbox').press('Enter');
    await expect(window.locator('.react-flow__node')).toHaveCount(3);
    let state = await graph(window);
    const lora = state.nodes.find((node) => node.data.comfyType.startsWith('Lora'))!;
    expect(state.edges.some((edge) => edge.source === '1' && edge.target === lora.id)).toBe(true);
    expect(state.edges.some((edge) => edge.source === lora.id && edge.target === '2')).toBe(true);
    expect(state.edges.some((edge) => edge.id === link.id)).toBe(false);

    // Bypass the sampler with the shortcut, and back.
    const sampler = window.locator('.react-flow__node[data-id="2"]');
    await sampler.locator('.graph-node-title').click();
    await window.keyboard.press('Control+Shift+B');
    await expect.poll(async () => (await graph(window)).nodes.find((node) => node.id === '2')!.data.comfy?.mode).toBe(4);
    await expect(sampler.locator('[data-run-mode="bypassed"]')).toHaveCount(1);
    await window.keyboard.press('Control+Shift+B');
    await expect.poll(async () => (await graph(window)).nodes.find((node) => node.id === '2')!.data.comfy?.mode).toBe(0);

    // Replace the sampler by KSampler (Advanced): the links stay.
    await sampler.locator('.graph-node-title').click({ button: 'right' });
    await window.getByRole('menuitem', { name: 'Replace with…' }).click();
    const replace = window.locator('[data-purpose="replace"]');
    await replace.getByRole('textbox').fill('ksampler advanced');
    await expect(replace.getByRole('option').first()).toContainText('KSampler (Advanced)');
    await replace.getByRole('textbox').press('Enter');
    await expect.poll(async () => (await graph(window)).nodes.find((node) => node.id === '2')!.data.comfyType).toBe('KSamplerAdvanced');
    state = await graph(window);
    expect(state.edges.some((edge) => edge.source === lora.id && edge.target === '2')).toBe(true);

    // A note from the canvas menu, written in place; one Undo takes the text back.
    await window.mouse.click(1000, 780, { button: 'right' });
    await window.getByRole('menuitem', { name: 'Add note' }).click();
    await expect(window.locator('.react-flow__node')).toHaveCount(4);
    const note = window.locator('.react-flow__node').filter({ has: window.locator('[role="note"]') }).first();
    await note.getByRole('note').dblclick();
    await window.getByRole('textbox', { name: 'Note text' }).fill('Strength 0.8 keeps the face.');
    await window.keyboard.press('Control+Enter');
    await expect(note.getByRole('note')).toHaveText('Strength 0.8 keeps the face.');
    const noteNode = (await graph(window)).nodes.find((node) => node.data.comfyType === 'Note')!;
    expect(noteNode.data.comfy?.widgets_values?.[0]).toBe('Strength 0.8 keeps the face.');
    await window.locator('.react-flow__pane').click({ position: { x: 20, y: 20 } });
    await window.keyboard.press('Control+z');
    await expect.poll(async () => (await graph(window)).nodes.find((node) => node.data.comfyType === 'Note')?.data.comfy?.widgets_values?.[0]).toBe('');

    // The search says what a node does.
    await window.keyboard.press('Control+k');
    const search = window.getByRole('dialog', { name: 'Add node' });
    await search.getByRole('textbox').fill('upscale image');
    await expect(search.getByRole('option').first().locator('[class*="resultDesc"]')).not.toHaveText('');
    await window.keyboard.press('Escape');

    expect(errors).toEqual([]);
  } finally {
    await app.close();
    await fake.close();
  }
});
