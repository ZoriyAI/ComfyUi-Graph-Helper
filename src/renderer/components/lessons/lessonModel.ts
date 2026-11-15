/**
 * Between the lesson engine (shared/lessons) and the app: the canvas as the engine sees it, what the catalog
 * knows of the classes the lessons name, the trigger words of the files chosen on the canvas, and the two things
 * a step can ask the app for: show where it is, or do it.
 *
 * Who uses it: LessonPanel.tsx, lackText.ts and lessonAuthoring.ts; tests/unit/lessonModel.test.ts covers it.
 */
import { useEffect, useMemo, useState } from 'react';
import type { BaseModelFamily, NodeClassDetail } from '../../../shared/contracts/knowledge';
import type { GraphMutation } from '../../../shared/commands/types';
import {
  classOfRole,
  fixFor,
  inputFor,
  outputsFor,
  rolesOf,
  type ClassPorts,
  type Lesson,
  type LessonFacts,
  type LessonGraph,
  type LessonNode,
  type Missing,
  type Roles,
  type StepFix,
} from '../../../shared/lessons/engine';
import { lessonSpot } from '../../../shared/lessons/flow';
import { LESSONS } from '../../../shared/lessons/lessons';
import { LAYOUT_GAPS } from '../../../shared/graph/layout';
import type { GraphEdge, GraphNode } from '../../types/graph';
import { useGraphStore } from '../../state/graphState';
import { showToast } from '../../ui/toastStore';
import { i18n } from '../../i18n';
import { useKnowledgeStore } from '../../state/knowledgeState';
import { fieldValue } from '../fields/fieldModel';
import { useCanvasStore } from '../graph/canvasStore';
import { commitManual } from '../graph/commit';
import type { PositionedNode } from '../graph/lib/geometry';
import { layoutRect, newNodeSize, sizeHintsOf } from '../graph/lib/nodeSizes';
import { useNodeInfoStore } from '../graph/nodeInfo';
import { placeNewNode } from '../graph/placeNode';


/** Catalog details by class; null for a class the catalog does not have. */
type Details = Record<string, NodeClassDetail | null>;

/** A class the catalog has read: it has ports. Before ComfyUI is read a core class is a name without any. */
function readDetail(detail: NodeClassDetail | null | undefined): NodeClassDetail | null {
  return detail && detail.detailed ? detail : null;
}

/** The root canvas as a lesson sees it: classes, ports, values, links. */
export function lessonGraphOf(nodes: readonly GraphNode[], edges: readonly GraphEdge[], details: Details): LessonGraph {
  const out: LessonNode[] = [];
  for (const node of nodes) {
    const data = node.data;
    if (!data || typeof data.comfyType !== 'string' || data.kind === 'subgraph-instance') continue;
    const detail = readDetail(details[data.comfyType]);
    const names = new Set<string>([
      ...Object.keys(data.parameters ?? {}),
      ...(detail?.inputs ?? []).filter((input) => input.widget).map((input) => input.name),
    ]);
    const values: Record<string, unknown> = {};
    for (const name of names) {
      if (!name.includes('::')) values[name] = fieldValue(data, name, detail?.widgetOrder);
    }
    out.push({
      id: node.id,
      classType: data.comfyType,
      inputs: (data.inputs ?? []).map((port) => ({ id: port.id, name: port.name, type: port.dataType })),
      outputs: (data.outputs ?? []).map((port) => ({ id: port.id, name: port.name, type: port.dataType })),
      values,
      ...(detail ? { defaults: defaultsOf(detail) } : {}),
    });
  }
  const known = new Set(out.map((node) => node.id));
  return {
    nodes: out,
    links: edges
      .filter((edge) => known.has(edge.source) && known.has(edge.target) && edge.sourceHandle && edge.targetHandle)
      .map((edge) => ({ from: edge.source, fromPort: String(edge.sourceHandle), to: edge.target, toPort: String(edge.targetHandle) })),
  };
}

