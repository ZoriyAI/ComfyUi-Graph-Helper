/**
 * The exact Russian and English sentences of the MCP access block in Settings: whether the server took a pasted
 * token, what the next step is when the server requires sign-in (per chosen way in), and the token file in the app
 * folder as a place the token can live.
 * Why: "requires sign-in" alone leaves a person stuck; each sentence must name the one thing to do next.
 */
import { describe, expect, it } from 'vitest';
import { createTranslator } from '../../src/shared/i18n';
import { accessErrorText, detectionNote, NEEDS_SIGN_IN, tokenPlaceKey } from '../../src/renderer/components/settings/mcpAccess';

const ru = createTranslator('ru');
const en = createTranslator('en');

describe('what Check says about a pasted token', () => {
  it('says whether the server took the token, not only that it wants one', () => {
    expect(detectionNote({ ok: true, mode: 'token' }, ru)).toEqual({ mode: 'token', text: 'Сервер требует токен. Выбрано «Токен».', tone: 'good' });
    expect(detectionNote({ ok: true, mode: 'token', tokenAccepted: true, tools: 114 }, ru))
      .toEqual({ mode: 'token', text: 'Сервер требует токен и принимает ваш. Выбрано «Токен».', tone: 'good' });
    expect(detectionNote({ ok: true, mode: 'token', tokenAccepted: false }, en))
      .toEqual({ mode: 'token', text: 'The server needs a token and did not accept the pasted one. Check it. “Token” is selected.', tone: 'bad' });
  });
});

describe('the sentence for "requires sign-in"', () => {
  it('names the next step for the chosen way in', () => {
    const base = { authChoice: '' as const, tokenHeld: false, signedIn: false };
    expect(accessErrorText(NEEDS_SIGN_IN, { ...base, authChoice: 'token' }, ru)).toBe('Токен ещё не вставлен. Вставьте его в поле «Токен доступа» выше.');
    expect(accessErrorText(NEEDS_SIGN_IN, { ...base, authChoice: 'token', tokenHeld: true }, ru)).toBe('MCP-сервер не принял токен. Проверьте его в «Настройки ▸ Подключение».');
    expect(accessErrorText(NEEDS_SIGN_IN, { ...base, authChoice: 'oauth' }, ru)).toBe('Войдите через браузер в Настройках ▸ Подключение.');
    expect(accessErrorText(NEEDS_SIGN_IN, base, ru)).toBe('MCP-сервер требует входа. Выберите «Токен» или «Вход через браузер» в Настройках ▸ Подключение.');
    expect(accessErrorText(NEEDS_SIGN_IN, null, en)).toContain('requires sign-in');
    // Every other error keeps its own sentence.
    expect(accessErrorText('MCP server was not read.', { ...base, authChoice: 'token' }, ru)).toBe('Не удалось прочитать MCP-сервер. Проверьте адрес и запущен ли сервер.');
  });
});

describe('where the token lives', () => {
  it('names the app folder file as well', () => {
    expect(tokenPlaceKey({ held: true, source: 'file', stored: false, inFile: true })).toBe('settings.tokenPlaceFile');
    expect(tokenPlaceKey({ held: false, source: 'none', stored: false, inFile: true })).toBe('settings.tokenPlaceFile');
    expect(tokenPlaceKey({ held: true, source: 'os', stored: true, inFile: true })).toBe('settings.tokenPlaceOs');
    expect(tokenPlaceKey({ held: true, source: 'session', stored: false, inFile: false })).toBe('settings.tokenPlaceSession');
    expect(tokenPlaceKey({ held: false, source: 'none', stored: false, inFile: false })).toBe('settings.tokenPlaceNone');
  });
});
