import { test, expect, _electron as electron } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { useEnglish } from './locale';
import { exportPastGuard } from './exportGuard';
import { pickOption } from './pickOption';
import { isReadOnlyCall } from '../../src/main/mcp/readOnly';
import { CLASSES, PACKS, READ_TOOLS, startFakeMcp, WRITE_TOOLS } from '../fixtures/mcp/fakeMcpServer';

/**
 * The README first-run path against a fake MCP server on loopback (labelled fixture, not a real server):
 * Settings ▸ Connection (address, Check, token), Sync ▸ Sync now, the library, Ask about a model (TEST provider),
 * adding nodes from the library, Check graph and Export. The fake server logs every call; only read-only tools
 * with read-only arguments may appear there.
 */
const TOKEN = 'first-run-token-marker';

function containsMarker(dir: string, marker: string): string | null {
  const needle = Buffer.from(marker);
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = containsMarker(full, marker);
      if (nested) return nested;
    } else if (entry.isFile() && fs.readFileSync(full).includes(needle)) {
      return full;
    }
  }
  return null;
}

test('first run: connect, sync from MCP, browse the library, build, check and export', async () => {
  const fake = await startFakeMcp({ token: TOKEN });
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'first-run-sync-'));
  const exportPath = path.join(userData, 'first-run-workflow.json');
  const env = { ...process.env, NODE_ENV: 'production' } as Record<string, string>;
  delete env.DBUS_SESSION_BUS_ADDRESS;
  delete env.GNOME_KEYRING_CONTROL;
  const app = await electron.launch({
    args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`],
    env,
  });
  const errors: string[] = [];
  try {
    const window = await app.firstWindow();
    window.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    window.on('pageerror', (error) => errors.push(error.message));
    await window.setViewportSize({ width: 1440, height: 900 });
    await useEnglish(window);

    // A fresh profile has no MCP address: the empty canvas sends the person to Settings ▸ Connection.
    await window.getByRole('button', { name: 'Connect…' }).click();
    const dialog = window.locator('[role="dialog"].settings-dialog');
    const mcpUrl = dialog.getByRole('textbox', { name: 'MCP server address', exact: true });
    await expect(mcpUrl).toBeVisible();
    await mcpUrl.fill(fake.url);
    // "Check" asks the server: this one wants a token, so "Token" is selected and its field opens right there.
    await dialog.getByRole('button', { name: 'Test server', exact: true }).click();
    await expect(dialog.getByText('The server needs a token. “Token” is selected.')).toBeVisible();
    await expect(dialog.getByRole('radio', { name: 'Token', exact: true })).toBeChecked();
    // Pasting is enough: the app applies the token and asks the server whether it takes it.
    const token = dialog.getByRole('textbox', { name: 'Access token', exact: true });
    await expect(token).toBeFocused();
    await token.fill(TOKEN);
    await expect(dialog.getByText(/Token accepted: the server answers \(\d+ tools\)/)).toBeVisible({ timeout: 15000 });
    await expect(token).toHaveValue('');
    await expect(dialog.getByRole('status', { name: 'Access token' })).toHaveText('The token is kept until restart.');
    await expect(dialog.getByRole('button', { name: 'Forget token' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Save settings' }).click();
    await expect(dialog).toHaveCount(0);

    // Sync ▸ Sync now, from the menu bar.
    await window.getByRole('menubar').getByRole('menuitem', { name: 'Sync', exact: true }).click();
    await window.getByRole('menuitem', { name: 'Sync now' }).click();
    const indicator = window.locator('.sync-indicator');
    await expect(indicator).toHaveAttribute('data-sync-state', 'idle', { timeout: 30000 });
    await indicator.click();
    const popover = window.getByRole('dialog', { name: 'Sync' });
    await expect(popover.getByText(`Up to date`).first()).toBeVisible();
    const counts = await popover.locator('dd').allInnerTexts();
    expect(counts[0]).toBe(String(CLASSES.length));
    expect(counts[1]).toBe(String(CLASSES.length));
    expect(counts[2]).toBe(String(PACKS.length));
    expect(Number(counts[3])).toBeGreaterThanOrEqual(25);
    // The small fake catalog is read in one batch: no background reading is left, and the details are shown.
    await expect(indicator).not.toHaveAttribute('data-sync-enriching', 'true');
    await expect(popover.getByText('Model files read', { exact: true })).toBeVisible();
    await expect(popover.getByText('Duration', { exact: true })).toBeVisible();
    await indicator.click();
    await expect(popover).toHaveCount(0);

    // Library ▸ Nodes: classes grouped by category, with ports from the native object_info.
    const rail = window.locator('#library-rail');
    await rail.getByRole('tab', { name: 'Nodes' }).click();
    const nodeList = window.locator('#node-library-list');
    await expect(window.getByText(`${CLASSES.length} nodes`, { exact: true })).toBeVisible();
    const headers = nodeList.locator('[aria-expanded]');
    await expect(headers.first()).toContainText('advanced');
    await expect(headers.filter({ hasText: 'conditioning' })).toHaveCount(1);
    const nodeSearch = rail.getByRole('searchbox', { name: 'Search nodes' }).or(rail.getByRole('textbox', { name: 'Search nodes' })).first();
    await nodeSearch.fill('wanvideo');
    await expect(headers.filter({ hasText: 'WanVideoWrapper' })).toHaveCount(1);
    await nodeSearch.fill('ksampler');
    await nodeList.getByRole('option').filter({ hasText: /^KSampler\s*KSampler/ }).first().dblclick();
    const sampler = window.locator('.react-flow__node').filter({ hasText: 'latent_image' }).first();
    await expect(sampler).toBeVisible();
    await expect(sampler.locator('.react-flow__handle')).toHaveCount(11);
    // Drag a class onto the canvas: it keeps the library's display name.
    await nodeSearch.fill('lora');
    await nodeList.getByRole('option').filter({ hasText: 'Load LoRA' }).first()
      .dragTo(window.locator('.react-flow__pane'), { targetPosition: { x: 80, y: 120 } });
    await expect(window.locator('.react-flow__node')).toHaveCount(2);
    await expect(window.locator('.react-flow__node').filter({ hasText: 'Load LoRA' })).toHaveCount(1);
    // lora_name is a field row (a control), not a socket row.
    const loraNode = window.locator('.react-flow__node').filter({ hasText: 'Load LoRA' });
    await expect(loraNode.locator('.node-field-name').getByText('lora_name')).toBeVisible();
    // The new node starts with the catalog defaults, so its field shows a LoRA file, not "not set".
    await expect(loraNode.getByRole('combobox', { name: 'lora_name' })).toHaveAttribute('data-value', /\.safetensors$/);

    // Library ▸ Models: family badges from metadata, sidecars and file names.
    await rail.getByRole('tab', { name: 'Models' }).click();
    const modelList = window.locator('#model-library-list');
    const modelSearch = rail.getByRole('searchbox', { name: 'Search models' }).or(rail.getByRole('textbox', { name: 'Search models' })).first();
    const families: Array<[string, string]> = [
      ['PastelDetailPonyV2', 'Pony'],
      ['sd_xl_base_1.0', 'SDXL'],
      ['wan2.2_i2v_A14b_high_noise', 'Wan 2.2'],
      ['Z-Image-Turbo-Realism', 'Z-Image'],
    ];
    for (const [name, family] of families) {
      await modelSearch.fill(name);
      const row = modelList.getByRole('option').filter({ hasText: name }).first();
      await expect(row).toContainText(family);
    }
    await expect(modelList.getByRole('option').first()).toContainText('LoRA');

    // Ask about this model with the TEST provider: the question lands in the chat and the fixture answers.
    await pickOption(window, 'Choose the assistant', 'TEST mode');
    await modelSearch.fill('PastelDetailPonyV2');
    const ponyRow = modelList.getByRole('option').filter({ hasText: 'PastelDetailPonyV2' }).first();
    await ponyRow.hover();
    await ponyRow.getByRole('button', { name: 'Ask about this model' }).click();
    await expect(window.getByText('What is the model PastelDetailPonyV2.safetensors, and what does it work with?')).toBeVisible();
    await expect(window.getByText(/TEST fixture only: I looked this model up in your synced catalog/)).toBeVisible({ timeout: 30000 });

    // Check graph: the two unconnected nodes have required inputs left empty.
    await window.locator('.react-flow__pane').click({ position: { x: 20, y: 400 } });
    await window.keyboard.press('Control+Shift+C');
    await expect(window.getByRole('heading', { name: 'Check before saving' })).toBeVisible();
    await expect(window.getByText(/Required inputs left empty/)).toBeVisible();

    // Export through the stubbed save dialog: plain ComfyUI JSON with numeric ids.
    await app.evaluate(({ dialog: fileDialog }, filePath) => {
      fileDialog.showSaveDialog = async () => ({ canceled: false, filePath });
    }, exportPath);
    await exportPastGuard(window);
    const workflow = JSON.parse(fs.readFileSync(exportPath, 'utf8')) as { version: number; nodes: Array<{ id: unknown; type: string }> };
    expect(workflow.version).toBe(1);
    expect(workflow.nodes.map((node) => node.type).sort()).toEqual(['KSampler', 'LoraLoader']);
    for (const node of workflow.nodes) expect(typeof node.id).toBe('number');
    // Nodes added before any value was set still export the object_info defaults, never null.
    const libraryKSampler = (workflow.nodes as Array<{ type: string; widgets_values?: unknown[] }>).find((node) => node.type === 'KSampler');
    expect(libraryKSampler?.widgets_values).toEqual([0, 'randomize', 20, 8, 'euler', 'normal', 1]);

    // Build a text-to-image graph with the TEST provider, then export again: no widget of the loader or the
    // sampler is null, because new nodes start with the catalog defaults.
    await window.getByRole('tab', { name: 'Assistant' }).click();
    const composer = window.locator('textarea[aria-label="Chat message"]');
    await expect(composer).toHaveAttribute('placeholder', 'Ask about the graph');
    await window.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Build', exact: true }).click();
    await expect(composer).toHaveAttribute('placeholder', 'Ask for a graph change');
    await composer.fill('build a text to image graph');
    await composer.press('Enter');
    await expect(window.locator('[data-tool-name="connectNodes"][data-tool-status="success"]')).toHaveCount(9, { timeout: 60000 });
    await expect(window.locator('.react-flow__node')).toHaveCount(9);
    await expect(window.locator('[data-live-build]')).toHaveCount(0, { timeout: 30000 });
    const builtPath = path.join(userData, 'first-run-built.json');
    await app.evaluate(({ dialog: fileDialog }, filePath) => {
      fileDialog.showSaveDialog = async () => ({ canceled: false, filePath });
    }, builtPath);
    // The library nodes above are still unconnected, so the export guard asks first.
    await exportPastGuard(window, { guard: true });
    await expect.poll(() => fs.existsSync(builtPath), { timeout: 10000 }).toBe(true);
    const built = JSON.parse(fs.readFileSync(builtPath, 'utf8')) as { nodes: Array<{ type: string; widgets_values?: unknown[] }> };
    const checked = built.nodes.filter((node) => node.type === 'KSampler' || node.type === 'CheckpointLoaderSimple');
    expect(checked.map((node) => node.type).sort()).toEqual(['CheckpointLoaderSimple', 'KSampler', 'KSampler']);
    for (const node of checked) {
      expect(Array.isArray(node.widgets_values) && node.widgets_values.length > 0).toBe(true);
      expect(node.widgets_values).not.toContain(null);
    }
    expect(checked.find((node) => node.type === 'CheckpointLoaderSimple')?.widgets_values).toEqual(['juggernautXL_v9.safetensors']);

    // Only read-only MCP tools with read-only arguments; the token never reached the disk.
    const toolCalls = fake.calls.filter((call) => call.method === 'tools/call');
    expect(new Set(toolCalls.map((call) => call.tool))).toEqual(new Set(['studio_capabilities', 'models', 'studio_info', 'comfy_api', 'model_metadata', 'workspace_files']));
    for (const call of toolCalls) {
      expect(READ_TOOLS as readonly string[]).toContain(call.tool);
      expect(WRITE_TOOLS as readonly string[]).not.toContain(call.tool);
      expect(isReadOnlyCall(String(call.tool), call.args ?? {})).toBe(true);
    }
    // The file tool can also write, move and delete. The app uses it for two things only: to read, as bytes, a
    // description or a preview that lies next to a model file, and the pyproject.toml and README at the top of
    // a node pack, where the pack says what it is.
    const fileCalls = toolCalls.filter((call) => call.tool === 'workspace_files').map((call) => (call.args ?? {}) as Record<string, unknown>);
    expect(fileCalls.length).toBeGreaterThan(0);
    const sideFile = /^\/srv\/comfyui\/models\/[^/]+\/[^/]+\.(metadata\.json|civitai\.info|webp|png|jpe?g|gif|mp4|webm)$/;
    const packFile = /^\/srv\/comfyui\/custom_nodes\/[^/]+\/(pyproject\.toml|README\.md|readme\.md|README\.MD|Readme\.md)$/;
    for (const args of fileCalls) {
      expect(args.action).toBe('read');
      expect(args.encoding).toBe('base64');
      const target = String(args.absolute_path);
      expect(sideFile.test(target) || packFile.test(target), target).toBe(true);
      expect(target.split('/')).not.toContain('..');
      expect(Object.keys(args).sort()).toEqual(['absolute_path', 'action', 'encoding', 'length', 'offset']);
    }
    expect(fileCalls.some((args) => packFile.test(String(args.absolute_path)))).toBe(true);
    // Where the packs lie is asked once, by the one read-only question that names it.
    expect(toolCalls.filter((call) => call.tool === 'studio_capabilities' && call.args?.section === 'roots').map((call) => call.args)).toEqual([{ section: 'roots' }]);
    // "Check" knocks without credentials on purpose (that is how it learns a token is needed) and is turned away
    // before any tool runs; every tool call afterwards carried the token.
    expect(toolCalls.every((call) => call.authorized)).toBe(true);
    const anonymous = fake.calls.filter((call) => !call.authorized);
    expect(anonymous.length).toBeGreaterThan(0);
    expect(anonymous.some((call) => call.method === 'tools/call')).toBe(false);
    expect(fake.comfyHits).toEqual(['GET /system_stats', 'GET /object_info']);
    expect(containsMarker(userData, TOKEN)).toBeNull();
    expect(errors).toEqual([]);
  } finally {
    await app.close();
    await fake.close();
  }
});
