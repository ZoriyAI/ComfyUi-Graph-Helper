import type Database from 'better-sqlite3';
import type { CatalogView } from '../../shared/catalog/types';
import type { BaseModelFamily, PromptNote } from '../../shared/contracts/knowledge';
import type { GraphNodeLike } from '../../shared/graph/compatibility';
import { contradictions, holdsTrigger, inspectText, readerOfClipType, readerOfFamily, type PromptReader } from '../../shared/prompt/inspect';
import { catalogFileIndex, loadedModelFiles } from './loadedModels';

/**
 * The descriptions (prompts) of a graph read the way ComfyUI will read them. For every sampler the texts that
 * reach its `positive` and `negative` inputs are found, through whatever nodes pass conditioning on, and looked
 * at together with the sampler's cfg, the kind of text encoder they were encoded with, and the LoRAs on the way.
 * What comes out is advice, not errors: the graph runs either way, but not the way the person expects.
 */

interface Port { id?: unknown; name?: unknown; dataType?: unknown }
interface CanvasNode extends GraphNodeLike {
  id?: unknown;
  data?: GraphNodeLike['data'] & { inputs?: unknown; outputs?: unknown };
}
interface CanvasEdge { source?: unknown; target?: unknown; sourceHandle?: unknown; targetHandle?: unknown }
interface SpecInput { name: string; type: string; widget: boolean }
interface Spec { inputs: SpecInput[]; outputs: Array<{ name: string; type: string }> }

/** How far a conditioning or a CLIP link is followed back; a real graph is a handful of steps. */
const MAX_HOPS = 24;
const SHOWN_WORDS = 6;

const classOf = (node: CanvasNode | undefined) => (typeof node?.data?.comfyType === 'string' ? node.data.comfyType : '');
const ports = (node: CanvasNode | undefined, side: 'inputs' | 'outputs'): Port[] => (Array.isArray(node?.data?.[side]) ? (node!.data![side] as Port[]) : []);
const same = (left: unknown, right: string) => typeof left === 'string' && left.toLowerCase() === right.toLowerCase();

