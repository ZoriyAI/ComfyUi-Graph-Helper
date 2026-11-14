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
 * the saved why with the inference badge. The chat tells the build once: one card with a sentence per step (made
 * from the step's data, not the tool's English message), the why on the step, and a summary with what to do next.
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

  await pickOption(window, 'Choose the assistant', 'TEST mode');
  await window.getByText('TEST mode is on').first().waitFor();
  await window.getByRole('tab', { name: 'Assistant' }).click();
  // Build tools exist only in a build turn: switch the composer to Build.
  await window.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Build', exact: true }).click();
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
  expect(strips.some((text) => /The assistant is building: step \d+ of \d+/.test(text))).toBe(true);

  await expect(window.locator('.react-flow__node')).toHaveCount(7);
  await expect(window.locator('.react-flow__edge')).toHaveCount(9);
  // The strip hides once the run is closed and the queue is empty.
  await expect(window.locator('[data-live-build]')).toHaveCount(0, { timeout: 20000 });

  // The KSampler's description card holds the saved why with the inference badge.
  const card = window.getByRole('region', { name: 'Description of KSampler', exact: true });
  await expect(card).toBeVisible({ timeout: 10000 });
  await expect(card).toHaveAttribute('data-description-scope', 'node');
  await expect(card.locator('[data-provenance="inference"]')).toHaveText('Guess');
  await expect(card).toContainText('The sampler removes noise step by step');

  // The chat tells the build once: one card, one line per step, each made from the step's own data.
  const buildCard = window.locator('[data-build-card]');
  await expect(buildCard).toHaveCount(1);
  await expect(buildCard).toContainText('Build · 16 steps');
  await expect(buildCard.locator('[data-tool-name="addNode"][data-tool-status="success"]')).toHaveCount(7);
  await expect(buildCard.locator('[data-tool-name="connectNodes"][data-tool-status="success"]')).toHaveCount(9);
  await expect(buildCard).toContainText('Link: Load Checkpoint · MODEL → KSampler · model');
  await expect(buildCard).not.toContainText('Added CheckpointLoaderSimple node');
  await expect(buildCard).not.toContainText('Connected the nodes');
  // A step opens its why and shows its node on the canvas.
  const samplerStep = buildCard.locator('[data-tool-name="addNode"]').filter({ hasText: 'Added the node KSampler' });
  await expect(samplerStep).toHaveCount(1);
  await samplerStep.getByRole('button', { name: /Show on the canvas/ }).click();
  await expect(samplerStep.locator('[data-build-why]')).toContainText('Why');
  await expect(samplerStep.locator('[data-build-why]')).toContainText('The sampler removes noise step by step');
  await expect(window.locator('.react-flow__node.selected')).toHaveCount(1);
  await expect(window.getByText('step by step: checkpoint, two prompts')).toBeVisible();
  // The build closes with what it made and what to do next.
  const summary = window.locator('[data-build-summary]');
  await expect(summary).toContainText('Done: 7 nodes and 9 links.');
  await expect(summary.getByRole('button', { name: 'Tour the graph' })).toBeEnabled();
  await expect(summary.getByRole('button', { name: 'Check the graph' })).toBeVisible();
  await expect(summary.getByRole('button', { name: 'Save workflow…' })).toBeVisible();
  await summary.getByRole('button', { name: 'Tour the graph' }).click();
  await expect(window.locator('[data-tour-step="0"]')).toBeVisible();
  await window.keyboard.press('Escape');

  expect(errors).toEqual([]);
  await app.close();
  fs.rmSync(userData, { recursive: true, force: true });
});

/**
 * A click on the canvas ends following the helper: the person took the camera. That is about the build going on,
 * not about the next one. A person clicks the canvas all the time; the next build they ask for is followed
 * again, so each step and its bubble are on screen, clear of the canvas toolbar and the build strip.
 */
test('a build asked for after a click on the canvas is followed again', async () => {
  test.setTimeout(150000);
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'live-build-follow-'));
  const app = await electron.launch({
    args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  const window = await app.firstWindow();
  await window.setViewportSize({ width: 1440, height: 900 });
  await useEnglish(window);
  await pickOption(window, 'Choose the assistant', 'TEST mode');
  await window.getByText('TEST mode is on').first().waitFor();

  const follow = window.getByRole('button', { name: 'Follow the assistant', exact: true });
  await expect(follow).toHaveAttribute('aria-pressed', 'true');
  // The person looks around: zooms the canvas in and back out. Any press on the canvas ends following.
  await window.locator('.react-flow__controls-zoomin').click();
  await window.locator('.react-flow__controls-zoomout').click();
  await expect(follow).toHaveAttribute('aria-pressed', 'false');

  await window.getByRole('tab', { name: 'Assistant' }).click();
  await window.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Build', exact: true }).click();
  const input = window.locator('textarea[aria-label="Chat message"]');
  await input.fill('build a text to image graph');
  await input.press('Enter');

  await window.locator('[data-build-callout]').first().waitFor({ timeout: 60000 });
  await expect(follow).toHaveAttribute('aria-pressed', 'true');
  // Three steps in a row: once the camera has arrived, the bubble is inside the canvas and under its chrome.
  // The step and its place are read in one look at the page: a bubble gives way to the next one at any moment.
  const look = () => window.evaluate(() => {
    const box = (element: Element | null) => {
      const rect = element?.getBoundingClientRect();
      return rect && rect.width > 0 ? { x: rect.left, y: rect.top, right: rect.right, bottom: rect.bottom } : null;
    };
    const bubble = document.querySelector('[data-build-callout]');
    return {
      step: bubble?.getAttribute('data-build-callout') ?? null,
      bubble: box(bubble),
      canvas: box(document.querySelector('.react-flow')),
      strip: box(document.querySelector('[data-live-build]')),
      toolbar: box(document.querySelector('[role="toolbar"][aria-label="Canvas tools"]')),
    };
  });
  const seen = new Set<string>();
  const started = Date.now();
  while (seen.size < 3 && Date.now() - started < 60000) {
    const before = await look();
    if (!before.step || seen.has(before.step)) {
      await window.waitForTimeout(150);
      continue;
    }
    // The camera takes --motion-tour to arrive.
    await window.waitForTimeout(900);
    const now = await look();
    // The step gave way to the next one while the camera was on its way: look at that one instead.
    if (now.step !== before.step || !now.bubble || !now.canvas) continue;
    seen.add(now.step);
    expect(now.bubble.x, `step ${now.step}: left edge`).toBeGreaterThanOrEqual(now.canvas.x);
    expect(now.bubble.right, `step ${now.step}: right edge`).toBeLessThanOrEqual(now.canvas.right);
    expect(now.bubble.bottom, `step ${now.step}: bottom edge`).toBeLessThanOrEqual(now.canvas.bottom);
    const chrome = Math.max(now.strip?.bottom ?? 0, now.toolbar?.bottom ?? 0);
    expect(chrome, 'the canvas toolbar is on screen').toBeGreaterThan(0);
    expect(now.bubble.y, `step ${now.step}: under the toolbar and the build strip`).toBeGreaterThanOrEqual(chrome);
  }
  expect(seen.size, 'steps looked at').toBe(3);

  await app.close();
  fs.rmSync(userData, { recursive: true, force: true });
});
