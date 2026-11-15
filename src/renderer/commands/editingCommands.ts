/**
 * The editing commands of the canvas, as the menu bar (Graph), the canvas context menu and the shortcuts reach
 * them: bypass and mute the selected nodes, add a note, place a node on the selected link, replace the selected
 * node, and colour nodes. Each one sends one mutation (main/commands/editOps.ts), so it is one undo step.
 *
 * Who uses it: appCommands.ts registers them; components/shell/MenuBar.tsx and components/graph/editingMenu.tsx
 * list them and call the helpers here directly for a node or link under the pointer.
 * Why the commands stay enabled while the selection does not fit: a person who presses the shortcut or picks the
 * menu item with nothing selected is told in one sentence what to select, instead of a silent key.
 */
import { Ban, Palette, Replace, Spline, StickyNote, Waypoints } from 'lucide-react';
import type { Command } from './registry';
import { NODE_COLORS } from '../../shared/commands/types';
import { canEditLevel, selectedEdgeIds, selectedNodes } from './actions';
import { commitManual } from '../components/graph/commit';
import { placeNewNode } from '../components/graph/placeNode';
import { useCanvasStore } from '../components/graph/canvasStore';
import { levelEdges, levelNodes } from '../components/graph/lib/level';
import { nodeRunMode } from '../../shared/graph/layout';
import { isEditorNodeType } from '../../shared/graph/editorNodes';
import { showToast } from '../ui/toastStore';
import { i18n } from '../i18n';
import type { GraphNode } from '../types/graph';
import { paletteNameOf, type ColorName } from '../../shared/graph/palette';

const translate = (key: string, options?: Record<string, unknown>) => String(i18n.t(key, options ?? {}));

/** The palette colour all selected nodes share, 'none' when none has one, null when they differ or none is selected. */
export function selectionColor(): ColorName | 'none' | null {
  const nodes = selectedNodes();
  if (nodes.length === 0) return null;
  const names = new Set(nodes.map((node) => {
    const comfy = node.data.comfy as { color?: unknown } | undefined;
    return comfy?.color === undefined ? 'none' : paletteNameOf(comfy.color) ?? 'other';
  }));
  if (names.size !== 1) return null;
  const [only] = names;
  return only === 'other' ? null : only as ColorName | 'none';
}

/** One short note when a command does not fit the selection. */
function tell(key: string): void {
  showToast({ id: 'editing-selection', tone: 'info', title: translate(key), duration: 4000 });
}

/** The level on screen takes manual edits (no replay is open). */
function editable(): boolean {
  return canEditLevel() && !useCanvasStore.getState().replay;
}

/** Selected nodes that ComfyUI runs: notes have nothing to bypass or mute. */
function runnableSelection(): GraphNode[] {
  return selectedNodes().filter((node) => node.type === 'comfy' && !['Note', 'MarkdownNote'].includes(String(node.data.comfyType)));
}

/** True when every selected node already has this run mode, so the command takes it off again. */
export function selectionHasMode(mode: 'bypassed' | 'muted'): boolean {
  const nodes = runnableSelection();
  return nodes.length > 0 && nodes.every((node) => nodeRunMode(node.data as { comfy?: unknown }) === mode);
}

/** Sets how ComfyUI runs these nodes, in one undo step. */
export async function setRunMode(nodeIds: string[], mode: 'always' | 'bypass' | 'mute'): Promise<void> {
  if (nodeIds.length === 0) {
    tell('editing.noNodes');
    return;
  }
  await commitManual({ type: 'set-node-mode', nodeIds, mode });
}

/** Bypass (or mute) the selected nodes; when all of them already are, they run again. One undo step. */
export async function toggleRunMode(mode: 'bypass' | 'mute'): Promise<void> {
  const nodes = runnableSelection();
  if (nodes.length === 0) {
    tell('editing.noNodes');
    return;
  }
  const on = selectionHasMode(mode === 'bypass' ? 'bypassed' : 'muted');
  await setRunMode(nodes.map((node) => node.id), on ? 'always' : mode);
}

/** A new Note in the middle of the view (or at `at`), selected like any added node. */
export async function addNote(at: { x: number; y: number } | null = null): Promise<void> {
  // 400 x 200 is the size a new Note gets, so the free spot is found for the whole note.
  const spot = await placeNewNode(at, { classType: 'Note', size: { width: 400, height: 200 } });
  await commitManual({ type: 'add-node', nodeType: 'Note', title: 'Note', x: Math.round(spot.x), y: Math.round(spot.y) });
}

/** The type a link carries and the type its target input takes, for the search that fills the link. */
function linkTypes(edgeId: string): { dataType: string; targetType: string; at: { x: number; y: number } } | null {
  const edge = levelEdges().find((item) => item.id === edgeId);
  if (!edge) return null;
  const nodes = levelNodes();
  const source = nodes.find((node) => node.id === edge.source);
  const target = nodes.find((node) => node.id === edge.target);
  const dataType = String(edge.data?.dataType ?? '*');
  const targetType = target?.data.inputs.find((port) => port.id === edge.targetHandle)?.dataType ?? dataType;
  // Halfway along the link: the new node goes where the person looks.
  const at = source && target
    ? { x: Math.round((source.position.x + target.position.x) / 2), y: Math.round((source.position.y + target.position.y) / 2) }
    : { x: 0, y: 0 };
  return { dataType, targetType, at };
}

