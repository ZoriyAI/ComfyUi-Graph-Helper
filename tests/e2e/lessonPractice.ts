/** Shared UI traversal of the standard-2 practice steps, without claiming a generated result. */
import { expect, type Page } from '@playwright/test';

const panel = (page: Page) => page.locator('.lesson-panel');

/** Exercise the person's explicit practice answers; this UI test does not claim a real ComfyUI run. */
export async function answerPracticeStep(page: Page, automaticAction = 'Do this for me'): Promise<boolean> {
  const step = panel(page).locator('[data-lesson-step]');
  const id = await step.getAttribute('data-lesson-step');
  if (!id?.startsWith('practice-')) return false;
  await expect(panel(page).getByRole('button', { name: automaticAction, exact: true })).toHaveCount(0);
  const kind = await step.locator('[data-step-kind]').getAttribute('data-step-kind');
  const choices = kind === 'rubric' ? step.locator('input[type="radio"][id$="-yes"]')
    : kind === 'quiz' ? step.locator('input[type="radio"][id$="-correct"]')
      : step.locator('input[type="checkbox"]:enabled:not(:checked)');
  const count = await choices.count();
  expect(count, `${id}: the person has answers to give`).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    // Checkboxes leave the unmatched set as each answer lands; radio locators stay in place.
    await choices.nth(kind === 'rubric' || kind === 'quiz' ? index : 0).click();
  }
  await expect.poll(() => step.getAttribute('data-lesson-step')).not.toBe(id);
  return true;
}
