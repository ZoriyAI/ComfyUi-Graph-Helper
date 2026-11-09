import { describe, expect, it } from 'vitest';
import { detectionNote, shouldDetectAfterSave, tokenPlaceKey } from '../../src/renderer/components/settings/mcpAccess';
import { ru } from '../../src/shared/i18n/catalog';

/** Reads the Russian catalog the way i18next would, with {{name}} interpolation. */
const translate = (key: string, options?: Record<string, unknown>): string => {
  let node: unknown = ru;
  for (const part of key.split('.')) node = (node as Record<string, unknown>)?.[part];
  if (typeof node !== 'string') return key;
  return node.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(options?.[name] ?? ''));
};

describe('Check: what the server wants becomes the choice and one sentence', () => {
  it('selects the detected access and says so', () => {
    expect(detectionNote({ ok: true, mode: 'none', tools: 12 }, translate)).toEqual({
      mode: 'none', tone: 'good', text: 'Сервер отвечает без входа (инструментов: 12) — выбрано «Без входа».',
    });
    expect(detectionNote({ ok: true, mode: 'oauth' }, translate)).toEqual({
      mode: 'oauth', tone: 'good', text: 'Сервер требует входа через браузер — выбрано «Вход через браузер».',
    });
    expect(detectionNote({ ok: true, mode: 'token' }, translate)).toEqual({
      mode: 'token', tone: 'good', text: 'Сервер требует токен — выбрано «Токен».',
    });
  });

  it('selects nothing when the server could not be asked, and explains why', () => {
    const note = detectionNote({ ok: false, error: 'MCP server URL is empty.' }, translate);
    expect(note.mode).toBeNull();
    expect(note.tone).toBe('bad');
    expect(note.text).toBe('Адрес MCP-сервера пуст.');
  });
});

describe('token status line', () => {
  it('says where the token is', () => {
    expect(tokenPlaceKey({ held: false, source: 'none', stored: false })).toBe('settings.tokenPlaceNone');
    expect(tokenPlaceKey({ held: true, source: 'session', stored: false })).toBe('settings.tokenPlaceSession');
    expect(tokenPlaceKey({ held: true, source: 'os', stored: true })).toBe('settings.tokenPlaceOs');
    // Saved for the stored address but not loaded into memory yet: still "saved".
    expect(tokenPlaceKey({ held: false, source: 'none', stored: true })).toBe('settings.tokenPlaceOs');
  });
});

describe('detection after a save', () => {
  it('runs only for a new address with nothing chosen', () => {
    expect(shouldDetectAfterSave({ mcpUrl: '' }, { mcpUrl: 'http://127.0.0.1:9000/mcp', mcpAuth: '' })).toBe(true);
    expect(shouldDetectAfterSave({ mcpUrl: 'http://a/mcp' }, { mcpUrl: 'http://b/mcp', mcpAuth: '' })).toBe(true);
    expect(shouldDetectAfterSave({ mcpUrl: 'http://a/mcp' }, { mcpUrl: 'http://a/mcp', mcpAuth: '' })).toBe(false);
    expect(shouldDetectAfterSave({ mcpUrl: '' }, { mcpUrl: 'http://a/mcp', mcpAuth: 'token' })).toBe(false);
    expect(shouldDetectAfterSave({ mcpUrl: 'http://a/mcp' }, { mcpUrl: ' ', mcpAuth: '' })).toBe(false);
  });
});
