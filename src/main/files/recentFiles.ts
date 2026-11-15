import * as fs from 'fs';
import * as path from 'path';
import { writeFileAtomic } from './atomicWrite';

/**
 * The files a person opened or saved lately, and the name of the file each graph came from.
 *
 * Who uses it: File ▸ Recent and the welcome card's recent list (renderer, through main/ipc/openIpc.ts), and the
 * project name in the app bar, which falls back to the file a workflow was opened from when the graph has no title.
 * Why a small file in the profile folder and not the database: it is a convenience list the person can lose without
 * harm, it needs no migration, and it is written whole (atomicWrite) so a crash never leaves half of it.
 * Only paths and times are kept, never file contents.
 */

/** One remembered file. `kind` says how it opens: as a project of this app or as a ComfyUI workflow. */
export interface RecentFile {
  path: string;
  kind: 'project' | 'workflow';
  at: number;
}

interface Store {
  recent: RecentFile[];
  /** graph key → name of the workflow file that graph was opened from. */
  sources: Record<string, string>;
}

/** How many files File ▸ Recent lists: enough for a week's work, short enough to read at a glance. */
export const RECENT_MAX = 10;
const SOURCES_MAX = 200;
const FILE_NAME = 'recent-files.json';

function storePath(userData: string): string {
  return path.join(userData, FILE_NAME);
}

function read(userData: string): Store {
  try {
    const parsed = JSON.parse(fs.readFileSync(storePath(userData), 'utf8')) as Partial<Store>;
    const recent = Array.isArray(parsed.recent)
      ? parsed.recent.filter((item): item is RecentFile => !!item && typeof item.path === 'string' && (item.kind === 'project' || item.kind === 'workflow') && typeof item.at === 'number')
      : [];
    const sources = parsed.sources && typeof parsed.sources === 'object' ? Object.fromEntries(Object.entries(parsed.sources).filter(([, value]) => typeof value === 'string')) as Record<string, string> : {};
    return { recent, sources };
  } catch {
    return { recent: [], sources: {} };
  }
}

function write(userData: string, store: Store): void {
  try {
    writeFileAtomic(storePath(userData), JSON.stringify(store, null, 2), { mode: 0o600 });
  } catch {
    // The list is a convenience: a full disk must not stop the open or the save that called this.
  }
}

/** The list, newest first, without files that are gone from the disk. */
export function recentFiles(userData: string): RecentFile[] {
  return read(userData).recent.filter((item) => fs.existsSync(item.path));
}

/** Puts a file at the top of the list (once). */
export function rememberRecent(userData: string, filePath: string, kind: RecentFile['kind'], now = Date.now()): void {
  const store = read(userData);
  const absolute = path.resolve(filePath);
  store.recent = [{ path: absolute, kind, at: now }, ...store.recent.filter((item) => item.path !== absolute)].slice(0, RECENT_MAX);
  write(userData, store);
}

/** Whether a path is on the list: File ▸ Recent opens only what the list holds. */
export function isRecent(userData: string, filePath: string): RecentFile | null {
  return read(userData).recent.find((item) => item.path === path.resolve(filePath)) ?? null;
}

/** Remembers the workflow file a graph was opened from, so the app bar can name the graph after it. */
export function rememberSource(userData: string, graphKey: string, fileName: string): void {
  if (!graphKey) return;
  const store = read(userData);
  const entries = Object.entries({ ...store.sources, [graphKey]: fileName });
  store.sources = Object.fromEntries(entries.slice(-SOURCES_MAX));
  write(userData, store);
}

/** The file name a graph was opened from, or null. */
export function sourceOf(userData: string, graphKey: string): string | null {
  return graphKey ? read(userData).sources[graphKey] ?? null : null;
}
