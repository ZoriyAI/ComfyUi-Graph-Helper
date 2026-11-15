import { test, expect, _electron as electron, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { expectSoundLayout } from './layoutProfile';
import { useEnglish } from './locale';
import { fakeFileHash, READ_TOOLS, startFakeMcp, WRITE_TOOLS } from '../fixtures/mcp/fakeMcpServer';
import { CIVITAI_KNOWN, startFakeModelWeb } from '../fixtures/web/fakeModelWeb';

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
    await search.fill('PastelDetailPonyV2');
    await list.getByRole('option').filter({ hasText: 'PastelDetailPonyV2' }).first().click();
    const card = window.getByRole('dialog', { name: 'PastelDetailPonyV2.safetensors' });
    await expect(card).toBeVisible();
    await expect(card).toContainText('Pony');
    await expect(card).toContainText('from the description next to the file');
    await expect(card.getByRole('button', { name: 'pastel detail' })).toBeVisible();
    await expect(card).toContainText('Pony LoRA for soft pastel detail.');
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
    await expect.poll(() => loaders(window)).toEqual([{ type: 'LoraLoader', lora_name: 'PastelDetailPonyV2.safetensors' }]);
    await expect(node).toHaveClass(/selected/);
    await expect(window.getByText(/Added “Load LoRA” with PastelDetailPonyV2\.safetensors/)).toBeVisible();

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
    // The one LoRA made for Flux; its row is headed by the name its author gave it.
    await expect(list.getByRole('option').first().locator('[data-model="loras/flux_realism_lora.safetensors"]')).toHaveCount(1);
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

/** The card is looked at in the window it is open in: a smaller window folds the library away and closes it. */
const HERE = [{ width: 1440, height: 900 }];

async function shot(window: Page, name: string): Promise<void> {
  const dir = process.env.MODEL_SHOTS;
  if (!dir) return;
  fs.mkdirSync(dir, { recursive: true });
  await window.screenshot({ path: path.join(dir, `${name}.png`) });
}

test('model card: shows what lies next to a file, and content marked as adult only when asked', async () => {
  test.setTimeout(180_000);
  const fake = await startFakeMcp();
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'model-notes-'));
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
    // The descriptions next to the files are read with the file headers, in the background after the listing.
    await expect.poll(() => window.evaluate(async () => {
      const api = (window as unknown as { electronAPI: { modelDetail: (directory: string, name: string) => Promise<{ title: string } | null> } }).electronAPI;
      return (await api.modelDetail('checkpoints', 'juggernautXL_v9.safetensors'))?.title ?? '';
    }), { timeout: 60_000 }).toBe('Juggernaut XL');
    await window.reload();
    await window.locator('.app-shell').waitFor({ timeout: 20000 });

    const rail = window.locator('#library-rail');
    await rail.getByRole('tab', { name: 'Models' }).click();
    const list = window.locator('#model-library-list');
    const search = rail.getByRole('searchbox', { name: 'Search models' }).or(rail.getByRole('textbox', { name: 'Search models' })).first();
    const row = (file: string) => list.locator(`[data-model$="/${file}"]`);

    // The name its author gave a file finds it, and leads its row when it says more than the file name.
    await search.fill('retro');
    await expect(list.getByRole('option')).toHaveCount(1);
    const pixel = row('pixel-art-xl.safetensors');
    await expect(pixel).toContainText('pixel-art-xl.safetensors');
    // Its preview heads the row, small.
    await expect.poll(() => pixel.locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    await pixel.click();
    const card = window.getByRole('dialog', { name: 'pixel-art-xl.safetensors' });
    await expect(card).toBeVisible();
    await expect.poll(() => card.locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    for (const text of [
      'SDXL', 'from the description next to the file', 'Made for', 'SDXL 1.0', 'Version', 'v1.1', 'Author', 'nerijs',
      'style', 'retro', 'Strength the author suggests: 0.9', 'It works from 0.6 to 1.2', 'Your notes', 'Turn the strength down for portraits.',
      'Turns a picture into pixel art with a limited palette.', '• Works at 1024 x 1024.', 'Sharper edges than v1.0.',
      'Prompts the author used', 'pixel art, a lighthouse on a cliff, sunset, seagulls', 'Negative prompt: blurry, 3d render', 'steps: 8 · cfg 1.5 · euler',
      'pixel art, a cat sleeping on a bookshelf, warm lamp light',
    ]) await expect(card, text).toContainText(text);
    await expect(card.getByRole('button', { name: 'pixel art', exact: true })).toBeVisible();
    // The preview is whole and inside the card.
    const box = (await card.boundingBox())!;
    const image = (await card.locator('img').boundingBox())!;
    expect(image.x).toBeGreaterThanOrEqual(box.x);
    expect(image.x + image.width).toBeLessThanOrEqual(box.x + box.width + 0.5);
    expect(image.height).toBeLessThanOrEqual(241);
    await shot(window, '1-card-with-preview');
    await expectSoundLayout(window, 'model card with a preview and examples', HERE);
    await card.getByRole('button', { name: 'Copy', exact: true }).first().click();
    await expect(card.getByRole('status')).toContainText('Prompt copied');

    // Another convention (a bare Civitai record, .preview.png): the author's name leads the row; the file name is
    // what the row is called when pointed at, and what heads its card.
    await search.fill('juggernaut');
    const base = row('juggernautXL_v9.safetensors');
    await expect(base).toContainText('Juggernaut XL');
    await expect(base).toHaveAttribute('title', 'checkpoints/juggernautXL_v9.safetensors');
    // Kind, family and size on one line, each readable.
    await expect(base).toContainText('SDXL');
    await expect(base).toContainText('6.5 GB');
    await base.click();
    const baseCard = window.getByRole('dialog', { name: 'juggernautXL_v9.safetensors' });
    await expect(baseCard).toContainText('Name from its author');
    await expect(baseCard).toContainText('a portrait photograph of an old sailor, overcast light, 85mm');
    await expect(baseCard).toContainText('steps: 30 · cfg 4.5 · dpmpp_2m_sde');

    // A clip as the preview: the row carries a mark, the card plays it without sound.
    await search.fill('lightx2v_4step_1022');
    const clipRow = row('wan2.2_i2v_A14b_high_noise_lora_rank64_lightx2v_4step_1022.safetensors');
    await expect(clipRow.locator('[data-kind="video"]')).toBeVisible();
    await expect(clipRow.locator('img')).toHaveCount(0);
    await clipRow.click();
    const clipCard = window.getByRole('dialog', { name: /wan2\.2_i2v_A14b_high_noise_lora/ });
    const video = clipCard.locator('video');
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.videoWidth), { timeout: 20_000 }).toBe(160);
    expect(await video.evaluate((element: HTMLVideoElement) => element.muted)).toBe(true);
    await shot(window, '2-card-with-clip');
    await expectSoundLayout(window, 'model card with a clip', HERE);

    // Marked by its author as adult content: nothing of it is read or shown until the person asks.
    const sideReads = () => fake.calls.filter((call) => call.tool === 'workspace_files' && String(call.args?.absolute_path).endsWith('flux_realism_lora.png')).length;
    await search.fill('night painter');
    const marked = row('flux_realism_lora.safetensors');
    await expect(marked).toContainText('Night Painter');
    await expect(marked.locator('img')).toHaveCount(0);
    await marked.click();
    const markedCard = window.getByRole('dialog', { name: 'flux_realism_lora.safetensors' });
    await expect(markedCard).toContainText('The author marked this as adult content.');
    await expect(markedCard.locator('img')).toHaveCount(0);
    await expect(markedCard).toContainText('night painter, a harbour at midnight, lanterns on the water');
    await expect(markedCard).not.toContainText('a figure in a doorway');
    await expect(markedCard).toContainText('1 more example is hidden.');
    expect(sideReads()).toBe(0);
    await shot(window, '3-card-marked');
    await expectSoundLayout(window, 'model card, content marked as adult', HERE);
    await markedCard.getByRole('button', { name: 'Show for this file' }).first().click();
    await expect.poll(() => markedCard.locator('img').evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
    await expect(markedCard).toContainText('night painter, a figure in a doorway, candle light');
    await expect(markedCard).not.toContainText('more example is hidden');
    expect(sideReads()).toBe(1);
    // Asked for one file, shown for that file: the list still shows no picture for it.
    await expect(marked.locator('img')).toHaveCount(0);

    // Settings ▸ Privacy turns it on everywhere.
    const saved = await window.evaluate(async () => {
      const api = (window as unknown as { electronAPI: Api }).electronAPI;
      const read = await api.getSettings();
      return api.saveSettings({ ...(read.values ?? {}), preferences: { privacy: { showMarkedPreviews: true } } });
    });
    expect(saved.ok).toBe(true);
    await window.reload();
    await window.locator('.app-shell').waitFor({ timeout: 20000 });
    await rail.getByRole('tab', { name: 'Models' }).click();
    await search.fill('night painter');
    await expect.poll(() => row('flux_realism_lora.safetensors').locator('img').evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
    await row('flux_realism_lora.safetensors').click();
    await expect(window.getByRole('dialog', { name: 'flux_realism_lora.safetensors' })).not.toContainText('The author marked this');

    // Everything was read; nothing on the server was written, moved or removed.
    for (const call of fake.calls.filter((item) => item.method === 'tools/call')) {
      expect(READ_TOOLS as readonly string[]).toContain(call.tool);
      expect(WRITE_TOOLS as readonly string[]).not.toContain(call.tool);
      if (call.tool === 'workspace_files') expect(call.args).toMatchObject({ action: 'read', encoding: 'base64' });
    }
    expect(errors).toEqual([]);
  } finally {
    await app.close();
    await fake.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

test('model card: a file nothing describes is looked up on the internet when the person asks', async () => {
  test.setTimeout(180_000);
  const fake = await startFakeMcp();
  const web = await startFakeModelWeb();
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'model-web-'));
  // A test build reads this to ask the fake of Civitai and Hugging Face; a packaged app never does.
  const env = { ...process.env, NODE_ENV: 'production', GRAPH_HELPER_TEST_MODEL_WEB: web.origin };
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
    await expect.poll(() => window.evaluate(async () => {
      const api = (window as unknown as { electronAPI: { modelDetail: (directory: string, name: string) => Promise<{ title: string } | null> } }).electronAPI;
      return (await api.modelDetail('checkpoints', 'juggernautXL_v9.safetensors'))?.title ?? '';
    }), { timeout: 60_000 }).toBe('Juggernaut XL');
    // Sync asked the internet nothing: the setting is off.
    expect(web.requests).toEqual([]);

    const rail = window.locator('#library-rail');
    await rail.getByRole('tab', { name: 'Models' }).click();
    const list = window.locator('#model-library-list');
    const search = rail.getByRole('searchbox', { name: 'Search models' }).or(rail.getByRole('textbox', { name: 'Search models' })).first();
    const open = async (file: string) => {
      await search.fill(file.replace(/\.safetensors$/, ''));
      await list.locator(`[data-model$="/${file}"]`).first().click();
      const card = window.getByRole('dialog', { name: file });
      await expect(card).toBeVisible();
      return card;
    };

    // A file Civitai described already (its description lies next to it) offers no lookup.
    const pixel = await open('pixel-art-xl.safetensors');
    await expect(pixel).toContainText('nerijs');
    await expect(pixel).not.toContainText('From the internet');

    // Nothing lies next to this one and its family is not known. The card says what leaves the computer.
    const mystery = await open('mystery_style_v3.safetensors');
    const section = mystery.locator('[aria-labelledby="model-card-web"]');
    await expect(section).toContainText('This sends the file fingerprint to civitai.com');
    await expect(section).toContainText('huggingface.co');
    await expect(mystery).toContainText('not known');
    await section.getByRole('button', { name: 'Find on the internet' }).click();
    // The fingerprint was made on the server (only for this one model file), then Civitai found the file by it.
    await expect(section).toHaveAttribute('data-web', 'found', { timeout: 30_000 });
    for (const text of [
      'Civitai', 'Found by the file fingerprint: it is exactly this file.', 'Mystery Style', 'v3', 'fogmaker', 'SDXL 1.0',
      'mystery style, a lighthouse in fog', 'Negative prompt: sunny', '1 more example is hidden.', 'https://civitai.com/models/900100?modelVersionId=900101',
    ]) await expect(section, text).toContainText(text);
    await expect(section).not.toContainText('a figure on the stairs');
    await expect(section.getByRole('button', { name: 'mystery style', exact: true })).toBeVisible();
    // The family it was missing, marked as learned from the internet; the sample at the top of the card.
    await expect(mystery).toContainText('SDXL');
    await expect(mystery).toContainText('from the internet');
    await expect.poll(() => mystery.locator('img').first().evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    // Its row in the list says so too, without waiting for a sync.
    await expect(list.locator('[data-model$="/mystery_style_v3.safetensors"]')).toContainText('SDXL');
    await expect(list.locator('[data-model$="/mystery_style_v3.safetensors"]')).not.toContainText('family not known');
    const hashes = fake.calls.filter((call) => call.tool === 'workspace_files' && call.args?.action === 'hash');
    expect(hashes.map((call) => call.args)).toEqual([{ action: 'hash', absolute_path: '/srv/comfyui/models/loras/mystery_style_v3.safetensors' }]);
    expect(web.requests.map((item) => item.path)).toEqual([`/civitai/api/v1/model-versions/by-hash/${CIVITAI_KNOWN.mystery}`, '/img/width=450/mystery.png']);
    await shot(window, '4-card-found-online');
    await expectSoundLayout(window, 'model card with what was found on the internet', HERE);

    // Marked by the site as adult content: found, and closed like a file marked by its author.
    const marked = await open('Wan21_CausVid_14B_T2V_lora_rank32.safetensors');
    await marked.getByRole('button', { name: 'Find on the internet' }).click();
    const markedWeb = marked.locator('[aria-labelledby="model-card-web"]');
    await expect(markedWeb).toHaveAttribute('data-web', 'found', { timeout: 30_000 });
    await expect(markedWeb).toContainText('Velvet Hour');
    await expect(markedWeb).toContainText('The site marks this model as adult content.');
    await expect(markedWeb).toContainText('1 more example is hidden.');
    await expect(markedWeb).not.toContainText('a quiet room at dusk');
    await expect(marked).toContainText('marked this as adult content');
    await expect(marked.locator('img')).toHaveCount(0);
    expect(web.requests.some((item) => item.path.includes('velvet'))).toBe(false);

    // Civitai does not know this one; Hugging Face has a repository of that name. It is shown as a guess.
    const lightning = await open('sdxl_lightning_8step_lora.safetensors');
    await lightning.getByRole('button', { name: 'Find on the internet' }).click();
    const lightningWeb = lightning.locator('[aria-labelledby="model-card-web"]');
    await expect(lightningWeb).toHaveAttribute('data-web', 'found', { timeout: 30_000 });
    for (const text of ['Hugging Face', 'Found by the file name. It may be a different model.', 'ByteDance/SDXL-Lightning', 'SDXL-Lightning is a lightning-fast text-to-image generation model.', 'https://huggingface.co/ByteDance/SDXL-Lightning']) {
      await expect(lightningWeb, text).toContainText(text);
    }
    // The picture its README shows, at the top of the card; downloaded once, at lookup, to check it is one.
    const lightningPicture = '/hf/ByteDance/SDXL-Lightning/resolve/main/sdxl_lightning_samples.jpg';
    await expect.poll(() => lightning.locator('img').first().evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    expect(web.requests.filter((item) => item.path === lightningPicture)).toHaveLength(1);
    // A guess by name can be asked again; the card says what leaves the computer.
    await expect(lightningWeb).toContainText('This sends the file fingerprint to civitai.com');
    const lookedBefore = web.requests.length;
    await lightningWeb.getByRole('button', { name: 'Look again' }).click();
    await expect.poll(() => web.requests.filter((item) => item.path === lightningPicture).length, { timeout: 30_000 }).toBe(2);
    await expect(lightningWeb).toHaveAttribute('data-web', 'found', { timeout: 30_000 });
    await expect(lightningWeb).toContainText('ByteDance/SDXL-Lightning');
    await expect.poll(() => lightning.locator('img').first().evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    // One chain: Civitai by the fingerprint, Hugging Face by the name, the picture.
    expect(web.requests.slice(lookedBefore).map((item) => item.path)).toEqual([
      `/civitai/api/v1/model-versions/by-hash/${fakeFileHash('loras', 'sdxl_lightning_8step_lora.safetensors')}`,
      '/hf/api/models?search=sdxl_lightning_8step_lora&limit=5',
      '/hf/api/models?search=sdxl-lightning&limit=5',
      '/hf/api/models/ByteDance/SDXL-Lightning',
      '/hf/ByteDance/SDXL-Lightning/raw/main/README.md',
      lightningPicture,
    ]);
    await shot(window, '5-card-found-on-hugging-face');

    // A repository tagged not-for-all-audiences: its picture is not downloaded and stays closed until opened.
    const velvet = await open('realisticVisionV60B1_v51VAE.safetensors');
    await velvet.getByRole('button', { name: 'Find on the internet' }).click();
    const velvetWeb = velvet.locator('[aria-labelledby="model-card-web"]');
    await expect(velvetWeb).toHaveAttribute('data-web', 'found', { timeout: 30_000 });
    await expect(velvetWeb).toContainText('velvet-studio/realisticVisionV60B1_v51VAE');
    await expect(velvetWeb).toContainText('The site marks this model as adult content.');
    const closed = velvet.locator('[data-preview="hidden"]');
    await expect(closed).toContainText('marked this as adult content');
    await expect(velvet.locator('img')).toHaveCount(0);
    expect(web.requests.some((item) => item.path.includes('/velvet-studio/') && item.path.includes('/resolve/'))).toBe(false);
    await shot(window, '6-card-hugging-face-closed');
    await expectSoundLayout(window, 'model card with a closed picture from Hugging Face', HERE);
    await closed.getByRole('button', { name: 'Show for this file' }).click();
    await expect.poll(() => velvet.locator('img').first().evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    expect(web.requests.filter((item) => item.path === '/hf/velvet-studio/realisticVisionV60B1_v51VAE/resolve/main/previews/cover.png')).toHaveLength(1);

    // Neither site knows this one, and the card says so.
    const unknown = await open('Z-Image-Turbo-Fun-Controlnet-Union.safetensors');
    await unknown.getByRole('button', { name: 'Find on the internet' }).click();
    const unknownWeb = unknown.locator('[aria-labelledby="model-card-web"]');
    await expect(unknownWeb).toHaveAttribute('data-web', 'not-found', { timeout: 30_000 });
    await expect(unknownWeb).toContainText('Civitai does not know this file; nothing was found on Hugging Face by its name.');
    await expect(unknownWeb.getByRole('button', { name: 'Look again' })).toBeVisible();

    // Kept: after a reload the card shows what was found, and nothing is asked again.
    const asked = web.requests.length;
    await window.reload();
    await window.locator('.app-shell').waitFor({ timeout: 20000 });
    await rail.getByRole('tab', { name: 'Models' }).click();
    const again = await open('mystery_style_v3.safetensors');
    await expect(again.locator('[aria-labelledby="model-card-web"]')).toContainText('Mystery Style');
    await expect.poll(() => again.locator('img').first().evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    expect(web.requests).toHaveLength(asked);
    expect(web.requests.every((item) => item.credentials.length === 0)).toBe(true);

    // Only reads and fingerprints of model files went to the MCP server.
    for (const call of fake.calls.filter((item) => item.method === 'tools/call')) {
      expect(READ_TOOLS as readonly string[]).toContain(call.tool);
      if (call.tool === 'workspace_files') expect(['read', 'hash']).toContain(call.args?.action);
    }
    expect(errors).toEqual([]);
  } finally {
    await app.close();
    await fake.close();
    await web.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
