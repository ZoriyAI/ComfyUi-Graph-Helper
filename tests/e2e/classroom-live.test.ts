/** Opt-in functional proof against a real already configured local model. No scripted provider. */
import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { readClassroomMaterial } from '../../src/shared/education/material';
import { launchApp } from './support/app';

test('real local assistant prepares a reviewable classroom draft from the wizard', async () => {
  const baseURL = process.env.NODEWISE_CLASSROOM_BASE;
  const model = process.env.NODEWISE_CLASSROOM_MODEL;
  test.skip(!baseURL || !model, 'Opt in with the address and exact name of a real local model.');
  test.setTimeout(180_000);
  const { page, close, pageErrors } = await launchApp({ prefix: 'nodewise-classroom-live-', args: process.platform === 'linux' ? ['--ozone-platform=x11'] : [], env: { DBUS_SESSION_BUS_ADDRESS: undefined, GNOME_KEYRING_CONTROL: undefined } });
  try {
    await page.evaluate(async config => {
      const read = await window.electronAPI.getSettings();
      if (!('values' in read) || !read.values) throw Error('Settings unavailable');
      const saved = await window.electronAPI.saveSettings({ ...read.values, provider: 'local', ...config, preferences: { assistant: { unloadOnExit: false } } });
      if (!saved.ok) throw Error('Model settings failed');
    }, { baseURL: baseURL!, model: model! });
    await page.reload();
    await page.getByRole('button', { name: 'Материалы к уроку', exact: true }).click();
    const wizard = page.locator('[data-classroom-wizard]');
    await wizard.getByRole('button', { name: 'Проверка понимания', exact: false }).click();
    await wizard.getByRole('button', { name: 'Продолжить', exact: true }).click();
    await wizard.getByLabel('Тема или название').fill('Сложение в пределах 10');
    await wizard.getByLabel('Класс или возраст').fill('1 класс');
    await wizard.getByLabel('Что ученики должны отработать?', { exact: true }).fill('Сложить два небольших числа и объяснить ответ.');
    await wizard.getByLabel('Ваш исходный текст (необязательно)', { exact: true }).fill('Подготовь три коротких вопроса про 2 + 3, 4 + 1 и 3 + 3. Ответы: 5, 5, 6. Не включай ответы в тексты вопросов.');
    await wizard.getByRole('button', { name: 'Открыть заготовку для правки' }).click();
    await wizard.getByLabel('Текст для учеников', { exact: true }).first().fill('Исходное задание учителя');
    await wizard.getByRole('button', { name: 'Подготовить с помощником', exact: true }).click();
    await page.getByRole('button', { name: 'Открыть материал для правки', exact: true }).last().click({ timeout: 150_000 });
    await expect(wizard.getByLabel('Текст для учеников', { exact: true }).first()).toHaveValue('Исходное задание учителя');
    await wizard.getByRole('button', { name: 'Открыть этот материал', exact: true }).click();
    const material = readClassroomMaterial(await page.evaluate(() => JSON.parse(localStorage.getItem('nodewise.classroom.v1')!).material));
    expect(material.language).toBe('ru'); expect(material.kind).toBe('quiz');
    expect(material.blocks.every(block => block.text.trim() && block.answer.trim())).toBe(true);
    expect(material.blocks[0].text).not.toBe('Исходное задание учителя');
    expect(await page.locator('.react-flow__node').count()).toBe(0);
    await writeFile('test-results/classroom-live-material.json', JSON.stringify(material, null, 2));
    await page.screenshot({ path: 'test-results/classroom-live.png', fullPage: true });
    expect(pageErrors).toEqual([]);
  } finally { await close(); }
});
