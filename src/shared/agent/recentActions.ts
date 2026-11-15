import { safeParameter, safeText, slotName, type GraphSummary } from './graph';

/**
 * One applied graph command, as listRecentCommands (main/commands/commit.ts) reads it back from
 * applied_commands joined to graph_revisions. Bulky payloads (a whole imported workflow, an opened project)
 * keep only their type.
 */
export interface RecentCommand {
  actionId: string;
  actor: 'ai' | 'manual';
  /** Mutation type: move-node, connect, set-parameter, … */
  type: string;
  /** Node, edge, group and subgraph ids the command touched (from its payload and its result). */
  ids: string[];
  timestamp: number;
  revisionId: string;
  /** The mutation payload without bulky fields. Values are raw here; recentActionsText redacts them. */
  payload: Record<string, unknown>;
}

const BULKY = new Set(['import-workflow', 'open-native', 'paste-selection']);
const ID_KEYS = ['nodeId', 'edgeId', 'source', 'target', 'groupId', 'definitionId'] as const;

/** The payload a recent command keeps, and the ids it touched. */
export function recentPayload(type: string, payload: Record<string, unknown>, result: Record<string, unknown> | null): { payload: Record<string, unknown>; ids: string[] } {
  const kept = BULKY.has(type)
    ? { type }
    // An arrangement can move hundreds of nodes: the prompt needs how many, not every coordinate.
    : type === 'move-nodes' && Array.isArray(payload.moves)
      ? { type, count: payload.moves.length }
    : type === 'edit-in-subgraph' && isRecord(payload.edit) && payload.edit.type === 'move-nodes' && Array.isArray(payload.edit.moves)
      ? { ...payload, edit: { type: 'move-nodes', count: payload.edit.moves.length } }
    : type === 'edit-in-subgraph' && isRecord(payload.edit) && BULKY.has(String(payload.edit.type))
      ? { type, definitionId: payload.definitionId, edit: { type: payload.edit.type } }
    // A batch (multi-delete, paste, duplicate, cut, a nudge): what it was and how many, not every edit.
    : type === 'batch' && Array.isArray(payload.edits)
      ? { type, label: payload.label, count: payload.edits.length, nodes: payload.edits.reduce<number>((count, edit) => count + (isRecord(edit) && edit.type === 'paste-selection' && Array.isArray(edit.nodes) ? edit.nodes.length : isNodeEdit(edit) ? 1 : 0), 0) }
    : type === 'restore-revision' && typeof result?.restoredRevSeq === 'number'
      ? { ...payload, revSeq: result.restoredRevSeq }
      : payload;
  const ids = new Set<string>();
  for (const source of [payload, result ?? {}]) {
    for (const key of ID_KEYS) {
      const value = source[key];
      if (typeof value === 'string' && value !== '') ids.add(value);
      if (typeof value === 'number') ids.add(String(value));
    }
    for (const key of ['nodeIds'] as const) {
      const list = source[key];
      if (Array.isArray(list)) for (const item of list) if (typeof item === 'string') ids.add(item);
    }
  }
  return { payload: kept, ids: [...ids] };
}

/** An edit of a batch that adds or removes a node (on the canvas or inside a subgraph). */
function isNodeEdit(edit: unknown): boolean {
  if (!isRecord(edit)) return false;
  const type = isRecord(edit.edit) ? edit.edit.type : edit.type;
  return type === 'add-node' || type === 'remove-node' || type === 'insert-subgraph';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
}

function round(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(Math.round(value)) : '?';
}

function nodeName(id: string): string {
  return `node ${safeText(id, 80) || '?'}`;
}

function port(summary: GraphSummary | null, nodeId: string, handle: string, side: 'inputs' | 'outputs'): string {
  const node = summary?.nodes.find((item) => item.id === nodeId);
  const name = node ? slotName(node[side], handle) : '';
  return `${safeText(nodeId, 80)}:${name || safeText(handle, 40)}`;
}

