/** One rendered journey for inner groups, touch menus, drag, unpack, undo and native export. */
import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { useEnglish } from './locale';
import { OUTER_ID, nestedSubgraphWorkflow } from './fixtures/nestedSubgraphWorkflow';

test('inner groups and nested unpack work through the desktop and narrow-screen menus', async () => {
  const profile = mkdtempSync(join(tmpdir(), 'nodewise-inner-groups-'));
  const env = { ...process.env, NODE_ENV: 'production' } as Record<string, string>;
  delete env.DBUS_SESSION_BUS_ADDRESS; delete env.GNOME_KEYRING_CONTROL;
  const app = await electron.launch({ args: [join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${profile}`], env });
  try {
    const page = await app.firstWindow(); const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 1000 }); await useEnglish(page);
    await page.evaluate(async (workflow) => {
      const before = await window.electronAPI.readProjection('desktop');
      const result = await window.electronAPI.commitCommand({ projectId: 'desktop', actionId: 'import-nested', expectedRevisionId: before!.currentRevisionId, actor: 'manual', runId: null, payload: { type: 'import-workflow', document: workflow } });
      if (result.status !== 'applied') throw Error('Import refused');
    }, nestedSubgraphWorkflow);
    await page.reload(); await page.getByRole('button', { name: 'Open subgraph Prompt block', exact: true }).click();
    await expect(page.locator('[data-canvas-mode="definition"]')).toBeVisible();
    const encode = page.locator('.react-flow__node[data-id="1"]');
    await encode.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Make a group from selection', exact: false }).click();
    const title = page.locator('[data-group-title="1"]');
    await expect(title).toContainText('Group');
    await title.getByRole('button', { name: 'Canvas actions: Group', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Rename…', exact: true }).click();
    const field = page.getByRole('textbox', { name: 'Group title', exact: true });
    await field.fill('Nested prompts'); await field.press('Enter'); await expect(field).toHaveCount(0);
    await expect(title).toContainText('Nested prompts');
    const read = () => page.evaluate(async () => {
      const p = await window.electronAPI.readProjection('desktop');
      return { revision: p!.revSeq, snapshot: p!.snapshot };
    });
    const before = await read();
    const outerBefore = before.snapshot.subgraphs!.find((item) => item.id === OUTER_ID)!;
    const spot = await title.locator('span').boundingBox(); if (!spot) throw Error('No group title');
    await page.mouse.move(spot.x + 8, spot.y + spot.height / 2); await page.mouse.down();
    await page.mouse.move(spot.x + 68, spot.y + spot.height / 2 + 65, { steps: 10 }); await page.mouse.up();
    await expect.poll(async () => (await read()).revision).toBe(before.revision + 1);
    const moved = await read();
    expect(moved.snapshot.subgraphs!.find((item) => item.id === OUTER_ID)!.nodes[0].position).not.toEqual(outerBefore.nodes[0].position);
    expect(moved.snapshot.nodes).toEqual(before.snapshot.nodes);
    expect(moved.snapshot.groups).toEqual(before.snapshot.groups);
    await page.screenshot({ path: 'test-results/nested-groups-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    const back = page.getByRole('button', { name: /Back to canvas/ }); if (await back.isVisible()) await back.click();
    await page.getByRole('button', { name: 'Fit to view', exact: true }).click();
    const menu = title.getByRole('button', { name: 'Canvas actions: Nested prompts', exact: true });
    await expect(menu).toBeVisible();
    const navigation = await page.getByRole('navigation', { name: 'Subgraph path', exact: true }).boundingBox();
    const touchTools = await page.getByRole('toolbar', { name: 'Touch graph actions', exact: true }).boundingBox();
    expect(navigation!.y).toBeGreaterThan(touchTools!.y + touchTools!.height);
    await menu.click(); await expect(page.getByRole('menuitem', { name: 'Remove group', exact: true })).toBeVisible();
    const popup = page.getByRole('menu', { name: 'Canvas actions', exact: true });
    await expect(popup).toHaveCSS('opacity', '1');
    const bounds = await popup.boundingBox(); expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
    await page.screenshot({ path: 'test-results/nested-groups-mobile.png' });
    await page.keyboard.press('Escape');
    await encode.getByRole('button', { name: 'Node menu: Encode', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Dissolve subgraph', exact: true }).click();
    await expect(encode).toContainText('CLIPTextEncode');
    const result = await read(); const outer = result.snapshot.subgraphs!.find((item) => item.id === OUTER_ID)!;
    expect(outer.groups![0].title).toBe('Nested prompts');
    expect(outer.edges.some((edge) => edge.source === '-10' && edge.target === '1')).toBe(true);
    expect(result.snapshot.nodes).toEqual(before.snapshot.nodes);
    const exported = await page.evaluate(() => window.electronAPI.exportWorkflowDocument());
    expect(exported.ok).toBe(true);
    if (exported.ok) {
      const file = exported.workflow as Record<string, any>;
      expect(file.definitions.subgraphs.find((item: { id: string }) => item.id === OUTER_ID).groups[0].title).toBe('Nested prompts');
    }
    await page.keyboard.press('Control+z');
    await expect(encode).toContainText('Encode'); await expect(encode).not.toContainText('CLIPTextEncode');
    expect(errors).toEqual([]);
  } finally { await app.close(); rmSync(profile, { recursive: true, force: true }); }
});
