/**
 * The Preferences store (src/shared/config/preferences, saved on the settings row by src/main/settings/repository):
 * defaults for every section, ranges and enums, a broken store read field by field, section-wise merge, secrets
 * refused anywhere, the column added by migration 10, and clearing the chat history of one project.
 * Why: a person's preferences survive a bad value or an older database without being reset, and a pasted API key
 * can never end up stored in plain settings.
 */
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import {
  isChord,
  mergePreferences,
  parsePreferences,
  preferencesCarrySecret,
  preferencesDefaults,
  preferencesSchema,
  preferencesWriteError,
  samePreferences,
} from '../../src/shared/config/preferences';
import { migrate, schemaVersion, SCHEMA_VERSION } from '../../src/main/settings/migrate';
import { readPreferences, readSettings, saveSettings, secretRecordCount } from '../../src/main/settings/repository';
import { clearChatHistory, loadChatHistory, saveChatMessage } from '../../src/main/agent/chatHistory';
import { ensureWorkspace } from '../../src/main/commands/commit';
import { DESKTOP_PROJECT_ID } from '../../src/shared/project';

/** The plain settings row sent with every settings:save in these tests. */
const ROW = {
  theme: 'graphite',
  motion: 'system',
  provider: 'openai',
  model: 'stored-model',
  baseURL: '',
  comfyOrigin: '',
  mcpUrl: '',
  mcpAuth: '',
  language: 'en',
};

/** A migrated in-memory database. */
function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  return db;
}

