/**
 * The chat's own types: a message, its tool calls, a checkpoint pause, the app's notices about a turn.
 *
 * Who uses it: services/llm/chatService.ts and chatModel.ts, state/chatState.ts, and components/chat (Message,
 * ToolCard, BuildCard, BuildSummary, QuietGroup, buildSteps.ts, toolPresentation.ts).
 * Why "not persisted" marks: main stores a chat message without these fields, so they live only in this session.
 */
import type { TurnError } from '../../shared/agent/turnError';
import type { AgentTurnContext } from '../../shared/contracts';

/** Tool family, from the AGENT_* name lists in shared/contracts/agentTools.ts. */
export type ToolKind = 'read' | 'knowledge' | 'proposal' | 'build' | 'other';

/** A call is pending until its result arrives. */
export type ToolStatus = 'pending' | 'success' | 'error';

/**
 * One tool call of an assistant turn, as the chat shows it.
 * `name` and `toolName` carry the same value; `name` is kept for older callers and tests.
 */
export interface ToolCall {
  id: string;
  name: string;
  toolName: string;
  kind: ToolKind;
  args: Record<string, unknown>;
  result?: unknown;
  status: ToolStatus;
  error?: string;
  /** Set when a propose* tool created a ghost. */
  proposalId?: string;
  /** Set when the explain tool saved an explanation. */
  explanationId?: string;
}

/**
 * A turn that stopped on a guard instead of the model's own answer (main sends 'turn-paused'). The run stays
 * paused; Continue resumes it and sends "continue" with `context`, Stop cancels it.
 */
export interface TurnCheckpoint {
  reason: 'step-limit' | 'failure-streak';
  steps: number;
  /** Failed tool results in a row, for the failure-streak reason. */
  failures?: number;
  /** The context of the paused turn; Continue sends with it. */
  context?: AgentTurnContext;
  /** open: buttons shown; continued / stopped: what the person chose; closed: a later turn moved on. */
  state: 'open' | 'continued' | 'stopped' | 'closed';
}

/**
 * Something the person should know about how a turn went, said by the app (not by the model). For now one kind:
 * the model on the person's own server works with a context window too small for the helper's request.
 */
export interface TurnNotice {
  /** context-window: the window is small; no-tools: the model cannot call tools and answered without them. */
  code: 'context-window' | 'no-tools';
  /** 'cut': the server dropped part of the request. 'tight': it fit, with little room left for a build. */
  state: 'tight' | 'cut';
  /** The window the server loaded the model with, in tokens. */
  window: number;
  /** About how many tokens the helper's request needs. */
  needed: number;
  model: string;
  /** The turn already ran with the reduced tool set. */
  compact: boolean;
}

/** A notice chunk from main as the chat accepts it, or null when it is not one this version knows. */
export function parseTurnNotice(input: unknown): TurnNotice | null {
  if (!input || typeof input !== 'object') return null;
  const record = input as Record<string, unknown>;
  if (record.code === 'no-tools') {
    return { code: 'no-tools', state: 'tight', window: 0, needed: 0, model: typeof record.model === 'string' ? record.model.slice(0, 200) : '', compact: false };
  }
  if (record.code !== 'context-window') return null;
  if (record.state !== 'tight' && record.state !== 'cut') return null;
  const window = Number(record.window);
  const needed = Number(record.needed);
  if (!Number.isFinite(window) || !Number.isFinite(needed) || window <= 0 || needed <= 0) return null;
  return {
    code: 'context-window',
    state: record.state,
    window: Math.round(window),
    needed: Math.round(needed),
    model: typeof record.model === 'string' ? record.model.slice(0, 200) : '',
    compact: record.compact === true,
  };
}

/** One message of the chat, from the person, the assistant or the app. */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  graphRevisionId?: string;
  toolCalls?: ToolCall[];
  /** The turn context a person's message was sent with; drives the "about" chip. Not persisted. */
  context?: AgentTurnContext;
  /** Set on the assistant message of a turn that paused at a checkpoint. Not persisted. */
  checkpoint?: TurnCheckpoint;
  /**
   * The record of this answer's turn in the conversation log (Help ▸ Conversation log), when the log is kept.
   * Lets the person open the log on exactly this answer. Not persisted: after a restart the log lists every turn.
   */
  logId?: string;
  /** What the app noticed about this turn (TurnNotice). Not persisted. */
  notices?: TurnNotice[];
  /**
   * Set on the message that says a turn failed: the kind (key, rate, …), the server's short redacted words, and
   * the question with its context so "Retry" (chat.retry) can send it again. Not persisted.
   */
  turnError?: ChatTurnError;
  /** The person stopped this answer (Stop): its build card says stopped, not done. Not persisted. */
  stopped?: boolean;
}

/** A failed turn's error plus what Retry needs to ask again. */
export interface ChatTurnError extends TurnError {
  question: string;
  context?: AgentTurnContext;
}
