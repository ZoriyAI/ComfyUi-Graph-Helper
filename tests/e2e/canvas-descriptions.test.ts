import { test, expect, _electron as electron } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { denseWorkflow } from './fixtures/denseWorkflow';
import { useEnglish } from './locale';
import { pickOption } from './pickOption';

/**
 * Description blocks on the canvas. Own-notes mode (the default): built-in class knowledge waits behind a dot and
 * opens on hover or selection; an explanation owned by the node shows as a card at once, with its provenance badge;
 * the toolbar cycles own → all → off; a card edited in place saves a "user" explanation.
 */
test('description cards: dots for class knowledge, hover, node explanation, mode cycle, edit in place', async () => {
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

  const cards = window.locator('.description-card');
  const dots = window.locator('[data-knowledge-dot]');
  const toggle = window.getByRole('button', { name: 'Descriptions on the canvas' });
  const sampleNode = window.locator('.react-flow__node[data-id="4"]');
  const away = async () => window.mouse.move(700, 880);

  // Nothing is explained yet and the catalog is empty, but every node here is a core class with built-in knowledge.
  // The default mode (own notes only) keeps that class knowledge behind a dot on each node: no card covers the graph.
  await expect(toggle).toHaveAttribute('data-descriptions-mode', 'own');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(toggle).toHaveAttribute('title', 'Descriptions: own notes only. Click for all nodes');
  await expect(dots).toHaveCount(12);
  await expect(cards).toHaveCount(0);
  await expect(window.getByRole('button', { name: 'Read the description: Sample', exact: true })).toBeVisible();

  // Hovering a node for a moment shows its (collapsed) card; moving away closes it again.
  await sampleNode.hover();
  const card = window.getByRole('region', { name: 'Description of Sample', exact: true });
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('data-on-demand', 'hover');
  await expect(card).toHaveAttribute('data-expanded', 'false');
  await expect(card).toHaveAttribute('data-description-scope', 'nodeClass');
  await expect(card.locator('[data-provenance="fact"]').first()).toHaveText('Fact');
  await expect(card).toContainText('The main sampler');
  await expect(cards).toHaveCount(1);
  await away();
  await expect(cards).toHaveCount(0);
  await expect(dots).toHaveCount(12);

  // The TEST fixture saves an inference about the KSampler class: class knowledge, so still behind the dots,
  // and the next hover shows it with its "Inference" badge.
  await pickOption(window, 'Chat provider', 'TEST fixture');
  await window.getByText('TEST fixture is on').waitFor();
  await window.getByRole('tab', { name: 'Assistant' }).click();
  const input = window.locator('textarea[aria-label="Chat message"]');
  await input.fill('explain this');
  await input.press('Enter');
  await expect(window.locator('[data-tool-name="explain"]')).toHaveAttribute('data-tool-status', 'success', { timeout: 30000 });
  await expect(cards).toHaveCount(0);
  await sampleNode.hover();
  await expect(card).toBeVisible();
  await expect(card.locator('[data-provenance="inference"]').first()).toHaveText('Inference');
  await expect(card).toContainText('KSampler denoises a latent step by step');
  await away();
  await expect(cards).toHaveCount(0);

  // An AI explanation owned by this one node is its own note: its card shows without hover, the others stay dots.
  await input.fill('explain node 4 (KSampler)');
  await input.press('Enter');
  await expect(window.locator('[data-tool-name="explain"]')).toHaveCount(2, { timeout: 30000 });
  await expect(window.locator('[data-tool-name="explain"]').last()).toHaveAttribute('data-tool-status', 'success', { timeout: 30000 });
  await away();
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('data-description-scope', 'node');
  await expect(card).not.toHaveAttribute('data-on-demand', /.+/);
  await expect(card.locator('[data-provenance="inference"]').first()).toHaveText('Inference');
  await expect(card).toContainText('This sampler renders prompt A');
  await expect(cards).toHaveCount(1);
  await expect(dots).toHaveCount(11);

  // The toolbar button cycles own → all → off → own; all shows the class cards too (where they fit), off only dots.
  await toggle.click();
  await expect(toggle).toHaveAttribute('data-descriptions-mode', 'all');
  await expect(toggle).toHaveAttribute('title', 'Descriptions: all nodes. Click to turn off');
  await expect.poll(async () => cards.count()).toBeGreaterThan(1);
  await toggle.click();
  await expect(toggle).toHaveAttribute('data-descriptions-mode', 'off');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(cards).toHaveCount(0);
  await expect(dots).toHaveCount(12);
  await toggle.click();
  await expect(toggle).toHaveAttribute('data-descriptions-mode', 'own');
  await expect(card).toBeVisible();
  await expect(cards).toHaveCount(1);
  // The View menu offers the same three modes as a radio group.
  await window.getByRole('menubar').getByRole('menuitem', { name: 'View', exact: true }).click();
  await window.getByRole('menu').getByRole('menuitem', { name: 'Node descriptions' }).click();
  await expect(window.getByRole('menuitemradio', { name: 'Own notes only' })).toHaveAttribute('aria-checked', 'true');
  await window.keyboard.press('Escape');
  await window.keyboard.press('Escape');
  await expect(window.getByRole('menu')).toHaveCount(0);

  // One card can be closed; the dot on the node brings it back.
  await card.getByRole('button', { name: 'Hide the description: Sample' }).click();
  await expect(card).toHaveCount(0);
  await window.getByRole('button', { name: 'Show the description: Sample' }).click();
  await expect(card).toBeVisible();

  // Selecting a node shows its card above the others. On this dense layout the expanded card has no free room,
  // so selection keeps it to one line instead of covering a neighbour; the chevron still expands it on purpose.
  await window.getByRole('button', { name: 'Read the description: Decode', exact: true }).waitFor();
  await window.locator('.react-flow__node[data-id="5"]').click();
  const decode = window.getByRole('region', { name: 'Description of Decode', exact: true });
  await expect(decode).toHaveAttribute('data-on-demand', 'selected');
  await expect(decode).toHaveAttribute('data-raised', 'true');
  await expect(decode).toHaveAttribute('data-expanded', 'false');
  await decode.locator('button[aria-expanded]').click();
  await expect(decode).toHaveAttribute('data-expanded', 'true');
  // Escape collapses every card (React Flow also lets go of the selection).
  await card.locator('button[aria-expanded]').click();
  await expect(card).toHaveAttribute('data-expanded', 'true');
  await expect(window.locator('.description-card[data-expanded="true"]')).toHaveCount(2);
  await window.locator('.react-flow__node[data-id="5"]').focus();
  await window.keyboard.press('Escape');
  await expect(window.locator('.description-card[data-expanded="true"]')).toHaveCount(0);
  await expect(card).toHaveAttribute('data-expanded', 'false');
  await window.locator('.react-flow__pane').click({ position: { x: 20, y: 400 } });
  await away();
  await expect(decode).toHaveCount(0);

  // Expand, edit in place, save: the node gets its own "user" explanation and the card shows it.
  await card.locator('button[aria-expanded]').click();
  await expect(card).toHaveAttribute('data-expanded', 'true');
  // Keyboard, so the click cannot land on whatever sits under the pointer.
  await card.getByRole('button', { name: 'Edit the description' }).focus();
  await window.keyboard.press('Enter');
  const field = card.getByRole('textbox', { name: 'Description text' });
  // The node's own explanation is a "why"; the "what" starts from what the card says for it (nothing yet).
  await expect(field).toHaveValue('');
  await field.fill('Turns the noisy latent into the picture for prompt A.');
  await card.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(card).toHaveAttribute('data-description-scope', 'node');
  await expect(card.locator('[data-provenance="user"]').first()).toBeVisible();
  await expect(card).toContainText('Turns the noisy latent into the picture for prompt A.');
  const stored = await api('listExplanations', [{ projectId: 'desktop', owner: { kind: 'node', id: '4', classType: 'KSampler' } }]) as Array<{ text: string; provenance: string; aspect: string; createdBy: string }>;
  expect(stored.some((item) => item.provenance === 'user' && item.createdBy === 'user' && item.aspect === 'what' && item.text.startsWith('Turns the noisy latent'))).toBe(true);
  // The other KSampler only has class knowledge: a dot until someone looks. (Escape first, so the expanded
  // Sample card is back to one line and cannot sit under the pointer.)
  await window.keyboard.press('Escape');
  await expect(window.locator('.description-card[data-expanded="true"]')).toHaveCount(0);
  await expect(window.getByRole('button', { name: 'Read the description: Sample B', exact: true })).toBeVisible();
  await window.locator('.react-flow__node[data-id="8"]').hover();
  await expect(window.getByRole('region', { name: 'Description of Sample B', exact: true })).toHaveAttribute('data-description-scope', 'nodeClass');

  expect(errors).toEqual([]);
  await app.close();
  fs.rmSync(userData, { recursive: true, force: true });
});
