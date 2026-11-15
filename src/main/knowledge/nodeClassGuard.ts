import { isEditorNodeType } from '../../shared/graph/editorNodes';
import type Database from 'better-sqlite3';
import { SEEDED_NODE_TYPES } from '../catalog/repository';
import { hasBuiltinPorts } from '../../shared/graph/ports';
import type { NodeClassVerdict } from '../../shared/contracts/knowledge';
import { searchNodeClasses } from './repository';

export const SUGGESTION_LIMIT = 5;
export const CATALOG_NOT_SYNCED = 'catalog not synced; ports unknown';

/**
 * The catalog counts as synced once it knows more than the seeded classes: a sync stamped some rows, or an
 * object_info snapshot added classes. Before that an unknown class is allowed, because the catalog cannot tell.
 */
export function catalogSynced(db: Database.Database): boolean {
  const row = db.prepare('SELECT COUNT(*) AS n, SUM(CASE WHEN synced_at IS NOT NULL THEN 1 ELSE 0 END) AS synced FROM node_catalog').get() as
    { n: number; synced: number | null };
  return (row.synced ?? 0) > 0 || row.n > SEEDED_NODE_TYPES.length;
}

/** Optimal string alignment distance (Damerau–Levenshtein with adjacent swaps), case-insensitive. */
export function editDistance(left: string, right: string): number {
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** How close a class name is to what was asked: the whole name, or its start (a typo in a longer class). */
function closeness(query: string, classType: string): number {
  const whole = editDistance(query, classType);
  const prefix = classType.length > query.length ? editDistance(query, classType.slice(0, query.length)) + 0.5 : Infinity;
  return Math.min(whole, prefix);
}

/**
 * Up to `limit` installed class names nearest to an unknown one: close spellings first (typos, swapped
 * letters, a longer class that starts the same), then what searchNodeClasses finds for the name's words.
 */
export function nearestNodeClasses(db: Database.Database, classType: string, limit = SUGGESTION_LIMIT): string[] {
  const query = classType.trim().slice(0, 200);
  if (!query) return [];
  const all = (db.prepare('SELECT class_type FROM node_catalog').pluck().all() as string[]);
  const budget = Math.max(2, Math.floor(query.length / 3));
  const close = all
    .map((name) => ({ name, score: closeness(query, name) }))
    .filter((item) => item.score <= budget)
    .sort((left, right) => left.score - right.score || left.name.length - right.name.length || left.name.localeCompare(right.name))
    .map((item) => item.name);
  const words = query.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_\-.]+/g, ' ');
  const searched = [
    ...searchNodeClasses(db, { query, limit: limit * 2 }),
    ...searchNodeClasses(db, { query: words, limit: limit * 2 }),
  ].map((item) => item.classType);
  return [...new Set([...close, ...searched])].filter((name) => name !== classType).slice(0, limit);
}

/** Whether the app knows this class's ports: object_info (or a sync) stored them, or the app ships them. */
function portsKnown(db: Database.Database, classType: string): boolean {
  if (hasBuiltinPorts(classType)) return true;
  const row = db.prepare('SELECT inputs_json, outputs_json, synced_at FROM node_catalog WHERE class_type = ?').get(classType) as
    { inputs_json: string | null; outputs_json: string | null; synced_at: number | null } | undefined;
  if (!row) return false;
  const filled = (value: string | null) => Boolean(value) && value !== '[]';
  return filled(row.inputs_json) || filled(row.outputs_json) || row.synced_at !== null;
}

/**
 * The guard before a node class is added (agent addNode/proposeNode, the add-node search):
 * - known class: allowed; `portsKnown` says whether the canvas has its ports;
 * - unknown class with a synced catalog: refused, with the nearest class names;
 * - unknown class before any sync: allowed with a warning, since the catalog cannot tell.
 */
export function validateNodeClass(db: Database.Database, classType: string): NodeClassVerdict {
  // Note, Reroute and Primitive live only in ComfyUI's editor: no catalog lists them, yet ComfyUI opens them.
  if (isEditorNodeType(classType)) return { ok: true, known: true, portsKnown: true };
  const known = db.prepare('SELECT 1 FROM node_catalog WHERE class_type = ?').get(classType) !== undefined;
  if (known) return { ok: true, known: true, portsKnown: portsKnown(db, classType) };
  if (!catalogSynced(db)) {
    return { ok: true, known: false, portsKnown: hasBuiltinPorts(classType), warning: CATALOG_NOT_SYNCED };
  }
  const suggestions = nearestNodeClasses(db, classType);
  const shown = classType.length > 120 ? `${classType.slice(0, 120)}…` : classType;
  const error = suggestions.length > 0
    ? `Unknown node class \`${shown}\`. Did you mean: ${suggestions.join(', ')}?`
    : `Unknown node class \`${shown}\`. It is not in the synced ComfyUI catalog; search the node types for the installed name.`;
  return { ok: false, error, suggestions };
}
