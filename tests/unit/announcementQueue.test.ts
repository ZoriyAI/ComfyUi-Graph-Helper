import { afterEach, describe, expect, it, vi } from 'vitest';
import { announcementQueue } from '../../src/renderer/a11y/announcementQueue';

describe('build progress announcements', () => {
  afterEach(() => vi.useRealTimers());
  it('coalesces rapid progress, announces pause immediately and cancels stale speech on disposal', () => {
    vi.useFakeTimers(); const say = vi.fn(); const queue = announcementQueue(say);
    queue.update('Starting', true);
    for (let step = 1; step <= 20; step += 1) queue.update(`Step ${step}`);
    vi.advanceTimersByTime(1499); expect(say.mock.calls).toEqual([['Starting']]);
    vi.advanceTimersByTime(1); expect(say).toHaveBeenLastCalledWith('Step 20');
    queue.update('Step 21'); queue.update('Paused', true);
    vi.advanceTimersByTime(1500); expect(say.mock.calls).toEqual([['Starting'], ['Step 20'], ['Paused']]);
    queue.update('Step 22'); queue.dispose(); vi.advanceTimersByTime(2000);
    expect(say).toHaveBeenLastCalledWith('Paused');
  });
});