/** One command as a short phrase: "moved node 4 to (780,120)", "set 4.steps = 30", … Values are redacted. */
export function describeCommand(command: RecentCommand, summary: GraphSummary | null, sendFieldValues = true): string {
  const p = command.payload;
  switch (command.type) {
    case 'move-node': return `moved ${nodeName(str(p.nodeId))} to (${round(p.x)},${round(p.y)})`;
    case 'connect': return `connected ${port(summary, str(p.source), str(p.sourceHandle), 'outputs')} → ${port(summary, str(p.target), str(p.targetHandle), 'inputs')}`;
    case 'remove-edge': return `removed connection ${safeText(str(p.edgeId), 80)}`;
    case 'retarget-edge': return `moved connection ${safeText(str(p.edgeId), 80)} to ${port(summary, str(p.target), str(p.targetHandle), 'inputs')}`;
    case 'set-parameter': return `set ${safeText(str(p.nodeId), 80)}.${safeText(str(p.key), 80)} = ${sendFieldValues ? safeParameter(str(p.key), p.value) : '[not sent]'}`;
    case 'add-node': return `added ${safeText(str(p.nodeType), 120)}${command.ids[0] ? ` as ${nodeName(command.ids[0])}` : ''}`;
    case 'remove-node': return `removed ${nodeName(str(p.nodeId))}`;
    case 'remove-selection': return `removed a selection of ${Array.isArray(p.nodeIds) ? p.nodeIds.length : 0} nodes`;
    case 'paste-selection': return 'pasted a selection';
    case 'batch': return `edited ${round(p.count)} items (${safeText(str(p.label), 40)})`;
    case 'annotate-node': return `annotated ${nodeName(str(p.nodeId))}`;
    case 'set-component': return `wrote what ${safeText(str(p.ownerKind), 20)} ${safeText(str(p.ownerId), 80)} is for`;
    case 'set-process': return `named the process "${safeText(str(p.title), 80)}"`;
    case 'import-workflow': return 'imported a workflow';
    case 'open-native': return 'opened a project';
    case 'create-subgraph': return `made subgraph "${safeText(str(p.name), 80)}" from nodes ${Array.isArray(p.nodeIds) ? p.nodeIds.map((id) => safeText(str(id), 40)).join(', ') : '?'}`;
    case 'insert-subgraph': return `placed subgraph ${safeText(str(p.definitionId), 80)}`;
    case 'dissolve-subgraph': return `dissolved subgraph ${nodeName(str(p.nodeId))}`;
    case 'rename-subgraph': return `renamed subgraph ${safeText(str(p.definitionId), 80)} to "${safeText(str(p.name), 80)}"`;
    case 'add-subgraph-io': return `exposed ${port(summary, str(p.nodeId), str(p.handle), p.direction === 'output' ? 'outputs' : 'inputs')} as a subgraph ${p.direction === 'output' ? 'output' : 'input'}`;
    case 'remove-subgraph-io': return `removed a subgraph ${p.direction === 'output' ? 'output' : 'input'}`;
    case 'add-group': return `grouped nodes ${Array.isArray(p.nodeIds) ? p.nodeIds.map((id) => safeText(str(id), 40)).join(', ') : '?'}${str(p.title) ? ` as "${safeText(str(p.title), 80)}"` : ''}`;
    case 'remove-group': return `removed group ${safeText(str(p.groupId), 80)}`;
    case 'edit-in-subgraph': {
      const edit = (p.edit && typeof p.edit === 'object' ? p.edit : {}) as Record<string, unknown>;
      return `inside subgraph ${safeText(str(p.definitionId), 80)}: ${safeText(str(edit.type), 40)}${str(edit.nodeType) ? ` ${safeText(str(edit.nodeType), 120)}` : ''}${str(edit.nodeId) ? ` node ${safeText(str(edit.nodeId), 40)}` : ''}${str(edit.key) ? ` field ${safeText(str(edit.key), 80)}` : ''}`;
    }
    case 'rename-group': return `renamed group ${safeText(str(p.groupId), 80)} to "${safeText(str(p.title), 80)}"`;
    case 'restore-revision': return `restored revision ${round(p.revSeq)}`;
    case 'move-nodes': return `arranged ${round(p.count)} nodes`;
    case 'rename-subgraph-io': return `renamed a subgraph ${p.direction === 'output' ? 'output' : 'input'} to "${safeText(str(p.name), 80)}"`;
    case 'rename-node': return `renamed ${nodeName(str(p.nodeId))} to "${safeText(str(p.title), 80)}"`;
    default: return safeText(command.type, 40);
  }
}

/**
 * The person's recent actions, oldest first, as one line for the prompt. Repeated moves of the same node
 * collapse to the last one. The selection (from the turn context) closes the line.
 */
export function recentActionsText(commands: RecentCommand[], summary: GraphSummary | null, selectedIds: readonly string[] = [], sendFieldValues = true): string {
  const manual = commands.filter((command) => command.actor === 'manual');
  const lastMove = new Map<string, number>();
  manual.forEach((command, index) => {
    if (command.type === 'move-node') lastMove.set(str(command.payload.nodeId), index);
  });
  const phrases = manual
    .filter((command, index) => command.type !== 'move-node' || lastMove.get(str(command.payload.nodeId)) === index)
    .map((command) => describeCommand(command, summary, sendFieldValues));
  const selected = selectedIds.map((id) => safeText(id, 80)).filter((id) => id !== '');
  if (selected.length > 0) phrases.push(`selected ${selected.length === 1 ? 'node' : 'nodes'} ${selected.join(', ')}`);
  return phrases.join('; ');
}
