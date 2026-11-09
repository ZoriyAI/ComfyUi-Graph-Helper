import { test, expect, _electron as electron } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { useEnglish } from './locale';
import { pickOption } from './pickOption';

/**
 * Step checkpoint: the TEST fixture "build a long chain" takes 70 tool steps. With the default 60 steps per
 * answer the turn pauses with a visible card ("The helper used 60 steps and paused"), the run stays paused, and
 * Continue resumes the same run and sends "continue", so the build finishes all 70 steps.
 */
test('step checkpoint: a 70-step build pauses at 60 with a card, and Continue finishes it', async () => {
  test.setTimeout(240000);
  const errors: string[] = [];
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'step-checkpoint-'));
  const app = await electron.launch({
    args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  const window = await app.firstWindow();
  window.on('pageerror', (error) => errors.push(error instanceof Error ? error.message : String(error)));
  await window.setViewportSize({ width: 1440, height: 900 });
  await useEnglish(window);

  await pickOption(window, 'Chat provider', 'TEST fixture');
  await window.getByText('TEST fixture is on').waitFor();
  await window.getByRole('tab', { name: 'Assistant' }).click();
  await window.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Build', exact: true }).click();
  const input = window.locator('textarea[aria-label="Chat message"]');
  await input.fill('Build a long chain');
  await input.press('Enter');

  const card = window.locator('.turn-checkpoint');
  await expect(card).toHaveCount(1, { timeout: 90000 });
  await expect(card).toHaveAttribute('data-reason', 'step-limit');
  await expect(card).toHaveAttribute('data-state', 'open');
  await expect(card.locator('.checkpoint-reason')).toHaveText('The helper used 60 steps and paused');
  await expect(window.locator('[data-tool-name="addNode"][data-tool-status="success"]')).toHaveCount(60);
  // The run is paused, not closed: the status bar still shows it.
  await expect(card.getByRole('button', { name: 'Continue' })).toBeEnabled();
  await expect(card.getByRole('button', { name: 'Stop' })).toBeVisible();

  await card.getByRole('button', { name: 'Continue' }).click();
  await expect(card).toHaveAttribute('data-state', 'continued');
  await expect(window.locator('.message-row.is-user').last()).toContainText('continue');
  await expect(window.getByText('TEST fixture only: the long chain is complete with 70 steps.')).toBeVisible({ timeout: 90000 });
  await expect(window.locator('.turn-checkpoint')).toHaveCount(1);
  await expect(window.locator('[data-tool-name="addNode"][data-tool-status="success"]')).toHaveCount(70);
  await expect(window.locator('.react-flow__node')).toHaveCount(70, { timeout: 120000 });
  expect(errors).toEqual([]);
  await app.close();
});