describe('preferences schema', () => {
  it('fills every section with its defaults', () => {
    expect(preferencesDefaults).toEqual({
      assistant: { defaultIntent: 'ask', maxStepsPerTurn: 60, contextTokens: 0, allowWebSearch: true, allowFetchPage: true, answerLanguage: 'ui', verbosity: 'short' },
      providers: {
        openai: { model: '', baseURL: '' },
        anthropic: { model: '', baseURL: '' },
        google: { model: '', baseURL: '' },
        compatible: { model: '', baseURL: '' },
        local: { model: '', baseURL: '' },
      },
      network: { proxy: '', openaiOrganization: '', openaiProject: '' },
      sync: { enrichmentScope: 'loaders', enrichPerRun: 50, enrichPauseMs: 1500 },
      canvas: { showDescriptions: true, showMinimap: true, followAgent: true, buildPaceMs: 820, tourAutoplay: true, gridSize: 18 },
      appearance: { density: 'comfortable', accent: 'cyan', reduceGlow: false, interfaceScale: 100 },
      shortcuts: {},
      privacy: { sendFieldValues: true, saveChatHistory: true, modelLog: true, showMarkedPreviews: false, lookupModelsOnline: false, checkUpdates: false },
      view: { railTab: 'nodes', modelKind: 'all', modelFamily: '', modelSort: 'name' },
      lessons: { active: '', read: {}, done: [], answers: {}, outcomes: {} },
    });
    expect(preferencesSchema.parse({ canvas: { gridSize: 24 } }).canvas).toMatchObject({ gridSize: 24, showDescriptions: true });
  });

  it('keeps what a person has read in a lesson, and nothing that is not a lesson id', () => {
    const stored = { lessons: { active: 'video-text', read: { 'video-text': ['intro', 'run'] }, done: ['image'], answers: {}, outcomes: {} } };
    expect(parsePreferences(stored).lessons).toEqual(stored.lessons);
    expect(preferencesSchema.safeParse({ lessons: { active: 'Video Text' } }).success).toBe(false);
    expect(preferencesSchema.safeParse({ lessons: { read: { image: ['<script>'] } } }).success).toBe(false);
    // One bad field does not take the rest with it.
    expect(parsePreferences({ lessons: { active: '../x', done: ['image'] } }).lessons).toEqual({ active: '', read: {}, done: ['image'], answers: {}, outcomes: {} });
    // A change of one field leaves the others.
    const merged = mergePreferences(parsePreferences(stored), { lessons: { active: '' } });
    expect(parsePreferences(merged).lessons).toEqual({ ...stored.lessons, active: '' });
  });

  it('keeps the answers and outcomes of lessons, the ids that start with a digit and the lessons of the person', () => {
    // Before 1.1 a lesson id that starts with a digit (3d-image) or one of My lessons (my:...) was refused, and with it
    // every later save of lesson progress.
    const stored = {
      lessons: {
        active: 'my:sdxl-size',
        read: { '3d-image': ['intro'], 'my:sdxl-size': ['intro'] },
        done: ['3d-image', 'my:sdxl-size'],
        answers: { 'one-factor': { ready: { question: 'yes' }, assess: { difference: 'partly' }, complete: { self: 'yes' } } },
        outcomes: { 'one-factor': ['structure', 'run-self', 'result'] },
      },
    };
    expect(preferencesSchema.safeParse(stored).success).toBe(true);
    expect(parsePreferences(stored).lessons).toEqual(stored.lessons);
    // An answer is an id, never a text a person or a file could fill with anything.
    expect(preferencesSchema.safeParse({ lessons: { answers: { 'one-factor': { ready: { question: 'Hello <b>' } } } } }).success).toBe(false);
    expect(preferencesSchema.safeParse({ lessons: { outcomes: { 'one-factor': ['done'] } } }).success).toBe(false);
    // A profile saved before 1.1 reads with empty answers and outcomes.
    expect(parsePreferences({ lessons: { active: '', read: {}, done: ['image'] } }).lessons).toEqual({ active: '', read: {}, done: ['image'], answers: {}, outcomes: {} });
  });

  it('enforces the ranges and enums', () => {
    expect(preferencesSchema.safeParse({ assistant: { maxStepsPerTurn: 3 } }).success).toBe(false);
    expect(preferencesSchema.safeParse({ assistant: { maxStepsPerTurn: 201 } }).success).toBe(false);
    expect(preferencesSchema.safeParse({ assistant: { contextTokens: -1 } }).success).toBe(false);
    expect(preferencesSchema.safeParse({ sync: { enrichPerRun: 1000 } }).success).toBe(true);
    expect(preferencesSchema.safeParse({ sync: { enrichPerRun: 1001 } }).success).toBe(false);
    expect(preferencesSchema.safeParse({ sync: { enrichPerRun: 9 } }).success).toBe(false);
    expect(preferencesSchema.safeParse({ sync: { enrichPauseMs: 10_001 } }).success).toBe(false);
    expect(preferencesSchema.safeParse({ canvas: { buildPaceMs: 299 } }).success).toBe(false);
    expect(preferencesSchema.safeParse({ appearance: { accent: 'pink' } }).success).toBe(false);
    expect(preferencesSchema.safeParse({ providers: { openai: { baseURL: 'notaurl' } } }).success).toBe(false);
    expect(preferencesSchema.safeParse({ unknown: true }).success).toBe(false);
    expect(preferencesSchema.safeParse({ shortcuts: { 'view.fit': 'Shift+2', 'file.quit': '' } }).success).toBe(true);
    expect(preferencesSchema.safeParse({ shortcuts: { 'view.fit': 'Hyper+Q' } }).success).toBe(false);
    expect(isChord('Mod+Shift+K')).toBe(true);
    expect(isChord('F12')).toBe(true);
    expect(isChord('Mod+')).toBe(false);
  });

  it('reads a broken or partial store field by field, never failing as a whole', () => {
    const read = parsePreferences({
      assistant: { maxStepsPerTurn: 999, verbosity: 'normal' },
      canvas: { showMinimap: false, gridSize: 'big' },
      shortcuts: { 'view.fit': 'Shift+2', 'bad id': 'Mod+K', 'file.open': 'Nope+Q' },
      providers: { local: { model: 'qwen2.5', baseURL: 'http://127.0.0.1:11434/v1' }, openai: { model: 'sk-live-abcdef123456' } },
      extra: 'ignored',
    });
    expect(read.assistant).toMatchObject({ maxStepsPerTurn: 60, verbosity: 'normal' });
    expect(read.canvas).toMatchObject({ showMinimap: false, gridSize: 18 });
    expect(read.shortcuts).toEqual({ 'view.fit': 'Shift+2' });
    expect(read.providers.local).toEqual({ model: 'qwen2.5', baseURL: 'http://127.0.0.1:11434/v1' });
    // A secret-shaped value is dropped on read too.
    expect(read.providers.openai.model).toBe('');
    expect(parsePreferences('not json')).toEqual(preferencesDefaults);
    expect(parsePreferences(null)).toEqual(preferencesDefaults);
  });

  it('merges a patch section by section; shortcuts replace the map', () => {
    const base = parsePreferences({ shortcuts: { 'view.fit': 'Shift+2' }, providers: { openai: { model: 'gpt-5', baseURL: '' } } });
    const merged = preferencesSchema.parse(mergePreferences(base, {
      assistant: { verbosity: 'normal' },
      providers: { openai: { baseURL: 'https://gateway.example.test/v1' } },
      shortcuts: { 'file.quit': '' },
    }));
    expect(merged.assistant).toEqual({ ...preferencesDefaults.assistant, verbosity: 'normal' });
    expect(merged.providers.openai).toEqual({ model: 'gpt-5', baseURL: 'https://gateway.example.test/v1' });
    expect(merged.shortcuts).toEqual({ 'file.quit': '' });
    expect(samePreferences(merged, JSON.parse(JSON.stringify(merged)))).toBe(true);
    expect(samePreferences(merged, base)).toBe(false);
  });

  it('finds secrets anywhere and reports the settings messages', () => {
    expect(preferencesCarrySecret({ providers: { openai: { model: 'sk-proj-abc123' } } })).toBe(true);
    expect(preferencesCarrySecret({ shortcuts: { apiKey: 'Mod+K' } })).toBe(true);
    expect(preferencesCarrySecret({ canvas: { note: 'Bearer abc.def' } })).toBe(true);
    expect(preferencesCarrySecret(preferencesDefaults)).toBe(false);
    expect(preferencesWriteError({ providers: { openai: { model: 'sk-proj-abc123' } } })).toBe('Settings cannot store a secret');
    expect(preferencesWriteError({ canvas: { gridSize: 2 } })).toBe('Settings do not match the schema');
    expect(preferencesWriteError(preferencesDefaults)).toBeNull();
  });
});

