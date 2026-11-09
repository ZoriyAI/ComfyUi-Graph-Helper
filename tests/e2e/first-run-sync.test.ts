import { test, expect, _electron as electron } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { useEnglish } from './locale';
import { pickOption } from './pickOption';
import { isReadOnlyCall } from '../../src/main/mcp/readOnly';
import { CLASSES, PACKS, READ_TOOLS, startFakeMcp, WRITE_TOOLS } from '../fixtures/mcp/fakeMcpServer';

/**
 * The README first-run path against a fake MCP server on loopback (labelled fixture, not the owner's server):
 * Settings ▸ Connection and Models & keys, Sync ▸ Sync now, the library, Ask about a model (TEST provider),
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
  const env = { ...process.env, NODE_ENV: 'production' };
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
    await window.getByRole('button', { name: 'Connect to ComfyUI…' }).click();
    const dialog = window.locator('[role="dialog"].settings-dialog');
    const mcpUrl = dialog.getByRole('textbox', { name: 'MCP server URL', exact: true });
    await expect(mcpUrl).toBeVisible();
    await mcpUrl.fill(fake.url);
    await dialog.getByRole('tab', { name: 'Models & keys' }).click();
    await dialog.getByRole('textbox', { name: 'MCP token', exact: true }).fill(TOKEN);
    await dialog.getByRole('button', { name: 'Use token for this session' }).click();
    await expect(dialog.getByText('The MCP token is held for this session only. It was not written.')).toBeVisible();
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
    await indicator.click();
    await expect(popover).toHaveCount(0);

    // Library ▸ Nodes: classes grouped by category, with ports from the native object_info.
    const rail = window.locator('#library-rail');
    await rail.getByRole('tab', { name: 'Nodes' }).click();
    const nodeList = window.locator('#node-library-list');
    await expect(window.getByText(`${CLASSES.length} nodes`)).toBeVisible();
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
    await expect(window.locator('.react-flow__node').filter({ hasText: 'Load LoRA' }).locator('.port-name').getByText('lora_name')).toBeVisible();
    // The new node starts with the catalog defaults, so its parameters show the first LoRA, not an empty field.
    await expect(window.locator('.react-flow__node').filter({ hasText: 'Load LoRA' }).getByText('lora_name', { exact: true }).nth(1)).toBeVisible();

    // Library ▸ Models: family badges from metadata, sidecars and file names.
    await rail.getByRole('tab', { name: 'Models' }).click();
    const modelList = window.locator('#model-library-list');
    const modelSearch = rail.getByRole('searchbox', { name: 'Search models' }).or(rail.getByRole('textbox', { name: 'Search models' })).first();
    const families: Array<[string, string]> = [
      ['PerfectBreastsPonyV2', 'Pony'],
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
    await pickOption(window, 'Chat provider', 'TEST fixture');
    await modelSearch.fill('PerfectBreastsPonyV2');
    const ponyRow = modelList.getByRole('option').filter({ hasText: 'PerfectBreastsPonyV2' }).first();
    await ponyRow.hover();
    await ponyRow.getByRole('button', { name: 'Ask about this model' }).click();
    await expect(window.getByText('What is the model PerfectBreastsPonyV2.safetensors, and what does it work with?')).toBeVisible();
    await expect(window.getByText(/TEST fixture only: I looked this model up in your synced catalog/)).toBeVisible({ timeout: 30000 });

    // Check graph: the two unconnected nodes have required inputs left empty.
    await window.locator('.react-flow__pane').click({ position: { x: 20, y: 400 } });
    await window.keyboard.press('Control+Shift+C');
    await expect(window.getByRole('heading', { name: 'Check before export' })).toBeVisible();
    await expect(window.getByText(/Required inputs left empty/)).toBeVisible();

    // Export through the stubbed save dialog: plain ComfyUI JSON with numeric ids.
    await app.evaluate(({ dialog: fileDialog }, filePath) => {
      fileDialog.showSaveDialog = async () => ({ canceled: false, filePath });
    }, exportPath);
    await window.getByRole('button', { name: 'Export', exact: true }).click();
    await expect(window.getByText('Exported the current workflow.')).toBeVisible();
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
    await window.getByRole('button', { name: 'Export', exact: true }).click();
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
    expect(new Set(toolCalls.map((call) => call.tool))).toEqual(new Set(['studio_capabilities', 'models', 'studio_info', 'comfy_api', 'model_metadata']));
    for (const call of toolCalls) {
      expect(READ_TOOLS as readonly string[]).toContain(call.tool);
      expect(WRITE_TOOLS as readonly string[]).not.toContain(call.tool);
      expect(isReadOnlyCall(String(call.tool), call.args ?? {})).toBe(true);
    }
    expect(fake.calls.every((call) => call.authorized)).toBe(true);
    expect(fake.comfyHits).toEqual(['GET /system_stats', 'GET /object_info']);
    expect(containsMarker(userData, TOKEN)).toBeNull();
    expect(errors).toEqual([]);
  } finally {
    await app.close();
    await fake.close();
  }
});
