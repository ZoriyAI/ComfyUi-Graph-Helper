/**
 * The knowledge:* and sync:* request handlers: node and model search and detail, previews, internet lookup,
 * explanations, the graph check, the node class guard, field models, and the sync controls.
 * Registered by ipc/knowledgeIpc.ts; the tests (knowledgeIpc, nodeClassGuard, fieldSpec) call them directly.
 * Every argument is validated with zod, and every error leaving here is one of a few fixed messages.
 */
import type Database from 'better-sqlite3';
import { ZodError } from 'zod';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type { ExplanationInput, ListExplanationsRequest, ModelLookupResult, ModelPreview, SearchModelsRequest, SearchNodesRequest } from '../../shared/contracts/knowledge';
import {
  classTypeSchema,
  userExplanationInputSchema,
  listExplanationsSchema,
  modelKeySchema,
  projectIdSchema,
  searchModelsSchema,
  searchNodesSchema,
  setAutoSchema,
  syncItemSchema,
  syncSkipSchema,
} from '../../shared/knowledge/schemas';
import type { SyncService } from '../mcp/sync';
import { carriesSecret, textCarriesSecret } from '../../shared/config/draft';
import {
  checkGraph,
  listExplanations,
  modelDetail,
  nodeClassDetail,
  saveExplanation,
  deleteAssistantExplanations,
  deletePersonExplanation,
  searchModels,
  searchNodeClasses,
} from './repository';
import { validateNodeClass } from './nodeClassGuard';
import { graphResources } from './resources';
import { fieldModels, fieldModelsSchema } from './fieldModels';

/** One handler: the IPC arguments after the event, unvalidated. */
export type KnowledgeHandler = (...args: unknown[]) => unknown;

/** Refusal of an explanation whose text or link looks like a key or a token. */
export const EXPLANATION_SECRET_ERROR = 'Explanations cannot store a secret.';

/** Messages our own code throws on purpose; anything else becomes a generic message so no internals leak. */
const PUBLIC_MESSAGES = new Set(['Project was not found.', EXPLANATION_SECRET_ERROR]);

/** The only error type the window gets from these handlers. */
export class KnowledgeRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KnowledgeRequestError';
  }
}

/** Any error as a KnowledgeRequestError with a fixed message. */
function clean(error: unknown): KnowledgeRequestError {
  if (error instanceof ZodError) return new KnowledgeRequestError('Knowledge request is not valid.');
  if (error instanceof Error && PUBLIC_MESSAGES.has(error.message)) return new KnowledgeRequestError(error.message);
  return new KnowledgeRequestError('Knowledge request failed.');
}

