import { describe, expect, it } from 'vitest';
import { readTypedNumber } from '../../src/renderer/components/fields/fieldModel';

const steps = { kind: 'int' as const, min: 1, max: 10000 };
const denoise = { kind: 'float' as const, min: 0, max: 1, step: 0.01 };

describe('a typed number', () => {
  it('is kept as typed when it fits', () => {
    expect(readTypedNumber('30', steps, 'int')).toEqual({ kind: 'value', value: 30, note: null });
    expect(readTypedNumber('0,5', denoise, 'float')).toEqual({ kind: 'value', value: 0.5, note: null });
  });

  it('says why it changed: raised to the minimum, lowered to the maximum, rounded', () => {
    expect(readTypedNumber('0', steps, 'int')).toEqual({ kind: 'value', value: 1, note: { key: 'field.raisedToMin', values: { min: '1', value: '1' } } });
    expect(readTypedNumber('999999', steps, 'int')).toEqual({ kind: 'value', value: 10000, note: { key: 'field.loweredToMax', values: { max: '10000', value: '10000' } } });
    expect(readTypedNumber('2.6', steps, 'int')).toEqual({ kind: 'value', value: 3, note: { key: 'field.roundedTo', values: { value: '3' } } });
  });

  it('refuses hex, words and stray characters, and ignores an empty field', () => {
    expect(readTypedNumber('0x10', steps, 'int')).toEqual({ kind: 'refused' });
    expect(readTypedNumber('abc', steps, 'int')).toEqual({ kind: 'refused' });
    expect(readTypedNumber('12px', steps, 'int')).toEqual({ kind: 'refused' });
    expect(readTypedNumber('  ', steps, 'int')).toEqual({ kind: 'empty' });
    expect(readTypedNumber('1e1', steps, 'int')).toEqual({ kind: 'value', value: 10, note: null });
  });
});
