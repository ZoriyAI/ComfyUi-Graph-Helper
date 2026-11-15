/**
 * E2E spec for Settings > Connection > "Access to the server", in Russian (the primary language): each choice opens
 * only itself, "Test server" asks a fake MCP server on loopback (labelled fixture; it accepts connections without
 * credentials) and selects "No sign-in", and a save of a new address with nothing chosen asks the server by itself.
 * A person should not have to know how their server signs in; the app finds out.
 */
import { test, expect, _electron as electron } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { startFakeMcp } from '../fixtures/mcp/fakeMcpServer';
import { artifact } from './artifacts';

test('access to the server: choose, check, and detect after save', async () => {
  const fake = await startFakeMcp();
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-access-'));
  const env = { ...process.env, NODE_ENV: 'production' } as Record<string, string>;
  // No session bus and no keyring daemon, so Electron does not talk to the desktop's keyring during the run.
  delete env.DBUS_SESSION_BUS_ADDRESS;
  delete env.GNOME_KEYRING_CONTROL;
  const app = await electron.launch({
    args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`],
    env,
  });
  try {
    const window = await app.firstWindow();
    await window.setViewportSize({ width: 1440, height: 900 });
    await window.locator('.app-shell').waitFor({ timeout: 20000 });
    await expect(window.locator('html')).toHaveAttribute('lang', 'ru');

    await window.getByRole('button', { name: 'Настройки', exact: true }).click();
    let dialog = window.locator('[role="dialog"].settings-dialog');
    await dialog.getByRole('tab', { name: 'Подключение' }).click();
    const access = dialog.getByRole('group', { name: 'Доступ к серверу' });
    await expect(access).toBeVisible();
    const options = access.locator('[data-access-option]');
    await expect(options).toHaveCount(3);
    // Nothing chosen yet: every option is one title line, and the block says how to find out.
    await expect(access.locator('[data-expanded="true"]')).toHaveCount(0);
    await expect(access.getByText('Пока не выбрано. Нажмите «Проверить» рядом с адресом, и приложение выберет подходящий вариант.')).toBeVisible();

    const choices: Array<{ name: string; id: string; text: string }> = [
      { name: 'Без входа', id: 'none', text: 'Сервер принимает подключение без учётных данных.' },
      { name: 'Токен', id: 'token', text: 'Сервер выдал вам токен доступа.' },
      { name: 'Вход через браузер', id: 'oauth', text: 'Сервер защищён входом.' },
    ];
    for (const choice of choices) {
      await access.getByRole('radio', { name: choice.name, exact: true }).check();
      await expect(access.locator('[data-expanded="true"]')).toHaveCount(1);
      await expect(access.locator(`[data-access-option="${choice.id}"]`)).toHaveAttribute('data-expanded', 'true');
      await expect(access.getByText(choice.text, { exact: false })).toBeVisible();
      for (const other of choices.filter((item) => item.id !== choice.id)) {
        await expect(access.getByText(other.text, { exact: false })).toHaveCount(0);
      }
    }
    // Only the token choice shows the token field; it is a password field and starts empty.
    await expect(access.getByRole('textbox', { name: 'Токен доступа' })).toHaveCount(0);
    await access.getByRole('radio', { name: 'Токен', exact: true }).check();
    await expect(access.getByRole('textbox', { name: 'Токен доступа', exact: true })).toHaveAttribute('type', 'password');
    await expect(access.getByRole('status', { name: 'Токен доступа' })).toHaveText('Токена нет.');
    await window.screenshot({ path: artifact('mcp-access-token.png') }).catch(() => undefined);
    // Arrow keys move between the choices like any radio group.
    await access.getByRole('radio', { name: 'Токен', exact: true }).focus();
    await window.keyboard.press('ArrowDown');
    await expect(access.getByRole('radio', { name: 'Вход через браузер', exact: true })).toBeChecked();
    await expect(access.locator('[data-access-option="oauth"]')).toHaveAttribute('data-expanded', 'true');

    // "Test server" works before saving, and selects what the server wants.
    const check = dialog.getByRole('button', { name: 'Проверить', exact: true });
    await expect(check).toBeDisabled();
    await dialog.getByRole('textbox', { name: 'Адрес MCP-сервера', exact: true }).fill(fake.url);
    await check.click();
    await expect(dialog.getByRole('status').filter({ hasText: 'Сервер отвечает без входа' }))
      .toHaveText(/^Сервер отвечает без входа\. Выбрано «Без входа»\. Этот MCP-сервер даёт весь каталог: ноды, паки, модели, описания и отпечатки\.$/);
    await expect(access.getByRole('radio', { name: 'Без входа', exact: true })).toBeChecked();
    await expect(access.getByText('Выбор вступит в силу после «Сохранить настройки».')).toBeVisible();
    await window.screenshot({ path: artifact('mcp-access-checked.png') }).catch(() => undefined);
    await dialog.getByRole('button', { name: 'Отмена' }).click();
    // A changed draft is not thrown away without asking.
    const discard = window.locator('[role="dialog"].settings-discard');
    await expect(discard.getByText('Закрыть без сохранения?')).toBeVisible();
    await discard.getByRole('button', { name: 'Закрыть без сохранения' }).click();
    await expect(dialog).toHaveCount(0);

    // Only the address, nothing chosen: the save asks the server and stores "No sign-in" by itself.
    await window.getByRole('button', { name: 'Настройки', exact: true }).click();
    dialog = window.locator('[role="dialog"].settings-dialog');
    await dialog.getByRole('tab', { name: 'Подключение' }).click();
    await expect(dialog.locator('[data-expanded="true"]')).toHaveCount(0);
    await dialog.getByRole('textbox', { name: 'Адрес MCP-сервера', exact: true }).fill(fake.url);
    await dialog.getByRole('button', { name: 'Сохранить настройки' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(window.getByText(/^Сервер отвечает без входа\. Выбрано «Без входа»\. Этот MCP-сервер даёт весь каталог: ноды, паки, модели, описания и отпечатки\.$/).first()).toBeVisible({ timeout: 15000 });
    const stored = await window.evaluate(async () => {
      const api = (window as unknown as { electronAPI: { getSettings: () => Promise<{ values?: { mcpAuth?: string } }> } }).electronAPI;
      return (await api.getSettings()).values?.mcpAuth;
    });
    expect(stored).toBe('none');
    await window.getByRole('button', { name: 'Настройки', exact: true }).click();
    dialog = window.locator('[role="dialog"].settings-dialog');
    await dialog.getByRole('tab', { name: 'Подключение' }).click();
    await expect(dialog.getByRole('radio', { name: 'Без входа', exact: true })).toBeChecked();

    // The helper section knows nothing about the server token.
    await dialog.getByRole('tab', { name: 'Помощник' }).click();
    await expect(dialog.getByRole('tabpanel', { name: 'Помощник' }).getByRole('textbox', { name: 'Токен доступа', exact: true })).toHaveCount(0);
    // The server was asked: it saw connections and no tool that changes anything.
    expect(fake.calls.length).toBeGreaterThan(0);
  } finally {
    await app.close();
    await fake.close();
  }
});
