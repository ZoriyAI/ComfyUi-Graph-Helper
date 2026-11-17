/** Real SQLite cleanup from the UI in a disposable profile; owner history is never opened. */
import { test, expect } from '@playwright/test';
import { launchApp, temporaryProfile, removeProfile, type LaunchedApp } from './support/app';
import { DESKTOP_PROJECT_ID } from '../../src/shared/project';

test('history shows measured usage, reviews cleanup, preserves the head and remains trimmed after restart', async () => {
  const profile = temporaryProfile('nodewise-history-'); let current: LaunchedApp | undefined;
  try {
    current = await launchApp({ userData: profile, english: true, viewport: { width: 1440, height: 1000 } });
    const page = current.page;
    const finalHead = await page.evaluate(async projectId => {
      let head = (await window.electronAPI.readProjection(projectId))!.currentRevisionId;
      for (let i = 2; i <= 240; i++) {
        const result = await window.electronAPI.commitCommand({ projectId, runId: null, actionId: `history-${i}`, actor: 'manual', expectedRevisionId: head,
          payload: i === 2 ? { type: 'add-node', nodeType: 'Note', x: 0, y: 0 } : { type: 'move-node', nodeId: '1', x: i, y: 0 } });
        if (result.status !== 'applied' || !result.projection) throw Error('History fixture command failed');
        head = result.projection.currentRevisionId;
      }
      return head;
    }, DESKTOP_PROJECT_ID);
    await page.reload();
    await page.locator('.document-bar').getByRole('menuitem', { name: 'File', exact: true }).click();
    await page.getByRole('menu').getByRole('menuitem', { name: 'Settings…' }).click();
    await page.getByRole('tablist', { name: 'Settings sections' }).getByRole('tab', { name: 'Privacy', exact: true }).click();
    const section = page.locator('[data-history-storage]');
    await expect(section).toContainText('240 saved versions');
    await section.getByRole('button', { name: 'Review old-version cleanup' }).click();
    let dialog = page.getByRole('dialog', { name: 'Remove old graph versions?' });
    await expect(dialog).toContainText('Remove 40 old versions');
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect((await page.evaluate(p => window.electronAPI.historyUsage(p), DESKTOP_PROJECT_ID)).revisions).toBe(240);
    await section.getByRole('button', { name: 'Review old-version cleanup' }).click();
    dialog = page.getByRole('dialog', { name: 'Remove old graph versions?' });
    await dialog.getByRole('button', { name: 'Remove old versions', exact: true }).click();
    await expect(section).toContainText('200 saved versions');
    await expect(section).toContainText('Removed 40 old versions');
    await expect(section.getByRole('button', { name: 'Review old-version cleanup' })).toBeDisabled();
    expect(current.pageErrors).toEqual([]);
    await current.close(); current = await launchApp({ userData: profile, english: true });
    const restored = await current.page.evaluate(async p => ({ usage: await window.electronAPI.historyUsage(p), graph: await window.electronAPI.readProjection(p) }), DESKTOP_PROJECT_ID);
    expect(restored.usage.revisions).toBe(200); expect(restored.graph?.currentRevisionId).toBe(finalHead);
    expect(current.pageErrors).toEqual([]);
  } finally { await current?.close(); removeProfile(profile); }
});
