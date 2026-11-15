/**
 * E2E spec: an imported ComfyUI workflow looks and behaves the way its file describes it (IMPORT+NODES): sizes from the
 * file, collapsed nodes, Reroute dots and native reroute points, a Primitive's value, notes, Set / Get partners,
 * nodes that are not installed, colours, promoted fields of a subgraph copy, no node on another after the import,
 * and the file's own view. LOOK_SHOTS=<dir> also opens real workflows (LOOK_FILES=name=path,...) and keeps shots.
 * A person who opens a workflow from the internet should recognise it as the same graph ComfyUI shows.
 */
import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { useEnglish } from './locale';
import { startFakeMcp, type FakeMcp } from '../fixtures/mcp/fakeMcpServer';
import { estimateNodeSize, sizeHintsOfClass } from '../../src/shared/graph/layout';
import { classPresence } from '../../src/shared/workflow/comfyLook';
import { en } from '../../src/shared/i18n/catalog';

const FIXTURE = path.join(__dirname, '../fixtures/workflows/import-look-0.4.json');
const SHOTS = process.env.LOOK_SHOTS;

type Box = { id: string; x: number; y: number; width: number; height: number };

async function launch(fake: FakeMcp, size = { width: 1600, height: 1000 }): Promise<{ app: ElectronApplication; page: Page }> {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'import-look-'));
  const env: Record<string, string | undefined> = { ...process.env, NODE_ENV: 'production' };
  // No session bus, so Electron does not talk to the desktop's keyring during the run.
  delete env.DBUS_SESSION_BUS_ADDRESS;
  const app = await electron.launch({ args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`], env: env as Record<string, string> });
  const page = await app.firstWindow();
  await page.setViewportSize(size);
  await useEnglish(page);
  await page.evaluate(async (mcpUrl) => {
    const api = (window as any).electronAPI;
    const read = await api.getSettings();
    await api.saveSettings({ ...(read.values ?? {}), mcpUrl, mcpAuth: 'none' });
    await api.syncNow();
  }, fake.url);
  await expect.poll(async () => page.evaluate(async () => (await (window as any).electronAPI.syncStatus()).state), { timeout: 90_000 }).not.toBe('running');
  return { app, page };
}

async function openWorkflow(app: ElectronApplication, page: Page, file: string): Promise<void> {
  await app.evaluate(({ dialog }, p) => {
    (dialog as any).showOpenDialog = async () => ({ canceled: false, filePaths: [p] });
  }, file);
  // The toolbar's Open workflow… runs File ▸ Import. Ctrl+I would stay with the chat field, which has focus at the
  // start (shortcuts other than Save, Open, New and Check do not work while typing).
  await page.getByRole('toolbar', { name: en.toolbar.aria }).getByRole('button', { name: en.toolbar.import, exact: true }).click();
  await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(2500);
}

/** Node boxes in canvas units, from React Flow's own positions and measured sizes. */
async function boxes(page: Page): Promise<Box[]> {
  return page.evaluate(() => {
    const viewport = document.querySelector('.react-flow__viewport') as HTMLElement;
    const zoom = new DOMMatrixReadOnly(getComputedStyle(viewport).transform).a;
    return Array.from(document.querySelectorAll<HTMLElement>('.react-flow__node')).map((node) => {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform);
      const rect = node.getBoundingClientRect();
      return { id: node.dataset.id ?? '', x: matrix.e, y: matrix.f, width: rect.width / zoom, height: rect.height / zoom };
    });
  });
}

function overlaps(list: Box[], pairs: string[] = []): number {
  let count = 0;
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const a = list[i];
      const b = list[j];
      if (a.x < b.x + b.width - 1 && a.x + a.width - 1 > b.x && a.y < b.y + b.height - 1 && a.y + a.height - 1 > b.y) {
        count += 1;
        pairs.push(`${JSON.stringify(a)} ${JSON.stringify(b)}`);
      }
    }
  }
  return count;
}

const node = (page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);

test('an imported workflow is drawn as its file describes it', async () => {
  test.setTimeout(240_000);
  const fake = await startFakeMcp({ video: true });
  // Wide enough that the file's own view (60 %) shows the whole fixture with every card whole.
  const { app, page } = await launch(fake, { width: 2560, height: 1440 });
  try {
    await openWorkflow(app, page, FIXTURE);

    // Nothing covers anything after the import, and the person is told how many nodes moved.
    await expect(page.getByText(/Nodes moved apart so none covers another/)).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(600);
    const pairs: string[] = [];
    expect(overlaps(await boxes(page), pairs), pairs.join('\n')).toBe(0);

    // The first view is the file's own (extra.ds scale 0.6).
    const zoom = await page.evaluate(() => new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.react-flow__viewport') as HTMLElement).transform).a);
    expect(zoom).toBeCloseTo(0.6, 2);

    // Sizes from the file: a 425 px wide text encoder, and the estimate matches the drawn card.
    const projection = await page.evaluate(async () => (await (window as any).electronAPI.readProjection('desktop')).snapshot.nodes);
    const drawn = new Map((await boxes(page)).map((item) => [item.id, item]));
    for (const id of ['1', '2', '4', '5', '8', '10', '11', '6', '7', '12', '14', '15']) {
      const data = projection.find((item: any) => item.id === id).data;
      const detail = await page.evaluate(async (type) => (window as any).electronAPI.nodeTypeDetail(type), data.comfyType);
      const missing = classPresence(data.comfyType, detail ?? null, true, data.kind === 'subgraph-instance') === 'missing';
      const hints = detail ? sizeHintsOfClass(detail) : { missing };
      const estimate = estimateNodeSize(data, hints);
      const box = drawn.get(id)!;
      expect(Math.abs(box.width - estimate.width), `width of ${id}`).toBeLessThanOrEqual(1);
      // Never drawn larger than worked out (a spot chosen with it is free), and at most a few pixels smaller.
      expect(box.height, `height of ${id}`).toBeLessThanOrEqual(estimate.height + 1);
      expect(estimate.height - box.height, `height of ${id}`).toBeLessThanOrEqual(6);
    }
    expect(drawn.get('2')!.width).toBeCloseTo(425, 0);

    // A collapsed node is one title row and opens with its arrow; Alt+C folds it again; both reach the file.
    await expect(node(page, '6').locator('[data-collapsed="true"]')).toBeVisible();
    expect(drawn.get('6')!.height).toBeLessThanOrEqual(37);
    await node(page, '6').getByRole('button', { name: /Open/ }).click();
    await expect(node(page, '6').locator('[data-collapsed="true"]')).toHaveCount(0);
    await node(page, '6').click({ position: { x: 20, y: 10 } });
    await page.keyboard.press('Alt+c');
    await expect(node(page, '6').locator('[data-collapsed="true"]')).toBeVisible();
    const flags = await page.evaluate(async () => (await (window as any).electronAPI.readProjection('desktop')).snapshot.nodes.find((item: any) => item.id === '6').data.comfy.flags);
    expect(flags).toEqual({ collapsed: true });

    // A Reroute is a dot of the colour of what passes; the native reroute point of a link is drawn.
    await expect(node(page, '7').locator('[data-node-kind="reroute"]')).toHaveAttribute('data-reroute-type', 'VAE');
    await expect(page.locator('[data-reroute-point="1"]')).toHaveCount(1);

    // A Primitive shows its value as the field it feeds, with its switch.
    await expect(node(page, '8').locator('[data-primitive-for="width"]')).toBeVisible();
    await expect(node(page, '8').locator('[data-field="control_after_generate"]')).toBeVisible();
    await expect(node(page, '8').locator('input').first()).toHaveValue('832');

    // Notes: markdown drawn (a heading, bold), the link kept as text.
    await expect(node(page, '11').getByRole('heading', { name: 'Models' })).toBeVisible();
    await expect(node(page, '11').locator('a')).toHaveCount(0);
    await expect(node(page, '11').locator('strong')).toHaveText('Put');

    // A class that is not installed: dashed frame, a mark, its saved values read-only, object values as service data.
    await expect(node(page, '14').locator('[data-class-missing="true"]')).toBeVisible();
    await expect(node(page, '14').getByText('Not installed')).toBeVisible();
    await expect(node(page, '14').locator('[data-saved-values="3"]')).toContainText('service data');
    await expect(node(page, '14').locator('.port-type')).toHaveText('…CLIPEMBEDS');
    await node(page, '14').click({ position: { x: 30, y: 12 } });
    await expect(page.locator('.inspector-look')).toContainText('This node is not installed in your ComfyUI');
    await expect(page.getByText(/Run a sync and the fields appear/)).toHaveCount(0);

    // Colours from the file tint the card.
    await expect(node(page, '1').locator('.graph-node')).toHaveCSS('--file-color', '#322');

    // A subgraph copy shows the fields its author promoted, with the file's values.
    await expect(node(page, '15').locator('[data-promoted-fields="2"]')).toBeVisible();
    await expect(node(page, '15').locator('[data-field="steps"] input')).toHaveValue('12');
    await expect(node(page, '15').locator('[data-field="text"] textarea, [data-field="text"] input')).toHaveValue('inner prompt');

    // Set / Get: selecting the Get shows its Set; the menu jumps there.
    // The imported Get is collapsed; its title remains the target at the file's 60% zoom.
    const getTitle = node(page, '13').locator('.graph-node-title');
    await getTitle.click();
    await expect(page.locator('[data-set-get-partners="12"]')).toHaveCount(1);
    await getTitle.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Go to its Set' }).click();
    await expect(node(page, '12')).toHaveClass(/selected/);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'fixture-after.png') });
  } finally {
    await app.close();
    await fake.close?.();
  }
});

test('real workflows open without a pile (shots)', async () => {
  test.skip(!SHOTS || !process.env.LOOK_FILES, 'LOOK_SHOTS and LOOK_FILES name real workflows to open');
  test.setTimeout(600_000);
  const fake = await startFakeMcp({ video: true });
  const { app, page } = await launch(fake);
  const log: string[] = [];
  try {
    for (const entry of (process.env.LOOK_FILES ?? '').split(',').filter(Boolean)) {
      const [name, file] = entry.split('=');
      await openWorkflow(app, page, file);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SHOTS!, `${name}-after.png`) });
      const list = await boxes(page);
      log.push(`${name}: nodes ${list.length}, overlaps ${overlaps(list)}`);
      await page.keyboard.press('Shift+1');
      await page.waitForTimeout(900);
      await page.screenshot({ path: path.join(SHOTS!, `${name}-after-fit.png`) });
    }
  } finally {
    fs.writeFileSync(path.join(SHOTS!, 'overlaps.txt'), log.join('\n'));
    await app.close();
    await fake.close?.();
  }
});
