/**
 * Editor nodes: Note, Markdown Note, Reroute and Primitive. They exist only in ComfyUI's editor, so ComfyUI's
 * object_info never lists them and the synced catalog cannot add them. The add-node search, the library, the class
 * guard and the engine (main/commands/editOps.ts) read them from here, so a person can add them by hand like any
 * other node, and the workflow file holds them in the shape ComfyUI's own frontend writes (LGraphNode.serialize).
 */
import type { PortDefinition } from './ports';

/** The editor node classes a person can add. */
export const EDITOR_NODE_TYPES = ['Note', 'MarkdownNote', 'Reroute', 'PrimitiveNode'] as const;
export type EditorNodeType = typeof EDITOR_NODE_TYPES[number];

/** Notes carry their text in widgets_values[0]. */
export const NOTE_NODE_TYPES: ReadonlySet<string> = new Set(['Note', 'MarkdownNote']);

/** The name ComfyUI's frontend gives the Primitive's only output until a field is connected. */
export const PRIMITIVE_UNSET_OUTPUT = 'connect to widget input';

/** What the app needs to know about one editor node class. */
interface EditorNodeSpec {
  /** The name ComfyUI shows in its own search. */
  displayName: string;
  /** Russian and English words the add-node search should also answer to (lower case). */
  words: string[];
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  size: [number, number];
  /** Native fields beyond id, type, title, pos, size, flags, order and mode. */
  extra: () => Record<string, unknown>;
}

/** The four editor node classes, with the sizes and fields ComfyUI's frontend gives a new one. */
const SPECS: Record<EditorNodeType, EditorNodeSpec> = {
  Note: {
    displayName: 'Note',
    words: ['note', 'comment', 'text', 'заметка', 'заметк', 'комментар', 'записк'],
    inputs: [],
    outputs: [],
    size: [400, 200],
    extra: () => ({ inputs: [], outputs: [], properties: {}, widgets_values: [''], color: '#432', bgcolor: '#653' }),
  },
  MarkdownNote: {
    displayName: 'Markdown Note',
    words: ['markdown', 'note', 'comment', 'заметка', 'заметк', 'маркдаун', 'разметк'],
    inputs: [],
    outputs: [],
    size: [400, 200],
    extra: () => ({ inputs: [], outputs: [], properties: {}, widgets_values: [''], color: '#432', bgcolor: '#653' }),
  },
  Reroute: {
    displayName: 'Reroute',
    words: ['reroute', 'wire', 'link', 'перенаправ', 'развод', 'провод', 'точка', 'связь'],
    inputs: [{ id: 'in-0', name: '', dataType: '*', optional: false }],
    outputs: [{ id: 'out-0', name: '', dataType: '*', optional: false }],
    size: [75, 26],
    extra: () => ({
      inputs: [{ name: '', type: '*', link: null }],
      outputs: [{ name: '', type: '*', links: [] }],
      properties: { showOutputText: false, horizontal: false },
    }),
  },
  PrimitiveNode: {
    displayName: 'Primitive',
    words: ['primitive', 'value', 'constant', 'примитив', 'значени', 'констант', 'общее'],
    inputs: [],
    outputs: [{ id: 'out-0', name: PRIMITIVE_UNSET_OUTPUT, dataType: '*', optional: false }],
    size: [210, 58],
    extra: () => ({
      inputs: [],
      outputs: [{ name: PRIMITIVE_UNSET_OUTPUT, type: '*', links: [] }],
      properties: { 'Run widget replace on values': false },
      widgets_values: [],
    }),
  },
};

/** True for a class that only ComfyUI's editor knows (Note, Markdown Note, Reroute, Primitive). */
export function isEditorNodeType(classType: string): classType is EditorNodeType {
  return Object.prototype.hasOwnProperty.call(SPECS, classType);
}

/** The ports the canvas draws for a new editor node. */
export function editorNodePorts(classType: EditorNodeType): { inputs: PortDefinition[]; outputs: PortDefinition[] } {
  const spec = SPECS[classType];
  return { inputs: spec.inputs.map((port) => ({ ...port })), outputs: spec.outputs.map((port) => ({ ...port })) };
}

/** The display name ComfyUI shows for an editor node. */
export function editorNodeDisplayName(classType: EditorNodeType): string {
  return SPECS[classType].displayName;
}

/** Extra words the search matches for an editor node, besides its class and display name. */
export function editorNodeWords(classType: EditorNodeType): string[] {
  return SPECS[classType].words;
}

/** The native record of a new editor node, as ComfyUI's frontend would save it. */
export function editorNodeRecord(classType: EditorNodeType, id: number, title: string, x: number, y: number): Record<string, unknown> {
  const spec = SPECS[classType];
  return {
    id,
    type: classType,
    title,
    pos: [x, y],
    size: [...spec.size],
    flags: {},
    order: 0,
    mode: 0,
    ...spec.extra(),
  };
}
