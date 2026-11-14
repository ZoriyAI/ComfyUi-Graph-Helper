import type { Lesson } from './engine';
import { LESSONS, LESSON_AFTER, LESSON_PATH } from './lessons';
import type { LessonGroup } from './sets/image-models';

/** Both conceptual predecessors and graphs a lesson continues. Hints only, never completion gates. */
export function lessonDependencies(id: string): string[] {
  return [...new Set([...(LESSON_PATH[id]?.follows ?? []), ...(LESSON_AFTER[id] ?? [])])];
}

/** Group the registry without reordering lessons within a group or filtering by the person's progress. */
export function lessonGroups(): Array<LessonGroup & { lessons: Lesson[] }> {
  const groups = new Map<string, LessonGroup & { lessons: Lesson[] }>();
  for (const lesson of LESSONS) {
    const { group } = LESSON_PATH[lesson.id];
    if (!groups.has(group.id)) groups.set(group.id, { ...group, lessons: [] });
    groups.get(group.id)!.lessons.push(lesson);
  }
  return [...groups.values()];
}
