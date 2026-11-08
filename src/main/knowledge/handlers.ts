import type Database from 'better-sqlite3';
import { ZodError } from 'zod';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type { ExplanationInput, ListExplanationsRequest, SearchModelsRequest, SearchNodesRequest } from '../../shared/contracts/knowledge';
import {
  classTypeSchema,
  explanationInputSchema,
  listExplanationsSchema,
  modelKeySchema,
  projectIdSchema,
  searchModelsSchema,
  searchNodesSchema,
  setAutoSchema,
} from '../../shared/knowledge/schemas';
import type { SyncService } from '../mcp/sync';
import {
  checkGraph,
  listExplanations,
  modelDetail,
  nodeClassDetail,
  saveExplanation,
  searchModels,
  searchNodeClasses,
} from './repository';

export type KnowledgeHandler = (...args: unknown[]) => unknown;

/** Messages our own code throws on purpose; anything else becomes a generic message so no internals leak. */
const PUBLIC_MESSAGES = new Set(['Project was not found.']);

export class KnowledgeRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KnowledgeRequestError';
  }
}

function clean(error: unknown): KnowledgeRequestError {
  if (error instanceof ZodError) return new KnowledgeRequestError('Knowledge request is not valid.');
  if (error instanceof Error && PUBLIC_MESSAGES.has(error.message)) return new KnowledgeRequestError(error.message);
  return new KnowledgeRequestError('Knowledge request failed.');
}

function guarded(handler: KnowledgeHandler): KnowledgeHandler {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      throw clean(error);
    }
  };
}

/**
 * knowledge:* and sync:* handlers without Electron, so they can be tested directly.
 * Each handler receives the IPC arguments after the event and validates them with zod.
 */
export function knowledgeHandlers(deps: { db: () => Database.Database; sync: SyncService; fetchImpl?: typeof fetch }): Record<string, KnowledgeHandler> {
  const { db, sync } = deps;
  const table: Record<string, KnowledgeHandler> = {
    [IPC_CHANNELS.KNOWLEDGE_SEARCH_NODES]: (request) => searchNodeClasses(db(), searchNodesSchema.parse(request) as SearchNodesRequest),
    [IPC_CHANNELS.KNOWLEDGE_NODE_DETAIL]: (classType) => nodeClassDetail(db(), classTypeSchema.parse(classType)),
    [IPC_CHANNELS.KNOWLEDGE_SEARCH_MODELS]: (request) => searchModels(db(), searchModelsSchema.parse(request) as SearchModelsRequest),
    [IPC_CHANNELS.KNOWLEDGE_MODEL_DETAIL]: (request) => {
      const key = modelKeySchema.parse(request);
      return modelDetail(db(), key.directory, key.name);
    },
    [IPC_CHANNELS.KNOWLEDGE_LIST_EXPLANATIONS]: (request) => listExplanations(db(), listExplanationsSchema.parse(request ?? {}) as ListExplanationsRequest),
    [IPC_CHANNELS.KNOWLEDGE_SAVE_EXPLANATION]: (input) => saveExplanation(db(), explanationInputSchema.parse(input) as ExplanationInput),
    [IPC_CHANNELS.KNOWLEDGE_CHECK_GRAPH]: (projectId) => checkGraph(db(), projectIdSchema.parse(projectId)),
    [IPC_CHANNELS.SYNC_STATUS]: () => sync.status(db()),
    [IPC_CHANNELS.SYNC_NOW]: () => sync.runSync(db(), deps.fetchImpl),
    [IPC_CHANNELS.SYNC_SET_AUTO]: (request) => {
      const parsed = setAutoSchema.parse(request);
      return sync.setAuto(db(), parsed.enabled, parsed.intervalMinutes);
    },
  };
  return Object.fromEntries(Object.entries(table).map(([channel, handler]) => [channel, guarded(handler)]));
}
