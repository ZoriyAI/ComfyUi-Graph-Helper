/**
 * How the conversation log window shows the assistant's turns (src/renderer/components/log/modelLogView):
 * ending labels and tones, words in both languages, Russian plural forms, durations, sizes, "today" and
 * "yesterday", and the quick selections for saving turns.
 * Why: the person reads this log to see what the assistant did and to send a turn for help; an unknown ending
 * must never look like a success.
 */
import { describe, expect, it } from 'vitest';
import {
  durationParts, formatLogBytes, formatTurnTime, intentLabelKey, logErrorKey, outcomeView, pickTurns, providerLabelKey,
} from '../../src/renderer/components/log/modelLogView';
import { createTranslator, en, ru } from '../../src/shared/i18n';
import type { ModelLogTurn } from '../../src/shared/contracts/modelLog';

/** A logged turn started at `startedAt` with the given ending. */
function turn(id: string, startedAt: number, outcome = 'ok'): ModelLogTurn {
  return {
    id, startedAt, provider: 'local', model: 'qwen3:14b', baseUrl: 'http://127.0.0.1:21434', intent: 'build', outcome,
    steps: 3, toolCalls: 5, inputTokens: 1200, outputTokens: 80, durationMs: 12_000, error: null, bytes: 4096, question: 'собери граф',
  };
}

/** The value at a dotted key path in an i18n catalog, or undefined. */
function leaf(catalog: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((current, part) => (current && typeof current === 'object' ? (current as Record<string, unknown>)[part] : undefined), catalog);
}

describe('the conversation log as a person reads it', () => {
  it('never calls an unknown or missing ending a success', () => {
    expect(outcomeView('ok')).toEqual({ labelKey: 'modelLog.outcome.ok', tone: 'ok' });
    expect(outcomeView('error').tone).toBe('danger');
    expect(outcomeView('paused').tone).toBe('warn');
    expect(outcomeView('cancelled').tone).toBe('neutral');
    expect(outcomeView('unfinished').labelKey).toBe('modelLog.outcome.unfinished');
    expect(outcomeView('something-new').labelKey).toBe('modelLog.outcome.unfinished');
    expect(outcomeView('').tone).toBe('warn');
  });

  it('has words in both languages for every ending, provider and kind of request', () => {
    const keys = [
      ...['ok', 'error', 'paused', 'cancelled', 'unfinished', 'x'].map((value) => outcomeView(value).labelKey),
      ...['local', 'openai', 'anthropic', 'google', 'test', '', 'x'].map((provider) => providerLabelKey(provider)),
      providerLabelKey('local', 'gemma4:cloud'),
      ...['ask', 'build', 'chat', '', 'x'].map(intentLabelKey),
      ...['That turn is not in the log.', 'The log has no turns to save.', 'The log file could not be written.', 'The log folder is not available.'].map((text) => logErrorKey(text) as string),
    ];
    for (const key of keys) {
      expect(typeof leaf(en, key), key).toBe('string');
      expect(typeof leaf(ru, key), key).toBe('string');
    }
    expect(logErrorKey('EACCES: permission denied')).toBeNull();
    expect(logErrorKey(undefined)).toBeNull();
  });

  it('counts records, steps and tool calls in full Russian plural forms', () => {
    const russian = createTranslator('ru');
    expect(russian('modelLog.steps', { count: 1 })).toBe('1 шаг');
    expect(russian('modelLog.steps', { count: 3 })).toBe('3 шага');
    expect(russian('modelLog.steps', { count: 16 })).toBe('16 шагов');
    expect(russian('modelLog.toolCalls', { count: 21 })).toBe('21 обращение к инструментам');
    expect(russian('modelLog.toolCalls', { count: 5 })).toBe('5 обращений к инструментам');
    expect(russian('modelLog.usage', { count: 12, size: '3,4 МБ' })).toBe('12 записей, 3,4 МБ');
    expect(russian('modelLog.saved', { count: 2 })).toBe('Журнал сохранён: 2 вопроса');
    expect(createTranslator('en')('modelLog.steps', { count: 1 })).toBe('1 step');
  });

  it('shows short turns with tenths and long ones in minutes', () => {
    expect(durationParts(400)).toEqual({ minutes: 0, seconds: 0.4, tenths: true });
    expect(durationParts(9_940)).toEqual({ minutes: 0, seconds: 9.9, tenths: true });
    expect(durationParts(12_400)).toEqual({ minutes: 0, seconds: 12, tenths: false });
    expect(durationParts(185_000)).toEqual({ minutes: 3, seconds: 5, tenths: false });
    expect(durationParts(null)).toBeNull();
    expect(durationParts(-1)).toBeNull();
  });

  it('formats sizes in the language of the window', () => {
    expect(formatLogBytes(0, 'ru')).toBe('0 Б');
    expect(formatLogBytes(900, 'en')).toBe('900 B');
    expect(formatLogBytes(3.4 * 1024 * 1024, 'ru').replace(/\s/g, ' ')).toBe('3,4 МБ');
    expect(formatLogBytes(150 * 1024 * 1024, 'en')).toBe('150 MB');
  });

  it('says today and yesterday instead of a date', () => {
    const now = new Date(2026, 10, 10, 15, 0).getTime();
    expect(formatTurnTime(new Date(2026, 10, 10, 14, 32).getTime(), 'ru', now)).toEqual({ day: 'today', text: '14:32' });
    expect(formatTurnTime(new Date(2026, 10, 9, 23, 5).getTime(), 'ru', now).day).toBe('yesterday');
    const older = formatTurnTime(new Date(2026, 10, 3, 9, 15).getTime(), 'ru', now);
    expect(older.day).toBe('date');
    expect(older.text).toContain('09:15');
    expect(older.text).toMatch(/3/);
  });

  it('ticks the last turn, today\'s turns, the failed ones or all', () => {
    const now = new Date(2026, 10, 10, 15, 0).getTime();
    const turns = [
      turn('c', new Date(2026, 10, 10, 14, 0).getTime(), 'error'),
      turn('b', new Date(2026, 10, 10, 9, 0).getTime()),
      turn('a', new Date(2026, 10, 8, 9, 0).getTime(), 'unfinished'),
    ];
    expect(pickTurns(turns, 'last', now)).toEqual(['c']);
    expect(pickTurns(turns, 'today', now)).toEqual(['c', 'b']);
    // An unfinished turn counts among the failed ones.
    expect(pickTurns(turns, 'errors', now)).toEqual(['c', 'a']);
    expect(pickTurns(turns, 'all', now)).toEqual(['c', 'b', 'a']);
    expect(pickTurns(turns, 'none', now)).toEqual([]);
    expect(pickTurns([], 'last', now)).toEqual([]);
  });
});
