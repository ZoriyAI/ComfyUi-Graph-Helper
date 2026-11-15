/** Regression: real positional ComfyUI settings remain visible/editable before sync and gain names after it. */
import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { useEnglish } from './locale';
import { startFakeMcp } from '../fixtures/mcp/fakeMcpServer';

const values = [123456, 'fixed', 31, 5.5, 'dpmpp_2m', 'karras', 0.75];
const workflow = {
  version: 0.4, last_node_id: 3, last_link_id: 1,
  nodes: [
    { id: 1, type: 'KSampler', pos: [500, 40], size: [300, 360], flags: {}, order: 1, mode: 0, properties: {},
      widgets_values: values, inputs: [{ name: 'positive', type: 'CONDITIONING', link: 1 }], outputs: [{ name: 'LATENT', type: 'LATENT', links: null }] },
    { id: 2, type: 'CLIPTextEncode', pos: [80, 40], size: [300, 220], flags: {}, order: 0, mode: 0, properties: {},
      widgets_values: ['foggy forest\nblue hour'], outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING', links: [1] }] },
    { id: 3, type: 'UnknownCustomNode', pos: [900, 40], size: [250, 220], flags: {}, order: 2, mode: 0, properties: { vendor: 'preserve' }, widgets_values: ['custom-mode', false, 0, { ownState: true }] },
  ], links: [[1, 2, 0, 1, 0, 'CONDITIONING']], groups: [], config: {}, extra: {},
};

test('imported settings survive offline editing, catalog refresh and ComfyUI export with their links', async () => {
  const profile = mkdtempSync(join(tmpdir(), 'nodewise-import-settings-'));
  const source = join(profile, 'comfy-workflow.json'); writeFileSync(source, JSON.stringify(workflow));
  const fake = await startFakeMcp();
  const env = { ...process.env, NODE_ENV: 'production' } as Record<string, string>;
  delete env.DBUS_SESSION_BUS_ADDRESS; delete env.GNOME_KEYRING_CONTROL;
  const app = await electron.launch({ args: [join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${profile}`], env });
  try {
    const page = await app.firstWindow(); const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width: 1600, height: 1000 }); await useEnglish(page);
    await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, source);
    await page.getByRole('button', { name: 'Open workflow…', exact: true }).click();
    const sampler = page.locator('.react-flow__node[data-id="1"]');
    const text = page.locator('.react-flow__node[data-id="2"]');
    const custom = page.locator('.react-flow__node[data-id="3"]');
    await expect(sampler.locator('.node-field')).toHaveCount(7);
    await expect(sampler.getByRole('spinbutton', { name: 'Saved value 3', exact: true })).toHaveValue('31');
    await expect(text.getByRole('textbox', { name: 'Saved value 1', exact: true })).toHaveValue('foggy forest\nblue hour');
    await expect(custom.getByRole('spinbutton', { name: 'Saved value 3', exact: true })).toHaveValue('0');
    await expect(custom.locator('[data-service-data="true"]')).toHaveCount(1);
    await sampler.locator('.graph-node-title').click();
    await page.getByRole('tab', { name: 'Properties', exact: true }).click();
    const inspector = page.getByRole('region', { name: 'Properties', exact: true });
    const steps = inspector.getByRole('spinbutton', { name: 'Saved value 3', exact: true });
    await expect(steps).toHaveValue('31'); await steps.fill('37'); await steps.press('Enter');
    await expect(sampler.getByRole('spinbutton', { name: 'Saved value 3', exact: true })).toHaveValue('37');
    await page.evaluate(async (url) => {
      const settings = await window.electronAPI.getSettings(); if (settings.source === 'corrupt') throw Error('Unreadable settings');
      await window.electronAPI.saveSettings({ ...settings.values, mcpUrl: url, mcpAuth: 'none' });
      const status = await window.electronAPI.syncNow(); if (status.state === 'error') throw Error(status.lastError ?? 'Sync failed');
    }, fake.url);
    await expect(sampler.getByRole('spinbutton', { name: 'steps', exact: true })).toHaveValue('37');
    await expect(sampler.getByRole('combobox', { name: 'sampler_name', exact: true })).toHaveAttribute('data-value', 'dpmpp_2m');
    await expect(text.getByRole('textbox', { name: 'text', exact: true })).toHaveValue('foggy forest\nblue hour');
    await expect(custom.getByRole('textbox', { name: 'Saved value 1', exact: true })).toHaveValue('custom-mode');
    const namedSteps = inspector.getByRole('spinbutton', { name: 'steps', exact: true });
    await namedSteps.fill('39'); await namedSteps.press('Enter');
    await expect(sampler.getByRole('spinbutton', { name: 'steps', exact: true })).toHaveValue('39');
    const exported = await page.evaluate(() => window.electronAPI.exportWorkflowDocument());
    expect(exported.ok).toBe(true);
    if (!exported.ok) throw Error('Export refused');
    const document = exported.workflow as typeof workflow;
    expect(document.nodes.map((node) => node.widgets_values)).toEqual([[123456, 'fixed', 39, 5.5, 'dpmpp_2m', 'karras', 0.75], workflow.nodes[1].widgets_values, workflow.nodes[2].widgets_values]);
    expect(document.links).toEqual(workflow.links);
    expect(document.nodes[2].properties).toEqual(workflow.nodes[2].properties);
    await page.screenshot({ path: 'test-results/import-settings.png' });
    expect(errors).toEqual([]);
  } finally { await app.close(); await fake.close(); rmSync(profile, { recursive: true, force: true }); }
});
