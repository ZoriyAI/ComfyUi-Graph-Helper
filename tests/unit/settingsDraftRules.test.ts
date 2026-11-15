/**
 * Protects rules of the Settings draft that a person meets when saving: a save that cannot happen points at the
 * field to fix, automatic sync cannot be switched on without a server address, a shortcut moved onto a taken chord
 * frees it from the other command, and the sync status never shows a stale green or points "above" outside Settings.
 */
import { describe, expect, it } from 'vitest';
import { settingsProblemFields } from '../../src/shared/config/draft';
import { nonSecretDefaults } from '../../src/shared/config/schema';
import { autoSyncAllowed, sameAuto } from '../../src/renderer/components/settings/settingsDraft';
import { moveChord } from '../../src/renderer/components/settings/sections/ShortcutsSection';
import { syncView } from '../../src/renderer/components/sync/syncView';
import { accessErrorText } from '../../src/renderer/components/settings/mcpAccess';
import { createTranslator } from '../../src/shared/i18n';
import type { SyncStatus } from '../../src/shared/contracts';

describe('a save that cannot happen names its field', () => {
  it('names the model of your own server, its address and an MCP address that is not one', () => {
    expect(settingsProblemFields({ ...nonSecretDefaults, provider: 'local', baseURL: 'http://127.0.0.1:11434/v1', model: '' })).toEqual(['model']);
    expect(settingsProblemFields({ ...nonSecretDefaults, provider: 'local', baseURL: '', model: 'm' })).toEqual(['baseURL']);
    // Free words are not an address; a bare host and port without a scheme is accepted.
    expect(settingsProblemFields({ ...nonSecretDefaults, mcpUrl: 'мой комфи' })).toEqual(['mcpUrl']);
    expect(settingsProblemFields({ ...nonSecretDefaults, mcpUrl: '127.0.0.1:9000/mcp' })).toEqual([]);
    expect(settingsProblemFields(nonSecretDefaults)).toEqual([]);
  });

  it('has one sentence per field in both languages', () => {
    for (const language of ['ru', 'en'] as const) {
      const t = createTranslator(language);
      for (const field of ['mcpUrl', 'comfyOrigin', 'baseURL', 'model']) expect(t(`settings.fixField.${field}`)).not.toBe(`settings.fixField.${field}`);
    }
  });
});

describe('auto sync is a draft and needs an address', () => {
  it('compares drafts and refuses switching on without an address', () => {
    expect(sameAuto({ enabled: true, intervalMinutes: 30 }, { enabled: true, intervalMinutes: 30 })).toBe(true);
    expect(sameAuto({ enabled: true, intervalMinutes: 30 }, { enabled: false, intervalMinutes: 30 })).toBe(false);
    expect(autoSyncAllowed(false, true)).toBe(false);
    expect(autoSyncAllowed(false, false)).toBe(true);
    expect(autoSyncAllowed(true, true)).toBe(true);
  });
});

describe('two actions never share a shortcut', () => {
  it('moves the chord and leaves the other command without one', () => {
    const defaults: Record<string, string> = { 'file.new': 'Mod+N', 'file.open': 'Mod+O' };
    const next = moveChord({}, 'file.open', 'Mod+N', ['file.new'], (id) => defaults[id] ?? '');
    expect(next).toEqual({ 'file.new': '', 'file.open': 'Mod+N' });
    expect(moveChord({ 'file.open': 'Mod+Shift+Y' }, 'file.open', 'Mod+O', [], (id) => defaults[id] ?? '')).toEqual({});
  });
});

describe('a token that lived until the app closed', () => {
  const base: SyncStatus = {
    state: 'idle', lastSyncAt: 1, lastError: null, mcpUrl: 'http://127.0.0.1:9000/mcp', tokenHeld: false, signedIn: false,
    auto: { enabled: false, intervalMinutes: 30 }, counts: { nodeClasses: 40, detailedClasses: 40, packs: 5, models: 30, enrichedModels: 7 },
    progress: null, authMode: 'token', authChoice: 'token',
  };

  it('is said at start instead of a green left from before', () => {
    expect(syncView(base)).toMatchObject({ blocked: 'noToken', labelKey: 'sync.state.needsToken', hintKey: 'sync.needsToken' });
    expect(syncView({ ...base, tokenHeld: true })).toMatchObject({ blocked: null, labelKey: 'sync.state.idle' });
  });

  it('never points "above" outside Settings', () => {
    const ru = createTranslator('ru');
    const error = 'MCP server requires sign-in.';
    expect(accessErrorText(error, base, ru, 'elsewhere')).toBe(ru('sync.needsToken'));
    // The Russian word for "above" must not appear: outside Settings there is no field above to point at.
    expect(accessErrorText(error, base, ru, 'elsewhere')).not.toContain('выше');
    expect(accessErrorText(error, base, ru)).toBe(ru('settings.needsTokenPasted'));
  });
});
