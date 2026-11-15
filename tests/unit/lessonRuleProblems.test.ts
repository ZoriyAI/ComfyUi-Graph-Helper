/**
 * A lesson file refused for breaking a rule of lessons (schema.ts) is told in the person's language: the problem
 * comes as a code with the names it is about, and the catalog has a sentence for every code in both languages
 * (lessons/lessonFiles.ts problemText). Before, an English sentence of the schema check sat inside the Russian
 * message.
 */
import { describe, expect, it } from 'vitest';
import i18next from 'i18next';
import { en, ru } from '../../src/shared/i18n/catalog';
import { LESSON_RULE_CODES, lessonRuleProblems } from '../../src/shared/lessons/schema';
import { builtinLessonDoc } from '../../src/shared/lessons/share/builtin';
import { LESSON_FILE_FORMAT, LESSON_FILE_VERSION, readLessonFile } from '../../src/shared/lessons/share/format';
import { problemText } from '../../src/renderer/components/lessons/lessonFiles';

/** A translator over the app's own catalog in one language. */
function translator(language: 'en' | 'ru') {
  const instance = i18next.createInstance();
  void instance.init({ lng: language, resources: { [language]: { translation: language === 'ru' ? ru : en } }, interpolation: { escapeValue: false } });
  return instance.t.bind(instance) as never;
}

describe('a rule of lessons broken in a file', () => {
  it('comes back as a code with the names it is about, not as a sentence', () => {
    const doc = { ...builtinLessonDoc('image')!, id: 'my-picture' };
    // A reason the app never wrote: a file may point at the app's reasons, never bring its own.
    const step = doc.steps.find((item) => (item.fields?.length ?? 0) > 0)!;
    const spec = step.fields![0];
    spec.why = 'myOwnSentence';
    const read = readLessonFile({ format: LESSON_FILE_FORMAT, version: LESSON_FILE_VERSION, lessons: [doc] });
    expect(read).toEqual({ ok: false, problem: { code: 'rules', lesson: 'my-picture', rule: { code: 'reason', step: step.id, field: spec.field, name: 'myOwnSentence' } } });
    if (read.ok) return;
    expect(problemText(translator('ru'), read.problem)).toBe(`В уроке «my-picture» шаг «${step.id}» ссылается на объяснение «myOwnSentence», которого в приложении нет.`);
    expect(problemText(translator('en'), read.problem)).toBe(`In lesson “my-picture”, step “${step.id}” points to an explanation “myOwnSentence” that this app does not have.`);
  });

  it('has a sentence for every code in both languages, with every name filled in and no English in the Russian one', () => {
    const names = { step: 'шаг-1', role: 'loader', field: 'steps', value: 80, name: 'other' };
    for (const code of LESSON_RULE_CODES) {
      const problem = { code: 'rules' as const, lesson: 'урок', rule: { code, ...names } };
      const russian = problemText(translator('ru'), problem);
      const english = problemText(translator('en'), problem);
      for (const text of [russian, english]) {
        expect(text, code).not.toMatch(/\{\{|lessonFiles\./);
        expect(text, code).toContain('урок');
      }
      // Only the names (and the formula of a frame count) may be Latin letters in the Russian sentence.
      const words = russian.replace(/«[^»]*»/g, '').replace(/4n \+ 1/g, '').match(/[A-Za-z]{2,}/g) ?? [];
      expect(words, code).toEqual([]);
    }
  });

  it('finds the codes the sentences are written for', () => {
    const problems = lessonRuleProblems({ id: 'x', steps: [{ id: 'a', read: true, roles: [{ role: 'r', classes: [] }] }, { id: 'b' }] }, [], { x: ['gone'] }, new Set());
    expect(problems.map((problem) => problem.code)).toEqual(['read-asks', 'role-no-class', 'asks-nothing', 'after']);
  });
});
