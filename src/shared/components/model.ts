/**
 * Component records and the process: the text a person (or the helper) writes about what a node or a subgraph is
 * for and how to use it, and the title and notes of the whole graph. Stored with every revision
 * (main/commands/commit.ts), carried in project files (native-project.ts, workflow/codec.ts) and edited in the
 * renderer's Properties panel (renderer/components/graph/Inspector.tsx). Everything read back is checked here.
 */
// Length caps of the stored texts; a longer purpose or usage makes a record unreadable, a longer title is cut.
export const COMPONENT_TEXT_MAX = 20000;
export const PROCESS_TITLE_MAX = 500;
export const PROCESS_NOTES_MAX = 20000;

/** What a record describes: a node on the canvas or a subgraph definition. */
export type ComponentOwnerKind = 'node' | 'subgraph';

/** What one node or subgraph is for (`purpose`) and how to use it (`usage`). */
export interface ComponentRecord {
  id: string;
  ownerKind: ComponentOwnerKind;
  ownerId: string;
  purpose: string;
  usage: string;
  /**
   * Who wrote the text last: the person (in Properties or a note) or the helper (its describe tool). Absent on
   * records written before it was kept; those were typed by the person, as the helper's tool came later.
   */
  author?: ComponentAuthor;
}

/** Who wrote a record's text: the person or the helper. */
export type ComponentAuthor = 'user' | 'assistant';

/** The title and notes of the whole graph ("the process"). */
export interface ProcessMeta {
  title: string;
  notes: string;
}

/** A subgraph definition found in a document, with how deeply it is nested. */
export interface SubgraphIdentity {
  id: string;
  name: string;
  depth: number;
}

/** The subgraph definitions of a document, plus repeated ids and definitions without an id. */
export interface SubgraphCensus {
  definitions: SubgraphIdentity[];
  duplicateIds: string[];
  unidentified: number;
}

export const EMPTY_PROCESS: ProcessMeta = { title: '', notes: '' };

/** The key that pairs a record with its owner: `node:4`, `subgraph:<id>`. */
export function componentKey(kind: ComponentOwnerKind, ownerId: string): string {
  return `${kind}:${ownerId}`;
}

/** A blank record for an owner that has none yet. */
export function emptyComponent(kind: ComponentOwnerKind, ownerId: string): ComponentRecord {
  return {
    id: `component:${componentKey(kind, ownerId)}`,
    ownerKind: kind,
    ownerId,
    purpose: '',
    usage: '',
  };
}

/** A stored or imported record, checked; null when it is not a valid record. A missing id is made from the owner. */
export function readComponent(value: unknown): ComponentRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.ownerKind !== 'node' && record.ownerKind !== 'subgraph') return null;
  if (typeof record.ownerId !== 'string' || record.ownerId.length === 0 || record.ownerId.length > 200) return null;
  if (typeof record.purpose !== 'string' || record.purpose.length > COMPONENT_TEXT_MAX) return null;
  if (typeof record.usage !== 'string' || record.usage.length > COMPONENT_TEXT_MAX) return null;
  const id = typeof record.id === 'string' && record.id.length > 0 && record.id.length <= 200
    ? record.id
    : `component:${componentKey(record.ownerKind, record.ownerId)}`;
  return {
    id,
    ownerKind: record.ownerKind,
    ownerId: record.ownerId,
    purpose: record.purpose,
    usage: record.usage,
    ...(record.author === 'user' || record.author === 'assistant' ? { author: record.author } : {}),
  };
}

/** The records stored as JSON text; invalid ones are dropped, broken JSON gives none. */
export function parseStoredComponents(raw: string | null | undefined): ComponentRecord[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      const record = readComponent(item);
      return record ? [record] : [];
    });
  } catch {
    return [];
  }
}

/** A process from anywhere, with its texts cut to the caps. */
export function normalizeProcess(value: unknown): ProcessMeta {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...EMPTY_PROCESS };
  const record = value as Record<string, unknown>;
  return {
    title: typeof record.title === 'string' ? record.title.slice(0, PROCESS_TITLE_MAX) : '',
    notes: typeof record.notes === 'string' ? record.notes.slice(0, PROCESS_NOTES_MAX) : '',
  };
}

/** The process stored as JSON text; broken JSON gives an empty process. */
export function parseStoredProcess(raw: string | null | undefined): ProcessMeta {
  if (!raw) return { ...EMPTY_PROCESS };
  try {
    return normalizeProcess(JSON.parse(raw) as unknown);
  } catch {
    return { ...EMPTY_PROCESS };
  }
}

/** Walks a workflow's `definitions.subgraphs`, nested definitions included, and counts what it finds. */
export function listSubgraphDefinitions(raw: unknown): SubgraphCensus {
  const definitions: SubgraphIdentity[] = [];
  const seen = new Set<string>();
  const duplicateIds: string[] = [];
  let unidentified = 0;
  const walk = (container: unknown, depth: number) => {
    if (!container || typeof container !== 'object' || Array.isArray(container)) return;
    const subgraphs = (container as { subgraphs?: unknown }).subgraphs;
    if (!Array.isArray(subgraphs)) return;
    for (const item of subgraphs) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const record = item as { id?: unknown; name?: unknown; definitions?: unknown };
      if (typeof record.id !== 'string' || record.id.length === 0) {
        unidentified += 1;
      } else if (seen.has(record.id)) {
        duplicateIds.push(record.id);
      } else {
        seen.add(record.id);
        definitions.push({
          id: record.id,
          name: typeof record.name === 'string' && record.name.length > 0 ? record.name : record.id,
          depth,
        });
      }
      walk(record.definitions, depth + 1);
    }
  };
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    walk((raw as { definitions?: unknown }).definitions, 0);
  }
  return { definitions, duplicateIds, unidentified };
}

/**
 * One record per node and subgraph that exists now, in that order: kept where one exists, blank where not. Records
 * whose owner is gone are returned as `orphans` (their keys) so the caller can say what was dropped.
 */
export function reconcileComponents(
  existing: ComponentRecord[],
  nodeIds: string[],
  subgraphIds: string[],
): { components: ComponentRecord[]; orphans: string[] } {
  const wanted = new Set<string>([
    ...nodeIds.map((id) => componentKey('node', id)),
    ...subgraphIds.map((id) => componentKey('subgraph', id)),
  ]);
  const byKey = new Map<string, ComponentRecord>();
  const orphans: string[] = [];
  for (const record of existing) {
    const key = componentKey(record.ownerKind, record.ownerId);
    if (!wanted.has(key)) {
      orphans.push(key);
      continue;
    }
    if (!byKey.has(key)) byKey.set(key, record);
  }
  const components = [
    ...nodeIds.map((id) => byKey.get(componentKey('node', id)) ?? emptyComponent('node', id)),
    ...subgraphIds.map((id) => byKey.get(componentKey('subgraph', id)) ?? emptyComponent('subgraph', id)),
  ];
  return { components, orphans };
}
