import { test, expect, _electron as electron, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { expectSoundLayout } from './layoutProfile';
import { useEnglish } from './locale';
import { KJNODES_DESCRIPTION, KJNODES_REPOSITORY, startFakeMcp } from '../fixtures/mcp/fakeMcpServer';

/**
 * The node card against the fake MCP server (labelled fixture): a click on a node in the library says what the
 * node is for before it is on the canvas. What it is and why, from the knowledge the app ships; what goes into
 * it; what each setting takes, with the hint ComfyUI gives for it; what comes out. A double click still adds the
 * node, and so does the card's button.
 */
type Api = {
  getSettings: () => Promise<{ values?: Record<string, unknown> }>;
  saveSettings: (input: unknown) => Promise<{ ok: boolean; error?: string }>;
  syncNow: () => Promise<{ state: string; lastError: string | null }>;
};

async function shot(window: Page, name: string): Promise<void> {
  const dir = process.env.NODE_SHOTS;
  if (!dir) return;
  fs.mkdirSync(dir, { recursive: true });
  await window.screenshot({ path: path.join(dir, `${name}.png`) });
}

/** The card is looked at in the window it is open in: a smaller window folds the library away and closes it. */
const HERE = [{ width: 1440, height: 900 }];

test('node card: says what a node is for before it is on the canvas', async () => {
  test.setTimeout(120_000);
  const fake = await startFakeMcp();
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'node-card-'));
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
    const status = await window.evaluate(async (mcpUrl) => {
      const api = (window as unknown as { electronAPI: Api }).electronAPI;
      const read = await api.getSettings();
      const saved = await api.saveSettings({ ...(read.values ?? {}), mcpUrl, mcpAuth: 'none' });
      if (!saved.ok) return { state: 'error', lastError: saved.error ?? 'not saved' };
      return api.syncNow();
    }, fake.url);
    expect(status.lastError).toBeNull();
    await window.reload();
    await window.locator('.app-shell').waitFor({ timeout: 20000 });

    const rail = window.locator('#library-rail');
    await rail.getByRole('tab', { name: 'Nodes' }).click();
    const list = window.locator('#node-library-list');
    const search = rail.getByRole('searchbox', { name: 'Search nodes' }).or(rail.getByRole('textbox', { name: 'Search nodes' })).first();
    const row = (classType: string) => list.locator(`[data-node-class="${classType}"]`);
    await expect(rail).toContainText('Click a node to see what it is for. A double click adds it.');

    // A node of ComfyUI itself: what the app knows of it, then what ComfyUI says of its ports and settings.
    await search.fill('KSampler');
    await row('KSampler').click();
    const card = window.getByRole('dialog', { name: 'KSampler' });
    await expect(card).toBeVisible();
    await expect(card).toContainText('ComfyUI itself');
    // ComfyUI itself is no pack: there is nothing a pack says about itself.
    await expect(card.locator('[data-pack-info]')).toHaveCount(0);
    await expect(card).toContainText('sampling');
    for (const heading of ['What it is', 'Usually used for', 'How to connect it', 'What goes in', 'Settings on the node', 'What comes out']) {
      await expect(card.getByRole('heading', { name: heading }), heading).toBeVisible();
    }
    // The links it takes, by the names the node gives them, each with its data type.
    for (const port of ['model', 'positive', 'negative', 'latent_image']) await expect(card.locator('li').filter({ hasText: new RegExp(`^${port}`) }).first(), port).toBeVisible();
    // A setting: where it starts, its range, and the hint ComfyUI gives for it.
    const steps = card.locator('li').filter({ hasText: /^steps/ });
    await expect(steps).toContainText('from 1 to 10000 · starts at 20');
    await expect(steps).toContainText('The number of steps used in the denoising process.');
    await expect(card.locator('li').filter({ hasText: /^cfg/ })).toContainText('The Classifier-Free Guidance scale balances creativity and adherence to the prompt.');
    await expect(card.locator('li').filter({ hasText: /^sampler_name/ })).toContainText(/a list of \d+/);
    // A range that is only "any number" is not said.
    await expect(card.locator('li').filter({ hasText: /^seed/ })).not.toContainText('from 0 to');
    // The row keeps its place, and the card stands beside the rail.
    const railBox = (await rail.boundingBox())!;
    const cardBox = (await card.boundingBox())!;
    expect(cardBox.x).toBeGreaterThanOrEqual(railBox.x + railBox.width);
    await shot(window, '1-node-card-core');
    await expectSoundLayout(window, 'node card of a core node', HERE);

    // A file picker says which folder its files come from.
    await search.fill('Load Checkpoint');
    await row('CheckpointLoaderSimple').click();
    const loader = window.getByRole('dialog', { name: 'Load Checkpoint' });
    await expect(loader).toContainText('CheckpointLoaderSimple');
    await expect(loader.locator('li').filter({ hasText: /^ckpt_name/ })).toContainText('a file from the folder checkpoints');
    await expect(loader.locator('li').filter({ hasText: /^ckpt_name/ })).toContainText('The name of the checkpoint (model) to load.');
    await expect(loader).toContainText('Nothing is linked into it: a branch starts here.');

    // A node from a pack: where it comes from, and what its author says of it.
    await search.fill('Color Match');
    await row('ColorMatch').click();
    const custom = window.getByRole('dialog', { name: 'Color Match' });
    await expect(custom).toContainText('ComfyUI-KJNodes');
    await expect(custom.getByRole('heading', { name: 'Description from its author' })).toBeVisible();
    await expect(custom).toContainText('Transfers the colours of the reference image onto the target image.');
    await expect(custom.locator('li').filter({ hasText: /^image_ref/ })).toBeVisible();
    // What the pack says about itself in its own files: its description, the opening of its README folded to a
    // few lines, and the link to its repository as text that can be read and copied.
    const about = custom.locator('[data-pack-info]');
    await expect(about.getByRole('heading', { name: 'What the pack says about itself' })).toBeVisible();
    await expect(about).toContainText(KJNODES_DESCRIPTION);
    await expect(about).toContainText(KJNODES_REPOSITORY);
    // With a description in pyproject.toml, the README's chatter is not shown.
    await expect(about).not.toContainText("I know I'm bad at documentation");
    await expect(about.getByRole('button', { name: 'Copy the repository link' })).toBeVisible();
    await shot(window, '2-node-card-pack');
    await expectSoundLayout(window, 'node card of a node from a pack', HERE);

    // A node nobody described says so, and still shows its ports.
    await search.fill('Get Image Size');
    await row('GetImageSizeAndCount').click();
    const bare = window.getByRole('dialog', { name: 'Get Image Size & Count' });
    await expect(bare).toContainText('Neither ComfyUI nor the pack says what this node does.');
    await expect(bare.locator('li').filter({ hasText: /^count/ })).toBeVisible();

    // The card's button puts the node on the canvas; Escape closes the card.
    await bare.getByRole('button', { name: 'Add to canvas' }).click();
    await expect(window.locator('.react-flow__node').filter({ hasText: 'Get Image Size & Count' })).toHaveCount(1);
    await bare.press('Escape');
    await expect(bare).toHaveCount(0);

    // A double click adds the node as it always did, and opens no card.
    await search.fill('VAE Decode');
    await row('VAEDecode').dblclick();
    await expect(window.locator('.react-flow__node').filter({ hasText: 'VAE Decode' })).toHaveCount(1);
    await window.waitForTimeout(400);
    await expect(window.locator('.node-card')).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await app.close();
    await fake.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
