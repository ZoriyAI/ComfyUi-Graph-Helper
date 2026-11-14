import { describe, expect, it } from 'vitest';
import { mergePreferences, parsePreferences, preferencesDefaults, samePreferences } from '../../src/shared/config/preferences';

describe('the remembered view (per profile)', () => {
  it('has defaults that keep the window as it starts', () => {
    expect(preferencesDefaults.view).toEqual({ railTab: 'nodes', modelKind: 'all', modelFamily: '', modelSort: 'name' });
  });

  it('keeps what was saved, and drops a bad value without resetting the rest', () => {
    const saved = parsePreferences({ view: { railTab: 'models', railOpen: false, dockTab: 'check', dockWidth: 520, dockCollapsed: true, modelKind: 'lora', modelFamily: 'wan2.2', modelSort: 'size' } });
    expect(saved.view).toEqual({ railTab: 'models', railOpen: false, dockTab: 'check', dockWidth: 520, dockCollapsed: true, modelKind: 'lora', modelFamily: 'wan2.2', modelSort: 'size' });
    const broken = parsePreferences({ view: { railTab: 'nowhere', dockWidth: 10, modelSort: 'size' } });
    expect(broken.view).toEqual({ railTab: 'nodes', modelKind: 'all', modelFamily: '', modelSort: 'size' });
  });

  it('is not a setting: a different view never makes the Settings draft "changed"', () => {
    const base = parsePreferences({});
    const moved = parsePreferences({ view: { railTab: 'models', dockWidth: 600 } });
    expect(samePreferences(base, moved)).toBe(true);
    expect(samePreferences(base, parsePreferences({ canvas: { showMinimap: false } }))).toBe(false);
  });

  it('merges a patch field by field', () => {
    const base = parsePreferences({ view: { railTab: 'models', modelFamily: 'sdxl' } });
    expect(parsePreferences(mergePreferences(base, { view: { dockWidth: 600 } })).view).toMatchObject({ railTab: 'models', modelFamily: 'sdxl', dockWidth: 600 });
  });
});
