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
