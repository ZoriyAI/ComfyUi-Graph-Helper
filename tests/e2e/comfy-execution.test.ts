/** Isolated fixture server and profile: exercise the real IPC/UI, never a user's ComfyUI or model. */
import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { launchApp } from './support/app';

test('waiting diagnosis preserves prompt identity and never submits or unloads a job', async () => {
  let stage: 'pending' | 'running' | 'completed' | 'unknown' = 'pending';
  let broken = false;
  const requests: string[] = [];
  const server = createServer((req, res) => {
    requests.push(`${req.method} ${req.url}`);
    if (req.method !== 'GET') { res.writeHead(405).end(); return; }
    const replies: Record<string, unknown> = {
      '/queue': broken ? {} : { queue_pending: stage === 'pending' ? [[0, 'fixture-prompt-1', {}]] : [], queue_running: stage === 'running' ? [[0, 'fixture-prompt-1', {}]] : [] },
      '/reference_studio/ollama/status': { installed: true, state: stage === 'pending' ? 'waiting_resource' : 'idle', prompt_id: 'fixture-prompt-1',
        reason: 'Connection refused', reason_code: 'NATIVE_RESOURCE_AUTHORITY_WAIT', checked_at_ms: Date.now(),
        budgets: { vram_available_bytes: 30 * 1024 ** 3, vram_required_bytes: 24 * 1024 ** 3, ram_floor_bytes: 8 * 1024 ** 3 } },
      '/system_stats': { system: { ram_total: 64 * 1024 ** 3, ram_free: 40 * 1024 ** 3 }, devices: [{ name: 'Fixture GPU', type: 'cuda', vram_total: 32 * 1024 ** 3, vram_free: 30 * 1024 ** 3 }] },
      '/history/fixture-prompt-1': stage === 'completed' ? { 'fixture-prompt-1': { status: { status_str: 'success', completed: true, messages: [] } } } : {},
      '/api/ps': { models: broken ? [null] : [] },
    };
    res.writeHead(Object.hasOwn(replies, req.url ?? '') ? 200 : 404, { 'Content-Type': 'application/json' }).end(JSON.stringify(replies[req.url ?? ''] ?? {}));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const app = await launchApp({ prefix: 'execution-diagnosis-', english: true, env: { DBUS_SESSION_BUS_ADDRESS: undefined, GNOME_KEYRING_CONTROL: undefined }, viewport: { width: 1100, height: 850 } });
  try {
    await app.page.evaluate(async baseURL => {
      const read = await window.electronAPI.getSettings();
      if (!('values' in read) || !read.values) throw Error('Settings unavailable');
      const result = await window.electronAPI.saveSettings({ ...read.values, comfyOrigin: baseURL, provider: 'local', model: 'fixture-model', baseURL: `${baseURL}/v1` });
      if (!result.ok) throw Error('Fixture settings rejected');
    }, origin);
    await app.page.locator('.document-bar').getByRole('menuitem', { name: 'Help', exact: true }).click();
    await app.page.getByRole('menuitem', { name: 'Explain a ComfyUI error…', exact: true }).click();
    const panel = app.page.getByRole('region', { name: 'Why is my generation waiting?' });
    await panel.getByLabel('Prompt ID (optional)', { exact: true }).fill('fixture-prompt-1');
    await panel.getByRole('button', { name: 'Check ComfyUI', exact: true }).click();
    await expect(panel.locator('[data-execution-stage="pending"]')).toBeVisible();
    await expect(panel).toContainText('This is not evidence of low VRAM');
    await expect(panel).toContainText('30.00 GiB');
    await expect(panel).toContainText('24.00 GiB');
    await expect(panel).toContainText('The server reports no loaded models.');
    for (const next of ['running', 'completed', 'unknown'] as const) {
      stage = next;
      await panel.getByRole('button', { name: 'Refresh the observation', exact: true }).click();
      await expect(panel.locator(`[data-execution-stage="${next}"]`)).toBeVisible();
    }
    broken = true;
    await panel.getByRole('button', { name: 'Refresh the observation', exact: true }).click();
    await expect(panel.locator('[data-execution-stage="unavailable"]')).toBeVisible();
    await expect(panel).toContainText('This does not mean memory is free');
    await panel.getByText('Technical details and measured budgets', { exact: true }).click();
    const report = JSON.parse((await panel.locator('pre').textContent())!);
    expect(report.promptId).toBe('fixture-prompt-1');
    expect(report.changes).toMatchObject({ submittedPrompts: 0, workflow: false, model: false, resourceSettings: false });
    expect(requests.every(request => request.startsWith('GET '))).toBe(true);
    expect(requests.some(request => /\/prompt(?:$|\?)|\/generate|\/interrupt|\/free/.test(request))).toBe(false);
    await app.page.setViewportSize({ width: 390, height: 844 });
    expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    expect(app.pageErrors).toEqual([]);
  } finally {
    await app.close();
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
