import { test, expect, _electron as electron } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { pickOption } from './pickOption';
import { useEnglish } from './locale';

/**
 * Packaged Electron UI against a real local llama-server.
 * This is not the TEST fixture. The server is started outside the test.
 * If nothing is listening on 127.0.0.1:18080, the test is skipped.
 */
const LOCAL_BASE = 'http://127.0.0.1:18080/v1';
const PURPOSE = 'Loads the portrait checkpoint';

test('live local model adds a loader and the export keeps its parameter', async () => {
  let listening = false;
  try {
    const health = await fetch('http://127.0.0.1:18080/health');
    listening = health.ok;
  } catch {
    listening = false;
  }
  test.skip(!listening, 'llama-server is not listening on 127.0.0.1:18080');

  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'live-local-electron-'));
  const catalogPath = path.join(userData, 'object_info.json');
  const nativePath = path.join(userData, 'project.graph-helper.json');
  const comfyPath = path.join(userData, 'workflow.json');
  fs.writeFileSync(catalogPath, JSON.stringify({
    CheckpointLoaderSimple: {
      input: {
        required: {
          ckpt_name: [['known.safetensors'], { tooltip: 'The name of the checkpoint (model) to load.' }],
        },
      },
      input_order: { required: ['ckpt_name'] },
      output: ['MODEL', 'CLIP', 'VAE'],
      output_name: ['MODEL', 'CLIP', 'VAE'],
      python_module: 'nodes',
    },
  }));
  const env = { ...process.env, NODE_ENV: 'production' };
  delete env.DBUS_SESSION_BUS_ADDRESS;
  delete env.GNOME_KEYRING_CONTROL;
  const electronApp = await electron.launch({
    args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`],
    env,
  });
  try {
    const window = await electronApp.firstWindow();
    await window.setViewportSize({ width: 1440, height: 900 });
    await useEnglish(window);
    await window.getByRole('button', { name: 'Settings', exact: true }).click();
    const settings = window.locator('[role="dialog"].settings-dialog');
    await settings.getByRole('tab', { name: 'Assistant' }).click();
    await pickOption(window, 'Provider', 'Local endpoint', settings);
    await settings.getByRole('textbox', { name: 'Model', exact: true }).fill('qwen2.5-0.5b-instruct');
    await settings.getByRole('textbox', { name: 'Base URL', exact: true }).fill(LOCAL_BASE);
    await settings.getByRole('button', { name: 'Save settings' }).click();
    await expect(settings).toHaveCount(0);
    await expect(window.getByText('Local endpoint. No key is sent.')).toBeVisible();

    await electronApp.evaluate(({ dialog }, paths) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [paths.catalogPath] });
    }, { catalogPath });
    await window.getByRole('button', { name: 'Catalog snapshot', exact: true }).click();
    await expect(window.getByText('Catalog snapshot imported. Nodes: 1. Models: 1. Skipped: 0.')).toBeVisible();

    await window.getByRole('tab', { name: 'Assistant' }).click();
    const input = window.locator('textarea[aria-label="Chat message"]');
    await input.fill('Call the addNode tool once. nodeType is CheckpointLoaderSimple. title is Portrait loader. parameters is {"ckpt_name":"portrait.safetensors"}. Do not call another tool.');
    await input.press('Enter');
    await expect(window.locator('.react-flow__node', { hasText: 'Portrait loader' })).toBeVisible({ timeout: 90000 });

    await window.getByRole('tab', { name: 'Inspector' }).click();
    await window.locator('.react-flow__node', { hasText: 'Portrait loader' }).click();
    await electronApp.evaluate(({ dialog: fileDialog }, paths) => {
      fileDialog.showSaveDialog = async () => ({ canceled: false, filePath: paths.nativePath });
      fileDialog.showOpenDialog = async () => ({ canceled: false, filePaths: [paths.nativePath] });
    }, { nativePath });
    await window.getByRole('button', { name: 'Save project' }).click();
    await expect(window.getByText('Saved the native project.')).toBeVisible();
    const native = JSON.parse(fs.readFileSync(nativePath, 'utf8')) as { format: string };
    expect(native.format).toBe('comfy-graph-helper-project');

    await electronApp.evaluate(({ dialog: fileDialog }, paths) => {
      fileDialog.showSaveDialog = async () => ({ canceled: false, filePath: paths.comfyPath });
    }, { comfyPath });
    await window.getByRole('button', { name: 'Export', exact: true }).click();
    await expect(window.getByText('Exported the current workflow.')).toBeVisible();
    const exported = fs.readFileSync(comfyPath, 'utf8');
    expect(exported).not.toContain(PURPOSE);
    expect(exported).not.toContain('graphHelper');
    expect(exported).not.toContain('componentRecords');
    const workflow = JSON.parse(exported) as { nodes: Array<{ title?: string; type?: string; widgets_values?: unknown[] }> };
    expect(workflow.nodes).toHaveLength(1);
    expect(workflow.nodes[0]?.type).toBe('CheckpointLoaderSimple');
    expect(workflow.nodes[0]?.title).toBe('Portrait loader');
    expect(workflow.nodes[0]?.widgets_values).toEqual(['portrait.safetensors']);

    await window.getByRole('button', { name: 'Open project' }).click();
    await expect(window.getByText('Opened the native project.')).toBeVisible();
    await expect(window.locator('.react-flow__node', { hasText: 'Portrait loader' })).toBeVisible();
  } finally {
    await electronApp.close();
  }
});
