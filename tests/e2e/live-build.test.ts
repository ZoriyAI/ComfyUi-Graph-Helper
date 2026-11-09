import { test, expect, _electron as electron } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { useEnglish } from './locale';
import { pickOption } from './pickOption';

/**
 * Live build: the TEST fixture builds a text-to-image graph one tool call per step, each with a `why`.
 * Nodes appear on the canvas over time (not all at once), a speech-bubble callout carries the why while the
 * build runs, the live-build strip counts the steps, and after the run the KSampler's description card holds
 * the saved why with the inference badge. The chat mirrors each step with a card that shows the why.
 */
test('live build: nodes appear step by step with their why on the canvas and in the chat', async () => {
  test.setTimeout(120000);
  const errors: string[] = [];
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'live-build-'));
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
  await expect(window.locator('.react-flow__node')).toHaveCount(0);

  await pickOption(window, 'Chat provider', 'TEST fixture');
  await window.getByText('TEST fixture is on').waitFor();
  await window.getByRole('tab', { name: 'Assistant' }).click();
  const input = window.locator('textarea[aria-label="Chat message"]');
  await input.fill('build a text to image graph');
  await input.press('Enter');

  // Sample how many nodes are visible (on the canvas and not waiting their turn) while the build runs.
  const visibleCount = () => window.evaluate(() => (
    Array.from(document.querySelectorAll('.react-flow__node')).filter((node) => !node.querySelector('[data-build-pending="true"]')).length
  ));
  const counts: number[] = [];
  const whys = new Set<string>();
  const strips: string[] = [];
  const started = Date.now();
  while (Date.now() - started < 60000) {
    counts.push(await visibleCount());
    const bubble = window.locator('[data-build-callout] [data-build-why]').first();
    if (await bubble.count()) whys.add((await bubble.textContent()) ?? '');
    const strip = window.locator('[data-live-build]');
    if (await strip.count()) strips.push((await strip.textContent()) ?? '');
    if (counts[counts.length - 1] === 7 && (await window.locator('[data-build-pending="true"]').count()) === 0) break;
    await window.waitForTimeout(100);
  }
  const distinct = [...new Set(counts)];
  // Not all at once: the count grows through at least three distinct values on its way to seven.
  expect(distinct.filter((count) => count > 0 && count < 7).length).toBeGreaterThanOrEqual(3);
  expect(distinct[distinct.length - 1]).toBe(7);
  for (let index = 1; index < counts.length; index += 1) expect(counts[index]).toBeGreaterThanOrEqual(counts[index - 1]);
  // A callout carried the agent's why while the build ran.
  expect([...whys].some((text) => text.includes('The sampler removes noise step by step'))
    || [...whys].some((text) => text.includes('checkpoint'))).toBe(true);
  expect(strips.some((text) => /Agent is building: step \d+ of \d+/.test(text))).toBe(true);

  await expect(window.locator('.react-flow__node')).toHaveCount(7);
  await expect(window.locator('.react-flow__edge')).toHaveCount(9);
  // The strip hides once the run is closed and the queue is empty.
  await expect(window.locator('[data-live-build]')).toHaveCount(0, { timeout: 20000 });

  // The KSampler's description card holds the saved why with the inference badge.
  const card = window.getByRole('region', { name: 'Description of KSampler', exact: true });
  await expect(card).toBeVisible({ timeout: 10000 });
  await expect(card).toHaveAttribute('data-description-scope', 'node');
  await expect(card.locator('[data-provenance="inference"]')).toHaveText('Inference');
  await expect(card).toContainText('The sampler removes noise step by step');

  // The chat mirrors each step with a build card that shows the why.
  await expect(window.locator('[data-tool-name="addNode"][data-tool-status="success"]')).toHaveCount(7);
  await expect(window.locator('[data-tool-name="connectNodes"][data-tool-status="success"]')).toHaveCount(9);
  const samplerCard = window.locator('[data-tool-name="addNode"]').filter({ hasText: 'The sampler removes noise step by step' });
  await expect(samplerCard).toHaveCount(1);
  await expect(samplerCard.locator('[data-build-why]')).toContainText('Why');
  await samplerCard.getByRole('button', { name: /Show .* on the canvas/ }).click();
  await expect(window.locator('.react-flow__node.selected')).toHaveCount(1);
  await expect(window.getByText('step by step: checkpoint, two prompts')).toBeVisible();

  expect(errors).toEqual([]);
  await app.close();
  fs.rmSync(userData, { recursive: true, force: true });
});
