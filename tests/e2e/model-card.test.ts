import { test, expect, _electron as electron, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { useEnglish } from './locale';
import { startFakeMcp } from '../fixtures/mcp/fakeMcpServer';

/**
 * The model card against the fake MCP server (labelled fixture): a LoRA's card names its family, where the
 * family was learned from, its trigger words and the person's checkpoints it fits; "Add to canvas" makes the
 * loader with that file and selects it; a checkpoint's card counts the LoRAs that fit and filters the list.
 */
type Api = {
  getSettings: () => Promise<{ values?: Record<string, unknown> }>;
  saveSettings: (input: unknown) => Promise<{ ok: boolean; error?: string }>;
  syncNow: () => Promise<{ state: string; lastError: string | null }>;
};

async function connectAndSync(window: Page, url: string) {
  const status = await window.evaluate(async (mcpUrl) => {
    const api = (window as unknown as { electronAPI: Api }).electronAPI;
    const read = await api.getSettings();
    const saved = await api.saveSettings({ ...(read.values ?? {}), mcpUrl, mcpAuth: 'none' });
    if (!saved.ok) return { state: 'error', lastError: saved.error ?? 'not saved' };
    return api.syncNow();
  }, url);
  expect(status.lastError).toBeNull();
  await window.reload();
  await window.locator('.app-shell').waitFor({ timeout: 20000 });
}

/** The loader nodes of the stored project with their file field, read from the engine's projection. */
async function loaders(window: Page): Promise<Array<Record<string, unknown>>> {
  return window.evaluate(async () => {
    const api = (window as unknown as { electronAPI: { readProjection: (id: string) => Promise<{ snapshot: { nodes: Array<{ data: { comfyType: string; parameters: Record<string, unknown> } }> } }> } }).electronAPI;
    const projection = await api.readProjection('desktop');
    return projection.snapshot.nodes.map((item) => {
      const { comfyType, parameters } = item.data;
      const file = Object.entries(parameters ?? {}).find(([key]) => key.endsWith('_name'));
      return file ? { type: comfyType, [file[0]]: file[1] } : { type: comfyType };
    });
  });
}

test('model card: explains a LoRA and a checkpoint and puts the file on the canvas', async () => {
  const fake = await startFakeMcp();
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'model-card-'));
  const env = { ...process.env, NODE_ENV: 'production' };
  delete env.DBUS_SESSION_BUS_ADDRESS;
  delete env.GNOME_KEYRING_CONTROL;
  const app = await electron.launch({ args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`], env });
  const errors: string[] = [];
  try {
    const window = await app.firstWindow();
    window.on('pageerror', (error) => errors.push(error.message));
    await window.setViewportSize({ width: 1440, height: 900 });
    await useEnglish(window);
    await connectAndSync(window, fake.url);

    const rail = window.locator('#library-rail');
    await rail.getByRole('tab', { name: 'Models' }).click();
    const list = window.locator('#model-library-list');
    await expect(list.getByRole('option').first()).toBeVisible();

    // Kind chips with counts: four VAE files in the fixture.
    const chips = rail.getByRole('radiogroup', { name: 'Model kind' });
    await chips.getByRole('radio', { name: /VAE/ }).click();
    await expect(rail.getByText('4 results')).toBeVisible();
    await chips.getByRole('radio', { name: /^All/ }).click();

    // A LoRA's card: family from the Civitai description, trigger words, the checkpoints it fits.
    const search = rail.getByRole('searchbox', { name: 'Search models' }).or(rail.getByRole('textbox', { name: 'Search models' })).first();
    await search.fill('PerfectBreastsPonyV2');
    await list.getByRole('option').filter({ hasText: 'PerfectBreastsPonyV2' }).first().click();
    const card = window.getByRole('dialog', { name: 'PerfectBreastsPonyV2.safetensors' });
    await expect(card).toBeVisible();
    await expect(card).toContainText('Pony');
    await expect(card).toContainText('from the description next to the file');
    await expect(card.getByRole('button', { name: 'perfect breasts' })).toBeVisible();
    await expect(card).toContainText('Pony LoRA for body proportions.');
    await expect(card).toContainText('Your base models it fits:');
    await expect(card).toContainText('ponyDiffusionV6XL.safetensors');
    await expect(card).not.toContainText('flux1-dev-fp8.safetensors');
    // The card sits beside the rail and leaves the row visible.
    const railBox = await rail.boundingBox();
    const cardBox = await card.boundingBox();
    expect(cardBox!.x).toBeGreaterThanOrEqual(railBox!.x + railBox!.width);

    // Add to canvas: a Load LoRA node with this file, selected, and a toast that says so.
    await card.getByRole('button', { name: 'Add to canvas' }).click();
    const node = window.locator('.react-flow__node').filter({ hasText: 'Load LoRA' });
    await expect(node).toHaveCount(1);
    await expect.poll(() => loaders(window)).toEqual([{ type: 'LoraLoader', lora_name: 'PerfectBreastsPonyV2.safetensors' }]);
    await expect(node).toHaveClass(/selected/);
    await expect(window.getByText(/Added “Load LoRA” with PerfectBreastsPonyV2\.safetensors/)).toBeVisible();

    // With that loader selected, another LoRA's card offers to put its file into it.
    await search.fill('add-detail-xl');
    await list.getByRole('option').filter({ hasText: 'add-detail-xl' }).first().click();
    const second = window.getByRole('dialog', { name: 'add-detail-xl.safetensors' });
    await second.getByRole('button', { name: 'Put into the selected node' }).click();
    await expect.poll(() => loaders(window)).toEqual([{ type: 'LoraLoader', lora_name: 'add-detail-xl.safetensors' }]);
    await expect(second.getByRole('button', { name: 'Put into the selected node' })).toHaveCount(0);

    // A LoRA of unknown family says it cannot tell what it fits.
    await search.fill('mystery_style');
    await list.getByRole('option').filter({ hasText: 'mystery_style' }).first().click();
    await expect(window.getByRole('dialog', { name: 'mystery_style_v3.safetensors' })).toContainText('Its family is not known');

    // A checkpoint's card counts the LoRAs that fit it and shows them in the list.
    await search.fill('flux1-dev');
    await list.getByRole('option').filter({ hasText: 'flux1-dev-fp8' }).first().click();
    const flux = window.getByRole('dialog', { name: 'flux1-dev-fp8.safetensors' });
    await expect(flux).toContainText('1 of your LoRAs fits this model');
    await search.fill('');
    await flux.getByRole('button', { name: 'Show them in the list' }).click();
    await expect(flux).toHaveCount(0);
    await expect(rail.getByText('LoRAs for flux1-dev-fp8.safetensors')).toBeVisible();
    await expect(list.getByRole('option')).toHaveCount(1);
    await expect(list.getByRole('option').first()).toContainText('flux_realism_lora');
    await rail.getByRole('button', { name: 'Show all models' }).click();

    // Dragging a model onto the canvas makes its loader, selected, with a toast.
    // Only the VAE chip: the search ranks several "…vae.safetensors" files, so wait until the list settles.
    await search.fill('');
    await chips.getByRole('radio', { name: /VAE/ }).click();
    await expect(rail.getByText('4 results')).toBeVisible();
    const aeRow = list.locator('[role="option"]', { has: window.locator('[title="vae/ae.safetensors"]') });
    await expect(aeRow).toHaveCount(1);
    await aeRow.dragTo(window.locator('.react-flow__pane'), { targetPosition: { x: 200, y: 300 } });
    await expect.poll(async () => (await loaders(window)).find((item) => item.type === 'VAELoader')).toEqual({ type: 'VAELoader', vae_name: 'ae.safetensors' });
    const vae = window.locator('.react-flow__node').filter({ hasText: 'Load VAE' });
    await expect(vae).toHaveCount(1);
    await expect(vae).toHaveClass(/selected/);
    await expect(node).not.toHaveClass(/selected/);

    // A search that finds nothing says so and offers to clear it.
    await search.fill('zzzz-no-such-file');
    await expect(rail.getByText('Nothing found')).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await app.close();
    await fake.close();
  }
});
