import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { pickOption } from './pickOption';
import { useEnglish } from './locale';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { artifact } from './artifacts';

/**
 * Chat ask flow on the scripted TEST transport (not a live model):
 * "explain this" saves an explanation with its provenance, the chat shows it as a card, the explanation is stored
 * in the project, and the conversation comes back after a restart. "propose a sampler" shows a ghost card that is
 * accepted only through the proposals store.
 */

async function launch(userData: string): Promise<{ app: ElectronApplication; window: Page }> {
  const app = await electron.launch({
    args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  await useEnglish(window);
  return { app, window };
}

test('explain this: provenance card, stored explanation, history after restart', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'electron-chat-explain-'));
  let { app, window } = await launch(userData);

  await pickOption(window, 'Choose the assistant', 'TEST mode');
  await window.getByText('TEST mode is on').first().waitFor();
  await window.getByRole('tab', { name: 'Assistant' }).click();

  // Empty chat offers quick prompts and the Ask/Build mode.
  await expect(window.getByRole('button', { name: 'What can I build with my models?' })).toBeVisible();
  await expect(window.getByRole('button', { name: 'Ask', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(window.getByRole('button', { name: 'Build', exact: true })).toHaveAttribute('aria-pressed', 'false');

  const input = window.locator('textarea[aria-label="Chat message"]');
  await input.fill('explain this');
  await input.press('Enter');

  const card = window.locator('[data-tool-name="explain"]');
  await expect(card).toHaveAttribute('data-tool-status', 'success', { timeout: 30000 });
  await expect(card).toHaveAttribute('data-tool-kind', 'knowledge');
  // The provenance is the saved one, and an inference is labelled as such.
  const badge = card.locator('[data-provenance="inference"]');
  await expect(badge).toHaveText('Guess');
  await expect(card.locator('[data-provenance="fact"]')).toHaveCount(0);
  await expect(card).toContainText('KSampler denoises a latent step by step');
  await expect(card).toContainText('Saved to KSampler');
  await expect(window.getByText('TEST fixture only: I saved a short explanation to KSampler.')).toBeVisible();
  await expect(input).toBeEnabled();

  // The explanation lives in the project, not only in the chat.
  const stored = await window.evaluate(async () => {
    const api = (window as unknown as { electronAPI: { listExplanations: (r: unknown) => Promise<Array<{ text: string; provenance: string; owner: { id: string } }>> } }).electronAPI;
    return api.listExplanations({ owner: { kind: 'nodeClass', id: 'KSampler', classType: 'KSampler' } });
  });
  expect(stored.some((item) => item.provenance === 'inference' && item.text.startsWith('KSampler denoises'))).toBe(true);

  // When the shell mounts the Explain panel, the focused explanation is listed there with its badge.
  const explainPanel = window.locator('.explain-panel');
  if (await explainPanel.count() > 0 && await explainPanel.first().isVisible()) {
    await expect(explainPanel.first()).toContainText('KSampler denoises a latent step by step');
    await expect(explainPanel.first().locator('[data-provenance="inference"]').first()).toBeVisible();
  }

  await window.screenshot({ path: artifact('chat-explain.png') });
  await app.close();

  // History comes back from SQLite on the next start, cards included.
  ({ app, window } = await launch(userData));
  await window.getByRole('tab', { name: 'Assistant' }).click();
  await expect(window.locator('.message-row')).toHaveCount(2, { timeout: 15000 });
  await expect(window.locator('.message-row').first()).toContainText('explain this');
  const restored = window.locator('[data-tool-name="explain"]');
  await expect(restored).toHaveAttribute('data-tool-status', 'success');
  await expect(restored.locator('[data-provenance="inference"]')).toHaveText('Guess');
  await app.close();
  fs.rmSync(userData, { recursive: true, force: true });
});

test('propose a sampler: ghost card resolves through the proposals store', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'electron-chat-propose-'));
  const { app, window } = await launch(userData);

  await pickOption(window, 'Choose the assistant', 'TEST mode');
  await window.getByText('TEST mode is on').first().waitFor();
  await window.getByRole('tab', { name: 'Assistant' }).click();
  const before = await window.locator('.react-flow__node').count();

  const input = window.locator('textarea[aria-label="Chat message"]');
  await input.fill('propose a sampler');
  await input.press('Enter');

  const card = window.locator('[data-tool-name="proposeNode"]').first();
  await expect(card).toHaveAttribute('data-tool-status', 'success', { timeout: 30000 });
  const proposal = card.locator('.proposal-card');
  await expect(proposal).toHaveAttribute('data-proposal-status', 'proposed');
  await expect(proposal).toContainText('The sampler turns noise into an image');
  await expect(window.getByText('TEST fixture only: I put a KSampler on the canvas as a ghost.')).toBeVisible();
  // A ghost is not in the graph until the person accepts it.
  expect(await window.locator('.react-flow__node').count()).toBe(before);

  await proposal.getByRole('button', { name: 'Reject the suggestion: Add a node' }).click();
  await expect(proposal).toHaveAttribute('data-proposal-status', 'rejected');
  await expect(proposal.getByRole('button', { name: /Accept the suggestion/ })).toHaveCount(0);
  expect(await window.locator('.react-flow__node').count()).toBe(before);

  // A second suggestion, accepted: the store resolves it and the node enters the graph.
  await input.fill('propose a sampler');
  await input.press('Enter');
  const second = window.locator('[data-tool-name="proposeNode"]').nth(1).locator('.proposal-card');
  await expect(second).toHaveAttribute('data-proposal-status', 'proposed', { timeout: 30000 });
  await second.getByRole('button', { name: 'Accept the suggestion: Add a node' }).click();
  await expect(second).toHaveAttribute('data-proposal-status', 'accepted');
  await expect(window.locator('.react-flow__node', { hasText: 'Sampler' })).toHaveCount(1);
  await expect(proposal).toHaveAttribute('data-proposal-status', 'rejected');

  await app.close();
  fs.rmSync(userData, { recursive: true, force: true });
});
