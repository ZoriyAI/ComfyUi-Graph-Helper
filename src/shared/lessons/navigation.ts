/**
 * How the lesson list is laid out: lessons in their groups, by level, by track, the recommended path of one track,
 * and the lessons each one leans on. The lesson panel (renderer/components/lessons/LessonPanel.tsx and LessonViews.tsx)
 * draws the list from these. Order and groups come from the registry in lessons.ts and the programme table in
 * programme.ts, never from progress: an unfinished earlier lesson is a hint, not a lock.
 */
import type { Lesson } from './engine';
import { LESSONS, LESSON_AFTER, LESSON_PATH, isAdultLesson } from './lessons';
import { LESSON_LEVELS, LESSON_PROGRAMME, levelOf, type LessonLevel, type LessonTrack } from './programme';
import type { LessonGroup } from './sets/image-models';

/** The place of each lesson in the registry, for ties of the orders below. */
const ORDER = new Map(LESSONS.map((lesson, index) => [lesson.id, index]));

/**
 * The lessons a lesson leans on: conceptual predecessors, graphs it continues, and the prerequisites its metadata
 * names, lowest level first (the registry order between lessons of one level). Hints only, never completion gates.
 */
export function lessonDependencies(id: string): string[] {
  const lesson = LESSONS.find((item) => item.id === id);
  const all = [...new Set([...(LESSON_PATH[id]?.follows ?? []), ...(LESSON_AFTER[id] ?? []), ...(lesson?.meta?.prerequisites ?? [])])];
  return all
    .map((item, index) => ({ item, index }))
    .sort((a, b) => levelOf(a.item) - levelOf(b.item) || a.index - b.index)
    .map(({ item }) => item);
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

/** The lessons of each level that has any, levels in order and lessons in registry order. */
export function lessonLevels(): Array<{ level: LessonLevel; lessons: Lesson[] }> {
  return LESSON_LEVELS
    .map((level) => ({ level, lessons: LESSONS.filter((lesson) => levelOf(lesson.id) === level) }))
    .filter((row) => row.lessons.length > 0);
}

/** The lessons of a track, lowest level first. */
export function trackLessons(track: LessonTrack): Lesson[] {
  return LESSONS
    .filter((lesson) => LESSON_PROGRAMME[lesson.id]?.tracks.includes(track))
    .sort((a, b) => levelOf(a.id) - levelOf(b.id) || ORDER.get(a.id)! - ORDER.get(b.id)!);
}

/**
 * The recommended order of a track: its lessons and every lesson they lean on (transitively), each after the lessons
 * it leans on, and among those that are ready the lowest level first, then the registry order. Lessons for adults are
 * on a path only when `adultOn`. A cycle (none exists; a test holds it) would end the walk, never loop.
 */
export function trackPath(track: LessonTrack, adultOn = false): Lesson[] {
  const keep = (id: string) => ORDER.has(id) && (adultOn || !isAdultLesson(id));
  const wanted = new Set<string>();
  const add = (id: string) => {
    if (wanted.has(id) || !keep(id)) return;
    wanted.add(id);
    for (const before of lessonDependencies(id)) add(before);
  };
  for (const lesson of trackLessons(track)) add(lesson.id);
  const out: string[] = [];
  const placed = new Set<string>();
  while (out.length < wanted.size) {
    const ready = [...wanted]
      .filter((id) => !placed.has(id) && lessonDependencies(id).every((before) => placed.has(before) || !wanted.has(before)))
      .sort((a, b) => levelOf(a) - levelOf(b) || ORDER.get(a)! - ORDER.get(b)!);
    if (ready.length === 0) break;
    placed.add(ready[0]);
    out.push(ready[0]);
  }
  return out.map((id) => LESSONS.find((lesson) => lesson.id === id)!);
}
