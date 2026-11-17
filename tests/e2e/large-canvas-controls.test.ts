/** Large graphs keep every finding and value accessible while off-screen cards are unmounted. */
import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { useEnglish } from './locale';
import { startFakeMcp } from '../fixtures/mcp/fakeMcpServer';

test('large graph findings navigate to editable cards and camera movement preserves a typed value', async () => {
  const profile = mkdtempSync(join(tmpdir(), 'nodewise-large-canvas-'));
  const fake = await startFakeMcp();
  const env = { ...process.env, NODE_ENV: 'production' } as Record<string, string>;
  delete env.DBUS_SESSION_BUS_ADDRESS; delete env.GNOME_KEYRING_CONTROL;
  const app = await electron.launch({ args: [join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${profile}`], env });
  try {
    const page = await app.firstWindow(); const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width: 1600, height: 1100 }); await useEnglish(page);
    await page.evaluate(async url => {
      const read = await window.electronAPI.getSettings(); if (read.source === 'corrupt') throw Error('Unreadable settings');
      await window.electronAPI.saveSettings({ ...read.values, mcpUrl: url, mcpAuth: 'none' });
      await window.electronAPI.syncNow();
      const projection = await window.electronAPI.readProjection('desktop');
      if (!projection) throw Error('Missing project');
      const result = await window.electronAPI.commitCommand({ projectId: 'desktop', actionId: 'large-canvas-import', actor: 'manual', runId: null,
        expectedRevisionId: projection.currentRevisionId, payload: { type: 'import-workflow', document: {
          version: 0.4, last_node_id: 251, last_link_id: 0, links: [], groups: [], config: {}, extra: {},
          nodes: Array.from({ length: 251 }, (_, index) => ({ id: index + 1, type: 'KSampler', title: `Sampler ${index + 1}`,
            pos: [(index % 20) * 360, Math.floor(index / 20) * 420], size: [300, 350], flags: {}, order: index, mode: 0,
            inputs: [], outputs: [{ name: 'LATENT', type: 'LATENT', links: null }], properties: {},
            widgets_values: [1, 'fixed', 20, 7.5, 'euler', 'normal', 1] })),
        } } });
      if (result.status !== 'applied') throw Error('Import refused');
    }, fake.url);
    await page.reload(); await page.locator('.app-shell').waitFor();
    await page.keyboard.press('Control+Shift+c');
    const panel = page.locator('.check-panel');
    const group = panel.locator('[data-check-group="unconnectedRequiredInputs"]');
    await expect(group.locator('li')).toHaveCount(50);
    await expect(group.getByRole('status')).toContainText('1-50 of 1004');
    await group.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(group.getByRole('status')).toContainText('51-100 of 1004');
    await expect(group.locator('li')).toHaveCount(50);
    const search = panel.getByRole('searchbox', { name: 'Find a node or a problem' });
    await search.fill('Sampler 251');
    await expect(group.locator('li')).toHaveCount(4);
    const show = group.getByRole('button', { name: /Input model .*Show/ });
    await show.focus(); await page.keyboard.press('Enter');
    const card = page.locator('.react-flow__node[data-id="251"]');
    const steps = card.getByRole('spinbutton', { name: 'steps', exact: true });
    await expect(steps).toHaveValue('20');
    await expect.poll(() => page.locator('.react-flow__node').count()).toBeLessThan(100);
    await steps.fill('33');
    // Wheel changes the camera without clicking another control. The pending edit must commit before culling.
    const canvas = await page.locator('.react-flow').boundingBox(); if (!canvas) throw Error('Missing canvas');
    await page.mouse.move(canvas.x + 70, canvas.y + canvas.height - 80);
    await page.mouse.wheel(0, 300);
    const value = () => page.evaluate(async () => {
      const result = await window.electronAPI.exportWorkflowDocument();
      if (!result.ok) throw Error('Export refused');
      const graph = result.workflow as { nodes: { id: number; widgets_values: unknown[] }[] };
      return graph.nodes.find(node => node.id === 251)?.widgets_values[2];
    });
    await expect.poll(value).toBe(33);
    await page.keyboard.press('Control+z'); await expect.poll(value).toBe(20);
    await page.keyboard.press('Control+Shift+z'); await expect.poll(value).toBe(33);
    const exported = await page.evaluate(() => window.electronAPI.exportWorkflowDocument());
    expect(exported.ok).toBe(true); if (!exported.ok) throw Error('Export refused');
    const document = exported.workflow as { nodes: { id: number; widgets_values: unknown[] }[] };
    expect(document.nodes).toHaveLength(251);
    expect(document.nodes.find(node => node.id === 251)?.widgets_values).toEqual([1, 'fixed', 33, 7.5, 'euler', 'normal', 1]);
    expect(document.nodes.filter(node => node.id !== 251).every(node => node.widgets_values[2] === 20)).toBe(true);
    await page.reload(); await page.locator('.app-shell').waitFor();
    await expect.poll(value).toBe(33);
    expect(errors).toEqual([]);
  } finally { await app.close(); await fake.close(); rmSync(profile, { recursive: true, force: true }); }
});
