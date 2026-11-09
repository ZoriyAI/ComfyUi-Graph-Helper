import {
  AGENT_BUILD_TOOLS,
  AGENT_KNOWLEDGE_TOOLS,
  AGENT_PROPOSAL_TOOLS,
  AGENT_READ_TOOLS,
  type ChatRecord,
  type ObjectRef,
  type ObjectKind,
} from '../../../shared/contracts';
import type { ChatMessage, ToolCall, ToolKind, ToolStatus } from '../../types/chat';

/**
 * Pure helpers for the chat: tool classification, result reading, and ChatRecord mapping.
 * No store or bridge access here, so they are unit-tested directly.
 */

const READ = new Set<string>(AGENT_READ_TOOLS);
const KNOWLEDGE = new Set<string>(AGENT_KNOWLEDGE_TOOLS);
const PROPOSAL = new Set<string>(AGENT_PROPOSAL_TOOLS);
const BUILD = new Set<string>(AGENT_BUILD_TOOLS);

export function toolKind(name: string): ToolKind {
  if (READ.has(name)) return 'read';
  if (KNOWLEDGE.has(name)) return 'knowledge';
  if (PROPOSAL.has(name)) return 'proposal';
  if (BUILD.has(name)) return 'build';
  return 'other';
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

const OBJECT_KINDS: readonly ObjectKind[] = ['node', 'port', 'edge', 'subgraph', 'group', 'nodeClass', 'model', 'process'];

/** Reads an ObjectRef from untrusted data (a tool result or a saved record). */
export function asObjectRef(value: unknown): ObjectRef | null {
  if (!isRecord(value)) return null;
  const kind = value.kind;
  const id = value.id;
  if (typeof kind !== 'string' || !OBJECT_KINDS.includes(kind as ObjectKind) || typeof id !== 'string' || id === '') return null;
  const ref: ObjectRef = { kind: kind as ObjectKind, id };
  for (const key of ['nodeId', 'portName', 'classType', 'directory', 'name'] as const) {
    const item = value[key];
    if (typeof item === 'string') ref[key] = item;
  }
  if (value.direction === 'input' || value.direction === 'output') ref.direction = value.direction;
  return ref;
}

function stringField(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) return undefined;
  const item = value[key];
  return typeof item === 'string' && item !== '' ? item : undefined;
}

/** Tool-call arguments arrive as an object (AI SDK `input`), a JSON string, or not at all. */
export function parseToolArgs(value: unknown): Record<string, unknown> {
  if (isRecord(value)) return value;
  if (typeof value === 'string' && value.trim().startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(value);
      return isRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

/** Status and error of a tool result: `success: false` means failed, whatever else it carries. */
export function settleFromResult(result: unknown): { status: Exclude<ToolStatus, 'pending'>; error?: string } {
  if (isRecord(result) && result.success === false) {
    const error = stringField(result, 'error') ?? stringField(result, 'message') ?? 'Tool failed';
    return { status: 'error', error };
  }
  return { status: 'success' };
}

/** Copies ids the cards need from a successful result onto the call. */
export function withResultIds(call: ToolCall): ToolCall {
  if (call.status !== 'success') return call;
  const proposalId = stringField(call.result, 'proposalId');
  const explanationId = stringField(call.result, 'explanationId');
  return {
    ...call,
    ...(proposalId ? { proposalId } : {}),
    ...(explanationId ? { explanationId } : {}),
  };
}

export function newToolCall(id: string, name: string, args: Record<string, unknown> = {}): ToolCall {
  return { id, name, toolName: name, kind: toolKind(name), args, status: 'pending' };
}

/** Error marker of a call that was saved before it finished; the card shows chat.interrupted for it. */
export const INTERRUPTED_ERROR = 'interrupted';

/**
 * Largest tool result kept in a saved chat message, as JSON characters. A larger one keeps its message and ids
 * with `truncated: true` in the saved result the card shows. Only the stored copy of the card is shortened: the graph, the
 * catalog and the live turn are never cut, and the row stays well under the 5 MB store guard in main.
 */
export const SAVED_RESULT_CAP = 20_000;
const SAVED_ARG_CAP = 20_000;

function capped(value: unknown, cap: number): unknown {
  if (value === undefined) return undefined;
  let text: string;
  try {
    text = JSON.stringify(value);
  } catch {
    return undefined;
  }
  if (text === undefined || text.length <= cap) return value;
  if (isRecord(value)) {
    const keep: Record<string, unknown> = {};
    for (const key of ['success', 'message', 'error', 'proposalId', 'explanationId', 'provenance', 'owner', 'kind', 'note', 'nodeId', 'edgeId', 'definitionId']) {
      if (value[key] !== undefined) keep[key] = value[key];
    }
    keep.truncated = true;
    return keep;
  }
  return { truncated: true };
}

/** A tool call as it is stored in chat_messages.tool_calls: compact, no bulky results. */
export function savedToolCall(call: ToolCall): Record<string, unknown> {
  return {
    id: call.id,
    toolName: call.toolName,
    kind: call.kind,
    status: call.status,
    args: capped(call.args, SAVED_ARG_CAP) ?? {},
    ...(call.result !== undefined ? { result: capped(call.result, SAVED_RESULT_CAP) } : {}),
    ...(call.error ? { error: call.error } : {}),
    ...(call.proposalId ? { proposalId: call.proposalId } : {}),
    ...(call.explanationId ? { explanationId: call.explanationId } : {}),
  };
}

export function chatRecordFromMessage(message: ChatMessage, projectId: string, graphRevisionId: string | null): ChatRecord {
  const calls = message.toolCalls ?? [];
  return {
    id: message.id,
    projectId,
    role: message.role,
    content: message.content,
    timestamp: Math.max(0, Math.floor(message.timestamp)),
    graphRevisionId: message.graphRevisionId ?? graphRevisionId,
    toolCalls: calls.length > 0 ? calls.map(savedToolCall) : null,
  };
}

function toolCallFromSaved(value: unknown, index: number): ToolCall | null {
  if (!isRecord(value)) return null;
  const name = stringField(value, 'toolName') ?? stringField(value, 'name');
  if (!name) return null;
  const status: ToolStatus = value.status === 'success' || value.status === 'error' ? value.status : 'error';
  const call: ToolCall = {
    ...newToolCall(stringField(value, 'id') ?? `saved-${index}`, name, parseToolArgs(value.args ?? value.arguments)),
    status,
  };
  if (value.result !== undefined) call.result = value.result;
  const error = stringField(value, 'error');
  if (error) call.error = error;
  // A call saved while pending never finished; it is shown as failed rather than spinning forever.
  if (value.status === 'pending') call.error = call.error ?? INTERRUPTED_ERROR;
  const proposalId = stringField(value, 'proposalId');
  const explanationId = stringField(value, 'explanationId');
  if (proposalId) call.proposalId = proposalId;
  if (explanationId) call.explanationId = explanationId;
  return call;
}

export function messageFromChatRecord(record: ChatRecord): ChatMessage {
  const toolCalls = (record.toolCalls ?? [])
    .map((item, index) => toolCallFromSaved(item, index))
    .filter((item): item is ToolCall => item !== null);
  return {
    id: record.id,
    role: record.role,
    content: record.content,
    timestamp: record.timestamp,
    ...(record.graphRevisionId ? { graphRevisionId: record.graphRevisionId } : {}),
    ...(toolCalls.length > 0 ? { toolCalls } : {}),
  };
}

/** i18next language → turn language. */
export function turnLanguage(language: string | undefined): 'en' | 'ru' {
  return language?.startsWith('ru') ? 'ru' : 'en';
}
