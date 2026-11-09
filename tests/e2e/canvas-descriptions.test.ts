import { test, expect, _electron as electron } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { denseWorkflow } from './fixtures/denseWorkflow';
import { useEnglish } from './locale';
import { pickOption } from './pickOption';

/**
 * Description blocks on the canvas: an `explain` result shows up as a card under the node at once, with the
 * provenance badge; the toolbar turns all cards off and on; a card edited in place saves a "user" explanation.
 */
test('description cards: explain result on the canvas, toggle, edit in place', async () => {
  const errors: string[] = [];
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'canvas-descriptions-'));
  const app = await electron.launch({
    args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  const window = await app.firstWindow();
  window.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  window.on('pageerror', (error) => errors.push(error instanceof Error ? error.message : String(error)));
  await window.setViewportSize({ width: 1440, height: 900 });
  await useEnglish(window);
  const api = (name: string, args: unknown[]) => window.evaluate(async ({ name, args }) => {
    const bridge = (window as unknown as { electronAPI: Record<string, (...input: unknown[]) => Promise<unknown>> }).electronAPI;
    return bridge[name](...args);
  }, { name, args });
  const current = await api('readProjection', ['desktop']) as { currentRevisionId: string };
  const imported = await api('commitCommand', [{
    projectId: 'desktop', actionId: 'canvas-descriptions', expectedRevisionId: current.currentRevisionId, actor: 'manual', runId: null,
    payload: { type: 'import-workflow', document: denseWorkflow },
  }]) as { status: string };
  expect(imported.status).toBe('applied');
  await window.reload();
  await expect(window.locator('.react-flow__node')).toHaveCount(12);

  // Nothing is explained yet and the catalog is empty: no cards.
  const cards = window.locator('.description-card');
  await expect(cards).toHaveCount(0);

  // The TEST fixture saves an inference about the KSampler class; the card appears under each KSampler at once.
  await pickOption(window, 'Chat provider', 'TEST fixture');
  await window.getByText('TEST fixture is on').waitFor();
  await window.getByRole('tab', { name: 'Assistant' }).click();
  const input = window.locator('textarea[aria-label="Chat message"]');
  await input.fill('explain this');
  await input.press('Enter');
  await expect(window.locator('[data-tool-name="explain"]')).toHaveAttribute('data-tool-status', 'success', { timeout: 30000 });
  const card = window.getByRole('region', { name: 'Description of Sample', exact: true });
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('data-description-scope', 'nodeClass');
  await expect(card.locator('[data-provenance="inference"]')).toHaveText('Inference');
  await expect(card).toContainText('KSampler denoises a latent step by step');
  await expect(cards).toHaveCount(2);

  // The toolbar switch turns every card off and back on.
  const toggle = window.getByRole('button', { name: 'Descriptions on the canvas' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(cards).toHaveCount(0);
  await toggle.click();
  await expect(cards).toHaveCount(2);

  // One card can be closed; the dot on the node brings it back.
  await card.getByRole('button', { name: 'Hide the description: Sample' }).click();
  await expect(card).toHaveCount(0);
  await window.getByRole('button', { name: 'Show the description: Sample' }).click();
  await expect(card).toBeVisible();

  // Expand, edit in place, save: the node gets its own "user" explanation and the card shows it.
  await card.locator('button[aria-expanded]').click();
  await expect(card).toHaveAttribute('data-expanded', 'true');
  await card.getByRole('button', { name: 'Edit the description' }).click();
  const field = card.getByRole('textbox', { name: 'Description text' });
  await expect(field).toHaveValue('KSampler denoises a latent step by step, guided by the model and the conditioning.');
  await field.fill('Turns the noisy latent into the picture for prompt A.');
  await card.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(card).toHaveAttribute('data-description-scope', 'node');
  await expect(card.locator('[data-provenance="user"]').first()).toBeVisible();
  await expect(card).toContainText('Turns the noisy latent into the picture for prompt A.');
  const stored = await api('listExplanations', [{ projectId: 'desktop', owner: { kind: 'node', id: '4', classType: 'KSampler' } }]) as Array<{ text: string; provenance: string; aspect: string; createdBy: string }>;
  expect(stored.some((item) => item.provenance === 'user' && item.createdBy === 'user' && item.aspect === 'what' && item.text.startsWith('Turns the noisy latent'))).toBe(true);
  // The other KSampler still shows the class explanation.
  await expect(window.getByRole('region', { name: 'Description of Sample B', exact: true })).toHaveAttribute('data-description-scope', 'nodeClass');

  expect(errors).toEqual([]);
  await app.close();
  fs.rmSync(userData, { recursive: true, force: true });
});
