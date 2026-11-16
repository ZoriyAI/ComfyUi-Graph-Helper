/** Exercises overlapping preference and connection updates without stale whole-row replacement. */
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { migrate } from '../../src/main/settings/migrate';
import { readSettings, saveSettings, savePreferencesPatch, saveDetectedMcpAuth, settingsRevision } from '../../src/main/settings/repository';
import { nonSecretDefaults } from '../../src/shared/config/schema';

const databases: Database.Database[] = [];
const open = () => { const db = new Database(':memory:'); databases.push(db); migrate(db); return db; };
afterEach(() => { vi.restoreAllMocks(); databases.splice(0).forEach(db => db.close()); });
describe('settings changes at the current database boundary', () => {
  it('a lesson preference patch keeps a provider and address saved just before it', () => {
    const db = open();
    saveSettings(db, { ...nonSecretDefaults, model: 'new model', mcpUrl: 'http://localhost:7000/mcp', preferences: { canvas: { showGrid: false } } });
    const result = savePreferencesPatch(db, { lessons: { active: 'text-to-image' } });
    expect(result).toMatchObject({ ok: true, values: { model: 'new model', mcpUrl: 'http://localhost:7000/mcp' }, preferences: { lessons: { active: 'text-to-image' } } });
  });
  it('a late auth answer cannot roll back A to B to A changes even within one millisecond', () => {
    const db = open(); vi.spyOn(Date, 'now').mockReturnValue(1000);
    const a = { ...nonSecretDefaults, mcpUrl: 'http://localhost:7000/mcp' };
    saveSettings(db, a);
    const expected = { url: a.mcpUrl, auth: a.mcpAuth, revision: settingsRevision(db) };
    saveSettings(db, { ...a, mcpUrl: 'http://localhost:8000/mcp', model: 'new' });
    saveSettings(db, { ...a, model: 'new' });
    expect(saveDetectedMcpAuth(db, expected, 'token')).toBeNull();
    expect(readSettings(db)).toMatchObject({ values: { model: 'new', mcpAuth: a.mcpAuth } });
    expect(saveDetectedMcpAuth(db, { ...expected, revision: settingsRevision(db) }, 'token')).toMatchObject({ mcpAuth: 'token', model: 'new' });
  });
  it('refuses corrupt settings and secret-bearing preference patches without replacing them', () => {
    const db = open(); saveSettings(db, nonSecretDefaults);
    const before = JSON.stringify(readSettings(db));
    expect(savePreferencesPatch(db, { assistant: { token: 'sk-private-example' } })).toMatchObject({ ok: false });
    expect(JSON.stringify(readSettings(db))).toBe(before);
    db.prepare("UPDATE settings SET language = 'broken'").run();
    expect(savePreferencesPatch(db, { lessons: { active: 'x' } })).toMatchObject({ ok: false });
  });
});
