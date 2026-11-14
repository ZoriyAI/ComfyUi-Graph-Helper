import { test, expect, _electron as electron } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { useEnglish } from './locale';
import { loadNodeList } from './fileMenu';

/** object_info for the loader: the only checkpoint on disk is known.safetensors. */
const objectInfo = {
  CheckpointLoaderSimple: {
    input: { required: { ckpt_name: [['known.safetensors'], {}] } },
    input_order: { required: ['ckpt_name'] },
    output: ['MODEL', 'CLIP', 'VAE'],
    output_name: ['MODEL', 'CLIP', 'VAE'],
    name: 'CheckpointLoaderSimple',
    display_name: 'Load Checkpoint',
    description: '',
    python_module: 'nodes',
    category: 'loaders',
    output_node: false,
  },
};

/** A checkpoint loader whose model is not on disk: the check finds a missing model. */
const workflow = {
  version: 1,
  state: { lastNodeId: 1, lastLinkId: 0 },
  nodes: [{
    id: 1, type: 'CheckpointLoaderSimple', pos: [0, 0], size: [200, 80], flags: {}, order: 0, mode: 0, properties: {},
    title: 'Loader', widgets_values: ['missing-model.safetensors'],
  }],
  links: [],
};

test('Export with check findings asks first; Cancel writes nothing, Export anyway writes the file', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'export-guard-'));
  const saved = path.join(userData, 'out.json');
  const source = path.join(userData, 'in.json');
  const catalog = path.join(userData, 'object_info.json');
  fs.writeFileSync(source, JSON.stringify(workflow));
  fs.writeFileSync(catalog, JSON.stringify(objectInfo));
  const electronApp = await electron.launch({
    args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  const window = await electronApp.firstWindow();
  await useEnglish(window);
  await window.locator('#chat-provider').waitFor();
  await electronApp.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
  }, catalog);
  await loadNodeList(window);
  await expect(window.getByText(/Node list loaded/)).toBeVisible();
  await electronApp.evaluate(({ dialog }, paths) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [paths.source] });
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: paths.saved });
  }, { source, saved });
  await window.getByRole('button', { name: 'Open workflow…', exact: true }).click();
  await expect(window.locator('.react-flow__node')).toHaveCount(1);

  const guard = window.locator('[role="dialog"].export-guard-dialog');
  await window.getByRole('button', { name: 'Save workflow for ComfyUI…', exact: true }).click();
  await expect(guard).toBeVisible();
  await expect(guard.getByRole('heading')).toContainText(/The workflow has \d+ issues?/);
  await expect(guard).toContainText('missing-model.safetensors');
  await guard.getByRole('button', { name: 'Cancel' }).click();
  await expect(guard).toHaveCount(0);
  expect(fs.existsSync(saved)).toBe(false);

  // The menu command goes through the same guard; Open check shows the Check tab.
  await window.keyboard.press('Control+e');
  await expect(guard).toBeVisible();
  await guard.getByRole('button', { name: 'Open check' }).click();
  await expect(guard).toHaveCount(0);
  await expect(window.locator('.dock-tab[data-state="active"]')).toContainText(/Check/);
  expect(fs.existsSync(saved)).toBe(false);
  // The findings are marked on their node too: the loader with the missing file carries a raspberry ring and a count.
  const mark = window.locator('[data-check-mark]');
  await expect(mark).toHaveCount(1);
  await expect(mark).toHaveAttribute('data-check-level', 'error');
  await expect(mark).toHaveAttribute('aria-label', /Findings of the check on this node: \d+/);

  await window.getByRole('button', { name: 'Save workflow for ComfyUI…', exact: true }).click();
  await guard.getByRole('button', { name: 'Save anyway' }).click();
  await expect.poll(() => fs.existsSync(saved)).toBe(true);
  const written = JSON.parse(fs.readFileSync(saved, 'utf8')) as { nodes: Array<{ type: string }> };
  expect(written.nodes.map((node) => node.type)).toEqual(['CheckpointLoaderSimple']);
  await electronApp.close();
});
