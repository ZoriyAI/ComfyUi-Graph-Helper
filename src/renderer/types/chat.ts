import type { AgentTurnContext } from '../../shared/contracts';

/** Tool family, from the AGENT_* name lists in shared/contracts/agentTools.ts. */
export type ToolKind = 'read' | 'knowledge' | 'proposal' | 'build' | 'other';

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
 * Chat message
 */
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
}
