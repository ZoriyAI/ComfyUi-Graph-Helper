import { afterEach, describe, expect, it } from 'vitest';
import { parsePreferences } from '../../src/shared/config/preferences';
import { builtinLessonDoc } from '../../src/shared/lessons/share/builtin';
import type { MyLesson } from '../../src/shared/lessons/share/mine';
import { useLessonStore } from '../../src/renderer/state/lessonState';
import { useMyLessonsStore } from '../../src/renderer/state/myLessonsState';
import { usePreferencesStore } from '../../src/renderer/state/preferencesState';

/**
 * After a restart the lesson that was open comes back (lessonState.hydrate). A built-in one is known at once; one
 * of My lessons (`my:` id) only after main has handed the list over, so hydrate reads My lessons first, and a
 * lesson for adults comes back only while the switch is on.
 */

function mine(adultMark: boolean): MyLesson {
  const doc = { ...builtinLessonDoc('image')!, id: 'my-picture' };
  return { id: 'my:my-picture', origin: 'file', savedAt: 0, adultMark, doc };
}

/** The bridge main gives the window, with only the call that lists My lessons. */
function bridge(lessons: MyLesson[]): { asked: number } {
  const calls = { asked: 0 };
  (globalThis as { window?: unknown }).window = {
    electronAPI: {
      listMyLessons: async () => {
        calls.asked += 1;
        return lessons;
      },
    },
  };
  return calls;
}

function fresh(adultOn: boolean): void {
  useLessonStore.setState({ learning: false, active: '', read: {}, done: [] });
  useMyLessonsStore.setState({ lessons: [], loaded: false, editing: null });
  usePreferencesStore.setState({ preferences: parsePreferences({ privacy: { showMarkedPreviews: adultOn } }) });
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe('the open lesson after a restart', () => {
  it('reopens a built-in lesson at once', () => {
    fresh(false);
    const calls = bridge([]);
    useLessonStore.getState().hydrate({ active: 'image', read: {}, done: [] });
    expect(calls.asked).toBe(0);
    expect(useLessonStore.getState().learning).toBe(true);
  });

  it('reopens one of My lessons once My lessons are read', async () => {
    fresh(false);
    const calls = bridge([mine(false)]);
    useLessonStore.getState().hydrate({ active: 'my:my-picture', read: {}, done: [] });
    expect(useLessonStore.getState().learning).toBe(false);
    await settle();
    expect(calls.asked).toBe(1);
    expect(useLessonStore.getState().learning).toBe(true);
    expect(useLessonStore.getState().active).toBe('my:my-picture');
  });

  it('keeps one of My lessons marked for adults closed while the switch is off, and opens it while it is on', async () => {
    fresh(false);
    bridge([mine(true)]);
    useLessonStore.getState().hydrate({ active: 'my:my-picture', read: {}, done: [] });
    await settle();
    expect(useLessonStore.getState().learning).toBe(false);

    fresh(true);
    bridge([mine(true)]);
    useLessonStore.getState().hydrate({ active: 'my:my-picture', read: {}, done: [] });
    await settle();
    expect(useLessonStore.getState().learning).toBe(true);
  });

  it('does not reopen a lesson that is gone from My lessons, nor one the person left meanwhile', async () => {
    fresh(false);
    bridge([]);
    useLessonStore.getState().hydrate({ active: 'my:my-picture', read: {}, done: [] });
    await settle();
    expect(useLessonStore.getState().learning).toBe(false);

    fresh(false);
    bridge([mine(false)]);
    useLessonStore.getState().hydrate({ active: 'my:my-picture', read: {}, done: [] });
    useLessonStore.setState({ active: '' });
    await settle();
    expect(useLessonStore.getState().learning).toBe(false);
  });
});
