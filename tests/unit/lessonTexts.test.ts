import { describe, expect, it } from 'vitest';
import type { FieldSpec, Lesson } from '../../src/shared/lessons/engine';
import { LESSONS } from '../../src/shared/lessons/lessons';
import { LESSONS_EN } from '../../src/shared/lessons/texts.en';
import { LESSONS_RU } from '../../src/shared/lessons/texts.ru';
import { REASONS_EN } from '../../src/shared/lessons/reasons.en';
import { REASONS_RU } from '../../src/shared/lessons/reasons.ru';
import { FILES } from '../../src/shared/lessons/files';
import { rolesOf } from '../../src/shared/lessons/engine';
import { en, ru } from '../../src/shared/i18n/catalog';

/**
 * The words of a step and its checks say the same thing. Where a step's text names a number for a field ("set
 * `cfg` to 3.5", "`end_at_step` 10", "`shift` from 5 to 8"), the rule on that field must want that very number:
 * as its exact value, or as the value "Do this for me" sets inside its range. A text that names a range must name
 * the rule's range. Both languages are read.
 */

type Named = { field: string; value: number } | { field: string; min: number; max: number };

const NUMBER = '(-?\\d+(?:\\.\\d+)?)';
const RANGE = new RegExp(`^[^\\d]{0,12}(?:от|from)\\s+${NUMBER}\\s+(?:до|to)\\s+${NUMBER}`);
const FIRST = new RegExp(`^[^\\d\\n]{0,40}?${NUMBER}`);

/** The first number the text puts after each field it names in backticks, within the same phrase. */
export function namedNumbers(text: string): Named[] {
  const out: Named[] = [];
  const seen = new Set<string>();
  const pattern = /`([a-z_0-9]+)`([^`]*)/g;
  for (const match of text.matchAll(pattern)) {
    const [, field, after] = match;
    if (seen.has(field)) continue;
    seen.add(field);
    // "4n + 1", "5B" and other numbers inside words are not a value.
    const range = RANGE.exec(after);
    if (range) {
      out.push({ field, min: Number(range[1]), max: Number(range[2]) });
      continue;
    }
    const first = FIRST.exec(after);
    if (first && !/[a-zA-Zа-яА-Я]$/.test(after.slice(0, first.index + first[0].length - first[1].length))) out.push({ field, value: Number(first[1]) });
  }
  return out;
}

/** What the rules of a step want of a field, as a number; null when no rule there wants a number. */
function wanted(rules: FieldSpec[], field: string): { value?: number; min?: number; max?: number } | null {
  for (const rule of rules) {
    if (rule.field !== field) continue;
    const test = rule.test;
    if (test.kind === 'equals' && typeof test.value === 'number') return { value: test.value };
    if (test.kind === 'between') return { value: test.prefer, min: test.min, max: test.max };
  }
  return null;
}

function mismatches(lesson: Lesson, words: typeof LESSONS_RU, language: string): string[] {
  const out: string[] = [];
  for (const step of lesson.steps) {
    const rules = step.fields ?? [];
    if (rules.length === 0) continue;
    const text = words[lesson.id]?.steps[step.id]?.body ?? '';
    for (const named of namedNumbers(text)) {
      const want = wanted(rules, named.field);
      if (!want) continue;
      const where = `${language} ${lesson.id}/${step.id} \`${named.field}\``;
      if ('value' in named) {
        if (want.value === undefined) out.push(`${where}: the text says ${named.value}, the rule has no number of its own`);
        else if (want.value !== named.value) out.push(`${where}: the text says ${named.value}, the rule wants ${want.value}`);
      } else if (want.min !== named.min || want.max !== named.max) {
        out.push(`${where}: the text says from ${named.min} to ${named.max}, the rule ${want.min}–${want.max}`);
      }
    }
  }
  return out;
}

