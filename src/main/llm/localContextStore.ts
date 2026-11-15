/**
 * The context window a local server was seen to load a model with, kept between runs of the app: the first turn
 * after a restart then already fits a small window instead of finding it out the hard way again. One row per
 * server and model in the small key-value table next to the sync state; never a secret, only a number.
 * Read and written by agent/turn.ts around each local turn.
 */
import type Database from 'better-sqlite3';
import { originOf } from '../trace/modelTrace';

/** The sync_state key of a server and model; only the origin counts, so /v1 or not names the same server. */
function keyOf(baseURL: string | undefined, model: string): string | null {
  const origin = originOf(baseURL);
  const name = model.trim();
  return origin && name ? `local-context:${origin}|${name}` : null;
}

/** The window last seen for this server and model, or null when none is stored (256 tokens is the sane minimum). */
export function readStoredWindow(db: Database.Database, baseURL: string | undefined, model: string): number | null {
  const key = keyOf(baseURL, model);
  if (!key) return null;
  try {
    const row = db.prepare('SELECT value FROM sync_state WHERE key = ?').get(key) as { value: string } | undefined;
    const tokens = Number(row?.value);
    return Number.isFinite(tokens) && tokens >= 256 ? Math.floor(tokens) : null;
  } catch {
    return null;
  }
}

/** Remembers the window seen for this server and model. Never throws. */
export function writeStoredWindow(db: Database.Database, baseURL: string | undefined, model: string, tokens: number): void {
  const key = keyOf(baseURL, model);
  if (!key || !Number.isFinite(tokens) || tokens < 256) return;
  try {
    db.prepare('INSERT INTO sync_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, String(Math.floor(tokens)));
  } catch {
    // A read-only or missing table only costs the next run one turn to find the window again.
  }
}