/**
 * The value each field of a fresh node of this class starts with: the catalog's default, or for a list the first
 * entry, as ComfyUI does. A lesson does not take such a value for the person's choice of a number.
 */
export function defaultsOf(detail: NodeClassDetail): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const input of detail.inputs) {
    const spec = input.spec;
    if (!input.widget || !spec) continue;
    if (spec.default !== undefined) out[input.name] = spec.default;
    else if (spec.options && spec.options.length > 0) out[input.name] = spec.options[0];
  }
  return out;
}

/** What the catalog says of a class, in the shape the engine asks for; null for a class it has not read. */
export function classPortsOf(details: Details): ClassPorts {
  return (classType) => {
    const detail = readDetail(details[classType]);
    return detail ? { inputs: detail.inputs.map((input) => input.name), outputs: detail.outputs } : null;
  };
}

/** Every class any lesson names. */
export function lessonClasses(lessons: readonly Lesson[] = LESSONS): string[] {
  return [...new Set(lessons.flatMap((lesson) => rolesOf(lesson).flatMap((spec) => spec.classes)))];
}

/** The name of the node that plays a role, as the library of this ComfyUI shows it. */
export function nodeNameOf(lesson: Lesson, role: string, details: Details): string | null {
  const ports = classPortsOf(details);
  const classType = classOfRole(lesson, role, ports) ?? rolesOf(lesson).find((spec) => spec.role === role)?.classes[0];
  if (!classType) return null;
  return details[classType]?.displayName || classType;
}

/** The catalog as far as the lessons need it, kept fresh after ComfyUI is read again. */
export function useLessonCatalog(): { details: Details; ports: ClassPorts; read: boolean } {
  const details = useNodeInfoStore((state) => state.details);
  const request = useNodeInfoStore((state) => state.request);
  const counts = useKnowledgeStore((state) => state.sync?.counts);
  useEffect(() => {
    for (const classType of lessonClasses()) void request(classType);
  }, [request]);
  const ports = useMemo(() => classPortsOf(details), [details]);
  return { details, ports, read: (counts?.detailedClasses ?? 0) > 0 };
}

/** The graph on the root canvas as lessons see it. Inside an open subgraph there is no lesson to follow. */
export function useLessonGraph(details: Details): LessonGraph {
  const nodes = useGraphStore((state) => state.nodes);
  const edges = useGraphStore((state) => state.edges);
  return useMemo(() => lessonGraphOf(nodes, edges, details), [nodes, edges, details]);
}

/** The core LoRA loaders: their lora_name list is LoRA files even when the catalog names no folder. */
const LORA_CLASSES = new Set(['LoraLoaderModelOnly', 'LoraLoader']);
/** What a model file's own description says: its trigger words and its base model family. */
interface FileFacts {
  triggers: string[];
  family: BaseModelFamily;
}
/** Facts by `folder/name`, kept for the whole session: a file's description is asked of main only once. */
const fileCache = new Map<string, FileFacts>();

/**
 * The model files chosen on the canvas, with the folder the catalog found them in: the LoRAs of the core loaders,
 * and every field whose list the catalog knows to be model files.
 */
export function modelFilesOf(graph: LessonGraph, details: Details): Array<{ directory: string; name: string }> {
  const out = new Map<string, { directory: string; name: string }>();
  for (const node of graph.nodes) {
    const inputs = details[node.classType]?.inputs ?? [];
    for (const [field, value] of Object.entries(node.values)) {
      if (typeof value !== 'string' || value === '') continue;
      const directory = LORA_CLASSES.has(node.classType) && field === 'lora_name' ? 'loras' : inputs.find((input) => input.name === field)?.spec?.modelDirectory;
      if (directory) out.set(`${directory}/${value}`, { directory, name: value });
    }
  }
  return [...out.values()].sort((a, b) => `${a.directory}/${a.name}`.localeCompare(`${b.directory}/${b.name}`));
}

