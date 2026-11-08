export const COMPONENT_TEXT_MAX = 20000;
export const PROCESS_TITLE_MAX = 500;
export const PROCESS_NOTES_MAX = 20000;

export type ComponentOwnerKind = 'node' | 'subgraph';

export interface ComponentRecord {
  id: string;
  ownerKind: ComponentOwnerKind;
  ownerId: string;
  purpose: string;
  usage: string;
}

export interface ProcessMeta {
  title: string;
  notes: string;
}

export interface SubgraphIdentity {
  id: string;
  name: string;
  depth: number;
}

export interface SubgraphCensus {
  definitions: SubgraphIdentity[];
  duplicateIds: string[];
  unidentified: number;
}

export const EMPTY_PROCESS: ProcessMeta = { title: '', notes: '' };

export function componentKey(kind: ComponentOwnerKind, ownerId: string): string {
  return `${kind}:${ownerId}`;
}

export function emptyComponent(kind: ComponentOwnerKind, ownerId: string): ComponentRecord {
  return {
    id: `component:${componentKey(kind, ownerId)}`,
    ownerKind: kind,
    ownerId,
    purpose: '',
    usage: '',
  };
}

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
  };
}

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

export function normalizeProcess(value: unknown): ProcessMeta {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...EMPTY_PROCESS };
  const record = value as Record<string, unknown>;
  return {
    title: typeof record.title === 'string' ? record.title.slice(0, PROCESS_TITLE_MAX) : '',
    notes: typeof record.notes === 'string' ? record.notes.slice(0, PROCESS_NOTES_MAX) : '',
  };
}

export function parseStoredProcess(raw: string | null | undefined): ProcessMeta {
  if (!raw) return { ...EMPTY_PROCESS };
  try {
    return normalizeProcess(JSON.parse(raw) as unknown);
  } catch {
    return { ...EMPTY_PROCESS };
  }
}

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
