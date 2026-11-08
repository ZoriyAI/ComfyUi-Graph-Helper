import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import {
  catalogLeaves,
  createTranslator,
  en,
  explainError,
  fileDialogCopy,
  formatClock,
  moveAnnouncement,
  redactDiagnostic,
  ru,
} from '../../src/shared/i18n';
import { nonSecretDefaults } from '../../src/shared/config/schema';
import { migrate, schemaVersion } from '../../src/main/settings/migrate';
import { readSettings, saveSettings } from '../../src/main/settings/repository';

function leaf(catalog: unknown, key: string): string {
  const value = key.split('.').reduce<unknown>((current, part) => {
    if (current == null || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[part];
  }, catalog);
  if (typeof value !== 'string') throw new Error(`Missing catalog string ${key}`);
  return value;
}

const ASCII_RU = new Set([
  'ComfyUI Graph Builder',
  'English',
  'OpenAI',
  'TEST',
  'API',
  'JSON',
  'URL',
]);

describe('locale catalog', () => {
  it('keeps one shared catalog with English and Russian key parity', () => {
    const englishKeys = catalogLeaves(en);
    const russianKeys = catalogLeaves(ru);
    expect(russianKeys).toEqual(englishKeys);
    expect(englishKeys.length).toBeGreaterThan(40);
    const englishValues = new Map(englishKeys.map((key) => [key, leaf(en, key)]));
    const russianValues = new Map(russianKeys.map((key) => [key, leaf(ru, key)]));
    for (const key of englishKeys) {
      const english = englishValues.get(key) ?? '';
      const russian = russianValues.get(key) ?? '';
      expect(english).not.toBe(key);
      expect(russian).not.toBe(key);
      expect(english.trim()).not.toBe('');
      expect(russian.trim()).not.toBe('');
    }
    expect(en.workflow.imported).toContain('{{nodeText}}');
    expect(en.workflow.imported).toContain('{{modelText}}');
    expect(ru.workflow.imported).toContain('{{nodeText}}');
    expect(ru.status.nodes_other).toContain('{{count, number}}');
    expect(ru.status.nodes_other).not.toMatch(/\+/);
  });

  it('uses full plural sentences and locale number grouping', () => {
    const english = createTranslator('en');
    const russian = createTranslator('ru');
    expect(english('status.nodes', { count: 1 })).toBe('1 node');
    expect(english('status.nodes', { count: 12 })).toBe('12 nodes');
    expect(english('status.nodes', { count: 1280 })).toBe('1,280 nodes');
    expect(russian('status.nodes', { count: 1 })).toBe('1 узел');
    expect(russian('status.nodes', { count: 2 })).toBe('2 узла');
    expect(russian('status.nodes', { count: 5 })).toBe('5 узлов');
    expect(russian('status.nodes', { count: 21 })).toBe('21 узел');
    expect(russian('status.nodes', { count: 1280 }).replace(/\s/g, ' ')).toBe('1 280 узлов');
    expect(english('status.zoom', { percent: 100 })).toBe('Zoom 100%');
    expect(russian('status.zoom', { percent: 100 })).toBe('Масштаб 100%');
    expect(formatClock(Date.UTC(2026, 0, 2, 15, 4), 'en', 'UTC')).toMatch(/3:04/);
    expect(formatClock(Date.UTC(2026, 0, 2, 15, 4), 'ru', 'UTC')).toMatch(/15:04/);
  });

  it('keeps Russian app copy in Cyrillic except brand tokens', () => {
    for (const key of catalogLeaves(ru)) {
      const value = leaf(ru, key);
      const readable = value.replace(/\{\{[^}]+\}\}/g, '');
      const hasCyrillic = /\p{Script=Cyrillic}/u.test(readable);
      if (!hasCyrillic) expect(ASCII_RU.has(value), key).toBe(true);
    }
    expect(createTranslator('ru')('settings.languageEnglish')).toBe('English');
    expect(createTranslator('ru')('settings.languageRussian')).toBe('Русский');
    expect(createTranslator('en')('settings.languageEnglish')).toBe('English');
    expect(createTranslator('en')('settings.languageRussian')).toBe('Русский');
  });

  it('localizes known errors and redacts secret-shaped diagnostics', () => {
    const english = createTranslator('en');
    const russian = createTranslator('ru');
    expect(explainError(english, 'Settings cannot store a secret')).toEqual({
      summary: 'Settings cannot store a secret',
      diagnostic: null,
    });
    expect(explainError(russian, 'Settings do not match the schema').summary).toBe('Настройки не соответствуют схеме');
    expect(explainError(russian, 'Catalog snapshot is not object_info.').diagnostic).toBeNull();
    const unknown = explainError(russian, "Error: Incorrect API key provided: 'sk-abcDEF123'.");
    expect(unknown.summary).toBe('Приложение не смогло выполнить этот шаг.');
    expect(unknown.diagnostic).not.toContain('sk-abcDEF123');
    expect(unknown.diagnostic).toContain('Incorrect API key');
    expect(redactDiagnostic('Bearer sk-live-token')).not.toContain('sk-live');
    expect(redactDiagnostic('sk-proj-AbC123_def-GHI456')).toBe('[redacted]');
    expect(redactDiagnostic('sk-svcacct-AbC123_def')).toBe('[redacted]');
    expect(redactDiagnostic('token sk-example-secret rejected')).toBe('token [redacted] rejected');
    expect(redactDiagnostic("Error: key 'sk-proj-AbC123_def-GHI456' rejected")).not.toMatch(/AbC123|GHI456|sk-proj|sk-example/);
  });

  it('localizes the four React Flow move directions', () => {
    const english = createTranslator('en');
    const russian = createTranslator('ru');
    const words: Record<string, string> = { up: 'вверх', down: 'вниз', left: 'влево', right: 'вправо' };
    for (const direction of ['up', 'down', 'left', 'right']) {
      const sentence = moveAnnouncement(russian, direction, 12, 34);
      expect(sentence).toContain(words[direction]);
      expect(sentence).not.toMatch(/\b(up|down|left|right)\b/);
      expect(sentence).toMatch(/\p{Script=Cyrillic}/u);
      expect(moveAnnouncement(english, direction, 12, 34)).toContain(direction);
    }
  });

  it('localizes file dialog copy without changing the English filter names', () => {
    expect(fileDialogCopy('en').importWorkflow).toMatchObject({
      title: 'Import a workflow',
      buttonLabel: 'Import',
      filter: 'ComfyUI Workflow',
    });
    expect(fileDialogCopy('en').importCatalog.filter).toBe('ComfyUI object_info');
    expect(fileDialogCopy('ru').exportWorkflow.filter).toMatch(/\p{Script=Cyrillic}/u);
    expect(fileDialogCopy('ru').importWorkflow.title).not.toBe(fileDialogCopy('en').importWorkflow.title);
  });
});