/**
 * What the app knows of the model files chosen on the canvas, read from the files' own descriptions: the trigger
 * words of a LoRA, and the family its metadata names (a file named "mystery" may well be an SDXL LoRA).
 */
export function useLessonFacts(graph: LessonGraph, details: Details = {}): LessonFacts {
  const files = useMemo(() => modelFilesOf(graph, details), [graph, details]);
  const key = files.map((file) => `${file.directory}/${file.name}`).join('\n');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let live = true;
    const bridge = typeof window !== 'undefined' ? window.electronAPI : undefined;
    for (const file of files) {
      const id = `${file.directory}/${file.name}`;
      if (fileCache.has(id) || !bridge?.modelDetail) continue;
      void bridge.modelDetail(file.directory, file.name).catch(() => null).then((detail) => {
        // A family guessed only from the file name is not trusted: the lesson would judge the file by its name.
        fileCache.set(id, { triggers: detail?.triggerWords ?? [], family: detail && detail.baseModelEvidence !== 'filename' ? detail.baseModel : 'unknown' });
        if (live) setVersion((value) => value + 1);
      });
    }
    return () => {
      live = false;
    };
    // `key` stands for the list of files.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return useMemo(() => {
    const triggers: Record<string, string[]> = {};
    const families: Record<string, BaseModelFamily> = {};
    for (const file of files) {
      const known = fileCache.get(`${file.directory}/${file.name}`);
      if (file.directory === 'loras') triggers[file.name] = known?.triggers ?? [];
      if (known && known.family !== 'unknown') families[file.name] = known.family;
    }
    return { triggers, families };
  }, [files, version]); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * "Show me where": the canvas goes to what the step lacks. A missing node opens the node search with its name
 * typed in; a missing link brings its target into view and lights the output it starts from, with everything
 * that output can go into; a field brings its node into view and selects it.
 */
export function showMissing(missing: Missing, lesson: Lesson, graph: LessonGraph, details: Details): void {
  const canvas = useCanvasStore.getState();
  clearShown();
  if (missing.kind === 'node') {
    canvas.openAddSearch(null, nodeNameOf(lesson, missing.role, details) ?? missing.classes[0]);
    return;
  }
  if (missing.kind === 'field') {
    canvas.requestCenter(missing.nodeId);
    return;
  }
  canvas.requestCenter(missing.to.nodeId);
  const from = graph.nodes.find((node) => node.id === missing.from.nodeId);
  const output = from ? outputsFor(from, missing.output)[0] : undefined;
  if (from && output) {
    canvas.setConnectFrom({ nodeId: from.id, handle: output.id, direction: 'output', dataType: output.type }, true);
    lit = { nodeId: from.id, handle: output.id };
  }
}

/** The output a lesson lit on the canvas, so that it can be put out again. */
let lit: { nodeId: string; handle: string } | null = null;

/**
 * Puts out what "show me where" lit, once the step has moved on or the person has left the lesson. Only the
 * lesson's own light: a port the person lit themselves in the meantime is theirs.
 */
export function clearShown(): void {
  if (!lit) return;
  const canvas = useCanvasStore.getState();
  if (canvas.connectFrom?.nodeId === lit.nodeId && canvas.connectFrom.handle === lit.handle) canvas.setConnectFrom(null);
  lit = null;
}

/** Whether the app can do the thing in the person's place (it cannot choose a file or write a description). */
export function canDo(missing: Missing, graph: LessonGraph, ports: ClassPorts, details?: Details, facts?: LessonFacts): StepFix | null {
  return fixFor(missing, graph, (classType) => ports(classType) !== null, details ? (nodeId, field) => fieldChoices(graph, details, nodeId, field) : undefined, facts);
}

/** The values a field of a node on the canvas can take, as the catalog lists them. */
export function fieldChoices(graph: LessonGraph, details: Details, nodeId: string, field: string): readonly unknown[] {
  const node = graph.nodes.find((item) => item.id === nodeId);
  const input = node ? details[node.classType]?.inputs.find((item) => item.name === field) : undefined;
  return input?.spec?.options ?? [];
}

