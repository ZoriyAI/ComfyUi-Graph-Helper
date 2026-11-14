import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { startFakeMcp, type FakeMcp } from '../fixtures/mcp/fakeMcpServer';
import { estimateNodeSize, type SizeHints, NODE_BOX } from '../../src/shared/graph/layout';
import { NEW_NODE_GAP } from '../../src/renderer/components/graph/lib/geometry';

/**
 * Where a node goes is chosen before it is drawn, so the app works out how large it will be
 * (shared/graph/layout.ts estimateNodeSize). When that came out smaller than the node really is, a tall node was
 * put right against the one below it, or on it. These tests hold the worked-out size to the drawn one:
 * - every class of a catalog is drawn and measured, and so are a node with a long name, a node with a note and a
 *   subgraph: the worked-out height is never smaller than the drawn one, and at most a few pixels larger;
 * - nodes a person adds one after another at the same place keep their distance, whatever their height;
 * NODE_SIZE_OUT=<file> keeps the table of both sizes.
 */

type Bridge = (name: string, args?: unknown[]) => Promise<any>;
interface Drawn { id: string; x: number; y: number; width: number; height: number }

/** `fake` absent: a profile where ComfyUI has not been read, as on the first start. */
async function launch(fake?: FakeMcp): Promise<{ app: ElectronApplication; page: Page; api: Bridge; userData: string }> {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'node-size-'));
  const env: Record<string, string | undefined> = { ...process.env, NODE_ENV: 'production' };
  delete env.DBUS_SESSION_BUS_ADDRESS;
  delete env.GNOME_KEYRING_CONTROL;
  const app = await electron.launch({ args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`], env: env as Record<string, string> });
  const page = await app.firstWindow();
  await page.locator('.app-shell').waitFor({ timeout: 20_000 });
  await page.setViewportSize({ width: 1440, height: 900 });
  const api: Bridge = (name, args = []) => page.evaluate(async ({ name, args }) => {
    const bridge = (window as unknown as { electronAPI: Record<string, (...input: unknown[]) => Promise<unknown>> }).electronAPI;
    return bridge[name](...args);
  }, { name, args });
  if (!fake) return { app, page, api, userData };
  const read = await api('getSettings') as { values?: Record<string, unknown> };
  expect(await api('saveSettings', [{ ...(read.values ?? {}), mcpUrl: fake.url, mcpAuth: 'none' }])).toMatchObject({ ok: true });
  await page.reload();
  await page.locator('.app-shell').waitFor({ timeout: 20_000 });
  await api('syncNow').catch(() => undefined);
  await expect.poll(async () => ((await api('syncStatus')) as { state: string }).state, { timeout: 90_000 }).not.toBe('running');
  return { app, page, api, userData };
}

let step = 0;
async function commit(api: Bridge, payload: Record<string, unknown>): Promise<Record<string, any>> {
  const current = await api('readProjection', ['desktop']) as { currentRevisionId: string };
  step += 1;
  const outcome = await api('commitCommand', [{ projectId: 'desktop', actionId: `node-size-${step}`, expectedRevisionId: current.currentRevisionId, actor: 'manual', runId: null, payload }]) as Record<string, any>;
  expect(outcome.status, JSON.stringify(payload)).toBe('applied');
  return outcome;
}

async function reloaded(page: Page): Promise<void> {
  await page.reload();
  await page.locator('.app-shell').waitFor({ timeout: 20_000 });
  await page.waitForTimeout(900);
}

/** Every node as the canvas draws it, in the canvas's own units (so the zoom does not matter). */
async function drawn(page: Page): Promise<Drawn[]> {
  return page.evaluate(() => {
    const view = document.querySelector('.react-flow__viewport');
    const matrix = view ? new DOMMatrixReadOnly(getComputedStyle(view).transform) : new DOMMatrixReadOnly();
    const zoom = matrix.a || 1;
    return Array.from(document.querySelectorAll<HTMLElement>('.react-flow__node')).map((el) => {
      const box = el.getBoundingClientRect();
      const origin = (view as HTMLElement).getBoundingClientRect();
      return {
        id: el.dataset.id ?? '',
        x: Math.round((box.left - origin.left) / zoom),
        y: Math.round((box.top - origin.top) / zoom),
        width: Math.round(box.width / zoom),
        height: Math.round(box.height / zoom),
      };
    });
  });
}

async function fullSize(page: Page): Promise<void> {
  await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
  await page.keyboard.press('Control+0');
  await expect(page.locator('[data-canvas-mode="root"]')).not.toHaveAttribute('data-zoom', 'overview');
  await page.waitForTimeout(500);
}

test('the size the app works out for a node is the size the canvas draws it at', async () => {
  test.setTimeout(240_000);
  const fake = await startFakeMcp({ extraLoras: 3 });
  const { app, page, api, userData } = await launch(fake);
  try {
    const classes = (await api('searchNodeTypes', [{ query: '', limit: 500 }]) as Array<{ classType: string; displayName: string }>);
    expect(classes.length, 'classes read from the server').toBeGreaterThan(30);
    const hints = new Map<string, SizeHints>();
    let index = 0;
    const place = () => {
      const at = { x: (index % 8) * 420, y: Math.floor(index / 8) * 900 };
      index += 1;
      return at;
    };
    for (const item of classes) {
      const detail = await api('nodeTypeDetail', [item.classType]) as { inputs: Array<{ name: string; widget: boolean; spec?: { multiline?: boolean } }> } | null;
      if (detail) hints.set(item.classType, { inputs: detail.inputs.map((input) => ({ name: input.name, widget: input.widget, multiline: Boolean(input.spec?.multiline) })) });
      // The way the library adds it: under the name a person reads.
      await commit(api, { type: 'add-node', nodeType: item.classType, ...(item.displayName ? { title: item.displayName } : {}), ...place() });
    }
    // What changes a card's height beyond its class: a name that takes two lines, a note under the fields.
    await commit(api, { type: 'add-node', nodeType: 'KSampler', title: 'Second pass over the upscaled picture with fewer steps', ...place() });
    const noted = await commit(api, { type: 'add-node', nodeType: 'CLIPTextEncode', ...place() });
    await commit(api, { type: 'annotate-node', nodeId: String(noted.result?.nodeId ?? noted.nodeId), annotation: 'Negative prompt: what must not be in the picture, in plain words.' });
    // A subgraph card with ports: two nodes folded into one, a link coming in and a link going out.
    const idOf = (outcome: Record<string, any>) => String(outcome.result?.nodeId ?? outcome.nodeId);
    const latent = idOf(await commit(api, { type: 'add-node', nodeType: 'EmptyLatentImage', ...place() }));
    const decode = idOf(await commit(api, { type: 'add-node', nodeType: 'VAEDecode', ...place() }));
    const scale = idOf(await commit(api, { type: 'add-node', nodeType: 'ImageScale', ...place() }));
    const save = idOf(await commit(api, { type: 'add-node', nodeType: 'SaveImage', ...place() }));
    const handle = async (nodeId: string, side: 'inputs' | 'outputs', name: string) => {
      const now = await api('readProjection', ['desktop']) as { snapshot: { nodes: Array<{ id: string; data: Record<string, Array<{ id: string; name: string }>> }> } };
      return now.snapshot.nodes.find((node) => String(node.id) === nodeId)!.data[side].find((port) => port.name === name)!.id;
    };
    await commit(api, { type: 'connect', source: latent, sourceHandle: await handle(latent, 'outputs', 'LATENT'), target: decode, targetHandle: await handle(decode, 'inputs', 'samples') });
    await commit(api, { type: 'connect', source: decode, sourceHandle: await handle(decode, 'outputs', 'IMAGE'), target: scale, targetHandle: await handle(scale, 'inputs', 'image') });
    await commit(api, { type: 'connect', source: scale, sourceHandle: await handle(scale, 'outputs', 'IMAGE'), target: save, targetHandle: await handle(save, 'inputs', 'images') });
    await commit(api, { type: 'create-subgraph', name: 'Decode and enlarge', nodeIds: [decode, scale] });
    // A description of many lines: its box grows a little and then scrolls, so the node stays near its worked-out size.
    const wordy = idOf(await commit(api, { type: 'add-node', nodeType: 'CLIPTextEncode', ...place() }));
    await commit(api, { type: 'set-parameter', nodeId: wordy, key: 'text', value: 'A young woman in a red coat walks slowly along a wet city street at night. '.repeat(8).trim() });
    await reloaded(page);
    await fullSize(page);

    const projection = await api('readProjection', ['desktop']) as { snapshot: { nodes: Array<{ id: string; data: Record<string, unknown> }>; subgraphs?: Array<{ id: string; name: string }> } };
    for (const definition of projection.snapshot.subgraphs ?? []) hints.set(definition.id, { subgraphName: definition.name });
    const boxes = new Map((await drawn(page)).map((box) => [box.id, box]));
    expect(boxes.size, 'every node is drawn').toBe(projection.snapshot.nodes.length);
    const lines: string[] = [];
    const wrong: string[] = [];
    for (const node of projection.snapshot.nodes) {
      const real = boxes.get(String(node.id))!;
      const worked = estimateNodeSize(node.data, hints.get(String(node.data.comfyType)) ?? null);
      if (String(node.id) === wordy) {
        // Taller than with an empty box, by no more than the growth the layout counts on: the gap kept under a
        // node is larger, so a long description never brings a node onto the one below it.
        const grown = real.height - worked.height;
        lines.push(`a description of many lines: drawn ${real.height}, worked out ${worked.height}, grown by ${grown}`);
        expect(grown, 'a long description makes its node taller').toBeGreaterThan(16);
        expect(grown, 'and by no more than the layout counts on').toBeLessThanOrEqual(NODE_BOX.textGrowth + 2);
        continue;
      }
      const over = worked.height - real.height;
      const line = `${String(node.data.title ?? node.data.comfyType).slice(0, 44).padEnd(46)} drawn ${String(real.height).padStart(4)}  worked out ${String(worked.height).padStart(4)}  ${over >= 0 ? '+' : ''}${over}`;
      lines.push(line);
      // Never smaller than drawn (two pixels for rounding), and no more than a few pixels larger.
      if (over < -2 || over > 8 || Math.abs(worked.width - real.width) > 2) wrong.push(line);
    }
    if (process.env.NODE_SIZE_OUT) fs.writeFileSync(process.env.NODE_SIZE_OUT, `${lines.join('\n')}\n`);
    expect(wrong, 'nodes whose worked-out size is not the drawn one').toEqual([]);
  } finally {
    await app.close();
    await fake.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

/** Pairs of nodes with less air between them than `least` pixels (canvas units), on both axes at once. */
function crowded(boxes: Drawn[], least: number, only?: Drawn): string[] {
  const found: string[] = [];
  for (let a = 0; a < boxes.length; a += 1) {
    for (let b = a + 1; b < boxes.length; b += 1) {
      const p = boxes[a];
      const q = boxes[b];
      if (only && p !== only && q !== only) continue;
      const apartX = Math.max(q.x - (p.x + p.width), p.x - (q.x + q.width));
      const apartY = Math.max(q.y - (p.y + p.height), p.y - (q.y + q.height));
      if (apartX < least && apartY < least) found.push(`${p.id} and ${q.id}: ${Math.max(apartX, apartY)} px apart`);
    }
  }
  return found;
}

async function openNodeLibrary(page: Page) {
  const rail = page.locator('#library-rail');
  if ((await rail.getAttribute('data-open')) !== 'true') await rail.locator('button').nth(1).click();
  else await rail.getByRole('tab').nth(0).click();
  await expect(rail).toHaveAttribute('data-open', 'true');
  return rail.locator('input').first();
}

async function addFromLibrary(page: Page, search: ReturnType<Page['locator']>, classType: string, expected: number): Promise<void> {
  await search.fill(classType);
  const row = page.locator('#node-library-list').getByRole('option').filter({ hasText: classType }).first();
  await row.waitFor();
  await row.dblclick();
  await expect(page.locator('.react-flow__node')).toHaveCount(expected);
}

async function addFromSearch(page: Page, classType: string, expected: number): Promise<void> {
  await page.locator('[data-canvas-add-node]').click();
  // This test runs in the default language, so the search is found by its role, not by its name.
  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('listbox') }).last();
  await dialog.locator('input').fill(classType);
  const row = dialog.getByRole('option').filter({ hasText: classType }).first();
  await row.waitFor();
  await row.click();
  await expect(page.locator('.react-flow__node')).toHaveCount(expected);
}

test('before ComfyUI is read, nodes added one after another keep their distance too', async () => {
  test.setTimeout(180_000);
  const { app, page, api, userData } = await launch();
  try {
    // Before anything is read the library shows what to do instead of a list, so the nodes come from the
    // add-node search. The classes the app knows by name before anything is read get the ports the app ships.
    const added = ['KSampler', 'KSampler', 'CLIPTextEncode', 'KSampler', 'CheckpointLoaderSimple', 'VAEDecode', 'CLIPTextEncode'];
    for (const [count, classType] of added.entries()) await addFromSearch(page, classType, count + 1);
    await fullSize(page);
    const boxes = await drawn(page);
    expect(crowded(boxes, NEW_NODE_GAP - 4), `nodes closer than ${NEW_NODE_GAP - 4} px`).toEqual([]);
    // And the size worked out for each is the size it is drawn at.
    const projection = await api('readProjection', ['desktop']) as { snapshot: { nodes: Array<{ id: string; data: Record<string, unknown> }> } };
    const byId = new Map(boxes.map((box) => [box.id, box]));
    for (const node of projection.snapshot.nodes) {
      const real = byId.get(String(node.id))!;
      expect(estimateNodeSize(node.data).height - real.height, `${String(node.data.comfyType)} drawn ${real.height}`).toBeGreaterThanOrEqual(-2);
      expect(estimateNodeSize(node.data).height - real.height, `${String(node.data.comfyType)} drawn ${real.height}`).toBeLessThanOrEqual(8);
    }
  } finally {
    await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

test('nodes added one after another at the same place keep their distance, tall ones too', async () => {
  test.setTimeout(240_000);
  const fake = await startFakeMcp({ extraLoras: 3 });
  const { app, page, api, userData } = await launch(fake);
  try {
    const search = await openNodeLibrary(page);
    // The tall ones first: each next node has to find room around them.
    const added = ['KSamplerAdvanced', 'WanVideoTextEncode', 'KSampler', 'ControlNetApplyAdvanced', 'CLIPTextEncode', 'KSamplerAdvanced', 'LoraLoader', 'VAEDecode', 'KSampler', 'ImageResizeKJ'];
    for (const [count, classType] of added.entries()) await addFromLibrary(page, search, classType, count + 1);
    await search.fill('');
    await fullSize(page);
    // Air a person sees between two nodes: the gap the app keeps, less a few pixels of rounding.
    const least = NEW_NODE_GAP - 4;
    expect(crowded(await drawn(page), least), `nodes closer than ${least} px`).toEqual([]);

    // The same from the canvas's map (zoomed far out), where a node is drawn as a small block: the next node
    // still gets room for the whole node.
    await page.locator('.react-flow__controls-fitview').click();
    for (let turn = 0; turn < 8; turn += 1) await page.locator('.react-flow__controls-zoomout').click();
    await page.waitForTimeout(500);
    await expect(page.locator('[data-canvas-mode="root"]')).toHaveAttribute('data-zoom', 'overview');
    await addFromLibrary(page, search, 'KSamplerAdvanced', added.length + 1);
    await search.fill('');
    await fullSize(page);
    const after = await drawn(page);
    expect(crowded(after, least, after[after.length - 1]), 'a node added from the map of the canvas').toEqual([]);
  } finally {
    await app.close();
    await fake.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
