/**
 * The app's own project file (`*.nodewise.json`): the graph with its document mirror, component records, the
 * process, subgraphs, groups and extension records. parseNativeProject checks a file before main opens it
 * (main/files/openFile.ts, main/ipc/projectFile.ts, main/commands/commit.ts); serializeNativeProject writes one.
 * Reading is strict about shape but keeps what it does not know, so a file from a newer version survives a save.
 */
import {
  PROCESS_NOTES_MAX,
  PROCESS_TITLE_MAX,
  type ComponentRecord,
  type ProcessMeta,
  readComponent,
} from './components/model';
import type { GroupRecord, SubgraphDefinition } from './graph/subgraphs';
import type { WorkflowDocumentState } from './workflow/codec';
import { NATIVE_PROJECT_FORMAT_ID } from './productNames';
import { LEGACY_NATIVE_PROJECT_FORMAT_IDS } from './legacyNames';

/** The `format` field this version writes (src/shared/productNames.ts). */
export const NATIVE_PROJECT_FORMAT = NATIVE_PROJECT_FORMAT_ID;

/**
 * Whether a file's `format` field names a project file: the current id, or the id 0.x wrote before the product's
 * rename (src/shared/legacyNames.ts), so a project saved by 0.9 still opens. A file opened this way is written
 * back with the current id.
 */
export function isNativeProjectFormat(value: unknown): boolean {
  return value === NATIVE_PROJECT_FORMAT || (LEGACY_NATIVE_PROJECT_FORMAT_IDS as readonly unknown[]).includes(value);
}
/**
 * Version 2 adds modelled `subgraphs`, `groups`, and an opaque `extensions` bag.
 * Versions 0 and 1 still open; their subgraphs and groups are lifted from the native document on open.
 */
export const NATIVE_PROJECT_VERSION = 2;
/** The versions this build opens. */
const READABLE_VERSIONS = new Set([0, 1, 2]);

/** The canvas nodes and edges, and the ComfyUI document mirror they came from. */
export interface NativeGraph {
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
  document: WorkflowDocumentState | null;
}

/** A project file as read: always the current version, with what the original file said kept in sourceVersion. */
export interface NativeProject {
  format: typeof NATIVE_PROJECT_FORMAT;
  version: typeof NATIVE_PROJECT_VERSION;
  upgradedFrom: 0 | null;
  process: ProcessMeta;
  graph: NativeGraph;
  components: ComponentRecord[];
  /** Undefined when the file predates version 2. */
  subgraphs?: SubgraphDefinition[];
  /** Undefined when the file predates version 2. */
  groups?: GroupRecord[];
  /** Records other domains (explanations, ...) keep in the project file. Opaque to the engine. */
  extensions: Record<string, unknown>;
  /** The version the file was written with. */
  sourceVersion: number;
  /**
   * Top-level fields this version does not know (written by a later version or another tool). Kept with the
   * graph and written back on save, so opening and saving a file never drops them.
   */
  preserved?: Record<string, unknown>;
}

/** Top-level fields this version reads; any other is kept in `preserved`. */
const KNOWN_FIELDS = new Set(['format', 'version', 'process', 'graph', 'components', 'subgraphs', 'groups', 'extensions', 'sourceVersion', 'upgradedFrom', 'preserved']);

function unknownFields(input: Record<string, unknown>): Record<string, unknown> {
  const kept: Record<string, unknown> = isRecord(input.preserved) ? { ...input.preserved } : {};
  for (const [key, value] of Object.entries(input)) {
    if (!KNOWN_FIELDS.has(key)) kept[key] = value;
  }
  return kept;
}

/** A project or the reason it could not be read (a fixed English sentence, translated by i18n/index.ts). */
export type NativeParse = { ok: true; project: NativeProject } | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function invalid(error = 'The native project file is not valid.'): NativeParse {
  return { ok: false, error };
}

