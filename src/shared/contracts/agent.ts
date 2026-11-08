import type { ObjectRef } from './objects';

/** What the renderer knows about the moment a message is sent. No widget values, no secrets. */
export interface AgentTurnContext {
  intent: 'ask' | 'build' | 'chat';
  /** The object a person right-clicked or asked about. */
  objectRef?: ObjectRef;
  selection: ObjectRef[];
  language: 'en' | 'ru';
}

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
