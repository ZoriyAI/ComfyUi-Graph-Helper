/**
 * Checks the typing state of a number field (numberEditStep, used by FieldControl's NumberControl): Enter commits
 * once and the blur after it does not commit again; typing after Enter is an edit again, so a value arriving from
 * elsewhere does not overwrite what the person types.
 */
import { describe, expect, it } from 'vitest';
import { NUMBER_EDIT_IDLE, numberEditStep, type NumberEdit } from '../../src/renderer/components/fields/fieldModel';

/** Runs the events in order and returns the end state and which steps committed. */
function run(events: Array<Parameters<typeof numberEditStep>[1]>): { state: NumberEdit; commits: boolean[] } {
  let state = NUMBER_EDIT_IDLE;
  const commits: boolean[] = [];
  for (const event of events) {
    const next = numberEditStep(state, event);
    state = next.state;
    commits.push(next.commit);
  }
  return { state, commits };
}

describe('number field typing', () => {
  it('commits once for Enter followed by blur', () => {
    expect(run(['focus', 'type', 'commit', 'commit']).commits).toEqual([false, false, true, false]);
  });

  it('is editing again when the person types after Enter, and commits that change', () => {
    const afterEnter = run(['focus', 'type', 'commit']);
    expect(afterEnter.state.editing).toBe(false);
    const typing = run(['focus', 'type', 'commit', 'type']);
    expect(typing.state).toEqual({ editing: true, dirty: true });
    expect(run(['focus', 'type', 'commit', 'type', 'commit']).commits).toEqual([false, false, true, false, true]);
  });

  it('commits nothing for a visit without typing or after Escape', () => {
    expect(run(['focus', 'commit']).commits).toEqual([false, false]);
    expect(run(['focus', 'type', 'cancel', 'commit']).commits).toEqual([false, false, false, false]);
  });
});
