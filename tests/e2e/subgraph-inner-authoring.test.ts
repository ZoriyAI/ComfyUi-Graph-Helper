import { test, expect, _electron as electron, type Locator, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { useEnglish } from './locale';
import { startFakeMcp } from '../fixtures/mcp/fakeMcpServer';

/**
 * A subgraph is edited from the inside like the main canvas, against the fake MCP server (labelled fixture):
 * make a subgraph from a selection, open it, add a node from the toolbar search and one by dragging it from the
 * library (both land on free space), wire the new node to an inner node and to a new output slot, delete another
 * inner node with the keyboard, undo and redo (also after leaving), check the instance on the main canvas, and
 * read the workflow saved for ComfyUI.
 */
const artifactDir = path.join(__dirname, '../../test-results/subgraph-inner-authoring');

type Api = {
  getSettings: () => Promise<{ values?: Record<string, unknown> }>;
  saveSettings: (input: unknown) => Promise<{ ok: boolean; error?: string }>;
  syncNow: () => Promise<{ state: string; lastError: string | null }>;
  readProjection: (id: string) => Promise<{ currentRevisionId: string; snapshot: { nodes: any[]; edges: any[]; subgraphs?: any[] } }>;
  commitCommand: (request: unknown) => Promise<{ status: string; result: any }>;
  exportWorkflowDocument: () => Promise<{ ok: boolean; workflow: Record<string, any> }>;
};

async function connectAndSync(window: Page, url: string) {
  const saved = await window.evaluate(async (mcpUrl) => {
    const api = (window as unknown as { electronAPI: Api }).electronAPI;
    const read = await api.getSettings();
    const result = await api.saveSettings({ ...(read.values ?? {}), mcpUrl, mcpAuth: 'none' });
    if (!result.ok) return result;
    const status = await api.syncNow();
    return { ok: status.state !== 'error', error: status.lastError ?? undefined };
  }, url);
  expect(saved).toMatchObject({ ok: true });
  await expect(window.locator('.sync-indicator')).toHaveAttribute('data-sync-state', 'idle', { timeout: 30000 });
}

async function commit(window: Page, payload: Record<string, unknown>): Promise<{ status: string; result: any }> {
  return window.evaluate(async (body) => {
    const api = (window as unknown as { electronAPI: Api }).electronAPI;
    const head = await api.readProjection('desktop');
    return api.commitCommand({ projectId: 'desktop', actionId: `seed-${Math.random()}`, expectedRevisionId: head.currentRevisionId, actor: 'manual', runId: null, payload: body });
  }, payload);
}

async function snapshot(window: Page) {
  return (await window.evaluate(() => (window as unknown as { electronAPI: Api }).electronAPI.readProjection('desktop'))).snapshot;
}

async function exported(window: Page): Promise<Record<string, any>> {
  const result = await window.evaluate(() => (window as unknown as { electronAPI: Api }).electronAPI.exportWorkflowDocument());
  expect(result.ok).toBe(true);
  return result.workflow;
}

async function innerIds(window: Page, definitionId: string): Promise<string[]> {
  const definition = (await snapshot(window)).subgraphs!.find((item) => item.id === definitionId);
  return definition.nodes.map((node: { id: string }) => String(node.id)).sort();
}

function overlaps(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

async function expectNoOverlap(nodes: Locator) {
  const boxes = [];
  for (let index = 0; index < await nodes.count(); index += 1) boxes.push((await nodes.nth(index).boundingBox())!);
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) expect(overlaps(boxes[i], boxes[j]), `nodes ${i} and ${j} overlap`).toBe(false);
  }
}

/** Drags from one handle to another with the mouse, as a person does. */
async function dragLink(window: Page, from: Locator, to: Locator) {
  const a = (await from.boundingBox())!;
  const b = (await to.boundingBox())!;
  await window.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await window.mouse.down();
  await window.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 15 });
  await window.mouse.up();
}

