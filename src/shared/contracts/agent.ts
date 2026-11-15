/**
 * What the renderer and main's agent exchange around a chat turn: the turn context sent with a message, the build
 * step chunks streamed back while the helper builds, stored chat messages and the run a turn commits into.
 * main/agent/turn.ts reads and writes them; renderer/services/llm/chatService.ts and the canvas
 * (canvasStore.ts, graph/lib/buildQueue.ts) consume the build steps.
 */
import type { BuildStepTool } from './agentTools';
import type { Explanation } from './knowledge';
import type { ObjectRef } from './objects';

/** The canvas camera when the message was sent: React Flow transform, plus the canvas size in screen pixels. */
export interface AgentViewport {
  x: number;
  y: number;
  zoom: number;
  width?: number;
  height?: number;
}

/**
 * What the renderer knows about the moment a message is sent. Main builds the prompt from it and from the
 * project (every widget value, redacted only where it looks like a secret).
 */
export interface AgentTurnContext {
  intent: 'ask' | 'build' | 'chat';
  /** The object a person right-clicked or asked about. */
  objectRef?: ObjectRef;
  selection: ObjectRef[];
  language: 'en' | 'ru';
  /** What is on screen. Optional: older renderers do not send it. */
  viewport?: AgentViewport;
}


/**
 * Content of the `build-step` stream chunk, sent right after the `projection` chunk of a build tool commit.
 * Older renderers ignore the chunk type; the same `why` and `explanationId` are on the tool result.
 */
export interface AgentBuildStep {
  toolName: BuildStepTool;
  toolCallId: string;
  /** The node the step is about (added, changed, removed, or the new subgraph instance). */
  nodeId?: string;
  /** The new connection (connectNodes). */
  edgeId?: string;
  /** The subgraph definition (createSubgraph, insertSubgraph). */
  subgraphId?: string;
  /** The widget that changed (setParameter). */
  key?: string;
  why: string;
  /** The saved explanation, or null when nothing was stored (no why, a removal, or a refused save). */
  explanationId: string | null;
  explanation: Explanation | null;
  revisionId: string;
}

/** One stored chat message of a project. */
/**
 * Messages one page of the chat holds: the chat service loads the newest page, then older ones as the person
 * scrolls up, and takes a page shorter than this as "nothing older left". Main's chat history pages by the limit
 * the renderer sends, so this one number is the page size on both sides.
 */
export const CHAT_PAGE_SIZE = 200;

export interface ChatRecord {
  id: string;
  projectId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  graphRevisionId: string | null;
  toolCalls: unknown[] | null;
}

/** 4th argument of llm:stream-chat: the run the turn commits build tools into. */
export interface AgentRunContext {
  projectId: string;
  runId: string;
  expectedRevisionId: string;
}

/** chat:save-message result. `error` explains a refusal (schema, secret-shaped content, unknown project). */
export interface ChatSaveResult {
  ok: boolean;
  error?: string;
}
