import { describe, expect, it } from 'vitest';
import type { Lesson } from '../../src/shared/lessons/engine';
import { LESSONS, LESSON_AFTER } from '../../src/shared/lessons/lessons';
import { REASONS_EN } from '../../src/shared/lessons/reasons.en';
import { REASONS_RU } from '../../src/shared/lessons/reasons.ru';
import { lessonProblems } from '../../src/shared/lessons/schema';

const reasons = new Set(Object.keys(REASONS_RU).filter((id) => id in REASONS_EN));

describe('every lesson is built the way the engine reads it', () => {
  it('has no problems', () => {
    expect(LESSONS.flatMap((lesson) => lessonProblems(lesson, LESSONS, LESSON_AFTER, reasons))).toEqual([]);
  });

  it('names the problems an author makes', () => {
    const broken: Lesson = {
      id: 'Broken',
      steps: [
        { id: 'a', read: true, roles: [{ role: 'x', classes: ['KSampler'] }] },
        { id: 'a', links: [{ from: 'x', output: 'LATENT', to: 'y', input: 'samples' }] },
        { id: 'c', fields: [{ role: 'x', field: 'length', test: { kind: 'between', min: 49, max: 121, prefer: 80, frames: true }, why: 'nowhere' }] },
        { id: 'd' },
      ],
    };
    expect(lessonProblems(broken, [broken], { Broken: ['missing'] }, reasons)).toEqual([
      'Broken: the id is lower case letters, digits and dashes',
      'Broken: "a" is a step to read and also asks for nodes, links or fields',
      'Broken: the step id "a" is used twice',
      'Broken: "a": the link names the role "y" before any step brings it',
      'Broken: "c": the frame count 80 is not 4n + 1',
      'Broken: "c": the reason "nowhere" is not written',
      'Broken: "d" asks for nothing: mark it as a step to read',
      'Broken: it goes on from "missing", which is not a lesson',
    ]);
  });
});
