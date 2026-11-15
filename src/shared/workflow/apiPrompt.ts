import type { CatalogView } from '../catalog/types';
import { widgetsFromParameters } from './codec';

/**
 * Turns a workflow in ComfyUI's API format into a canvas workflow the app can open.
 *
 * Who uses it: the file opening path in main (files/openFile.ts) when a person opens or drops a file that ComfyUI
 * wrote with "Export (API)", or a picture that carries only the API form ("prompt") of its graph.
 * Why: the API format has no positions, sizes or slot lists, only nodes and their inputs. People share it often,
 * and refusing it left them with nothing. The node list read from ComfyUI (catalog) gives the inputs, outputs and
 * the order of field values; a node the catalog does not know keeps its values in the order the file lists them.
 * Nodes are laid out in columns by how far they are from the first loaders, so the graph reads left to right.
 * Nothing in the file is run: this only builds a document.
 */

/** One node of an API-format prompt: its class, its inputs (a value, or [node id, output index] for a link). */
interface ApiNode {
  class_type: string;
  inputs: Record<string, unknown>;
  _meta?: { title?: unknown };
}

/** True when a value in an API prompt is a link: [source node id, output index]. */
function isLinkValue(value: unknown): value is [string | number, number] {
  return Array.isArray(value) && value.length === 2 && (typeof value[0] === 'string' || typeof value[0] === 'number') && typeof value[1] === 'number';
}

/** True when the document is an API-format prompt (every entry a node with class_type and inputs). */
export function isApiPromptDocument(document: unknown): document is Record<string, ApiNode> {
  if (!document || typeof document !== 'object' || Array.isArray(document)) return false;
  const record = document as Record<string, unknown>;
  if ('nodes' in record || 'version' in record) return false;
  const values = Object.values(record);
  return values.length > 0 && values.every((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const node = value as Record<string, unknown>;
    return typeof node.class_type === 'string' && !!node.inputs && typeof node.inputs === 'object' && !Array.isArray(node.inputs);
  });
}

/** Column spacing and row spacing of the laid-out graph, in canvas units: a node fits with room for its links. */
const COLUMN = 400;
const ROW = 300;

/**
 * The canvas workflow (format 0.4: links as lists) for an API prompt. Node ids stay the file's numbers where they are
 * numbers, so an error from ComfyUI that names "#12" still points at the same node.
 */
export function apiPromptToWorkflow(prompt: Record<string, ApiNode>, catalog: CatalogView | null): Record<string, unknown> {
  const keys = Object.keys(prompt);
  // ComfyUI ids are usually numbers; a text id gets the next free number.
  const numeric = new Map<string, number>();
  let next = Math.max(0, ...keys.map((key) => (/^\d+$/.test(key) ? Number(key) : 0))) + 1;
  for (const key of keys) numeric.set(key, /^\d+$/.test(key) ? Number(key) : next++);

  // Depth: a node with no incoming links is in column 0; every other node one column right of its furthest source.
  const depth = new Map<string, number>();
  const visiting = new Set<string>();
  const depthOf = (key: string): number => {
    const known = depth.get(key);
    if (known !== undefined) return known;
    if (visiting.has(key)) return 0; // A loop in a broken file: stop here rather than recurse forever.
    visiting.add(key);
    let value = 0;
    for (const input of Object.values(prompt[key]?.inputs ?? {})) {
      if (isLinkValue(input) && prompt[String(input[0])]) value = Math.max(value, depthOf(String(input[0])) + 1);
    }
    visiting.delete(key);
    depth.set(key, value);
    return value;
  };
  keys.forEach(depthOf);
  const rows = new Map<number, number>();

  const links: unknown[] = [];
  let linkId = 0;
  const outputs = new Map<string, Array<{ name: string; type: string; links: number[]; slot_index: number }>>();
  const outputList = (key: string) => {
    let list = outputs.get(key);
    if (!list) {
      const spec = catalog?.nodes.find((item) => item.classType === prompt[key].class_type);
      list = (spec?.outputs ?? []).map((output, index) => ({ name: output.name, type: output.type, links: [], slot_index: index }));
      outputs.set(key, list);
    }
    return list;
  };

  const nodes = keys.map((key, order) => {
    const api = prompt[key];
    const spec = catalog?.nodes.find((item) => item.classType === api.class_type);
    const id = numeric.get(key) as number;
    const inputs: Array<Record<string, unknown>> = [];
    const values: Record<string, unknown> = {};
    const loose: unknown[] = [];
    // Sockets the catalog lists come first, in its order, so their indexes match what ComfyUI expects.
    for (const socket of spec?.inputs.filter((input) => !input.widget) ?? []) inputs.push({ name: socket.name, type: socket.type, link: null });
    for (const [name, value] of Object.entries(api.inputs)) {
      if (isLinkValue(value)) {
        const sourceKey = String(value[0]);
        if (!prompt[sourceKey]) continue;
        const sourceOutputs = outputList(sourceKey);
        while (sourceOutputs.length <= value[1]) sourceOutputs.push({ name: `output ${sourceOutputs.length + 1}`, type: '*', links: [], slot_index: sourceOutputs.length });
        const output = sourceOutputs[value[1]];
        let slot = inputs.findIndex((input) => input.name === name);
        const widgetInput = spec?.inputs.find((input) => input.name === name && input.widget);
        if (slot < 0) {
          // A field fed by a link (a converted widget), or a socket the catalog does not know.
          inputs.push({ name, type: widgetInput?.type ?? output.type, link: null, ...(widgetInput ? { widget: { name } } : {}) });
          slot = inputs.length - 1;
        }
        linkId += 1;
        inputs[slot].link = linkId;
        output.links.push(linkId);
        links.push([linkId, numeric.get(sourceKey), value[1], id, slot, output.type]);
        if (widgetInput) values[name] = null;
      } else {
        values[name] = value;
        loose.push(value);
      }
    }
    let widgets: unknown[] = loose;
    if (spec) {
      const known = Object.fromEntries(Object.entries(values).filter(([name, value]) => spec.widgetOrder.includes(name) && value !== null));
      const placed = widgetsFromParameters(api.class_type, known, catalog as CatalogView);
      if (placed.ok) widgets = placed.values;
    }
    const column = depth.get(key) ?? 0;
    const row = rows.get(column) ?? 0;
    rows.set(column, row + 1);
    const title = typeof api._meta?.title === 'string' && api._meta.title.trim() !== '' && api._meta.title !== api.class_type ? api._meta.title : undefined;
    return {
      id,
      type: api.class_type,
      pos: [column * COLUMN, row * ROW],
      size: [320, 180],
      flags: {},
      order,
      mode: 0,
      inputs,
      outputs: [] as unknown[],
      properties: { 'Node name for S&R': api.class_type },
      widgets_values: widgets,
      ...(title ? { title } : {}),
      _key: key,
    };
  });
  for (const node of nodes) {
    node.outputs = outputList(node._key);
    delete (node as { _key?: string })._key;
  }
  return {
    last_node_id: Math.max(0, ...nodes.map((node) => node.id)),
    last_link_id: linkId,
    nodes,
    links,
    groups: [],
    config: {},
    extra: {},
    version: 0.4,
  };
}