describe('language preference', () => {
  it('defaults a new profile to Russian and does not insert a row', () => {
    const db = new Database(':memory:');
    migrate(db);
    expect(nonSecretDefaults.language).toBe('ru');
    expect(readSettings(db)).toMatchObject({ source: 'default', values: { language: 'ru' } });
    expect(db.prepare('SELECT COUNT(*) AS count FROM settings').get()).toEqual({ count: 0 });
    db.close();
  });

  it('keeps an existing version 5 row in English while preserving the other fields', () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL);
      INSERT INTO schema_migrations (version, applied_at) VALUES (5, 1);
      CREATE TABLE settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        theme TEXT NOT NULL,
        motion TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        comfy_origin TEXT NOT NULL,
        base_url TEXT NOT NULL DEFAULT '',
        updated_at INTEGER NOT NULL
      );
      INSERT INTO settings (id, theme, motion, provider, model, comfy_origin, base_url, updated_at)
      VALUES (1, 'graphite', 'reduced', 'test', 'kept-model', 'http://127.0.0.1:8188', 'https://example.test/v1', 9);
    `);
    migrate(db);
    expect(schemaVersion(db)).toBe(7);
    expect(readSettings(db)).toMatchObject({
      source: 'stored',
      values: {
        language: 'en',
        motion: 'reduced',
        provider: 'test',
        model: 'kept-model',
        baseURL: 'https://example.test/v1',
        comfyOrigin: 'http://127.0.0.1:8188',
      },
    });
    db.close();
  });

  it('saves a language and reads the same value after reopen', () => {
    const db = new Database(':memory:');
    migrate(db);
    const saved = saveSettings(db, { ...nonSecretDefaults, language: 'en', model: 'fixture-model' });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.values.language).toBe('en');
    expect(readSettings(db)).toMatchObject({ source: 'stored', values: { language: 'en', model: 'fixture-model' } });
    const rejected = saveSettings(db, { ...nonSecretDefaults, language: 'de' });
    expect(rejected).toEqual({ ok: false, error: 'Settings do not match the schema' });
    expect(readSettings(db)).toMatchObject({ source: 'stored', values: { language: 'en' } });
    db.close();
  });
});
