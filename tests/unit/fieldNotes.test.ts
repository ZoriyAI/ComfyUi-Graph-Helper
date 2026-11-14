/** Built-in notes on single fields, read through the knowledge layer Properties uses (fieldNote). */
import { describe, expect, it } from 'vitest';
import { fieldNote } from '../../src/shared/knowledge/coreKnowledge';

describe('built-in field notes', () => {
  it('a KSampler field has its note in both languages', () => {
    const en = fieldNote('KSampler', 'steps', 'en');
    const ru = fieldNote('KSampler', 'steps', 'ru');
    expect(en).toBeTruthy();
    expect(ru).toBeTruthy();
    expect(ru).not.toBe(en);
    expect(/[Ѐ-ӿ]/.test(ru ?? '')).toBe(true);
  });

  it('a field no set knows has no note, so Properties shows no button', () => {
    expect(fieldNote('KSampler', 'no_such_field', 'en')).toBeNull();
    expect(fieldNote('SomeUnknownNode', 'steps', 'ru')).toBeNull();
  });
});