describe('the words of a step and its checks agree', () => {
  it('reads the number a text gives a field', () => {
    expect(namedNumbers('Поставьте `width` 832, `height` 480 и `length` 81.')).toEqual([
      { field: 'width', value: 832 }, { field: 'height', value: 480 }, { field: 'length', value: 81 },
    ]);
    expect(namedNumbers('- `cfg`: 3.5;\n- `start_at_step`: 0 и `end_at_step`: 10;')).toEqual([
      { field: 'cfg', value: 3.5 }, { field: 'start_at_step', value: 0 }, { field: 'end_at_step', value: 10 },
    ]);
    expect(namedNumbers('со значением `shift` от 5 до 8.')).toEqual([{ field: 'shift', min: 5, max: 8 }]);
    // Only the first mention counts: "the pack starts at `cfg` 6" after "set `cfg` 3.5" is not an instruction.
    expect(namedNumbers('Поставьте `cfg` 3.5. По умолчанию стоит `cfg` 6.')).toEqual([{ field: 'cfg', value: 3.5 }]);
    expect(namedNumbers('`steps` и `cfg`: как в первом;')).toEqual([]);
  });

  it('finds a text and a rule that disagree', () => {
    const lesson: Lesson = { id: 'probe', steps: [{ id: 'a', fields: [{ role: 'r', field: 'cfg', test: { kind: 'between', min: 1, max: 4 } }] }] };
    const words = { probe: { title: '', result: '', steps: { a: { title: '', body: 'Поставьте `cfg` 3.5.' } } } };
    expect(mismatches(lesson, words, 'ru')).toEqual(['ru probe/a `cfg`: the text says 3.5, the rule has no number of its own']);
  });

  for (const lesson of LESSONS) {
    it(`${lesson.id}: every number the text names is the number the check wants`, () => {
      expect([...mismatches(lesson, LESSONS_RU, 'ru'), ...mismatches(lesson, LESSONS_EN, 'en')]).toEqual([]);
    });
  }
});

describe('what a lesson says when a value is wrong', () => {
  const rules = LESSONS.flatMap((lesson) => lesson.steps.flatMap((step) => (step.fields ?? []).map((rule) => ({ lesson: lesson.id, step: step.id, rule }))));

  it('has a reason in both languages for every rule that names one, and none unused', () => {
    const ids = new Set(rules.flatMap(({ rule }) => (rule.why ? [rule.why] : [])));
    for (const id of ids) {
      expect(REASONS_RU[id], `ru ${id}`).toBeTruthy();
      expect(REASONS_EN[id], `en ${id}`).toBeTruthy();
    }
    expect(Object.keys(REASONS_RU).sort()).toEqual(Object.keys(REASONS_EN).sort());
    expect(Object.keys(REASONS_RU).filter((id) => !ids.has(id))).toEqual([]);
  });

  it('gives every number a rule wants a reason', () => {
    const silent = rules.filter(({ rule }) => (rule.test.kind === 'between' || (rule.test.kind === 'equals' && typeof rule.test.value === 'number')) && !rule.why);
    expect(silent.map(({ lesson, step, rule }) => `${lesson}/${step} ${rule.role}.${rule.field}`)).toEqual([]);
  });

  it('names every kind of file and every part of a lesson in both languages', () => {
    for (const kind of Object.keys(FILES)) {
      expect((en.lessons.fileKind as Record<string, string>)[kind], `en ${kind}`).toBeTruthy();
      expect((ru.lessons.fileKind as Record<string, string>)[kind], `ru ${kind}`).toBeTruthy();
    }
    for (const lesson of LESSONS) {
      for (const { role } of rolesOf(lesson)) {
        expect((en.lessons.role as Record<string, string>)[role], `en ${lesson.id} ${role}`).toBeTruthy();
        expect((ru.lessons.role as Record<string, string>)[role], `ru ${lesson.id} ${role}`).toBeTruthy();
      }
    }
  });
});
