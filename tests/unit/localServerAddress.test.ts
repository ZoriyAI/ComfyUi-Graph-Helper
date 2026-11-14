import { describe, expect, it } from 'vitest';
import { contextWindowFor, effectiveContextWindow } from '../../src/shared/agent/contextWindow';
import { contextSourceKey, discoveryEmptyNoteShown, listable, onlyModelToPick } from '../../src/renderer/components/settings/sections/pickerItems';
import { createTranslator } from '../../src/shared/i18n';

describe('the address of the person\'s own model server', () => {
  it('is asked without http:// when it is on this computer', () => {
    expect(listable('local', '127.0.0.1:11434/v1')).toBe(true);
    expect(listable('local', 'localhost:1234')).toBe(true);
    expect(listable('local', 'мой сервер')).toBe(false);
    expect(listable('local', '192.168.1.5:11434')).toBe(false);
  });

  it('fills in the only model the server lists, and nothing when there are several or one is chosen', () => {
    expect(onlyModelToPick([{ id: 'local-helper-7b' }], '')).toBe('local-helper-7b');
    expect(onlyModelToPick([{ id: 'a' }, { id: 'b' }], '')).toBeNull();
    expect(onlyModelToPick([{ id: 'a' }], 'mine')).toBeNull();
  });

  it('drops "no local server answered" once the typed address answered', () => {
    expect(discoveryEmptyNoteShown(0, false)).toBe(true);
    expect(discoveryEmptyNoteShown(0, true)).toBe(false);
    expect(discoveryEmptyNoteShown(2, false)).toBe(false);
  });
});

describe('the context window the page shows and the helper uses', () => {
  it('is the number the server reported when "auto" is chosen, larger or smaller than the published one', () => {
    expect(effectiveContextWindow('unknown-local-model', 0, 2048)).toEqual({ tokens: 2048, source: 'server' });
    expect(effectiveContextWindow('unknown-local-model', 0, 131072)).toEqual({ tokens: 131072, source: 'server' });
    expect(effectiveContextWindow('unknown-local-model', 0, null)).toEqual(contextWindowFor('unknown-local-model', 0));
  });

  it('keeps the person\'s setting unless the server loaded less', () => {
    expect(effectiveContextWindow('m', 8000, 32768)).toEqual({ tokens: 8000, source: 'override' });
    expect(effectiveContextWindow('m', 64000, 4096)).toEqual({ tokens: 4096, source: 'server' });
  });

  it('names where the number comes from in both languages', () => {
    for (const language of ['ru', 'en'] as const) {
      const t = createTranslator(language);
      for (const source of ['override', 'known', 'default', 'server'] as const) expect(t(contextSourceKey(source))).not.toBe(contextSourceKey(source));
    }
    expect(createTranslator('ru')(contextSourceKey('server'))).toBe('так модель загружена на вашем сервере');
  });
});
