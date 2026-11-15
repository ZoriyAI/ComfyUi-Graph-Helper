import { describe, expect, it } from 'vitest';
import { LESSONS, LESSON_AFTER, LESSON_PATH } from '../../src/shared/lessons/lessons';
import { lessonDependencies, lessonGroups } from '../../src/shared/lessons/navigation';

// Navigation groups existing lessons; it never gates them on completion of predecessors.
describe('lesson navigation', () => {
  it('groups all 66 lessons once, keeping registry order within each group', () => {
    const groups = lessonGroups();
    expect(LESSONS).toHaveLength(66);
    expect(groups.map(({ id, lessons }) => [id, lessons.length])).toEqual([
      ['foundations', 3], ['basics', 4], ['video', 15], ['wrapper', 10], ['images-models', 10], ['video-anchor', 4], ['packs-tools', 8], ['image-techniques', 12],
    ]);
    const all = groups.flatMap((group) => group.lessons);
    expect(all).toHaveLength(66);
    expect(new Set(all.map((lesson) => lesson.id)).size).toBe(66);
    for (const group of groups) {
      expect(group.title.en).toBeTruthy();
      expect(group.title.ru).toBeTruthy();
      expect(group.lessons).toEqual(LESSONS.filter((lesson) => LESSON_PATH[lesson.id].group.id === group.id));
    }
  });

  it('exposes all path and graph predecessors, once, including alternatives', () => {
    expect(lessonDependencies('image')).toEqual([]);
    expect(lessonDependencies('tags')).toEqual(['sdxl', 'prompt']);
    expect(lessonDependencies('gguf')).toEqual(['flux', 'zimage-turbo']);
    for (const lesson of LESSONS) {
      const dependencies = lessonDependencies(lesson.id);
      expect(dependencies).toEqual([...new Set([...(LESSON_PATH[lesson.id]?.follows ?? []), ...(LESSON_AFTER[lesson.id] ?? [])])]);
      expect(dependencies.every((id) => LESSONS.some((item) => item.id === id))).toBe(true);
    }
  });
});
