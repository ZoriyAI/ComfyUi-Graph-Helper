/** Actual Electron/SQLite/card recovery; deterministic HTTP model responses, no inference claim. */
import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { launchApp, temporaryProfile, removeProfile, type LaunchedApp } from './support/app';
import { startFakeLlm, FAKE_MODEL } from '../fixtures/llm/fakeLlmServer';

test('pending lesson and source cards survive restart, can be accepted/downloaded and respect privacy', async () => {
  const llm = await startFakeLlm(); const profile = temporaryProfile('nodewise-draft-recovery-');
  let current: LaunchedApp | undefined;
  const errors: string[] = [];
  const launch = async () => {
    current = await launchApp({ userData: profile, english: true, viewport: { width: 1440, height: 1000 }, env: { DBUS_SESSION_BUS_ADDRESS: undefined, GNOME_KEYRING_CONTROL: undefined } });
    current.page.on('pageerror', error => errors.push(error.message));
    await current.page.getByRole('tab', { name: 'Assistant', exact: true }).click();
    return current.page;
  };
  try {
    let page = await launch();
    await page.evaluate(async ({ base, model }) => {
      const settings = await window.electronAPI.getSettings();
      if (settings.source === 'corrupt') throw Error('Corrupt test profile');
      const saved = await window.electronAPI.saveSettings({ ...settings.values, provider: 'local', baseURL: base, model });
      if (!saved.ok) throw Error('Test settings were refused');
    }, { base: `${llm.origin}/v1`, model: FAKE_MODEL });
    await page.reload(); await page.getByRole('tab', { name: 'Assistant', exact: true }).click();
    const ask = async (text: string) => { const input = page.getByRole('textbox', { name: 'Chat message', exact: true }); await input.fill(text); await input.press('Enter'); };
    await ask('draft a lesson');
    await expect(page.locator('[data-lesson-draft-state="open"]')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('.pause-button')).toHaveCount(0);
    await ask('draft a recovery extension');
    const extension = page.locator('[data-extension-draft]');
    await expect(extension).toBeVisible({ timeout: 30000 });
    await expect(page.locator('.pause-button')).toHaveCount(0);
    const lessonId = await page.locator('[data-lesson-draft-state="open"]').getAttribute('data-lesson-draft');
    const extensionId = await extension.getAttribute('data-extension-draft');
    await current!.close(); page = await launch();
    const lesson = page.locator(`[data-lesson-draft="${lessonId}"]`);
    await expect(lesson).toHaveAttribute('data-lesson-draft-state', 'open');
    const recovered = page.locator(`[data-extension-draft="${extensionId}"]`);
    await expect(recovered).toContainText('Recovery fixture');
    await recovered.getByRole('combobox', { name: 'Read a source file' }).selectOption('__init__.py');
    await expect(recovered.locator('pre')).toContainText('class Echo');
    const destination = path.join(profile, 'recovered.zip');
    await current!.app.evaluate(({ session }, file) => { session.defaultSession.once('will-download', (_event, item) => item.setSavePath(file)); }, destination);
    await recovered.getByRole('button', { name: 'Download extension ZIP', exact: true }).click();
    await expect.poll(() => fs.existsSync(destination) && fs.statSync(destination).size).toBeGreaterThan(100);
    expect(fs.readFileSync(destination).readUInt32LE()).toBe(0x04034b50);
    await lesson.getByRole('button', { name: 'Keep in My lessons', exact: true }).click();
    await expect(lesson).toHaveAttribute('data-lesson-draft-state', 'kept');
    await page.evaluate(() => window.electronAPI.savePreferencesPatch({ privacy: { saveChatHistory: false } }));
    await ask('draft a lesson');
    const temporary = page.locator('[data-lesson-draft-state="open"]');
    await expect(temporary).toBeVisible({ timeout: 30000 });
    const temporaryId = await temporary.getAttribute('data-lesson-draft');
    await expect(page.locator('.pause-button')).toHaveCount(0);
    await current!.close(); page = await launch();
    expect(await page.evaluate(id => window.electronAPI.lessonDraft(id!), temporaryId)).toBeNull();
    await expect(page.locator(`[data-extension-draft="${extensionId}"]`)).toBeVisible();
    expect(errors).toEqual([]);
  } finally { await current?.close(); await llm.close(); removeProfile(profile); }
});