/** Wraps a handler so a thrown error (sync or async) leaves cleaned. */
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
export function knowledgeHandlers(deps: {
  db: () => Database.Database;
  sync: SyncService;
  fetchImpl?: typeof fetch;
  resources?: (projectId: string, refresh: boolean) => Promise<import('../../shared/contracts/resources').GraphResources>;
  modelText?: (detail: import('../../shared/contracts/knowledge').ModelDetail | null) => import('../../shared/contracts/knowledge').ModelDetail | null;
  /** Reads the preview that lies next to a model file; without it no model has one. */
  preview?: (directory: string, name: string) => Promise<ModelPreview | null>;
  /** The card's "Find on the internet": the fingerprint on the server, then the lookup. Without it, neither. */
  lookup?: {
    hash: (directory: string, name: string) => Promise<ModelLookupResult>;
    lookup: (directory: string, name: string) => Promise<ModelLookupResult>;
  };
}): Record<string, KnowledgeHandler> {
  const { db, sync } = deps;
  const table: Record<string, KnowledgeHandler> = {
    [IPC_CHANNELS.KNOWLEDGE_SEARCH_NODES]: (request) => searchNodeClasses(db(), searchNodesSchema.parse(request) as SearchNodesRequest),
    [IPC_CHANNELS.KNOWLEDGE_NODE_DETAIL]: (classType) => nodeClassDetail(db(), classTypeSchema.parse(classType)),
    [IPC_CHANNELS.KNOWLEDGE_SEARCH_MODELS]: (request) => searchModels(db(), searchModelsSchema.parse(request) as SearchModelsRequest),
    [IPC_CHANNELS.KNOWLEDGE_MODEL_DETAIL]: (request) => {
      const key = modelKeySchema.parse(request);
      return deps.modelText ? deps.modelText(modelDetail(db(), key.directory, key.name)) : modelDetail(db(), key.directory, key.name);
    },
    [IPC_CHANNELS.KNOWLEDGE_MODEL_PREVIEW]: (request) => {
      const key = modelKeySchema.parse(request);
      return deps.preview ? deps.preview(key.directory, key.name) : null;
    },
    [IPC_CHANNELS.KNOWLEDGE_MODEL_HASH]: (request) => {
      const key = modelKeySchema.parse(request);
      return deps.lookup ? deps.lookup.hash(key.directory, key.name) : { ok: false, error: 'no-server', detail: modelDetail(db(), key.directory, key.name) };
    },
    [IPC_CHANNELS.KNOWLEDGE_MODEL_LOOKUP]: (request) => {
      const key = modelKeySchema.parse(request);
      return deps.lookup ? deps.lookup.lookup(key.directory, key.name) : { ok: false, error: 'unreachable', detail: modelDetail(db(), key.directory, key.name) };
    },
    [IPC_CHANNELS.KNOWLEDGE_LIST_EXPLANATIONS]: (request) => listExplanations(db(), listExplanationsSchema.parse(request ?? {}) as ListExplanationsRequest),
    [IPC_CHANNELS.KNOWLEDGE_SAVE_EXPLANATION]: (input) => {
      const parsed = userExplanationInputSchema.parse(input);
      if (textCarriesSecret(parsed.text) || carriesSecret({ sourceUrl: parsed.sourceUrl ?? '' })) throw new KnowledgeRequestError(EXPLANATION_SECRET_ERROR);
      // What the person writes in the app is theirs, whatever the request claims.
      return saveExplanation(db(), { ...parsed, provenance: 'user', createdBy: 'user' } as ExplanationInput);
    },
    [IPC_CHANNELS.KNOWLEDGE_DELETE_EXPLANATION]: (id) => ({ removed: deletePersonExplanation(db(), id) }),
    [IPC_CHANNELS.KNOWLEDGE_DELETE_ASSISTANT_EXPLANATIONS]: (owner) => ({ removed: deleteAssistantExplanations(db(), owner) }),
    [IPC_CHANNELS.KNOWLEDGE_GRAPH_RESOURCES]: (projectId, refresh) => deps.resources ? deps.resources(projectIdSchema.parse(projectId), refresh === true) : graphResources(db(), projectIdSchema.parse(projectId)),
    [IPC_CHANNELS.KNOWLEDGE_CHECK_GRAPH]: (projectId) => checkGraph(db(), projectIdSchema.parse(projectId)),
    [IPC_CHANNELS.KNOWLEDGE_VALIDATE_NODE_CLASS]: (classType) => validateNodeClass(db(), classTypeSchema.parse(classType)),
    [IPC_CHANNELS.KNOWLEDGE_FIELD_MODELS]: (request) => fieldModels(db(), fieldModelsSchema.parse(request)),
    [IPC_CHANNELS.SYNC_STATUS]: () => sync.status(db()),
    [IPC_CHANNELS.SYNC_NOW]: () => sync.runSync(db(), deps.fetchImpl),
    [IPC_CHANNELS.SYNC_SET_AUTO]: (request) => {
      const parsed = setAutoSchema.parse(request);
      return sync.setAuto(db(), parsed.enabled, parsed.intervalMinutes);
    },
    [IPC_CHANNELS.SYNC_PAUSE_ENRICHMENT]: () => sync.pauseEnrichment(db()),
    [IPC_CHANNELS.SYNC_RETRY_ITEM]: (request) => {
      const parsed = syncItemSchema.parse(request);
      return sync.retryItem(db(), parsed.directory, parsed.name, deps.fetchImpl);
    },
    [IPC_CHANNELS.SYNC_SKIP_ITEM]: (request) => {
      const parsed = syncSkipSchema.parse(request);
      return sync.setSkipped(db(), parsed.directory, parsed.name, parsed.skip);
    },
    [IPC_CHANNELS.SYNC_RETRY_ALL]: () => sync.retryAll(db()),
  };
  return Object.fromEntries(Object.entries(table).map(([channel, handler]) => [channel, guarded(handler)]));
}