/** Opens the node search to place a node on a link; the search lists only nodes that fit it. */
export function openInsertOnLink(edgeId?: string): void {
  const id = edgeId ?? (selectedEdgeIds().length === 1 ? selectedEdgeIds()[0] : undefined);
  const types = id ? linkTypes(id) : null;
  if (!id || !types) {
    tell('editing.oneLink');
    return;
  }
  useCanvasStore.getState().openAddSearch(types.at, undefined, undefined, { kind: 'insert', edgeId: id, dataType: types.dataType, targetType: types.targetType });
}

/** Places a Reroute on a link at once (no search: there is only one kind). */
export async function addRerouteOnLink(edgeId: string): Promise<void> {
  const types = linkTypes(edgeId);
  if (!types) {
    tell('editing.oneLink');
    return;
  }
  await commitManual({ type: 'insert-node-on-edge', edgeId, nodeType: 'Reroute', title: 'Reroute', x: types.at.x, y: types.at.y });
}

/** True when this node can be put aside for another class (not a subgraph, note, reroute or primitive). */
export function replaceable(node: GraphNode | undefined): boolean {
  return Boolean(node && node.type === 'comfy' && node.data.kind !== 'subgraph-instance' && !isEditorNodeType(String(node.data.comfyType)));
}

/** Opens the node search to put another node in the selected node's place. */
export function openReplaceNode(nodeId?: string): void {
  const nodes = selectedNodes();
  const node = nodeId ? levelNodes().find((item) => item.id === nodeId) : nodes.length === 1 ? nodes[0] : undefined;
  if (!node) {
    tell('editing.oneNode');
    return;
  }
  if (!replaceable(node)) {
    showToast({ id: 'editing-selection', tone: 'info', title: translate('editing.errors.notReplaceable'), duration: 5000 });
    return;
  }
  useCanvasStore.getState().openAddSearch(null, undefined, undefined, { kind: 'replace', nodeId: node.id, name: String(node.data.title || node.data.comfyType) });
}

/** Colours the selected nodes (null takes the colour off). One undo step. */
export async function colorSelection(color: ColorName | null, nodeIds?: string[]): Promise<void> {
  const ids = nodeIds ?? selectedNodes().map((node) => node.id);
  if (ids.length === 0) {
    tell('editing.noNodes');
    return;
  }
  await commitManual({ type: 'set-node-color', nodeIds: ids, color });
}

/** Colours a group (null takes the colour off). */
export async function colorGroup(groupId: string, color: ColorName | null): Promise<void> {
  await commitManual({ type: 'set-group-color', groupId, color });
}

/** Command ids of the colour choices, the menu bar lists them as one group. */
export const COLOR_COMMAND_IDS = [...NODE_COLORS.map((name) => `graph.color.${name}`), 'graph.color.none'];

/** Graph ▸ Bypass, Mute, Add note, Insert node…, Replace with…, Color. */
export function buildEditingCommands(): Command[] {
  const colorCommands: Command[] = [...NODE_COLORS, null].map((name) => ({
    id: `graph.color.${name ?? 'none'}`,
    group: 'graph' as const,
    labelKey: name ? `editing.colors.${name}` : 'editing.colorNone',
    icon: Palette,
    enabled: editable,
    checked: () => selectionColor() === (name ?? 'none'),
    run: () => void colorSelection(name),
  }));
  return [
    {
      id: 'graph.bypass', group: 'graph', labelKey: 'editing.bypass', hintKey: 'editing.bypassHint', icon: Waypoints, shortcut: 'Mod+Shift+B',
      enabled: editable, checked: () => selectionHasMode('bypassed'), run: () => void toggleRunMode('bypass'),
    },
    {
      id: 'graph.mute', group: 'graph', labelKey: 'editing.mute', hintKey: 'editing.muteHint', icon: Ban, shortcut: 'Mod+M',
      enabled: editable, checked: () => selectionHasMode('muted'), run: () => void toggleRunMode('mute'),
    },
    { id: 'graph.addNote', group: 'graph', labelKey: 'editing.addNote', hintKey: 'editing.addNoteHint', icon: StickyNote, enabled: editable, run: () => void addNote() },
    { id: 'graph.insertOnLink', group: 'graph', labelKey: 'editing.insertNode', hintKey: 'editing.insertNodeHint', icon: Spline, enabled: editable, run: () => openInsertOnLink() },
    { id: 'graph.replaceNode', group: 'graph', labelKey: 'editing.replaceNode', hintKey: 'editing.replaceNodeHint', icon: Replace, enabled: editable, run: () => openReplaceNode() },
    ...colorCommands,
  ];
}