test('a subgraph is edited from the inside like the main canvas, and the saved workflow is well-formed', async () => {
  test.setTimeout(240000);
  fs.mkdirSync(artifactDir, { recursive: true });
  const fake = await startFakeMcp();
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'subgraph-inner-'));
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

    // A loader feeding two prompts on the main canvas.
    const loader = await commit(window, { type: 'add-node', nodeType: 'CheckpointLoaderSimple', x: 0, y: 0 });
    const positive = await commit(window, { type: 'add-node', nodeType: 'CLIPTextEncode', x: 420, y: 0 });
    const negative = await commit(window, { type: 'add-node', nodeType: 'CLIPTextEncode', x: 420, y: 320 });
    const [loaderId, positiveId, negativeId] = [loader, positive, negative].map((item) => String(item.result.nodeId));
    const nodes = (await snapshot(window)).nodes;
    const clipIn = nodes.find((node) => node.id === positiveId).data.inputs.find((port: { name: string }) => port.name === 'clip').id;
    const clipOut = nodes.find((node) => node.id === loaderId).data.outputs.find((port: { name: string }) => port.name === 'CLIP').id;
    for (const target of [positiveId, negativeId]) {
      expect((await commit(window, { type: 'connect', source: loaderId, sourceHandle: clipOut, target, targetHandle: clipIn })).status).toBe('applied');
    }

    // The canvas reads the seeded graph.
    await window.reload();
    await window.locator('#chat-provider').waitFor();

    // Select the two prompts and make a subgraph of them from the context menu.
    await expect(window.locator(`.react-flow__node[data-id="${negativeId}"]`)).toBeVisible();
    await window.locator(`.react-flow__node[data-id="${positiveId}"] .graph-node-title`).click();
    await window.locator(`.react-flow__node[data-id="${negativeId}"] .graph-node-title`).click({ modifiers: ['Control'] });
    await window.locator(`.react-flow__node[data-id="${negativeId}"] .graph-node-title`).click({ button: 'right' });
    await window.getByRole('menuitem', { name: 'Make a subgraph from selection' }).click();
    await expect.poll(async () => ((await snapshot(window)).subgraphs ?? []).length).toBe(1);
    const definitionId = String((await snapshot(window)).subgraphs![0].id);
    const instance = (await snapshot(window)).nodes.find((node) => node.data?.subgraphId === definitionId);
    const instanceId = String(instance.id);
    expect(instance.data.inputs).toHaveLength(2);

    // Open it.
    await window.locator(`.react-flow__node[data-id="${instanceId}"]`).dblclick();
    await expect(window.locator('[data-canvas-mode="definition"]')).toBeVisible();
    await expect(window.getByText('Inside a subgraph: changes apply to every copy of it.', { exact: false })).toBeVisible();
    const innerNodes = window.locator('.react-flow__node-comfy');
    await expect(innerNodes).toHaveCount(2);

    // Add a node with the toolbar's Node button and its search: it goes inside, on free space.
    await window.locator('[data-canvas-add-node]').click();
    const search = window.getByRole('dialog', { name: 'Add node' }).locator('input');
    await search.fill('combine');
    await window.getByRole('dialog', { name: 'Add node' }).getByRole('option').filter({ hasText: 'Conditioning (Combine)' }).first().click();
    await expect(innerNodes).toHaveCount(3);
    await expect.poll(() => innerIds(window, definitionId)).toHaveLength(3);
    const combineId = (await innerIds(window, definitionId)).find((id) => id !== positiveId && id !== negativeId)!;
    // The definition numbers its new node after its own highest id.
    expect(Number(combineId)).toBe(Math.max(Number(positiveId), Number(negativeId)) + 1);
    // The main canvas did not get it.
    expect((await snapshot(window)).nodes.some((node) => node.data?.comfyType === 'ConditioningCombine')).toBe(false);

    // Drag one from the library onto the subgraph's canvas.
    const rail = window.locator('#library-rail');
    await rail.getByRole('tab', { name: 'Nodes' }).click();
    const nodeSearch = rail.getByRole('searchbox', { name: 'Search nodes' }).or(rail.getByRole('textbox', { name: 'Search nodes' })).first();
    await nodeSearch.fill('empty latent');
    const latentRow = window.locator('#node-library-list').getByRole('option').filter({ hasText: 'Empty Latent Image' });
    await expect(rail.getByText('1 result', { exact: true })).toBeVisible();
    // A drag the window is still settling under can miss: it is repeated until the node is there.
    await expect(async () => {
      if (await innerNodes.count() < 4) await latentRow.first().dragTo(window.locator('.react-flow__pane'), { targetPosition: { x: 150, y: 620 } });
      await expect(innerNodes).toHaveCount(4, { timeout: 3000 });
    }).toPass({ timeout: 20000 });
    await expect.poll(() => innerIds(window, definitionId)).toHaveLength(4);
    await expectNoOverlap(innerNodes);
    await window.screenshot({ path: path.join(artifactDir, 'inside-after-adding.png') });

    // A double click on empty canvas and the shortcut open the same search inside the subgraph.
    await window.locator('.react-flow__pane').dblclick({ position: { x: 40, y: 700 } });
    await expect(window.getByRole('dialog', { name: 'Add node' })).toBeVisible();
    await window.keyboard.press('Escape');
    await expect(window.getByRole('dialog', { name: 'Add node' })).toHaveCount(0);
    await window.locator('.react-flow__pane').click({ position: { x: 40, y: 700 } });
    await window.keyboard.press('Control+k');
    await expect(window.getByRole('dialog', { name: 'Add node' })).toBeVisible();
    await window.keyboard.press('Escape');

    // Fit works inside too: everything is in view before wiring by hand.
    await window.locator('.react-flow__controls-fitview').click();
    await window.waitForTimeout(800);

    // Wire the positive prompt into the new node, and the new node into the empty output slot (a new slot).
    const combine = window.locator(`.react-flow__node[data-id="${combineId}"]`);
    await dragLink(window, window.locator(`.react-flow__node[data-id="${positiveId}"] .react-flow__handle.source`).first(), combine.locator('.react-flow__handle.target').first());
    await expect.poll(async () => (await snapshot(window)).subgraphs![0].edges.some((edge: any) => edge.source === positiveId && edge.target === combineId)).toBe(true);
    await dragLink(window, combine.locator('.react-flow__handle.source').first(), window.locator('.react-flow__node[data-id="-20"] [data-new-slot] .react-flow__handle'));
    await expect.poll(async () => (await snapshot(window)).subgraphs![0].outputs.length).toBe(1);
    await expect(window.locator('.react-flow__node[data-id="-20"] [data-port-handle="in-0"]')).toBeVisible();
    // The two input slots made from two "clip" ports have distinct names.
    expect((await snapshot(window)).subgraphs![0].inputs.map((slot: { name: string }) => slot.name)).toEqual(['clip', 'CLIPTextEncode · clip']);
    // Rename the new output slot in place: double click, type, Enter.
    await window.locator('.react-flow__node[data-id="-20"] [data-port-handle="in-0"] .port-name').dblclick();
    const slotField = window.getByRole('textbox', { name: 'Output name' });
    await slotField.fill('Mixed');
    await slotField.press('Enter');
    await expect(window.locator('.react-flow__node[data-id="-20"] [data-port-handle="in-0"] .port-name')).toHaveText('Mixed');

    // Delete the negative prompt with the keyboard: its slot link goes, the slot stays.
    await window.locator(`.react-flow__node[data-id="${negativeId}"] .graph-node-title`).click();
    await window.locator(`.react-flow__node[data-id="${negativeId}"]`).focus();
    await window.keyboard.press('Delete');
    await expect(window.locator(`.react-flow__node[data-id="${negativeId}"]`)).toHaveCount(0);
    await expect.poll(() => innerIds(window, definitionId)).not.toContain(negativeId);
    expect((await snapshot(window)).subgraphs![0].inputs).toHaveLength(2);

    // Undo brings it back (with its link to the slot), redo takes it away again.
    await window.locator('.react-flow__pane').click({ position: { x: 5, y: 5 } });
    await window.keyboard.press('Control+z');
    await expect(window.locator(`.react-flow__node[data-id="${negativeId}"]`)).toHaveCount(1);
    await expect.poll(async () => (await snapshot(window)).subgraphs![0].edges.some((edge: any) => edge.source === '-10' && edge.target === negativeId)).toBe(true);
    await window.keyboard.press('Control+Shift+z');
    await expect(window.locator(`.react-flow__node[data-id="${negativeId}"]`)).toHaveCount(0);
    await window.screenshot({ path: path.join(artifactDir, 'inside-after-delete.png') });

    // Escape leaves: the instance has both inputs (one now feeds nothing inside) and the renamed output.
    await window.locator('.react-flow__pane').click({ position: { x: 5, y: 5 } });
    await window.keyboard.press('Escape');
    await expect(window.locator('[data-canvas-mode="root"]')).toBeVisible();
    const card = window.locator(`.react-flow__node[data-id="${instanceId}"]`);
    await expect(card.locator('.react-flow__handle.target')).toHaveCount(2);
    await expect(card.locator('.react-flow__handle.source')).toHaveCount(1);
    await expect(card).toContainText('Mixed');
    expect((await snapshot(window)).edges.filter((edge: any) => edge.target === instanceId)).toHaveLength(2);

    // Undo and redo still reach the inner edit from the main canvas.
    await window.locator('.react-flow__pane').click({ position: { x: 5, y: 5 } });
    await window.keyboard.press('Control+z');
    await expect.poll(() => innerIds(window, definitionId)).toContain(negativeId);
    await window.keyboard.press('Control+Shift+z');
    await expect.poll(() => innerIds(window, definitionId)).not.toContain(negativeId);

    // The workflow for ComfyUI: the definition holds the inner nodes, its links name them, the slots list theirs.
    const workflow = await exported(window);
    const definition = workflow.definitions.subgraphs.find((item: { id: string }) => item.id === definitionId);
    const ids = definition.nodes.map((node: { id: number }) => node.id).sort((a: number, b: number) => a - b);
    expect(ids).toEqual([Number(positiveId), Number(combineId), Number(combineId) + 1]);
    expect(definition.nodes.map((node: { type: string }) => node.type).sort()).toEqual(['CLIPTextEncode', 'ConditioningCombine', 'EmptyLatentImage']);
    const linkIds = new Set(definition.links.map((link: { id: number }) => link.id));
    for (const link of definition.links) {
      expect(link.origin_id === -10 || ids.includes(link.origin_id)).toBe(true);
      expect(link.target_id === -20 || ids.includes(link.target_id)).toBe(true);
    }
    expect(definition.inputs).toHaveLength(2);
    expect(definition.outputs).toHaveLength(1);
    for (const slot of [...definition.inputs, ...definition.outputs]) for (const id of slot.linkIds) expect(linkIds.has(id)).toBe(true);
    expect(definition.outputs[0].linkIds).toHaveLength(1);
    expect(definition.outputs[0]).toMatchObject({ name: 'CONDITIONING', label: 'Mixed' });
    // The negative prompt's input slot keeps no link inside, as in ComfyUI.
    expect(definition.inputs.filter((slot: { linkIds: number[] }) => slot.linkIds.length === 0)).toHaveLength(1);
    expect(definition.state.lastNodeId).toBeGreaterThanOrEqual(Math.max(...ids));
    expect(definition.state.lastLinkId).toBeGreaterThanOrEqual(Math.max(...linkIds as Set<number>));
    const root = workflow.nodes.find((node: { id: number }) => node.id === Number(instanceId));
    expect(root.type).toBe(definitionId);
    expect(root.inputs).toHaveLength(2);
    expect(root.outputs).toHaveLength(1);
    fs.writeFileSync(path.join(artifactDir, 'workflow.json'), JSON.stringify(workflow, null, 2));
    expect(errors).toEqual([]);
  } finally {
    await app.close();
    await fake.close();
  }
});