function readDocument(value: unknown): WorkflowDocumentState | null | undefined {
  if (value == null) return null;
  if (!isRecord(value)) return undefined;
  if (value.formatVersion !== 1 && value.formatVersion !== 0.4) return undefined;
  if (!isRecord(value.raw)) return undefined;
  return { formatVersion: value.formatVersion, raw: value.raw };
}

function readGraph(value: unknown): NativeGraph | undefined {
  if (!isRecord(value) || !Array.isArray(value.nodes) || !Array.isArray(value.edges)) return undefined;
  const nodes: Array<Record<string, unknown>> = [];
  for (const node of value.nodes) {
    if (!isRecord(node) || typeof node.id !== 'string' || node.id.length === 0) return undefined;
    nodes.push(node);
  }
  const edges: Array<Record<string, unknown>> = [];
  for (const edge of value.edges) {
    if (!isRecord(edge) || typeof edge.id !== 'string' || edge.id.length === 0) return undefined;
    edges.push(edge);
  }
  const document = readDocument(value.document);
  if (document === undefined) return undefined;
  return { nodes, edges, document };
}

function readComponents(value: unknown, required: boolean): { components: ComponentRecord[] } | { error: string } {
  if (value == null && !required) return { components: [] };
  if (!Array.isArray(value)) return { error: 'The native project file is not valid.' };
  const components: ComponentRecord[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const record = readComponent(item);
    if (!record) return { error: 'The native project file is not valid.' };
    const key = `${record.ownerKind}:${record.ownerId}`;
    if (seen.has(key)) return { error: 'The native project repeats a component owner.' };
    seen.add(key);
    components.push(record);
  }
  return { components };
}

function readProcess(value: unknown, required: boolean): ProcessMeta | undefined {
  if (value == null && !required) return { title: '', notes: '' };
  if (!isRecord(value)) return undefined;
  if (typeof value.title !== 'string' || value.title.length > PROCESS_TITLE_MAX) return undefined;
  if (typeof value.notes !== 'string' || value.notes.length > PROCESS_NOTES_MAX) return undefined;
  return { title: value.title, notes: value.notes };
}

function readSlots(value: unknown): SubgraphDefinition['inputs'] | undefined {
  if (!Array.isArray(value)) return undefined;
  const slots: SubgraphDefinition['inputs'] = [];
  for (const slot of value) {
    if (!isRecord(slot) || typeof slot.id !== 'string' || typeof slot.name !== 'string' || typeof slot.type !== 'string') return undefined;
    slots.push({
      id: slot.id,
      name: slot.name,
      type: slot.type,
      ...(isRecord(slot.raw) ? { raw: slot.raw } : {}),
      ...(Array.isArray(slot.linkIds) ? { linkIds: slot.linkIds } : {}),
    });
  }
  return slots;
}

function readSubgraphs(value: unknown): SubgraphDefinition[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: SubgraphDefinition[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== 'string' || item.id.length === 0 || seen.has(item.id)) return undefined;
    if (typeof item.name !== 'string' || !Array.isArray(item.nodes) || !Array.isArray(item.edges) || !isRecord(item.raw)) return undefined;
    if (item.nestedIn !== null && typeof item.nestedIn !== 'string') return undefined;
    const inputs = readSlots(item.inputs);
    const outputs = readSlots(item.outputs);
    if (!inputs || !outputs) return undefined;
    const groups = item.groups === undefined ? undefined : readGroups(item.groups);
    if (item.groups !== undefined && !groups) return undefined;
    if (!item.nodes.every(isRecord) || !item.edges.every(isRecord)) return undefined;
    seen.add(item.id);
    out.push({
      id: item.id,
      name: item.name,
      inputs,
      outputs,
      nodes: item.nodes as Array<Record<string, unknown>>,
      edges: item.edges as Array<Record<string, unknown>>,
      ...(groups ? { groups } : {}),
      nestedIn: item.nestedIn,
      ...(item.opaque === true ? { opaque: true as const } : {}),
      raw: item.raw,
      ...(isRecord(item.instanceDefaults) ? { instanceDefaults: item.instanceDefaults } : {}),
      ...(Array.isArray(item.importedLinks) && item.importedLinks.every((id) => typeof id === 'string')
        ? { importedLinks: item.importedLinks as string[] }
        : {}),
    });
  }
  return out;
}

