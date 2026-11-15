import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { useEnglish } from './locale';
import { startFakeMcp } from '../fixtures/mcp/fakeMcpServer';

/**
 * The journey on the real window: the welcome card's three ways and "I have no ComfyUI yet", the window tour on a
 * first start, an example opened from the welcome card, a picture ComfyUI saved dropped on the window (the workflow
 * inside it opens, the one import message says so, File ▸ Open recent lists it), the run card after Save workflow
 * for ComfyUI, a ComfyUI error pasted back and pointed at its node, glossary hints in a lesson, and a file named on
 * the command line. The ComfyUI is the fake MCP server's fixture; nothing reaches a real one.
 */

async function launch(userData: string, extra: string[] = []): Promise<{ app: ElectronApplication; page: Page }> {
  const env = { ...process.env, NODE_ENV: 'production' };
  delete env.DBUS_SESSION_BUS_ADDRESS;
  delete env.GNOME_KEYRING_CONTROL;
  const app = await electron.launch({ args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`, ...extra], env });
  const page = await app.firstWindow();
  await page.locator('.app-shell').waitFor({ timeout: 30_000 });
  await page.setViewportSize({ width: 1400, height: 860 });
  return { app, page };
}

/** A PNG with the workflow in a tEXt chunk, as ComfyUI's Save Image writes it. */
function pngWith(workflow: unknown): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    return Buffer.concat([length, Buffer.from(type, 'latin1'), data, Buffer.alloc(4)]);
  };
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', Buffer.alloc(13)), chunk('tEXt', Buffer.concat([Buffer.from('workflow\0', 'latin1'), Buffer.from(JSON.stringify(workflow), 'latin1')])), chunk('IEND', Buffer.alloc(0))]);
}

const WORKFLOW = {
  version: 0.4, last_node_id: 12, last_link_id: 0, links: [],
  nodes: [
    { id: 12, type: 'KSampler', pos: [0, 0], size: [300, 260], flags: {}, order: 0, mode: 0, properties: {}, widgets_values: [1, 'fixed', 20, 7, 'euler', 'normal', 1] },
    { id: 4, type: 'Note', pos: [400, 0], size: [200, 80], flags: {}, order: 1, mode: 0, properties: {}, widgets_values: ['a note'] },
  ],
};

/** Drops a real file on the window: an input element gives the page a File backed by the disk, as a file manager does. */
async function dropFile(page: Page, file: string): Promise<void> {
  await page.evaluate(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.id = 'e2e-drop-source';
    input.style.display = 'none';
    document.body.appendChild(input);
  });
  await page.locator('#e2e-drop-source').setInputFiles(file);
  await page.evaluate(() => {
    const input = document.getElementById('e2e-drop-source') as HTMLInputElement;
    const transfer = new DataTransfer();
    transfer.items.add(input.files![0]);
    const target = document.querySelector('.graph-pane')!;
    target.dispatchEvent(new DragEvent('dragover', { dataTransfer: transfer, bubbles: true, cancelable: true }));
    target.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }));
    input.remove();
  });
}

test('journey: welcome ways, tour, example, a dropped picture, run card, a ComfyUI error, term hints, command line', async () => {
  test.setTimeout(300_000);
  const fake = await startFakeMcp({ video: true });
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'journey-files-'));
  const picture = path.join(userData, 'from-comfy.png');
  fs.writeFileSync(picture, pngWith(WORKFLOW));
  const errors: string[] = [];
  let { app, page } = await launch(userData);
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await useEnglish(page);
    // A first start: the tour comes once, by itself, and can be skipped.
    const tour = page.locator('.window-tour');
    await expect(tour).toBeVisible({ timeout: 10_000 });
    await expect(tour).toContainText('The menu');
    await tour.getByRole('button', { name: 'Next' }).click();
    await expect(tour).toContainText('The library');
    await tour.getByRole('button', { name: 'Skip the tour' }).click();
    await expect(tour).toHaveCount(0);

    // The welcome card: three ways, the setup rows, help without ComfyUI.
    const welcome = page.locator('.canvas-empty');
    for (const way of ['lesson', 'example', 'ask']) await expect(welcome.locator(`[data-way="${way}"]`)).toBeVisible();
    await expect(welcome.locator('[data-way="example"]')).toContainText('once the app has read your ComfyUI');
    await welcome.getByRole('button', { name: 'I have no ComfyUI yet' }).click();
    const noComfy = page.locator('.journey-no-comfy-dialog');
    await expect(noComfy).toContainText('ComfyUI is a free program');
    await expect(noComfy.getByRole('button', { name: 'Open the ComfyUI download page' })).toBeVisible();
    await noComfy.getByRole('button', { name: 'Close' }).click();
    // The library is open at the size the app opens at, and the right panel shows the assistant.
    await expect(page.locator('#library-rail')).toHaveAttribute('data-open', 'true');

    // ComfyUI read: an example opens from the welcome card.
    await page.evaluate(async (url) => {
      const api = (window as unknown as { electronAPI: Record<string, (...args: unknown[]) => Promise<any>> }).electronAPI;
      const read = await api.getSettings();
      await api.saveSettings({ ...read.values, mcpUrl: url, mcpAuth: 'none' });
      await api.syncNow();
    }, fake.url);
    await page.reload();
    await page.locator('.app-shell').waitFor();
    await expect(welcome.locator('[data-way="example"]').getByRole('button', { name: 'Open an example' })).toBeVisible({ timeout: 20_000 });
    await welcome.locator('[data-way="example"]').getByRole('button', { name: 'Open an example' }).click();
    await expect(page.locator('.react-flow__node')).toHaveCount(7, { timeout: 15_000 });
    await expect(page.getByText('An example: the finished graph of a lesson')).toBeVisible();

    // A picture saved by ComfyUI, dropped on the window: asked first (the example is in no file), then opened.
    await dropFile(page, picture);
    await page.getByRole('button', { name: 'Open workflow', exact: false }).last().click();
    await expect(page.locator('.react-flow__node')).toHaveCount(2, { timeout: 15_000 });
    await expect(page.getByText('Read from the picture')).toBeVisible();
    await expect(page.locator('.project-chip')).toContainText('from-comfy');
    await page.locator('.document-bar [role="menuitem"]').first().click();
    await page.locator('[data-command="file.recent"]').click();
    await expect(page.getByRole('menuitem', { name: 'from-comfy.png' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');

    // Save for ComfyUI: the run card says how to run it.
    const out = path.join(userData, 'saved.json');
    await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, out);
    await page.locator('.document-bar [role="menuitem"]').first().click();
    await page.getByRole('menuitem', { name: 'Save workflow for ComfyUI…' }).click();
    const guard = page.locator('.export-guard-dialog');
    if (await guard.isVisible({ timeout: 3000 }).catch(() => false)) await guard.getByRole('button', { name: 'Save anyway' }).click();
    const run = page.locator('.journey-run-dialog');
    await expect(run).toBeVisible({ timeout: 10_000 });
    await expect(run).toContainText('saved.json');
    await expect(run.getByRole('button', { name: 'Open ComfyUI' })).toBeVisible();
    expect(fs.existsSync(out)).toBe(true);

    // A ComfyUI error comes back: explained, and its node shown.
    await run.getByRole('button', { name: 'Explain a ComfyUI error…' }).click();
    const card = page.locator('.journey-error-dialog');
    await card.getByRole('textbox').fill('Prompt outputs failed validation\nKSampler 12:\n - Required input is missing: model');
    await card.getByRole('button', { name: 'Explain', exact: true }).click();
    await expect(card.locator('[data-error-node="12"]')).toBeVisible();
    await expect(card.locator('[data-error-note]').first()).toBeVisible();
    await card.locator('[data-error-node="12"]').getByRole('button', { name: 'Show on the canvas' }).click();
    await expect(card).toHaveCount(0);
    await expect(page.locator('.react-flow__node.selected')).toHaveCount(1);

    // Glossary words explain themselves in a lesson step.
    await page.locator('.dock-tab').first().click();
    await page.locator('[data-intent="learn"]').click();
    await page.locator('.lesson-panel [data-lesson-card="image"]').getByRole('button', { name: 'Start' }).click();
    await expect(page.locator('.lesson-panel [data-term]').first()).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }

  // A file named on the command line opens at start (the graph on screen is in no file: asked first).
  ({ app, page } = await launch(userData, [picture]));
  try {
    await page.getByRole('button', { name: 'Open workflow', exact: false }).last().click({ timeout: 15_000 });
    await expect(page.locator('.react-flow__node')).toHaveCount(2, { timeout: 15_000 });
  } finally {
    await app.close();
    await fake.close();
  }
});
