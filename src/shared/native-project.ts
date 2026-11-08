import {
  PROCESS_NOTES_MAX,
  PROCESS_TITLE_MAX,
  type ComponentRecord,
  type ProcessMeta,
  readComponent,
} from './components/model';
import type { WorkflowDocumentState } from './workflow/codec';

export const NATIVE_PROJECT_FORMAT = 'comfy-graph-helper-project';
export const NATIVE_PROJECT_VERSION = 1;

export interface NativeGraph {
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
  document: WorkflowDocumentState | null;
}

export interface NativeProject {
  format: typeof NATIVE_PROJECT_FORMAT;
  version: typeof NATIVE_PROJECT_VERSION;
  upgradedFrom: 0 | null;
  process: ProcessMeta;
  graph: NativeGraph;
  components: ComponentRecord[];
}

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

export function parseNativeProject(input: unknown): NativeParse {
  if (!isRecord(input) || input.format !== NATIVE_PROJECT_FORMAT) {
    return { ok: false, error: 'This file is not a Graph Helper project.' };
  }
  if (input.version !== 0 && input.version !== NATIVE_PROJECT_VERSION) {
    return { ok: false, error: `Unsupported native project version ${String(input.version)}.` };
  }
  const legacy = input.version === 0;
  const graph = readGraph(input.graph);
  if (!graph) return invalid();
  const components = readComponents(input.components, !legacy);
  if ('error' in components) return { ok: false, error: components.error };
  const process = readProcess(input.process, !legacy);
  if (!process) return invalid();
  return {
    ok: true,
    project: {
      format: NATIVE_PROJECT_FORMAT,
      version: NATIVE_PROJECT_VERSION,
      upgradedFrom: legacy || input.upgradedFrom === 0 ? 0 : null,
      process,
      graph,
      components: components.components,
    },
  };
}

export function serializeNativeProject(project: {
  process: ProcessMeta;
  graph: NativeGraph;
  components: ComponentRecord[];
}): Record<string, unknown> {
  return {
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
    })),
  };
}