describe('preferences on the settings row (migration v10)', () => {
  it('adds preferences_json to a version 9 database without touching the row', () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL);
      INSERT INTO schema_migrations (version, applied_at) VALUES (1, 1), (2, 1), (3, 1), (4, 1), (5, 1), (6, 1), (7, 1), (8, 1), (9, 1);
      CREATE TABLE settings (
        id INTEGER PRIMARY KEY CHECK (id = 1), theme TEXT NOT NULL, motion TEXT NOT NULL, provider TEXT NOT NULL, model TEXT NOT NULL,
        comfy_origin TEXT NOT NULL, base_url TEXT NOT NULL DEFAULT '', language TEXT NOT NULL DEFAULT 'en', mcp_url TEXT NOT NULL DEFAULT '',
        updated_at INTEGER NOT NULL
      );
      INSERT INTO settings (id, theme, motion, provider, model, comfy_origin, updated_at) VALUES (1, 'graphite', 'off', 'local', 'llama', '', 1);
    `);
    // Before the migration there is no column: defaults are read, nothing fails.
    expect(readPreferences(db)).toEqual(preferencesDefaults);
    migrate(db);
    expect(schemaVersion(db)).toBe(SCHEMA_VERSION);
    const columns = (db.prepare('PRAGMA table_info(settings)').all() as Array<{ name: string }>).map((column) => column.name);
    expect(columns).toContain('preferences_json');
    expect(db.prepare('SELECT preferences_json, model FROM settings WHERE id = 1').get()).toEqual({ preferences_json: '{}', model: 'llama' });
    expect(readSettings(db)).toMatchObject({ source: 'corrupt', preferences: preferencesDefaults });
    migrate(db);
    expect(schemaVersion(db)).toBe(SCHEMA_VERSION);
    db.close();
  });

  it('saves, merges and reads preferences through settings:save', () => {
    const db = openDb();
    expect(readSettings(db)).toMatchObject({ source: 'default', preferences: preferencesDefaults });
    const first = saveSettings(db, { ...ROW, preferences: { canvas: { showDescriptions: false }, shortcuts: { 'view.fit': 'Shift+2' } } });
    expect(first.ok).toBe(true);
    // A later save of the row alone keeps the stored preferences.
    expect(saveSettings(db, { ...ROW, model: 'next-model' }).ok).toBe(true);
    const second = saveSettings(db, { ...ROW, preferences: { assistant: { maxStepsPerTurn: 8 }, providers: { openai: { model: 'next-model' } } } });
    expect(second).toMatchObject({ ok: true, preferences: { canvas: { showDescriptions: false }, assistant: { maxStepsPerTurn: 8 } } });
    const read = readSettings(db);
    expect(read).toMatchObject({ source: 'stored', values: { model: 'stored-model' } });
    expect(read.preferences).toMatchObject({
      canvas: { showDescriptions: false, showMinimap: true },
      assistant: { maxStepsPerTurn: 8, verbosity: 'short' },
      shortcuts: { 'view.fit': 'Shift+2' },
      providers: { openai: { model: 'next-model', baseURL: '' } },
    });
    expect(readPreferences(db)).toEqual(read.preferences);
    db.close();
  });

  it('fails closed: a secret or an invalid value in preferences blocks the whole save', () => {
    const db = openDb();
    expect(saveSettings(db, { ...ROW, preferences: { canvas: { gridSize: 18 } } }).ok).toBe(true);
    const before = db.prepare('SELECT * FROM settings WHERE id = 1').get();
    expect(saveSettings(db, { ...ROW, model: 'changed', preferences: { providers: { openai: { model: 'sk-proj-abcdef123456' } } } }))
      .toEqual({ ok: false, error: 'Settings cannot store a secret' });
    expect(saveSettings(db, { ...ROW, model: 'changed', preferences: { shortcuts: { token: 'Mod+K' } } }))
      .toEqual({ ok: false, error: 'Settings cannot store a secret' });
    expect(saveSettings(db, { ...ROW, model: 'changed', preferences: { assistant: { maxStepsPerTurn: 300 } } }))
      .toEqual({ ok: false, error: 'Settings do not match the schema' });
    expect(saveSettings(db, { ...ROW, model: 'changed', preferences: { nope: 1 } }))
      .toEqual({ ok: false, error: 'Settings do not match the schema' });
    expect(db.prepare('SELECT * FROM settings WHERE id = 1').get()).toEqual(before);
    expect(JSON.stringify(db.prepare('SELECT preferences_json FROM settings').all())).not.toContain('sk-proj');
    expect(secretRecordCount(db)).toBe(0);
    db.close();
  });
});

describe('chat history clear', () => {
  it('removes only the messages of the project', () => {
    const db = openDb();
    ensureWorkspace(db);
    db.prepare("INSERT INTO projects (id, name, created_at, updated_at) VALUES ('other', 'Other', 1, 1)").run();
    for (const [id, projectId] of [['a', DESKTOP_PROJECT_ID], ['b', DESKTOP_PROJECT_ID], ['c', 'other']]) {
      expect(saveChatMessage(db, { id, projectId, role: 'user', content: 'hi', timestamp: 1, graphRevisionId: null, toolCalls: null })).toEqual({ ok: true });
    }
    expect(clearChatHistory(db, DESKTOP_PROJECT_ID)).toEqual({ ok: true, removed: 2 });
    expect(loadChatHistory(db, DESKTOP_PROJECT_ID)).toEqual([]);
    expect(loadChatHistory(db, 'other')).toHaveLength(1);
    expect(clearChatHistory(db, '')).toEqual({ ok: false, error: 'Chat history could not be cleared.' });
    db.close();
  });
});
