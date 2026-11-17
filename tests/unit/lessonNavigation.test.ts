/**
 * Lesson navigation (shared/lessons/navigation.ts, the groups and "comes after" lists of LessonPanel): every lesson is
 * in exactly one group, in registry order, and its predecessors are listed once, lowest level first. Navigation
 * groups existing lessons; it never gates them on completion of predecessors, so a person can open any lesson. The
 * counts come from the registry: a new lesson changes the group sizes below on purpose, never a total written here.
 */
import { describe, expect, it } from 'vitest';
import { LESSONS, LESSON_AFTER, LESSON_PATH } from '../../src/shared/lessons/lessons';
import { lessonDependencies, lessonGroups } from '../../src/shared/lessons/navigation';
import { levelOf } from '../../src/shared/lessons/programme';

describe('lesson navigation', () => {
  it('groups every lesson once, keeping registry order within each group', () => {
    const groups = lessonGroups();
    expect(groups.map(({ id, lessons }) => [id, lessons.length])).toEqual([
      ['environment', 5], ['foundations', 3], ['basics', 4], ['video', 14], ['wrapper', 10], ['images-models', 10], ['video-anchor', 4], ['packs-tools', 8], ['image-techniques', 12],
      ['sound-speech', 5], ['3d', 1], ['faces-characters', 5], ['experiments', 3], ['diagnostics', 3], ['daily-cycle', 5], ['adult', 3],
    ]);
    const all = groups.flatMap((group) => group.lessons);
    expect(all).toHaveLength(LESSONS.length);
    expect(new Set(all.map((lesson) => lesson.id)).size).toBe(LESSONS.length);
    for (const group of groups) {
      expect(group.title.en).toBeTruthy();
      expect(group.title.ru).toBeTruthy();
      expect(group.lessons).toEqual(LESSONS.filter((lesson) => LESSON_PATH[lesson.id].group.id === group.id));
    }
  });

  it('exposes all path, graph and metadata predecessors, once, lowest level first', () => {
    expect(lessonDependencies('image')).toEqual(['comfy-basics']);
    // prompt (level 1) before sdxl (level 3), whatever order the registry names them in.
    expect(lessonDependencies('tags')).toEqual(['prompt', 'sdxl']);
    expect(lessonDependencies('gguf')).toEqual(['flux', 'zimage-turbo']);
    expect(lessonDependencies('one-factor')).toEqual(['sampler-fields', 'image']);
    for (const lesson of LESSONS) {
      const dependencies = lessonDependencies(lesson.id);
      const expected = new Set([...(LESSON_PATH[lesson.id]?.follows ?? []), ...(LESSON_AFTER[lesson.id] ?? []), ...(lesson.meta?.prerequisites ?? [])]);
      expect(new Set(dependencies)).toEqual(expected);
      expect(dependencies).toHaveLength(expected.size);
      expect(dependencies.every((id) => LESSONS.some((item) => item.id === id))).toBe(true);
      expect(dependencies.map(levelOf)).toEqual([...dependencies.map(levelOf)].sort((a, b) => a - b));
    }
  });
});