function parameters(node: CanvasNode | undefined): Record<string, unknown> {
  const value = node?.data?.parameters;
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function promptNotes(
  db: Database.Database,
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  specs: Map<string, Spec>,
  catalog: CatalogView,
): PromptNote[] {
  const byId = new Map(nodes.map((node) => [String(node.id), node]));
  const files = catalogFileIndex(catalog);

  /** The type of an input: the catalog's when it knows the class, else what the canvas port carries. */
  const inputType = (node: CanvasNode, name: string): string => {
    const known = specs.get(classOf(node))?.inputs.find((input) => same(input.name, name))?.type;
    if (known) return known;
    const port = ports(node, 'inputs').find((item) => same(item.name, name));
    return typeof port?.dataType === 'string' ? port.dataType : '';
  };
  const inputNames = (node: CanvasNode): string[] => {
    const names = new Set<string>();
    for (const port of ports(node, 'inputs')) if (typeof port.name === 'string') names.add(port.name);
    for (const input of specs.get(classOf(node))?.inputs ?? []) if (!input.widget) names.add(input.name);
    return [...names];
  };
  /** The link into a named input of a node, as the node it comes from and the name of the output it leaves by. */
  const feeder = (node: CanvasNode, input: string): { node: CanvasNode; output: string } | null => {
    const port = ports(node, 'inputs').find((item) => same(item.name, input));
    if (!port) return null;
    const edge = edges.find((item) => String(item.target) === String(node.id) && item.targetHandle === port.id);
    const source = edge ? byId.get(String(edge.source)) : undefined;
    if (!edge || !source) return null;
    const out = ports(source, 'outputs').find((item) => item.id === edge.sourceHandle);
    return { node: source, output: typeof out?.name === 'string' ? out.name : '' };
  };

  /** The texts a node holds: its text fields, as the catalog names them, else whatever of its values is called text or prompt. */
  const textsOf = (node: CanvasNode): string[] => {
    const values = parameters(node);
    const spec = specs.get(classOf(node));
    const fields = spec
      ? spec.inputs.filter((input) => input.widget && input.type.toUpperCase() === 'STRING').map((input) => input.name)
      : Object.keys(values).filter((name) => /text|prompt/i.test(name));
    return fields.map((name) => values[name]).filter((value): value is string => typeof value === 'string');
  };
  /** A node that turns words into conditioning: it takes a CLIP and holds text. */
  const isTextNode = (node: CanvasNode): boolean => inputNames(node).some((name) => inputType(node, name).toUpperCase() === 'CLIP')
    && (specs.get(classOf(node))?.inputs.some((input) => input.widget && input.type.toUpperCase() === 'STRING') ?? Object.keys(parameters(node)).some((name) => /text|prompt/i.test(name)));

  /** The text nodes whose words reach `input` of `sink`, through nodes that pass conditioning on. */
  const textNodesInto = (sink: CanvasNode, input: string): CanvasNode[] => {
    const found: CanvasNode[] = [];
    const seen = new Set<string>();
    const first = feeder(sink, input);
    const queue = first ? [first] : [];
    for (let hop = 0; hop < MAX_HOPS * 4 && queue.length > 0; hop += 1) {
      const { node, output } = queue.shift()!;
      const key = `${String(node.id)}\n${output}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (isTextNode(node)) {
        if (!found.includes(node)) found.push(node);
        continue;
      }
      const conditioning = inputNames(node).filter((name) => inputType(node, name).toUpperCase() === 'CONDITIONING');
      // A node that carries both descriptions through (image-to-video, a ControlNet) keeps them apart by name:
      // what left by `positive` came in by `positive`.
      const paired = conditioning.filter((name) => same(name, output));
      for (const name of paired.length > 0 ? paired : conditioning) {
        const next = feeder(node, name);
        if (next) queue.push(next);
      }
    }
    return found;
  };

  const familyOf = (name: string): BaseModelFamily => {
    const row = db.prepare("SELECT base_model FROM model_catalog WHERE directory = 'checkpoints' AND name = ?").get(name) as { base_model: string } | undefined;
    return (row?.base_model as BaseModelFamily | undefined) ?? 'unknown';
  };
  /** How the model reads this node's text: by the text encoder its CLIP input leads back to. */
  const readers = new Map<string, PromptReader>();
  const readerOf = (text: CanvasNode): PromptReader => {
    const held = readers.get(String(text.id));
    if (held) return held;
    let reader: PromptReader = 'unknown';
    let node: CanvasNode | undefined = text;
    const seen = new Set<string>();
    for (let hop = 0; hop < MAX_HOPS && node; hop += 1) {
      if (seen.has(String(node.id))) break;
      seen.add(String(node.id));
      const current: CanvasNode = node;
      const clip = inputNames(current).find((name) => inputType(current, name).toUpperCase() === 'CLIP');
      const next = clip ? feeder(current, clip)?.node : undefined;
      if (!next) break;
      const values = parameters(next);
      if (typeof values.ckpt_name === 'string') {
        reader = readerOfFamily(familyOf(values.ckpt_name));
        break;
      }
      if (/TripleCLIPLoader/i.test(classOf(next))) {
        reader = 't5';
        break;
      }
      if (/CLIPLoader/i.test(classOf(next)) && typeof values.type === 'string') {
        reader = readerOfClipType(values.type);
        break;
      }
      node = next;
    }
    readers.set(String(text.id), reader);
    return reader;
  };

  /** Every node whose output reaches `start`, by any link. */
  const upstream = (start: CanvasNode): CanvasNode[] => {
    const seen = new Set<string>();
    const queue = [String(start.id)];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const edge of edges) {
        if (String(edge.target) !== current) continue;
        const source = String(edge.source);
        if (seen.has(source) || source === String(start.id)) continue;
        seen.add(source);
        queue.push(source);
      }
    }
    return [...seen].flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  };
  const triggersOf = (name: string): string[] => {
    const row = db.prepare("SELECT trigger_words FROM model_catalog WHERE directory = 'loras' AND name = ?").get(name) as { trigger_words: string } | undefined;
    try {
      const value = JSON.parse(row?.trigger_words ?? '[]') as unknown;
      return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim() !== '') : [];
    } catch {
      return [];
    }
  };

  const notes: PromptNote[] = [];
  const said = new Set<string>();
  const say = (note: PromptNote, key = '') => {
    const id = `${note.kind}\n${note.nodeId}\n${key}`;
    if (said.has(id)) return;
    said.add(id);
    notes.push(note);
  };

  for (const sink of nodes) {
    const names = inputNames(sink);
    // A sampler, or a guider that plays its part: it takes what is wanted and what is not, and weighs them by cfg.
    if (!names.some((name) => same(name, 'positive')) || !names.some((name) => same(name, 'negative'))) continue;
    const values = parameters(sink);
    if (!('cfg' in values)) continue;
    const cfg = typeof values.cfg === 'number' ? values.cfg : Number(values.cfg);
    const positive = textNodesInto(sink, 'positive');
    const negative = textNodesInto(sink, 'negative');
    const samplerId = String(sink.id);

    for (const [role, list] of [['positive', positive], ['negative', negative]] as const) {
      for (const node of list) {
        // A node that feeds both inputs is read as what is wanted: that is what it is first.
        if (role === 'negative' && positive.includes(node)) continue;
        const reader = readerOf(node);
        for (const text of textsOf(node)) {
          for (const finding of inspectText(text, role, reader)) {
            say({ kind: finding.kind, nodeId: String(node.id), classType: classOf(node), found: finding.found, ...(finding.numbers ? { numbers: finding.numbers } : {}) });
          }
        }
      }
    }

    const wanted = positive.flatMap(textsOf);
    const unwanted = negative.filter((node) => !positive.includes(node)).flatMap(textsOf);
    if (positive.length > 0 && wanted.every((text) => text.trim() === '')) {
      say({ kind: 'empty-positive', nodeId: String(positive[0].id), classType: classOf(positive[0]), found: '', samplerId });
    }
    const silent = negative.find((node) => !positive.includes(node) && textsOf(node).some((text) => text.trim() !== ''));
    if (silent && Number.isFinite(cfg) && cfg <= 1) {
      say({ kind: 'negative-ignored', nodeId: String(silent.id), classType: classOf(silent), found: '', numbers: { cfg }, samplerId }, samplerId);
    }
    const both = contradictions(wanted.join(', '), unwanted.join(', '));
    if (both.length > 0 && positive[0]) {
      say({ kind: 'contradiction', nodeId: String(positive[0].id), classType: classOf(positive[0]), found: both.join(', ') });
    }

    // A LoRA on the way to this sampler that is switched on by its words, none of which is in the description.
    if (positive.length > 0 && wanted.some((text) => text.trim() !== '')) {
      const description = wanted.join(', ');
      for (const node of upstream(sink)) {
        for (const ref of loadedModelFiles(node, catalog, files)) {
          if (ref.directory !== 'loras') continue;
          const words = triggersOf(ref.name);
          if (words.length === 0 || holdsTrigger(description, words)) continue;
          say({ kind: 'missing-trigger', nodeId: String(node.id), classType: classOf(node), found: '', model: ref.name, words: words.slice(0, SHOWN_WORDS) }, ref.name);
        }
      }
    }
  }
  return notes;
}
