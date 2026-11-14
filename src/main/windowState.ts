import * as fs from 'fs';
import * as path from 'path';

/**
 * Window bounds and maximized state, remembered in `<userData>/window-state.json`. Restoring checks the saved
 * rectangle against the displays connected now: a window saved on a monitor that is gone comes back on the
 * primary display, and a window larger than the work area is shrunk to fit.
 */

export interface Rect { x: number; y: number; width: number; height: number }

export interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  maximized: boolean;
}

export const WINDOW_STATE_FILE = 'window-state.json';
export const DEFAULT_WINDOW_SIZE = { width: 1400, height: 900 };
export const MIN_WINDOW_SIZE = { width: 800, height: 560 };
/** The window's own colour before the page paints: the night theme's --bg (src/renderer/theme/tokens.css). */
export const WINDOW_BACKGROUND = '#0a0e15';
/** How much of the window (title bar side) must stay on a display for its position to be kept. */
const VISIBLE_MARGIN = 64;

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** The saved file's content, or null when it is missing fields or nonsense. */
export function parseWindowState(value: unknown): WindowState | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (!finite(record.width) || !finite(record.height) || record.width <= 0 || record.height <= 0) return null;
  const state: WindowState = {
    width: Math.round(record.width),
    height: Math.round(record.height),
    maximized: record.maximized === true,
  };
  if (finite(record.x) && finite(record.y)) {
    state.x = Math.round(record.x);
    state.y = Math.round(record.y);
  }
  return state;
}

function overlap(a: Rect, b: Rect): { width: number; height: number } {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return { width: Math.max(0, width), height: Math.max(0, height) };
}

/**
 * Bounds to open with. `workAreas[0]` is the primary display. Size is clamped to [MIN, work area of the display
 * the window lands on]; the position is kept only when a strip of the window's top stays on some display.
 */
export function clampWindowState(saved: WindowState | null, workAreas: Rect[]): { bounds: Partial<Rect> & { width: number; height: number }; maximized: boolean } {
  const primary = workAreas[0] ?? { x: 0, y: 0, ...DEFAULT_WINDOW_SIZE };
  const fit = (size: { width: number; height: number }, area: Rect) => ({
    width: Math.max(Math.min(MIN_WINDOW_SIZE.width, area.width), Math.min(size.width, area.width)),
    height: Math.max(Math.min(MIN_WINDOW_SIZE.height, area.height), Math.min(size.height, area.height)),
  });
  // First launch: the default size, shrunk to a smaller screen (the window manager places it).
  if (!saved) return { bounds: fit(DEFAULT_WINDOW_SIZE, primary), maximized: false };
  if (saved.x !== undefined && saved.y !== undefined) {
    const titleStrip: Rect = { x: saved.x, y: saved.y, width: saved.width, height: Math.min(saved.height, VISIBLE_MARGIN) };
    const host = workAreas.find((area) => {
      const shared = overlap(titleStrip, area);
      return shared.width >= Math.min(VISIBLE_MARGIN, saved.width) && shared.height >= Math.min(24, titleStrip.height);
    });
    if (host) {
      const size = fit(saved, host);
      // Pull the window back inside the host's work area when it hangs off an edge.
      const x = Math.min(Math.max(saved.x, host.x), host.x + host.width - size.width);
      const y = Math.min(Math.max(saved.y, host.y), host.y + host.height - size.height);
      return { bounds: { x, y, ...size }, maximized: saved.maximized };
    }
  }
  return { bounds: fit(saved, primary), maximized: saved.maximized };
}

export function readWindowState(file: string): WindowState | null {
  try {
    return parseWindowState(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch {
    return null;
  }
}

export function writeWindowState(file: string, state: WindowState): void {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temp = `${file}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(state));
    fs.renameSync(temp, file);
  } catch {
    // A read-only profile folder: the next launch opens with defaults.
  }
}

/** The part of BrowserWindow the tracker uses (kept small so tests can fake it). */
export interface TrackedWindow {
  on(event: 'resize' | 'move' | 'maximize' | 'unmaximize' | 'close', listener: () => void): unknown;
  isDestroyed(): boolean;
  isMaximized(): boolean;
  isMinimized(): boolean;
  getNormalBounds(): Rect;
}

/** Saves the window's state after it stops moving (debounced) and once more when it closes. */
export function trackWindowState(win: TrackedWindow, file: string, debounceMs = 500, write = writeWindowState): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const snapshot = (): WindowState | null => {
    if (win.isDestroyed() || win.isMinimized()) return null;
    const bounds = win.getNormalBounds();
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, maximized: win.isMaximized() };
  };
  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    const state = snapshot();
    if (state) write(file, state);
  };
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, debounceMs);
  };
  for (const event of ['resize', 'move', 'maximize', 'unmaximize'] as const) win.on(event, schedule);
  win.on('close', flush);
  return () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
}
