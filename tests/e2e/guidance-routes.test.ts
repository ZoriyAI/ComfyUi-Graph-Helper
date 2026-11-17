/** All routes render their concrete steps and result checks; nested targets retain the agent's context. */
import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GUIDE_PROBLEMS } from '../../src/shared/guidance/catalog';
import { guidanceEn } from '../../src/shared/i18n/guidance';
import { nestedSubgraphWorkflow } from './fixtures/nestedSubgraphWorkflow';
import { useEnglish } from './locale';
import { startFakeMcp } from '../fixtures/mcp/fakeMcpServer';

test('all fifty guides provide steps and honest result checks, including inner-node handoff', async () => {
  test.setTimeout(150000);
  const profile = mkdtempSync(join(tmpdir(), 'nodewise-guides-'));
  const fake = await startFakeMcp();
  const env = { ...process.env, NODE_ENV: 'production' } as Record<string, string>;
  delete env.DBUS_SESSION_BUS_ADDRESS; delete env.GNOME_KEYRING_CONTROL;
  const app = await electron.launch({ args: [join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${profile}`, ...(process.platform === 'linux' ? ['--ozone-platform=x11'] : [])], env });
  try {
    const page = await app.firstWindow(); const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message)); await useEnglish(page);
    const open = () => page.getByRole('toolbar', { name: 'Canvas tools' }).getByRole('button', { name: 'Solve a problem', exact: true }).click();
    await open(); const guide = page.getByRole('dialog', { name: guidanceEn.title });
    for (const p of GUIDE_PROBLEMS) {
      await guide.getByRole('searchbox').fill(p.title.en);
      await guide.getByRole('button', { name: p.title.en, exact: false }).click();
      await expect(guide.getByText(p.why.en, { exact: true })).toBeVisible();
      await guide.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(guide.getByText(p.prepare.en, { exact: true })).toBeVisible();
      await expect(guide.getByRole('button', { name: guidanceEn.actions[p.action], exact: true }).first()).toBeEnabled();
      await expect(guide.getByRole('button', { name: guidanceEn.actions[p.followUp], exact: true }).last()).toBeEnabled();
      await guide.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(guide.getByText(p.expected.en, { exact: true })).toBeVisible();
      await guide.getByRole('button', { name: guidanceEn.verifyResult }).click();
      await expect(guide.getByRole('status')).toContainText(p.verify.kind === 'observed' ? 'practical trial' : 'not enough current data');
      await expect(guide.getByRole('button', { name: guidanceEn.solved })).toBeDisabled();
      await guide.getByRole('button', { name: 'All situations', exact: true }).click();
    }
    await guide.getByRole('button', { name: 'Close guide' }).click();
    await page.evaluate(async url => {
      const settings = await window.electronAPI.getSettings();
      if (settings.source === 'corrupt') throw Error('Settings unavailable');
      await window.electronAPI.saveSettings({ ...settings.values, mcpUrl: url, mcpAuth: 'none' });
      await window.electronAPI.syncNow();
    }, fake.url);
    await page.evaluate(async workflow => {
      const head = await window.electronAPI.readProjection('desktop');
      if (!head) throw Error('Project is unavailable');
      const result = await window.electronAPI.commitCommand({ projectId: 'desktop', actionId: 'guide-nested', actor: 'manual', runId: null,
        expectedRevisionId: head.currentRevisionId, payload: { type: 'import-workflow', document: workflow } });
      if (result.status !== 'applied') throw Error('Import refused');
    }, nestedSubgraphWorkflow);
    await page.reload(); await page.locator('.app-shell').waitFor(); await open();
    const p = GUIDE_PROBLEMS.find(p => p.id === 'p10')!;
    await guide.getByRole('searchbox').fill(p.title.en);
    await guide.getByRole('button', { name: p.title.en, exact: false }).click();
    await guide.getByRole('button', { name: 'Next', exact: true }).click();
    await guide.getByRole('button', { name: /CLIPTextEncode #1.*inside a subgraph/ }).click();
    await expect(guide).toHaveCount(0);
    const node = page.locator('.react-flow__node[data-id="1"]');
    await expect(node).toHaveClass(/selected/);
    await expect(node.locator('textarea')).toHaveValue('a cat');
    await page.getByRole('button', { name: 'Continue the steps', exact: true }).click();
    await expect(guide.getByRole('button', { name: guidanceEn.actions.templates })).toBeEnabled();
    await expect(guide.getByText(guidanceEn.stale, { exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally { await app.close(); await fake.close(); rmSync(profile, { recursive: true, force: true }); }
});
