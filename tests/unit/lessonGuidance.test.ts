/**
 * The wording of the adult lessons and of docs/wiki/trust/Content-Rules: in both languages they state 18+, consent
 * and the law, and that the rules are the app's own whatever a model answers. The teaching text supplies guidance; it
 * does not advertise an application topic filter, so no lesson may claim the app "never helps" with something. A
 * person reads these rules as the app's promise, so lessons and wiki must say the same.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LESSONS } from '../../src/shared/lessons/lessons';
import { lessonWords } from '../../src/shared/lessons/texts';

describe('subject-neutral lesson guidance', () => {
  it.each(['en', 'ru'] as const)('keeps adult teaching factual and consent/law guidance explicit in %s', (language) => {
    const words = lessonWords(language, 'adult')!;
    expect(words.steps.rules.body).toContain('18+');
    expect(words.steps.rules.body).toMatch(language === 'en' ? /consent/i : /соглас/i);
    expect(words.steps.rules.body).toMatch(language === 'en' ? /law/i : /закон/i);
    expect(words.steps.helper.body).toMatch(language === 'en' ? /Privacy/ : /Приватность/);
    // The three adult lessons end alike: the rules at their start are the app's own, whatever a model answers.
    const own = language === 'en'
      ? 'The rules at the start of this lesson are the app\'s own and hold whatever a model answers.'
      : 'Правила в начале урока: это правила самого приложения, и они действуют, что бы ни ответила модель.';
    for (const id of ['adult', 'adult-image', 'adult-lora']) expect(lessonWords(language, id)!.steps.helper.body, id).toContain(own);
    const suffix = language === 'ru' ? '.ru' : '';
    const guidance = readFileSync(`docs/wiki/trust/Content-Rules${suffix}.md`, 'utf8');
    expect(guidance).toContain('18+');
    expect(guidance).toMatch(language === 'en' ? /consent/i : /соглас/i);
    expect(guidance).toMatch(language === 'en' ? /law/i : /закон/i);
    expect(guidance).not.toMatch(/never help|приложение не помогает/i);
    for (const lesson of LESSONS) {
      const text = JSON.stringify(lessonWords(language, lesson.id));
      expect(text, lesson.id).not.toMatch(/app (?:does not|never) help|never a real person in explicit|приложение не помогает|не помогает никогда|никаких реальных людей в откровенном/i);
    }
  });
});
