/**
 * The programme of the lessons (shared/lessons/programme.ts and navigation.ts): every lesson has a level, at least one
 * track and a priority; the list by level holds every lesson once; the path of a track is in an order where every
 * lesson comes after the lessons it leans on (so the dependencies have no cycle); the next lesson offered steps up one
 * level at a time when it can. A person who picks a track must get an order they can follow.
 */
import { describe, expect, it } from 'vitest';
import { LESSONS, isAdultLesson, nextLesson } from '../../src/shared/lessons/lessons';
import { lessonDependencies, lessonLevels, trackLessons, trackPath } from '../../src/shared/lessons/navigation';
import { LESSON_PROGRAMME, LESSON_TRACKS, levelOf } from '../../src/shared/lessons/programme';
import { en, ru } from '../../src/shared/i18n/catalog';
import { trackKey } from '../../src/renderer/components/lessons/LessonViews';

describe('the place of every lesson in the programme', () => {
  it('gives every lesson a level from 0 to 5, a track and a priority, and names no lesson that does not exist', () => {
    for (const lesson of LESSONS) {
      const place = LESSON_PROGRAMME[lesson.id];
      expect(place, lesson.id).toBeTruthy();
      expect(place.level, lesson.id).toBeGreaterThanOrEqual(0);
      expect(place.level, lesson.id).toBeLessThanOrEqual(5);
      expect(place.tracks.length, lesson.id).toBeGreaterThan(0);
      expect(new Set(place.tracks).size, lesson.id).toBe(place.tracks.length);
    }
    expect(Object.keys(LESSON_PROGRAMME).filter((id) => !LESSONS.some((lesson) => lesson.id === id))).toEqual([]);
  });

  it('keeps the basics of the audit at level 1 and the recipes of a model or a medium above them', () => {
    for (const id of ['comfy-basics', 'image', 'prompt', 'sampler-fields']) expect(levelOf(id), id).toBe(1);
    for (const id of ['one-factor', 'blind-compare', 'vram', 'samplers', 'loaders']) expect(levelOf(id), id).toBe(2);
    for (const id of ['video-text', 'wrapper', 'flux', 'audio-music', '3d-image']) expect(levelOf(id), id).toBe(3);
    // A lesson never stands below a lesson it leans on.
    for (const lesson of LESSONS) {
      for (const before of lessonDependencies(lesson.id)) expect(levelOf(before), `${before} before ${lesson.id}`).toBeLessThanOrEqual(levelOf(lesson.id));
    }
  });

  it('lists every lesson once by level, and names every level and track in both languages', () => {
    const levels = lessonLevels();
    expect(levels.flatMap((row) => row.lessons).length).toBe(LESSONS.length);
    expect(levels.map((row) => row.level)).toEqual([...levels.map((row) => row.level)].sort());
    for (const level of [0, 1, 2, 3, 4, 5] as const) {
      expect(en.lessons.level[level], `en level ${level}`).toBeTruthy();
      expect(ru.lessons.level[level], `ru level ${level}`).toBeTruthy();
    }
    for (const track of LESSON_TRACKS) {
      expect((en.lessons.track as Record<string, string>)[trackKey(track)], `en ${track}`).toBeTruthy();
      expect((ru.lessons.track as Record<string, string>)[trackKey(track)], `ru ${track}`).toBeTruthy();
    }
  });
});

describe('the path of a track', () => {
  for (const track of LESSON_TRACKS) {
    it(`${track}: every lesson after the lessons it leans on, each once, the track's own lessons all there`, () => {
      const path = trackPath(track).map((lesson) => lesson.id);
      expect(new Set(path).size).toBe(path.length);
      for (const lesson of trackLessons(track)) if (!isAdultLesson(lesson.id)) expect(path, lesson.id).toContain(lesson.id);
      path.forEach((id, index) => {
        for (const before of lessonDependencies(id)) {
          if (isAdultLesson(before)) continue;
          // Every lesson it leans on is on the path, before it: no cycle, nothing out of order.
          expect(path.indexOf(before), `${before} before ${id} on ${track}`).toBeGreaterThanOrEqual(0);
          expect(path.indexOf(before), `${before} before ${id} on ${track}`).toBeLessThan(index);
        }
      });
      // Lessons for adults stay off a path while the switch is off.
      expect(path.some(isAdultLesson)).toBe(false);
    });
  }

  it('puts the experiments after the first picture and its sampler, and lists the lessons for adults only when they are open', () => {
    const base = trackPath('base').map((lesson) => lesson.id);
    expect(base.indexOf('image')).toBeLessThan(base.indexOf('one-factor'));
    expect(base.indexOf('sampler-fields')).toBeLessThan(base.indexOf('one-factor'));
    expect(base.indexOf('one-factor')).toBeLessThan(base.indexOf('blind-compare'));
    expect(trackPath('image', true).some((lesson) => lesson.id === 'adult-image')).toBe(true);
  });

  it('is empty for a track whose lessons are not written yet, and says nothing it cannot keep', () => {
    expect(trackPath('nodes')).toEqual([]);
    expect(trackPath('projects')).toEqual([]);
  });
});

describe('the next lesson and the levels', () => {
  it('steps up one level at a time when a lesson of the next level is ready', () => {
    // After the first lessons of the basics the next lesson stays near their level.
    for (const lesson of LESSONS) {
      if (isAdultLesson(lesson.id)) continue;
      const next = nextLesson(lesson.id, () => true, new Set(LESSONS.slice(0, LESSONS.indexOf(lesson) + 1).map((item) => item.id)));
      if (!next) continue;
      const later = LESSONS.slice(LESSONS.indexOf(lesson) + 1).filter((item) => !isAdultLesson(item.id));
      // A farther lesson is offered only when no lesson within one level is left later in the list.
      if (levelOf(next.id) > levelOf(lesson.id) + 1) expect(later.some((item) => levelOf(item.id) <= levelOf(lesson.id) + 1), `${lesson.id} → ${next.id}`).toBe(false);
    }
    expect(nextLesson('image')?.id).toBe('prompt');
  });
});