function readGroups(value: unknown): GroupRecord[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: GroupRecord[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== 'string' || typeof item.title !== 'string') return undefined;
    if (!Array.isArray(item.nodeIds) || !item.nodeIds.every((id) => typeof id === 'string')) return undefined;
    const group: GroupRecord = { id: item.id, title: item.title, nodeIds: item.nodeIds as string[] };
    if (typeof item.color === 'string') group.color = item.color;
    if (Array.isArray(item.bounding) && item.bounding.length === 4 && item.bounding.every((n) => typeof n === 'number')) {
      group.bounding = item.bounding as [number, number, number, number];
    }
    if (isRecord(item.raw)) group.raw = item.raw;
    out.push(group);
  }
  return out;
}

/** Reads a parsed JSON value as a project file. Version 0 files may lack components and process. */
export function parseNativeProject(input: unknown): NativeParse {
  if (!isRecord(input) || !isNativeProjectFormat(input.format)) {
    return { ok: false, error: 'This file is not a native project.' };
  }
  if (typeof input.version !== 'number' || !READABLE_VERSIONS.has(input.version)) {
    return { ok: false, error: `Unsupported native project version ${String(input.version)}.` };
  }
  const legacy = input.version === 0;
  const graph = readGraph(input.graph);
  if (!graph) return invalid();
  const components = readComponents(input.components, !legacy);
  if ('error' in components) return { ok: false, error: components.error };
  const process = readProcess(input.process, !legacy);
  if (!process) return invalid();
  // Subgraphs and groups are optional even in version 2: a writer that did not pass them leaves them out,
  // and open-native then lifts them from the native document mirror.
  const subgraphs = input.subgraphs === undefined ? undefined : readSubgraphs(input.subgraphs);
  const groups = input.groups === undefined ? undefined : readGroups(input.groups);
  if ((input.subgraphs !== undefined && !subgraphs) || (input.groups !== undefined && !groups)) return invalid();
  if (input.extensions != null && !isRecord(input.extensions)) return invalid();
  return {
    ok: true,
    project: {
      format: NATIVE_PROJECT_FORMAT,
      version: NATIVE_PROJECT_VERSION,
      upgradedFrom: legacy || input.upgradedFrom === 0 ? 0 : null,
      process,
      graph,
      components: components.components,
      ...(subgraphs ? { subgraphs } : {}),
      ...(groups ? { groups } : {}),
      extensions: isRecord(input.extensions) ? input.extensions : {},
      sourceVersion: typeof input.sourceVersion === 'number' ? input.sourceVersion : input.version,
      ...(Object.keys(unknownFields(input)).length > 0 ? { preserved: unknownFields(input) } : {}),
    },
  };
}

/** The JSON object a project file is written as, in the current version. */
export function serializeNativeProject(project: {
  process: ProcessMeta;
  graph: NativeGraph;
  components: ComponentRecord[];
  subgraphs?: SubgraphDefinition[];
  groups?: GroupRecord[];
  extensions?: Record<string, unknown>;
  /** Fields of the opened file this version does not know; what this version writes itself wins. */
  preserved?: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    ...(project.preserved ?? {}),
    format: NATIVE_PROJECT_FORMAT,
    version: NATIVE_PROJECT_VERSION,
    process: { title: project.process.title, notes: project.process.notes },
    graph: {
      nodes: project.graph.nodes,
      edges: project.graph.edges,
      document: project.graph.document,
    },
    components: project.components.map((record) => ({
      id: record.id,
      ownerKind: record.ownerKind,
      ownerId: record.ownerId,
      purpose: record.purpose,
      usage: record.usage,
      ...(record.author ? { author: record.author } : {}),
    })),
    ...(project.subgraphs ? { subgraphs: project.subgraphs } : {}),
    ...(project.groups ? { groups: project.groups } : {}),
    extensions: project.extensions ?? {},
  };
}
