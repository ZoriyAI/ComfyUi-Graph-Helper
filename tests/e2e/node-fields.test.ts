import { test, expect, _electron as electron, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { useEnglish } from './locale';
import { exportPastGuard } from './exportGuard';
import { startFakeMcp } from '../fixtures/mcp/fakeMcpServer';

/**
 * Node fields are controls : against the fake MCP server (labelled fixture), a KSampler from the library
 * shows its widget inputs as fields; sampler_name changes through the list on the node, steps through the stepper in
 * Properties, and both reach the export. A LoRA loader's file field is a picker of the person's own files with
 * family badges, and once a checkpoint feeds it, the files that fit come first.
 */
const artifactDir = path.join(__dirname, '../../test-results/node-fields');

async function connectAndSync(window: Page, url: string) {
  const saved = await window.evaluate(async (mcpUrl) => {
    const api = (window as unknown as {
      electronAPI: {
        getSettings: () => Promise<{ values?: Record<string, unknown> }>;
        saveSettings: (input: unknown) => Promise<{ ok: boolean; error?: string }>;
        syncNow: () => Promise<{ state: string; lastError: string | null }>;
      };
    }).electronAPI;
    const read = await api.getSettings();
    const result = await api.saveSettings({ ...(read.values ?? {}), mcpUrl, mcpAuth: 'none' });
    if (!result.ok) return result;
    const status = await api.syncNow();
    return { ok: status.state !== 'error', error: status.lastError ?? undefined };
  }, url);
  expect(saved).toMatchObject({ ok: true });
  await expect(window.locator('.sync-indicator')).toHaveAttribute('data-sync-state', 'idle', { timeout: 30000 });
}

async function addFromLibrary(window: Page, query: string, option: RegExp | string) {
  const rail = window.locator('#library-rail');
  await rail.getByRole('tab', { name: 'Nodes' }).click();
  const search = rail.getByRole('searchbox', { name: 'Search nodes' }).or(rail.getByRole('textbox', { name: 'Search nodes' })).first();
  await search.fill(query);
  await window.locator('#node-library-list').getByRole('option').filter({ hasText: option }).first().dblclick();
}

test('node fields: lists, steppers and the model picker edit the graph', async () => {
  fs.mkdirSync(artifactDir, { recursive: true });
  const fake = await startFakeMcp();
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'node-fields-'));
  const exportPath = path.join(userData, 'fields.json');
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

    await addFromLibrary(window, 'ksampler', /^KSampler\s*KSampler/);
    const sampler = window.locator('.react-flow__node').filter({ hasText: 'latent_image' }).first();
    await expect(sampler).toBeVisible();
    // Link ports stay ports; widget inputs are field rows with a quiet handle each (11 handles in all).
    await expect(sampler.locator('.port-list .port-name')).toHaveText(['model', 'positive', 'negative', 'latent_image', 'LATENT']);
    await expect(sampler.locator('.node-fields .node-field-name')).toHaveText(['seed', 'steps', 'cfg', 'sampler_name', 'scheduler', 'denoise']);
    await expect(sampler.locator('.react-flow__handle')).toHaveCount(11);
    // No developer type words next to fields.
    await expect(sampler.locator('.node-fields')).not.toContainText('COMBO');
    await expect(sampler.locator('.node-fields')).not.toContainText('FLOAT');

    // sampler_name through the list on the node.
    const samplerName = sampler.getByRole('combobox', { name: 'sampler_name' });
    await expect(samplerName).toHaveAttribute('data-value', 'euler');
    await samplerName.click();
    await window.getByRole('listbox', { name: 'sampler_name' }).getByRole('option', { name: 'dpmpp_2m', exact: true }).click();
    await expect(samplerName).toHaveAttribute('data-value', 'dpmpp_2m');
    // The seed has a random button.
    await expect(sampler.getByRole('button', { name: 'Random value for seed' })).toBeVisible();
    await window.screenshot({ path: path.join(artifactDir, 'ksampler-node.png') });

    // steps through the stepper in Properties.
    await sampler.locator('.graph-node-title').click();
    await window.getByRole('tab', { name: 'Inspector' }).click();
    const inspector = window.getByRole('region', { name: 'Inspector' });
    const steps = inspector.getByRole('spinbutton', { name: 'steps' });
    await expect(steps).toHaveValue('20');
    await inspector.getByRole('button', { name: 'Increase steps' }).click();
    await inspector.getByRole('button', { name: 'Increase steps' }).click();
    await expect(steps).toHaveValue('22');
    // Typing past the range is clamped.
    await steps.fill('0');
    await steps.press('Enter');
    await expect(steps).toHaveValue('1');
    await steps.fill('22');
    await steps.press('Enter');
    await expect(steps).toHaveValue('22');
    await expect(inspector.getByText('From 1 to 10000')).toBeVisible();
    // The Ports table lists links only.
    await expect(inspector.locator('.inspector-port')).toHaveCount(5);
    await expect(inspector.getByRole('button', { name: 'Ask the assistant about this field' }).first()).toBeVisible();
    // A field with a built-in note: the "i" beside its name opens what the field does, and closes it again.
    const stepsNote = inspector.locator('[data-field-note-toggle="steps"]');
    await expect(stepsNote).toHaveAttribute('aria-expanded', 'false');
    await expect(inspector.locator('[data-field-note="steps"]')).toHaveCount(0);
    await stepsNote.click();
    await expect(stepsNote).toHaveAttribute('aria-expanded', 'true');
    await expect(inspector.locator('[data-field-note="steps"]')).toContainText(/\w{4,}/);
    await expect(inspector.locator('[data-field-note="steps"]')).toContainText('What to put in it');
    await stepsNote.click();
    await expect(inspector.locator('[data-field-note="steps"]')).toHaveCount(0);
    await window.screenshot({ path: path.join(artifactDir, 'ksampler-properties.png') });

    // A LoRA loader: the file field is a picker of the person's files with family badges.
    await addFromLibrary(window, 'lora', 'Load LoRA');
    const lora = window.locator('.react-flow__node').filter({ hasText: 'Load LoRA' }).first();
    await expect(lora).toBeVisible();
    const loraName = lora.getByRole('combobox', { name: 'lora_name' });
    await loraName.click();
    const files = window.getByRole('listbox', { name: 'lora_name' });
    await expect(files.getByRole('option').filter({ hasText: 'PastelDetailPonyV2' })).toContainText('Pony');
    await expect(files.getByRole('option').filter({ hasText: 'add-detail-xl' })).toContainText('SDXL');
    await expect(window.getByText('Connect a checkpoint upstream and the list shows which files fit it.')).toBeVisible();
    await window.keyboard.press('Escape');

    // Feed it from an SDXL checkpoint: the SDXL files come first, the Flux one last with the reason.
    await addFromLibrary(window, 'checkpoint', 'Load Checkpoint');
    const loader = window.locator('.react-flow__node').filter({ hasText: 'Load Checkpoint' }).first();
    await loader.getByRole('combobox', { name: 'ckpt_name' }).click();
    await window.getByRole('listbox', { name: 'ckpt_name' }).getByRole('option').filter({ hasText: 'sd_xl_base_1.0' }).click();
    await expect(loader.getByRole('combobox', { name: 'ckpt_name' })).toHaveAttribute('data-value', 'sd_xl_base_1.0.safetensors');
    const readProjection = () => window.evaluate(() => {
      const api = (window as unknown as { electronAPI: { readProjection: (id: string) => Promise<{
        revSeq: number;
        snapshot: { edges: Array<{ source: string; sourceHandle: string; target: string; targetHandle: string }> };
      }> } }).electronAPI;
      return api.readProjection('desktop');
    });
    const loaderId = await loader.getAttribute('data-id');
    const loraId = await lora.getAttribute('data-id');
    // Library placement can leave these two handles overlapping. Arrange, then reload the committed layout
    // so the arrangement's delayed camera fit cannot move a handle during the connection gesture.
    const arrangeFrom = (await readProjection()).revSeq;
    await window.getByRole('button', { name: 'Arrange the graph' }).click();
    await expect.poll(async () => (await readProjection()).revSeq).toBe(arrangeFrom + 1);
    await window.reload();
    await expect(window.locator('.react-flow__node')).toHaveCount(3);
    await window.locator('.react-flow__controls-fitview').click();
    const from = loader.locator('.react-flow__handle[data-handleid="out-0"]');
    const to = lora.locator('.react-flow__handle[data-handleid="in-0"]');
    // Locator actions wait for stable, unobstructed handles before the one real mouse drag.
    await to.hover();
    await from.hover();
    const a = await from.boundingBox();
    const b = await to.boundingBox();
    if (!a || !b) throw new Error('handles not on screen');
    await window.mouse.down();
    await window.mouse.move(a.x + a.width / 2 + 20, a.y + a.height / 2 + 10, { steps: 4 });
    await window.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
    await window.mouse.up();
    await expect(window.locator('.react-flow__edge')).toHaveCount(1);
    await expect.poll(async () => (await readProjection()).snapshot.edges).toEqual([
      expect.objectContaining({ source: loaderId, sourceHandle: 'out-0', target: loraId, targetHandle: 'in-0' }),
    ]);
    await loraName.click();
    await expect(window.getByText(/Compared with sd_xl_base_1\.0\.safetensors \(SDXL\)/)).toBeVisible();
    const options = files.getByRole('option');
    await expect(options.first()).toHaveAttribute('data-fit', 'fits');
    await expect(options.last()).toHaveAttribute('data-fit', 'differs');
    await expect(files.getByRole('option').filter({ hasText: 'flux_realism_lora' })).toContainText('family differs: Flux.1 ≠ SDXL');
    await window.screenshot({ path: path.join(artifactDir, 'lora-picker.png') });
    await files.getByRole('option').filter({ hasText: 'add-detail-xl' }).click();
    await expect(loraName).toHaveAttribute('data-value', 'add-detail-xl.safetensors');

    await app.evaluate(({ dialog: fileDialog }, filePath) => {
      fileDialog.showSaveDialog = async () => ({ canceled: false, filePath });
    }, exportPath);
    await exportPastGuard(window);
    const workflow = JSON.parse(fs.readFileSync(exportPath, 'utf8')) as { nodes: Array<{ type: string; widgets_values?: unknown[] }> };
    const exported = workflow.nodes.find((node) => node.type === 'KSampler');
    expect(exported?.widgets_values?.[2]).toBe(22);
    expect(exported?.widgets_values?.[4]).toBe('dpmpp_2m');
    expect(workflow.nodes.find((node) => node.type === 'LoraLoader')?.widgets_values?.[0]).toBe('add-detail-xl.safetensors');
    expect(errors).toEqual([]);
  } finally {
    await app.close();
    await fake.close();
  }
});
