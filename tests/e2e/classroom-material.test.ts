/** Actual isolated Electron UI: no ComfyUI, editable export, private teacher fields and phone-sized controls. */
import { test, expect, chromium } from '@playwright/test';
import { createServer } from 'node:net';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { launchApp } from './support/app';

test('teacher prepares, saves, restores and imports a resource without ComfyUI', async () => {
  const { app, page, close, pageErrors, userData } = await launchApp({ prefix: 'nodewise-classroom-', args: process.platform === 'linux' ? ['--ozone-platform=x11'] : [], env: { DBUS_SESSION_BUS_ADDRESS: undefined, GNOME_KEYRING_CONTROL: undefined }, viewport: { width: 1100, height: 850 } });
  try {
    await page.getByRole('button', { name: 'Материалы к уроку', exact: true }).click();
    const wizard = page.locator('[data-classroom-wizard]');
    await expect(wizard).toBeVisible();
    await wizard.getByRole('button', { name: 'Проверка понимания', exact: false }).click();
    await wizard.getByRole('button', { name: 'Продолжить', exact: true }).click();
    await wizard.getByLabel('Тема или название', { exact: true }).fill('Времена года');
    await wizard.getByLabel('Класс или возраст', { exact: true }).fill('2 класс');
    await wizard.getByLabel('Что ученики должны отработать?', { exact: true }).fill('Объяснить смену сезонов');
    await wizard.getByRole('button', { name: 'Открыть заготовку для правки' }).click();
    const first = wizard.locator('fieldset').first();
    await first.getByLabel('Текст для учеников', { exact: true }).fill('Какое время года следует за весной?');
    await first.locator('summary').click();
    await first.getByLabel('Ответ (только в копии учителя)', { exact: true }).fill('TEACHER_ONLY_Лето');
    await first.getByLabel('Заметки учителя (только в его копии)', { exact: true }).fill('PRIVATE_TEACHER_NOTE');
    const pupilPath = join(userData, 'pupil.html');
    await app.evaluate(({ session }, destination) => { session.defaultSession.once('will-download', (_event, item) => item.setSavePath(destination)); }, pupilPath);
    await wizard.getByRole('button', { name: 'Скачать лист ученика' }).click();
    await expect.poll(async () => (await readFile(pupilPath, 'utf8').catch(() => '')).includes('</html>')).toBe(true);
    const html = await readFile(pupilPath, 'utf8');
    expect(html).toContain('Какое время года'); expect(html).not.toMatch(/TEACHER_ONLY|PRIVATE_TEACHER_NOTE/);
    const filePath = join(userData, 'editable.json');
    await app.evaluate(({ session }, destination) => { session.defaultSession.once('will-download', (_event, item) => item.setSavePath(destination)); }, filePath);
    await wizard.getByRole('button', { name: 'Сохранить редактируемую копию' }).click();
    await expect.poll(async () => (await readFile(filePath, 'utf8').catch(() => '')).includes('PRIVATE_TEACHER_NOTE')).toBe(true);
    const saved = JSON.parse(await readFile(filePath, 'utf8'));
    expect(saved.blocks[0].answer).toBe('TEACHER_ONLY_Лето');
    await page.reload(); await page.locator('.app-shell').waitFor();
    await page.getByRole('button', { name: 'Материалы к уроку', exact: true }).click();
    await expect(wizard.getByLabel('Текст для учеников', { exact: true }).first()).toHaveValue('Какое время года следует за весной?');
    // Touch layout qualification is an emulated viewport, not a physical device claim.
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(wizard.getByRole('button', { name: 'Закрыть', exact: true }).last()).toBeVisible();
    expect(await wizard.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await wizard.locator('input[type=file]').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"version":999}') });
    await expect(wizard.getByRole('alert')).toBeVisible();
    await expect(wizard.getByLabel('Тема или название', { exact: true })).toHaveValue('Времена года');
    await wizard.locator('input[type=file]').setInputFiles(filePath);
    await wizard.getByRole('button', { name: 'Открыть этот материал', exact: true }).click();
    await expect(wizard.getByLabel('Текст для учеников', { exact: true }).first()).toHaveValue('Какое время года следует за весной?');
    await page.screenshot({ path: 'test-results/classroom-phone.png', fullPage: true });
    // The printable document actually renders in Chromium, and its generated PDF contains a real page.
    const pdfBytes = await app.evaluate(async ({ BrowserWindow }, document) => {
      const preview = new BrowserWindow({ show: false, webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true } });
      try { await preview.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(document)}`); return (await preview.webContents.printToPDF({ pageSize: 'A4', printBackground: false })).length; }
      finally { preview.destroy(); }
    }, html);
    expect(pdfBytes).toBeGreaterThan(1000);
    expect(pageErrors).toEqual([]);
  } finally { await close(); }
});

test('English material moves from desktop to a paired touch browser without ComfyUI', async () => {
  const { app, page, close, pageErrors, userData } = await launchApp({ prefix: 'nodewise-classroom-phone-', english: true, args: process.platform === 'linux' ? ['--ozone-platform=x11'] : [], env: { DBUS_SESSION_BUS_ADDRESS: undefined, GNOME_KEYRING_CONTROL: undefined } });
  const browser = await chromium.launch({ channel: 'chromium' });
  const allocator = createServer();
  await new Promise<void>(resolve => allocator.listen(0, '127.0.0.1', resolve));
  const port = (allocator.address() as { port: number }).port;
  await new Promise<void>(resolve => allocator.close(() => resolve()));
  try {
    await page.getByRole('button', { name: 'Materials for a lesson', exact: true }).click();
    const desktopWizard = page.locator('[data-classroom-wizard]');
    await desktopWizard.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(desktopWizard.getByLabel('Material language')).toHaveValue('en');
    await desktopWizard.getByLabel('Topic or title').fill('Seasons');
    await desktopWizard.getByRole('button', { name: 'Open editable scaffold' }).click();
    await desktopWizard.getByLabel('Text for pupils', { exact: true }).first().fill('Name a change you can see in spring.');
    const copy = join(userData, 'shared.json');
    await app.evaluate(({ session }, destination) => { session.defaultSession.once('will-download', (_event, item) => item.setSavePath(destination)); }, copy);
    await desktopWizard.getByRole('button', { name: 'Save editable copy', exact: true }).click();
    await expect.poll(async () => (await readFile(copy, 'utf8').catch(() => '')).includes('spring.')).toBe(true);
    await page.evaluate(async port => {
      const read = await window.electronAPI.getSettings();
      if (!('values' in read) || !read.values) throw Error('Settings unavailable');
      const result = await window.electronAPI.saveSettings({ ...read.values, preferences: { browserAccess: { enabled: true, address: '127.0.0.1', port } } });
      if (!result.ok) throw Error('Browser access failed');
    }, port);
    await expect.poll(() => page.evaluate(async () => (await window.electronAPI.browserAccessStatus()).state)).toBe('listening');
    const code = await page.evaluate(async () => (await window.electronAPI.browserPairingCode()).code);
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'en-US', acceptDownloads: true });
    const origin = `http://127.0.0.1:${port}`;
    expect((await context.request.post(`${origin}/browser/pair`, { headers: { Origin: origin }, data: { code } })).status()).toBe(200);
    const phone = await context.newPage(); phone.on('pageerror', error => pageErrors.push(error.message));
    await phone.goto(origin);
    await phone.getByRole('button', { name: 'Materials for a lesson', exact: true }).tap();
    const wizard = phone.locator('[data-classroom-wizard]');
    const chooser = phone.waitForEvent('filechooser');
    await wizard.getByRole('button', { name: 'Open material file', exact: true }).tap();
    await (await chooser).setFiles(copy);
    await wizard.getByRole('button', { name: 'Open this material', exact: true }).tap();
    await expect(wizard.getByLabel('Text for pupils', { exact: true }).first()).toHaveValue('Name a change you can see in spring.');
    await wizard.getByLabel('Text for pupils', { exact: true }).first().fill('Colleague version: name a change in autumn.');
    const download = phone.waitForEvent('download');
    await wizard.getByRole('button', { name: 'Download pupil sheet', exact: true }).tap();
    expect(await readFile((await (await download).path())!, 'utf8')).toContain('Colleague version:');
    await expect(desktopWizard.getByLabel('Text for pupils', { exact: true }).first()).toHaveValue('Name a change you can see in spring.');
    expect(await wizard.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await phone.screenshot({ path: 'test-results/classroom-touch-en.png', fullPage: true });
    await wizard.getByRole('button', { name: 'Close', exact: true }).last().tap();
    await expect(wizard).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  } finally { await browser.close(); await close(); }
});
