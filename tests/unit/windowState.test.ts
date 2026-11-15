/**
 * Protects the saved size and place of the main window (window-state.json in the profile). A person gets the
 * window back where they left it, but never off screen after a display was unplugged, never smaller than the
 * minimum, and never larger than a small first screen. Saves wait for a pause so dragging does not write constantly.
 */
import { describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  clampWindowState, DEFAULT_WINDOW_SIZE, MIN_WINDOW_SIZE, parseWindowState, readWindowState, trackWindowState, writeWindowState,
  type TrackedWindow,
} from '../../src/main/windowState';

const primary = { x: 0, y: 0, width: 1920, height: 1040 };
const right = { x: 1920, y: 0, width: 2560, height: 1400 };

describe('window state', () => {
  it('parses only sane files', () => {
    expect(parseWindowState(null)).toBeNull();
    expect(parseWindowState({ width: 'big', height: 3 })).toBeNull();
    expect(parseWindowState({ width: -5, height: 300 })).toBeNull();
    expect(parseWindowState({ width: 1200.4, height: 800, x: 10, y: 20, maximized: true })).toEqual({ width: 1200, height: 800, x: 10, y: 20, maximized: true });
    expect(parseWindowState({ width: 1200, height: 800, x: Number.NaN })).toEqual({ width: 1200, height: 800, maximized: false });
  });

  it('opens with the default size the first time', () => {
    expect(clampWindowState(null, [primary])).toEqual({ bounds: DEFAULT_WINDOW_SIZE, maximized: false });
  });

  it('opens no larger than a small screen the first time', () => {
    const laptop = { x: 0, y: 0, width: 1366, height: 740 };
    expect(clampWindowState(null, [laptop])).toEqual({ bounds: { width: 1366, height: 740 }, maximized: false });
    const tiny = { x: 0, y: 0, width: 700, height: 500 };
    expect(clampWindowState(null, [tiny])).toEqual({ bounds: { width: 700, height: 500 }, maximized: false });
  });

  it('keeps a window that is on a connected display', () => {
    expect(clampWindowState({ x: 2000, y: 100, width: 1600, height: 1000, maximized: true }, [primary, right]))
      .toEqual({ bounds: { x: 2000, y: 100, width: 1600, height: 1000 }, maximized: true });
  });

  it('moves a window from a display that is gone to the primary display', () => {
    const result = clampWindowState({ x: 2000, y: 100, width: 2400, height: 1300, maximized: false }, [primary]);
    expect(result.bounds.x).toBeUndefined();
    expect(result.bounds.width).toBe(1920);
    expect(result.bounds.height).toBe(1040);
  });

  it('pulls a window hanging off an edge back inside and enforces the minimum size', () => {
    const result = clampWindowState({ x: 1800, y: -20, width: 300, height: 200, maximized: false }, [primary]);
    expect(result.bounds.width).toBe(MIN_WINDOW_SIZE.width);
    expect(result.bounds.height).toBe(MIN_WINDOW_SIZE.height);
    expect(result.bounds.x).toBe(1920 - MIN_WINDOW_SIZE.width);
    expect(result.bounds.y).toBe(0);
  });

  it('writes, reads, and saves debounced with the normal bounds', () => {
    vi.useFakeTimers();
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'win-state-')), 'window-state.json');
    const listeners = new Map<string, () => void>();
    let maximized = false;
    const win: TrackedWindow = {
      on: (event, listener) => listeners.set(event, listener),
      isDestroyed: () => false,
      isMaximized: () => maximized,
      isMinimized: () => false,
      getNormalBounds: () => ({ x: 5, y: 6, width: 1000, height: 700 }),
    };
    const writes: unknown[] = [];
    trackWindowState(win, file, 500, (target, state) => {
      writes.push(state);
      writeWindowState(target, state);
    });
    listeners.get('resize')!();
    listeners.get('move')!();
    // Resize and move fold into one write after the 500 ms pause; close writes at once, maximized state included.
    expect(writes).toHaveLength(0);
    vi.advanceTimersByTime(500);
    expect(writes).toHaveLength(1);
    maximized = true;
    listeners.get('maximize')!();
    listeners.get('close')!();
    expect(writes).toHaveLength(2);
    expect(readWindowState(file)).toEqual({ x: 5, y: 6, width: 1000, height: 700, maximized: true });
    vi.useRealTimers();
  });
});
