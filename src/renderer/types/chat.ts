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
}
