/**
 * E2E spec for the journey a release must pass: configure a provider, build a process with the TEST fixture agent
 * plus a local HTTP catalog fixture, and export a clean workflow; then import object_info so the agent can export a
 * loader parameter. A session marker must not end up in any regular file of the profile.
 * This is not a live model and it does not queue a ComfyUI prompt.
 */
import { test, expect, _electron as electron } from '@playwright/test';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { pickOption } from './pickOption';
import { useEnglish } from './locale';
import { exportPastGuard } from './exportGuard';
import { loadNodeList } from './fileMenu';
import { artifact, ARTIFACT_DIR } from './artifacts';

const SESSION_MARKER = 'session-marker-not-stored';
const PURPOSE = 'Fixture node purpose';
const PROCESS_TITLE = 'Fixture process';

/** The first file under `dir` that holds the session marker, or null. */
function containsMarker(dir: string): string | null {
  const needle = Buffer.from(SESSION_MARKER);
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = containsMarker(full);
      if (nested) return nested;
      continue;
    }
    // The single-instance lock leaves links and a socket in the profile; only regular files can hold text.
    if (entry.isFile() && fs.readFileSync(full).includes(needle)) return full;
  }
  return null;
}

test('prerelease journey configures a provider, builds a process, and exports a clean workflow', async () => {
  const hits: string[] = [];
  const server = http.createServer((req, res) => {
    hits.push(`${req.method} ${req.url}`);
    if (req.method !== 'GET') {
      res.writeHead(405);
      res.end();
      return;
    }
    if (req.url === '/system_stats') {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ system: { comfyui_version: 'fixture-0' }, devices: [{ name: 'fixture' }] }));
      return;
    }
    if (req.url === '/object_info') {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({
        SeedNode: {
          input: { required: { seed: ['INT', { default: 0 }] } },
          input_order: { required: ['seed'] },
          output: ['LATENT'],
          python_module: 'nodes',
        },
        // The TEST fixture adds TestNode. Once a catalog is read, the helper refuses classes it does not list.
        TestNode: {
          input: { required: {} },
          output: ['LATENT'],
          python_module: 'nodes',
        },
      }));
      return;
    }
    if (req.url === '/customnode/installed' || req.url === '/experiment/models') {
      res.setHeader('content-type', 'application/json');
      res.end(req.url === '/customnode/installed' ? '{}' : '[]');
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('fixture server has no port');
  const origin = `http://127.0.0.1:${address.port}`;
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'prerelease-journey-'));
  const nativePath = path.join(userData, 'project.nodewise.json');
  const comfyPath = path.join(userData, 'workflow.json');
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const env = { ...process.env, NODE_ENV: 'production' } as Record<string, string>;
  // No session bus and no keyring daemon, so Electron does not talk to the desktop's keyring during the run.
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
    const dialog = window.locator('[role="dialog"].settings-dialog');
    await dialog.getByRole('textbox', { name: 'ComfyUI address', exact: true }).fill(origin);
    await dialog.getByRole('tab', { name: 'Assistant' }).click();
    await dialog.getByRole('radio', { name: 'Your own server', exact: true }).click();
    await dialog.getByRole('textbox', { name: 'Model', exact: true }).fill('fixture-local');
    await dialog.getByRole('textbox', { name: 'Server address', exact: true }).fill('http://127.0.0.1:9/v1');
    await dialog.getByRole('button', { name: 'Save settings' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(window.getByText('Your own server. No key is sent.')).toBeVisible();

    await window.getByRole('button', { name: 'Settings', exact: true }).click();
    const restored = window.locator('[role="dialog"].settings-dialog');
    await restored.getByRole('tab', { name: 'Assistant' }).click();
    await expect(restored.getByRole('textbox', { name: 'Model', exact: true })).toHaveValue('fixture-local');
    await expect(restored.getByRole('textbox', { name: 'Server address', exact: true })).toHaveValue('http://127.0.0.1:9/v1');
    await restored.getByRole('tab', { name: 'Connection' }).click();
    await expect(restored.getByRole('textbox', { name: 'ComfyUI address', exact: true })).toHaveValue(origin);
    // The key lives under the provider choice in Assistant; pasting applies it for this session at once.
    await restored.getByRole('tab', { name: 'Assistant' }).click();
    await restored.getByRole('radio', { name: 'OpenAI', exact: true }).click();
    // An https address nobody answers at: the marker is not a real key, and a provider that answered 401 would
    // (rightly) make the app drop it. Unchecked, it is held for this session.
    await restored.getByRole('textbox', { name: 'Server address', exact: true }).fill('https://127.0.0.1:9/v1');
    const session = restored.getByRole('textbox', { name: 'OpenAI key', exact: true });
    await session.fill(SESSION_MARKER);
    await expect(restored.getByRole('status', { name: 'OpenAI key' })).toHaveText('The key is kept until restart.', { timeout: 20000 });
    // Without a password store the only offer is the app folder file, which this test does not take.
    await expect(restored.getByRole('button', { name: 'Remember on this computer' })).toHaveCount(0);
    // Back to the official address, so the draft holds no change but the key.
    await restored.getByRole('textbox', { name: 'Server address', exact: true }).fill('');
    await restored.getByRole('radio', { name: 'Your own server', exact: true }).click();
    const blocked = await window.evaluate(async (marker) => {
      const bridge = (window as unknown as { electronAPI: { saveSecret: (provider: string, value: string) => Promise<{ status: string }> } }).electronAPI;
      return bridge.saveSecret('openai', marker);
    }, SESSION_MARKER);
    expect(blocked).toEqual({ status: 'secret-storage-blocked' });
    expect(containsMarker(userData)).toBeNull();

    await restored.getByRole('tab', { name: 'Connection' }).click();
    // System details and catalog reading now have separate contracts; keep both checks.
    const system = await window.evaluate(async (address) => {
      const bridge = (window as unknown as { electronAPI: { checkComfy: (origin: string) => Promise<unknown> } }).electronAPI;
      return bridge.checkComfy(address);
    }, origin);
    expect(system).toMatchObject({ ok: true, version: 'fixture-0', devices: 1 });
    await restored.getByRole('button', { name: 'Read now', exact: true }).click();
    await expect(restored.getByRole('status').filter({ hasText: 'Read from ComfyUI. Nodes: 2, packs: 0, model files: 0.' })).toBeVisible();
    expect(hits).toEqual(['GET /system_stats', 'GET /system_stats', 'GET /object_info', 'GET /customnode/installed', 'GET /experiment/models']);
    await window.screenshot({ path: artifact('pr13-prerelease-settings.png') });
    await restored.getByRole('button', { name: 'Cancel' }).click();
    await expect(restored).toHaveCount(0);

    await pickOption(window, 'Choose the assistant', 'TEST mode');
    await window.getByText('TEST mode is on').first().waitFor();
    await window.getByRole('tab', { name: 'Assistant' }).click();
    // Build tools exist only in a build turn: switch the composer to Build.
    await window.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Build', exact: true }).click();
    const input = window.locator('textarea[aria-label="Chat message"]');
    await input.fill('Build the process fixture');
    await input.press('Enter');
    await expect(window.getByText('TEST fixture only: I added a node, stored what it is for, and named the process.')).toBeVisible({ timeout: 30000 });
    // The chat says each change in words: the node, what it is for, the process name.
    const buildCard = window.locator('[data-build-card]');
    await expect(buildCard).toContainText('Added the node Fixture step');
    await expect(buildCard).toContainText('Wrote down what Fixture step is for');
    await expect(buildCard).toContainText(`Named the graph “${PROCESS_TITLE}”`);
    await window.getByRole('tab', { name: 'Properties' }).click();
    await window.getByText('Fixture step', { exact: true }).click();
    const nodeForm = window.locator('[data-component-owner="node:1"]');
    await expect(nodeForm.locator('textarea').nth(0)).toHaveValue(PURPOSE);
    await expect(nodeForm.locator('textarea').nth(1)).toHaveValue('Connect it in Comfy after export.');
    await expect(window.locator('#process-title')).toHaveValue(PROCESS_TITLE);

    await window.getByRole('button', { name: 'Settings', exact: true }).click();
    const check = window.locator('[role="dialog"].settings-dialog');
    await check.getByRole('button', { name: 'Check this graph' }).click();
    await expect(check.getByText('Missing nodes: none. Missing models: none.')).toBeVisible();
    await check.getByRole('button', { name: 'Cancel' }).click();
    await expect(check).toHaveCount(0);
    await window.screenshot({ path: artifact('pr13-prerelease-process.png') });

    await electronApp.evaluate(({ dialog: fileDialog }, paths) => {
      fileDialog.showSaveDialog = async () => ({ canceled: false, filePath: paths.nativePath });
      fileDialog.showOpenDialog = async () => ({ canceled: false, filePaths: [paths.nativePath] });
    }, { nativePath });
    await window.getByRole('button', { name: 'Save project' }).click();
    await expect(window.getByText('Project saved.')).toBeVisible();
    const native = JSON.parse(fs.readFileSync(nativePath, 'utf8')) as {
      format: string;
      version: number;
      process: { title: string; notes: string };
      components: Array<{ ownerId: string; purpose: string }>;
    };
    expect(native.format).toBe('nodewise-studio-project');
    expect(native.version).toBe(2);
    expect(native.process.title).toBe(PROCESS_TITLE);
    expect(native.components.find((item) => item.ownerId === '1')?.purpose).toBe(PURPOSE);

    await electronApp.evaluate(({ dialog: fileDialog }, paths) => {
      fileDialog.showSaveDialog = async () => ({ canceled: false, filePath: paths.comfyPath });
    }, { comfyPath });
    await exportPastGuard(window);
    const exported = fs.readFileSync(comfyPath, 'utf8');
    expect(exported).not.toContain(PURPOSE);
    expect(exported).not.toContain(PROCESS_TITLE);
    expect(exported).not.toContain('graphHelper');
    expect(exported).not.toContain('componentRecords');
    const workflow = JSON.parse(exported) as { version: number; nodes: Array<{ title?: string; type?: string }> };
    expect(workflow.version).toBe(1);
    expect(workflow.nodes).toHaveLength(1);
    expect(workflow.nodes[0]?.type).toBe('TestNode');

    await nodeForm.locator('textarea').nth(0).fill('Temporary edit');
    await nodeForm.getByRole('button', { name: 'Save documentation' }).click();
    await window.getByRole('button', { name: 'Open project' }).click();
    const replace = window.getByRole('dialog', { name: 'Open another project?', exact: true });
    await expect(replace).toBeVisible();
    await replace.getByRole('button', { name: 'Open project', exact: true }).click();
    await expect(window.getByText('Project opened.')).toBeVisible();
    await expect(window.locator('[data-component-owner="node:1"] textarea').nth(0)).toHaveValue(PURPOSE);
    expect(containsMarker(userData)).toBeNull();
    expect(hits.filter((hit) => hit.startsWith('POST'))).toEqual([]);
  } finally {
    await electronApp.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('object info import lets the agent export a loader parameter', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'loader-export-'));
  const catalogPath = path.join(userData, 'object_info.json');
  const nativePath = path.join(userData, 'project.nodewise.json');
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
  const env = { ...process.env, NODE_ENV: 'production' } as Record<string, string>;
  // No session bus and no keyring daemon, so Electron does not talk to the desktop's keyring during the run.
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
    await electronApp.evaluate(({ dialog }, paths) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [paths.catalogPath] });
    }, { catalogPath });
    await loadNodeList(window);
    await expect(window.getByText('Node list loaded. Nodes: 1. Models: 1. Skipped: 0.')).toBeVisible();

    await pickOption(window, 'Choose the assistant', 'TEST mode');
    await window.getByText('TEST mode is on').first().waitFor();
    await window.getByRole('tab', { name: 'Assistant' }).click();
    // Build tools exist only in a build turn: switch the composer to Build.
    await window.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Build', exact: true }).click();
    const input = window.locator('textarea[aria-label="Chat message"]');
    await input.fill('Build the loader fixture');
    await input.press('Enter');
    await expect(window.getByText('TEST fixture only: the loader parameter is in the export.')).toBeVisible({ timeout: 30000 });
    await window.getByRole('tab', { name: 'Properties' }).click();
    await window.locator('.react-flow__node', { hasText: 'Portrait loader' }).click();
    const nodeForm = window.locator('[data-component-owner="node:1"]');
    await expect(nodeForm.locator('textarea').nth(0)).toHaveValue('Loads the portrait checkpoint');
    await expect(window.locator('#process-title')).toHaveValue('Portrait process');

    await window.getByRole('button', { name: 'Settings', exact: true }).click();
    const check = window.locator('[role="dialog"].settings-dialog');
    await check.getByRole('button', { name: 'Check this graph' }).click();
    await expect(check.getByText('Missing models: checkpoints/portrait.safetensors.')).toBeVisible();
    await check.getByRole('button', { name: 'Cancel' }).click();

    await electronApp.evaluate(({ dialog: fileDialog }, paths) => {
      fileDialog.showSaveDialog = async () => ({ canceled: false, filePath: paths.nativePath });
      fileDialog.showOpenDialog = async () => ({ canceled: false, filePaths: [paths.nativePath] });
    }, { nativePath });
    await window.getByRole('button', { name: 'Save project' }).click();
    await expect(window.getByText('Project saved.')).toBeVisible();
    const native = JSON.parse(fs.readFileSync(nativePath, 'utf8')) as {
      format: string;
      process: { title: string };
      components: Array<{ ownerId: string; purpose: string }>;
    };
    expect(native.format).toBe('nodewise-studio-project');
    expect(native.process.title).toBe('Portrait process');
    expect(native.components.find((item) => item.ownerId === '1')?.purpose).toBe('Loads the portrait checkpoint');

    await electronApp.evaluate(({ dialog: fileDialog }, paths) => {
      fileDialog.showSaveDialog = async () => ({ canceled: false, filePath: paths.comfyPath });
    }, { comfyPath });
    await exportPastGuard(window);
    const exported = fs.readFileSync(comfyPath, 'utf8');
    expect(exported).not.toContain('Loads the portrait checkpoint');
    expect(exported).not.toContain('Portrait process');
    expect(exported).not.toContain('graphHelper');
    expect(exported).not.toContain('componentRecords');
    const workflow = JSON.parse(exported) as { nodes: Array<{ title?: string; type?: string; widgets_values?: unknown[] }> };
    expect(workflow.nodes).toHaveLength(1);
    expect(workflow.nodes[0]?.type).toBe('CheckpointLoaderSimple');
    expect(workflow.nodes[0]?.title).toBe('Portrait loader');
    expect(workflow.nodes[0]?.widgets_values).toEqual(['portrait.safetensors']);

    await nodeForm.locator('textarea').nth(0).fill('Temporary edit');
    await nodeForm.getByRole('button', { name: 'Save documentation' }).click();
    await window.getByRole('button', { name: 'Open project' }).click();
    const replace = window.getByRole('dialog', { name: 'Open another project?', exact: true });
    await expect(replace).toBeVisible();
    await replace.getByRole('button', { name: 'Open project', exact: true }).click();
    await expect(window.getByText('Project opened.')).toBeVisible();
    await expect(window.locator('[data-component-owner="node:1"] textarea').nth(0)).toHaveValue('Loads the portrait checkpoint');
  } finally {
    await electronApp.close();
  }
});
