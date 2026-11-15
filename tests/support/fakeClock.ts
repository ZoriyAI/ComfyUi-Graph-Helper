/**
 * A clock that moves only when the code under test sleeps. A request then takes no time at all, so a pause the
 * code computes from "the time since the last request" is exactly the pause it asks for, however busy the machine.
 * Used by modelWebSync.test.ts (integration) and modelWebLookup.test.ts (unit) to check the pacing of web lookups.
 */
/** Returns the clock pair; every sleep is pushed into `sleeps` so a test can read the pauses it took. */
export function steppingClock(sleeps: number[] = [], start = 1_000_000): { now: () => number; sleep: (ms: number) => Promise<void> } {
  let time = start;
  return {
    now: () => time,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      time += ms;
    },
  };
}