/** The role a new node is added for, with the lesson and the nodes that already play its roles. */
export interface FixPlace {
  lesson: Lesson;
  role: string;
  roles: Roles;
}

/**
 * The spot for a node the app adds for a lesson: in the column of its role, so that the graph reads left to
 * right as the lesson says. Null when nothing of the lesson is on the canvas yet.
 */
async function spotInFlow(classType: string, place: FixPlace): Promise<{ x: number; y: number } | null> {
  const detail = await useNodeInfoStore.getState().request(classType);
  const details = useNodeInfoStore.getState().details;
  const nodes = useGraphStore.getState().nodes as PositionedNode[];
  const rects = new Map(nodes.map((node) => [node.id, layoutRect(node, sizeHintsOf(node.data?.comfyType ? details[node.data.comfyType] : null))]));
  return lessonSpot(place.lesson, place.role, place.roles, rects, newNodeSize(classType, detail), { x: LAYOUT_GAPS.gapX, y: LAYOUT_GAPS.gapY });
}

/**
 * "Do it for me": one action through the same commands the canvas uses, so it is in the history and can be undone.
 * A node added for a role of a lesson is given its place in the lesson's flow.
 */
export async function doFix(fix: StepFix, place?: FixPlace): Promise<void> {
  // Lessons follow the main canvas: with a subgraph open, nothing is done and the lesson's sentence says why.
  if (useGraphStore.getState().activeSubgraphId) {
    showToast({ id: 'lesson-in-subgraph', tone: 'info', title: String(i18n.t('lessons.inSubgraph')), duration: 5000 });
    return;
  }
  let payload: GraphMutation;
  const before = new Set(useGraphStore.getState().nodes.map((node) => node.id));
  if (fix.kind === 'add-node') {
    const spot = await placeNewNode(place ? await spotInFlow(fix.classType, place) : null, { classType: fix.classType });
    // Under the name the library shows, the way a node added by hand from the library is named.
    const name = (await useNodeInfoStore.getState().request(fix.classType))?.displayName;
    payload = { type: 'add-node', nodeType: fix.classType, ...(name && name !== fix.classType ? { title: name } : {}), x: spot.x, y: spot.y };
  } else if (fix.kind === 'connect') {
    payload = { type: 'connect', source: fix.from, sourceHandle: fix.fromPort, target: fix.to, targetHandle: fix.toPort };
  } else {
    payload = { type: 'set-parameter', nodeId: fix.nodeId, key: fix.field, value: fix.value };
  }
  // The change goes to the root level, where lessons live (the guard above already stops it inside a subgraph).
  await commitManual(payload, 'lesson', { level: 'root' });
  // The person sees what was done: the canvas goes to the node the change is on, a new node included.
  const shown = fix.kind === 'connect' ? fix.to : fix.kind === 'set-field' ? fix.nodeId : useGraphStore.getState().nodes.find((node) => !before.has(node.id))?.id;
  if (shown) useCanvasStore.getState().requestCenter(shown);
}

/** The name a person reads for a node on the canvas: its title, else its class as the library shows it. */
export function titleOnCanvas(nodeId: string, details: Details): string {
  const node = useGraphStore.getState().nodes.find((item) => item.id === nodeId);
  if (!node) return '';
  const data = node.data;
  return String(data.title || details[data.comfyType]?.displayName || data.comfyType);
}

/** The port a link lack speaks of, as the node shows it. */
export function portLabel(graph: LessonGraph, nodeId: string, side: 'input' | 'output', name: string): string {
  const node = graph.nodes.find((item) => item.id === nodeId);
  if (!node) return name;
  return side === 'input' ? inputFor(node, name)?.name ?? name : outputsFor(node, name)[0]?.name ?? name;
}
