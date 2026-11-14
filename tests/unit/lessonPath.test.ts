import { describe, expect, it } from 'vitest';
import { LESSONS, isAdultLesson, nextLesson } from '../../src/shared/lessons/lessons';

/** The one rule for the lesson offered at the end of a lesson (lessons.ts nextLesson). */
describe('the next lesson', () => {
  const ordinary = LESSONS.filter((lesson) => !isAdultLesson(lesson.id)).map((lesson) => lesson.id);

  it('after the first picture offers the next lesson of its group', () => {
    expect(nextLesson('image', () => true, new Set(['image']))?.id).not.toBeUndefined();
    expect(isAdultLesson(nextLesson('image', () => true, new Set(['image']))!.id)).toBe(false);
  });

  it('never offers a lesson for adults after an ordinary one, nor an ordinary one after a lesson for adults', () => {
    const allOrdinaryDone = new Set(ordinary);
    for (const id of ordinary) expect(nextLesson(id, () => true, allOrdinaryDone)).toBeNull();
    const adult = LESSONS.filter((lesson) => isAdultLesson(lesson.id)).map((lesson) => lesson.id);
    for (const id of adult) {
      const next = nextLesson(id, () => true, new Set([id]));
      if (next) expect(isAdultLesson(next.id)).toBe(true);
    }
  });

  it('skips what does not fit or is done, and prefers a lesson whose lessons are done', () => {
    expect(nextLesson('image', () => false, new Set(['image']))).toBeNull();
    const only = ordinary.find((id) => id !== 'image')!;
    expect(nextLesson('image', (id) => id === only, new Set(['image']))?.id).toBe(only);
    expect(nextLesson('image', (id) => id === only, new Set(['image', only]))).toBeNull();
  });
});
