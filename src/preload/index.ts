import { contextBridge, ipcRenderer } from 'electron';
import type { ChatRuntimeConfig, NonSecretSettings, SettingsRead } from '../shared/config/schema';
import type { Preferences } from '../shared/config/preferences';
import type {
  AgentTurnContext,
  ChatRecord,
  ConnectionSuggestions,
  Explanation,
  ExplanationInput,
  GraphCheckReport,
  ListExplanationsRequest,
  LocalDiscovery,
  McpAuthProbe,
  McpTokenStatus,
  SecretStoreInfo,
  CloudKeyProvider,
  KeySourceName,
  SecretStatus,
  SessionKeyStatus,
  McpOAuthLoginResult,
  McpOAuthStatus,
  ModelDetail,
  ModelListResult,
  ModelSummary,
  NodeClassDetail,
  NodeClassVerdict,
  NodeClassSummary,
  Proposal,
  ProposalResolution,
  ResolveProposalRequest,
  RevisionSnapshot,
  RevisionSummary,
  SearchModelsRequest,
  SearchNodesRequest,
  SyncStatus,
} from '../shared/contracts';

// IPC channel constants (inlined for sandbox-compatible preload)
const IPC_CHANNELS = {
  FILE_IMPORT_WORKFLOW: 'file:import-workflow',
  FILE_IMPORT_CATALOG: 'file:import-catalog',
  FILE_EXPORT_WORKFLOW: 'file:export-workflow',
  FILE_OPEN_PROJECT: 'file:open-project',
  FILE_SAVE_PROJECT: 'file:save-project',
  WORKFLOW_EXPORT_DOCUMENT: 'workflow:export-document',
  DB_SAVE_PROJECT: 'db:save-project',
  DB_LOAD_PROJECT: 'db:load-project',
  DB_LIST_PROJECTS: 'db:list-projects',
  LLM_SET_CONFIG: 'llm:set-config',
  LLM_GET_CONFIG: 'llm:get-config',
  LLM_SET_SESSION_KEY: 'llm:set-session-key',
  LLM_SESSION_STATUS: 'llm:session-status',
  LLM_STREAM_CHAT: 'llm:stream-chat',
  LLM_CANCEL: 'llm:cancel',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SAVE: 'settings:save',
  SETTINGS_SAVE_SECRET: 'settings:save-secret',
  SETTINGS_FORGET_SECRET: 'settings:forget-secret',
  SETTINGS_SECRET_STATUS: 'settings:secret-status',
  COMFY_READ: 'comfy:read',
  MCP_READ: 'mcp:read',
  MCP_SET_TOKEN: 'mcp:set-token',
  MCP_TOKEN_STATUS: 'mcp:token-status',
  MCP_SAVE_TOKEN: 'mcp:save-token',
  MCP_FORGET_TOKEN: 'mcp:forget-token',
  MCP_DETECT_AUTH: 'mcp:detect-auth',
  MCP_SAVE_TOKEN_FILE: 'mcp:save-token-file',
  SECRET_STORE_GET: 'secret:store-get',
  SECRET_STORE_SET: 'secret:store-set',
  SETTINGS_SAVE_SECRET_FILE: 'settings:save-secret-file',
  MCP_OAUTH_LOGIN: 'mcp:oauth-login',
  MCP_OAUTH_LOGOUT: 'mcp:oauth-logout',
  MCP_OAUTH_STATUS: 'mcp:oauth-status',
  GRAPH_COMPATIBILITY: 'graph:compatibility',
  COMMAND_COMMIT: 'command:commit',
  COMMAND_START_RUN: 'command:start-run',
  COMMAND_RESUME_RUN: 'command:resume-run',
  COMMAND_PAUSE_RUN: 'command:pause-run',
  COMMAND_CANCEL_RUN: 'command:cancel-run',
  COMMAND_CLOSE_RUN: 'command:close-run',
  COMMAND_SWITCH_PROJECT: 'command:switch-project',
  COMMAND_READ_PROJECTION: 'command:read-projection',
  CHAT_SAVE_MESSAGE: 'chat:save-message',
  CHAT_LOAD_HISTORY: 'chat:load-history',
  CHAT_CLEAR_HISTORY: 'chat:clear-history',
  LLM_PROBE: 'llm:probe',
  LLM_LIST_MODELS: 'llm:list-models',
  LLM_DISCOVER_LOCAL: 'llm:discover-local',
  SETTINGS_CONNECTION_SUGGESTIONS: 'settings:connection-suggestions',
  KNOWLEDGE_SEARCH_NODES: 'knowledge:search-nodes',
  KNOWLEDGE_NODE_DETAIL: 'knowledge:node-detail',
  KNOWLEDGE_SEARCH_MODELS: 'knowledge:search-models',
  KNOWLEDGE_MODEL_DETAIL: 'knowledge:model-detail',
  KNOWLEDGE_LIST_EXPLANATIONS: 'knowledge:list-explanations',
  KNOWLEDGE_SAVE_EXPLANATION: 'knowledge:save-explanation',
  KNOWLEDGE_CHECK_GRAPH: 'knowledge:check-graph',
  KNOWLEDGE_VALIDATE_NODE_CLASS: 'knowledge:validate-node-class',
  SYNC_STATUS: 'sync:status',
  SYNC_NOW: 'sync:now',
  SYNC_SET_AUTO: 'sync:set-auto',
  SYNC_PAUSE_ENRICHMENT: 'sync:pause-enrichment',
  SYNC_EVENT: 'sync:event',
  PROPOSALS_LIST: 'proposals:list',
  PROPOSALS_RESOLVE: 'proposals:resolve',
  PROPOSALS_EVENT: 'proposals:event',
  GRAPH_LIST_REVISIONS: 'graph:list-revisions',
  GRAPH_LOAD_REVISION: 'graph:load-revision',
  DIAGNOSTICS_COLLECT: 'diagnostics:collect',
  DIAGNOSTICS_OPEN_LOGS: 'diagnostics:open-logs',
  DIAGNOSTICS_RENDERER_ERROR: 'diagnostics:renderer-error',
} as const;

/** The app version main passes as `--app-version=…` (a sandboxed preload cannot read package.json). */
function appVersion(): string {
  const flag = (process.argv ?? []).find((arg) => arg.startsWith('--app-version='));
  return flag ? flag.slice('--app-version='.length).slice(0, 40) : '';
}

/** A switch main passes as a plain argument (never a secret). */
function hasFlag(flag: string): boolean {
  return (process.argv ?? []).includes(flag);
}

// Expose safe IPC API to renderer
/** How long a stream listener may outlive its call when no terminal chunk arrives. */
const STREAM_LISTENER_GRACE_MS = 60_000;

/** After an `error` chunk, later chunks of the same turn still arrive within this window. */
const STREAM_ERROR_GRACE_MS = 5_000;

/** A stream turn ends with a `done` or an `error` chunk. */
function streamEnd(chunk: unknown): 'done' | 'error' | null {
  const type = chunk && typeof chunk === 'object' ? (chunk as { type?: unknown }).type : undefined;
  return type === 'done' || type === 'error' ? type : null;
}

contextBridge.exposeInMainWorld('electronAPI', {
  // Platform info
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    app: appVersion(),
  },
  /** Build switches from main. `testProvider`: the scripted TEST fixture is offered (unpackaged runs and tests only). */
  flags: { testProvider: hasFlag('--test-provider=1') },

  // File operations
  importWorkflow: () => ipcRenderer.invoke(IPC_CHANNELS.FILE_IMPORT_WORKFLOW),
  importCatalog: () => ipcRenderer.invoke(IPC_CHANNELS.FILE_IMPORT_CATALOG),
  exportWorkflow: () => ipcRenderer.invoke(IPC_CHANNELS.FILE_EXPORT_WORKFLOW),
  exportWorkflowDocument: () => ipcRenderer.invoke(IPC_CHANNELS.WORKFLOW_EXPORT_DOCUMENT),
  openProject: () => ipcRenderer.invoke(IPC_CHANNELS.FILE_OPEN_PROJECT),
  saveProjectFile: () => ipcRenderer.invoke(IPC_CHANNELS.FILE_SAVE_PROJECT),

  // Project operations
  saveProject: (project: any) => ipcRenderer.invoke(IPC_CHANNELS.DB_SAVE_PROJECT, project),
  loadProject: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.DB_LOAD_PROJECT, id),
  listProjects: () => ipcRenderer.invoke(IPC_CHANNELS.DB_LIST_PROJECTS),

  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
  saveSettings: (input: unknown) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SAVE, input),
  /** Remembers one provider's key in the OS store. Without a value, the key held for that provider is the one saved. */
  saveSecret: (provider: CloudKeyProvider, value?: string) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SAVE_SECRET, provider, value),
  saveSecretFile: (provider: CloudKeyProvider) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SAVE_SECRET_FILE, provider) as Promise<{ status: 'stored' | 'missing' }>,
  /** With a provider: that provider's key. Without: every model key. */
  forgetSecret: (provider?: CloudKeyProvider) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_FORGET_SECRET, provider) as Promise<{ status: 'removed' }>,
  secretStatus: (provider?: CloudKeyProvider) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SECRET_STATUS, provider) as Promise<SecretStatus>,
  readComfy: () => ipcRenderer.invoke(IPC_CHANNELS.COMFY_READ) as Promise<
    | { ok: true; version: string; devices: number; nodes: number; models: number; skipped: string[] }
    | { ok: false; error: string }
  >,
  readMcp: () => ipcRenderer.invoke(IPC_CHANNELS.MCP_READ) as Promise<
    | { ok: true; tools: number; nodes: number; models: number; objectInfo: 'mcp' | 'native' | 'none'; comfyUrl: string | null; skipped: string[] }
    | { ok: false; error: string }
  >,
  mcpSetToken: (value: string, forUrl?: string) => ipcRenderer.invoke(IPC_CHANNELS.MCP_SET_TOKEN, value, forUrl) as Promise<{ held: boolean }>,
  mcpTokenStatus: () => ipcRenderer.invoke(IPC_CHANNELS.MCP_TOKEN_STATUS) as Promise<McpTokenStatus>,
  /** Without a value, the token held for this session is the one saved. */
  mcpSaveToken: (value?: string, forUrl?: string) => ipcRenderer.invoke(IPC_CHANNELS.MCP_SAVE_TOKEN, value, forUrl) as Promise<{ status: 'stored' | 'secret-storage-blocked' }>,
  mcpSaveTokenFile: (forUrl?: string) => ipcRenderer.invoke(IPC_CHANNELS.MCP_SAVE_TOKEN_FILE, forUrl) as Promise<{ status: 'stored' | 'missing' }>,
  secretStore: () => ipcRenderer.invoke(IPC_CHANNELS.SECRET_STORE_GET) as Promise<SecretStoreInfo>,
  setSecretStore: (choice: SecretStoreInfo['override']) => ipcRenderer.invoke(IPC_CHANNELS.SECRET_STORE_SET, choice) as Promise<{ ok: boolean }>,
  mcpForgetToken: () => ipcRenderer.invoke(IPC_CHANNELS.MCP_FORGET_TOKEN) as Promise<{ status: 'removed' }>,
  mcpDetectAuth: (url?: string) => ipcRenderer.invoke(IPC_CHANNELS.MCP_DETECT_AUTH, url) as Promise<McpAuthProbe>,
  mcpOAuthLogin: () => ipcRenderer.invoke(IPC_CHANNELS.MCP_OAUTH_LOGIN) as Promise<McpOAuthLoginResult>,
  mcpOAuthLogout: () => ipcRenderer.invoke(IPC_CHANNELS.MCP_OAUTH_LOGOUT) as Promise<McpOAuthStatus>,
  mcpOAuthStatus: () => ipcRenderer.invoke(IPC_CHANNELS.MCP_OAUTH_STATUS) as Promise<McpOAuthStatus>,
  graphCompatibility: () => ipcRenderer.invoke(IPC_CHANNELS.GRAPH_COMPATIBILITY) as Promise<
    | { ok: true; missingNodes: string[]; missingModels: Array<{ directory: string; name: string }> }
    | { ok: false; error: string }
  >,

  commitCommand: (input: unknown) => ipcRenderer.invoke(IPC_CHANNELS.COMMAND_COMMIT, input),
  startRun: (projectId: string) => ipcRenderer.invoke(IPC_CHANNELS.COMMAND_START_RUN, projectId),
  resumeRun: (projectId: string) => ipcRenderer.invoke(IPC_CHANNELS.COMMAND_RESUME_RUN, projectId),
  pauseRun: (projectId: string, runId: string) => ipcRenderer.invoke(IPC_CHANNELS.COMMAND_PAUSE_RUN, projectId, runId),
  cancelRun: (projectId: string, runId: string) => ipcRenderer.invoke(IPC_CHANNELS.COMMAND_CANCEL_RUN, projectId, runId),
  closeRun: (projectId: string, runId: string) => ipcRenderer.invoke(IPC_CHANNELS.COMMAND_CLOSE_RUN, projectId, runId),
  switchProject: (projectId: string) => ipcRenderer.invoke(IPC_CHANNELS.COMMAND_SWITCH_PROJECT, projectId),
  readProjection: (projectId: string) => ipcRenderer.invoke(IPC_CHANNELS.COMMAND_READ_PROJECTION, projectId),

  // LLM operations
  llmSetConfig: (config: { provider: string; model: string; apiKey?: string; baseURL?: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.LLM_SET_CONFIG, config),
  llmGetConfig: () => ipcRenderer.invoke(IPC_CHANNELS.LLM_GET_CONFIG) as Promise<ChatRuntimeConfig>,
  llmSetSessionKey: (provider: CloudKeyProvider, value: string) => ipcRenderer.invoke(IPC_CHANNELS.LLM_SET_SESSION_KEY, provider, value) as Promise<{ held: boolean; source: KeySourceName }>,
  llmSessionStatus: () => ipcRenderer.invoke(IPC_CHANNELS.LLM_SESSION_STATUS) as Promise<SessionKeyStatus>,
  llmProbe: (draft: { provider: string; model: string; baseURL: string }) => ipcRenderer.invoke(IPC_CHANNELS.LLM_PROBE, draft) as Promise<LlmProbeResult>,
  llmListModels: (draft: { provider: string; model?: string; baseURL: string }) => ipcRenderer.invoke(IPC_CHANNELS.LLM_LIST_MODELS, draft) as Promise<ModelListResult>,
  llmDiscoverLocal: () => ipcRenderer.invoke(IPC_CHANNELS.LLM_DISCOVER_LOCAL) as Promise<LocalDiscovery>,
  connectionSuggestions: (probe?: boolean) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_CONNECTION_SUGGESTIONS, probe === true) as Promise<ConnectionSuggestions>,
  llmStreamChat: (
    messages: Array<{ role: string; content: string }>,
    toolSpecs: Array<{ name: string; description: string; parameters: any }>,
    onChunk: (chunk: { type: string; content: any }) => void,
    run: { projectId: string; runId: string; expectedRevisionId: string },
    context?: AgentTurnContext,
  ) => {
    const channel = `llm-stream-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    // One listener per turn, removed when the turn ends so listeners do not pile up across turns.
    const listener = (_event: unknown, chunk: { type: string; content: any }) => {
      onChunk(chunk);
      const end = streamEnd(chunk);
      // 'done' is always the last chunk. An 'error' part can also come from the model stream before the
      // turn's own terminal chunk, so after an error the listener stays a moment for what follows.
      if (end === 'done') ipcRenderer.removeListener(channel, listener);
      else if (end === 'error') setTimeout(() => ipcRenderer.removeListener(channel, listener), STREAM_ERROR_GRACE_MS);
    };
    ipcRenderer.on(channel, listener);
    const release = () => ipcRenderer.removeListener(channel, listener);
    // The reply and the chunks travel separately and the reply can arrive first, so the listener normally goes
    // with the terminal chunk. A turn whose terminal chunk never comes (window torn down) is released later.
    const releaseLater = () => {
      setTimeout(release, STREAM_LISTENER_GRACE_MS);
    };
    return ipcRenderer.invoke(IPC_CHANNELS.LLM_STREAM_CHAT, messages, toolSpecs, channel, run, context).then(
      (value) => {
        releaseLater();
        return value;
      },
      (error) => {
        releaseLater();
        throw error;
      },
    );
  },
  llmCancel: (runId?: string) => ipcRenderer.invoke(IPC_CHANNELS.LLM_CANCEL, runId) as Promise<{ cancelled: number }>,
  sendToolResult: (resultChannel: string, result: any) => {
    ipcRenderer.send(resultChannel, result);
  },

  // Chat history (Agent workstream)
  loadChatHistory: (projectId: string) => ipcRenderer.invoke(IPC_CHANNELS.CHAT_LOAD_HISTORY, projectId) as Promise<ChatRecord[]>,
  saveChatMessage: (record: ChatRecord) => ipcRenderer.invoke(IPC_CHANNELS.CHAT_SAVE_MESSAGE, record) as Promise<{ ok: boolean }>,
  clearChatHistory: (projectId: string) => ipcRenderer.invoke(IPC_CHANNELS.CHAT_CLEAR_HISTORY, projectId) as Promise<{ ok: true; removed: number } | { ok: false; error: string }>,

  // Knowledge and sync (KB workstream)
  searchNodeTypes: (request: SearchNodesRequest) => ipcRenderer.invoke(IPC_CHANNELS.KNOWLEDGE_SEARCH_NODES, request) as Promise<NodeClassSummary[]>,
  nodeTypeDetail: (classType: string) => ipcRenderer.invoke(IPC_CHANNELS.KNOWLEDGE_NODE_DETAIL, classType) as Promise<NodeClassDetail | null>,
  validateNodeClass: (classType: string) => ipcRenderer.invoke(IPC_CHANNELS.KNOWLEDGE_VALIDATE_NODE_CLASS, classType) as Promise<NodeClassVerdict>,
  searchModels: (request: SearchModelsRequest) => ipcRenderer.invoke(IPC_CHANNELS.KNOWLEDGE_SEARCH_MODELS, request) as Promise<ModelSummary[]>,
  modelDetail: (directory: string, name: string) => ipcRenderer.invoke(IPC_CHANNELS.KNOWLEDGE_MODEL_DETAIL, { directory, name }) as Promise<ModelDetail | null>,
  listExplanations: (request: ListExplanationsRequest) => ipcRenderer.invoke(IPC_CHANNELS.KNOWLEDGE_LIST_EXPLANATIONS, request) as Promise<Explanation[]>,
  saveExplanation: (input: ExplanationInput) => ipcRenderer.invoke(IPC_CHANNELS.KNOWLEDGE_SAVE_EXPLANATION, input) as Promise<Explanation>,
  checkGraph: (projectId: string) => ipcRenderer.invoke(IPC_CHANNELS.KNOWLEDGE_CHECK_GRAPH, projectId) as Promise<GraphCheckReport>,
  syncStatus: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_STATUS) as Promise<SyncStatus>,
  syncNow: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_NOW) as Promise<SyncStatus>,
  syncSetAuto: (enabled: boolean, intervalMinutes: number) => ipcRenderer.invoke(IPC_CHANNELS.SYNC_SET_AUTO, { enabled, intervalMinutes }) as Promise<SyncStatus>,
  syncPauseEnrichment: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_PAUSE_ENRICHMENT) as Promise<SyncStatus>,
  onSyncEvent: (listener: (status: SyncStatus) => void) => {
    const handler = (_event: unknown, status: SyncStatus) => listener(status);
    ipcRenderer.on(IPC_CHANNELS.SYNC_EVENT, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SYNC_EVENT, handler);
  },

  // Proposals / ghosts (Engine workstream)
  listProposals: (projectId: string) => ipcRenderer.invoke(IPC_CHANNELS.PROPOSALS_LIST, projectId) as Promise<Proposal[]>,
  resolveProposal: (request: ResolveProposalRequest) => ipcRenderer.invoke(IPC_CHANNELS.PROPOSALS_RESOLVE, request) as Promise<ProposalResolution>,
  onProposalsEvent: (listener: (proposals: Proposal[]) => void) => {
    const handler = (_event: unknown, proposals: Proposal[]) => listener(proposals);
    ipcRenderer.on(IPC_CHANNELS.PROPOSALS_EVENT, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.PROPOSALS_EVENT, handler);
  },

  // Revision history for the replay player (Canvas workstream; handlers in main/ipc/engineIpc.ts)
  listRevisions: (projectId: string) => ipcRenderer.invoke(IPC_CHANNELS.GRAPH_LIST_REVISIONS, projectId) as Promise<RevisionSummary[]>,
  loadRevision: (projectId: string, revisionId: string) => ipcRenderer.invoke(IPC_CHANNELS.GRAPH_LOAD_REVISION, { projectId, revisionId }) as Promise<RevisionSnapshot | null>,

  // Diagnostics (Help menu, error boundary, renderer error reports)
  collectDiagnostics: () => ipcRenderer.invoke(IPC_CHANNELS.DIAGNOSTICS_COLLECT) as Promise<string>,
  openLogsFolder: () => ipcRenderer.invoke(IPC_CHANNELS.DIAGNOSTICS_OPEN_LOGS) as Promise<{ ok: true } | { ok: false; error: string }>,
  reportRendererError: (report: RendererErrorReport) => ipcRenderer.invoke(IPC_CHANNELS.DIAGNOSTICS_RENDERER_ERROR, report) as Promise<{ logged: boolean }>,
});

/** What the renderer sends about an error; main clips, redacts and rate-limits it. */
export interface RendererErrorReport {
  kind: 'error' | 'unhandledrejection' | 'boundary';
  message: string;
  source?: string;
  stack?: string;
}

export type LlmProbeResult =
  | { ok: true; latencyMs: number; provider: string; model: string }
  | { ok: false; error: string; latencyMs: number | null };

export type SettingsSaveResult =
  | { ok: true; values: NonSecretSettings; preferences?: Preferences }
  | { ok: false; error: string };

// Type declaration for renderer
export interface ElectronAPI {
  platform: string;
  versions: {
    node: string;
    chrome: string;
    electron: string;
    /** package.json version, passed by main; '' when unknown. */
    app?: string;
  };
  /** Build switches from main. `testProvider`: the scripted TEST fixture is offered (unpackaged runs and tests only). */
  flags: { testProvider: boolean };
  importWorkflow: () => Promise<import('../shared/commands/types').CommandResponse | { status: 'cancelled'; projection: null; result: null }>;
  importCatalog: () => Promise<
    | { status: 'applied'; result: { nodes: number; models: number; skipped: string[] } }
    | { status: 'cancelled' }
    | { status: 'rejected'; error: string }
  >;
  exportWorkflow: () => Promise<{ ok: true; unsetWidgets?: Array<{ nodeId: string; classType: string; name: string }> } | { ok: false; canceled?: boolean; error?: string }>;
  exportWorkflowDocument: () => Promise<{ ok: true; workflow: Record<string, unknown>; unsetWidgets?: Array<{ nodeId: string; classType: string; name: string }> } | { ok: false; error: string }>;
  openProject: () => Promise<import('../shared/commands/types').CommandResponse | { status: 'cancelled'; projection: null; result: null }>;
  saveProjectFile: () => Promise<{ ok: true } | { ok: false; canceled?: boolean; error?: string }>;
  saveProject: (project: any) => Promise<{ success: boolean }>;
  loadProject: (id: string) => Promise<any>;
  listProjects: () => Promise<any[]>;
  getSettings: () => Promise<SettingsRead>;
  /** `input.preferences`, when present, is a patch merged onto the stored preferences. */
  saveSettings: (input: unknown) => Promise<SettingsSaveResult>;
  saveSecret: (provider: CloudKeyProvider, value?: string) => Promise<{ status: 'secret-storage-blocked' | 'stored' }>;
  saveSecretFile: (provider: CloudKeyProvider) => Promise<{ status: 'stored' | 'missing' }>;
  forgetSecret: (provider?: CloudKeyProvider) => Promise<{ status: 'removed' }>;
  secretStatus: (provider?: CloudKeyProvider) => Promise<SecretStatus>;
  readComfy: () => Promise<
    | { ok: true; version: string; devices: number; nodes: number; models: number; skipped: string[] }
    | { ok: false; error: string }
  >;
  readMcp: () => Promise<
    | { ok: true; tools: number; nodes: number; models: number; objectInfo: 'mcp' | 'native' | 'none'; comfyUrl: string | null; skipped: string[] }
    | { ok: false; error: string }
  >;
  /** `forUrl`: the MCP URL the token is for (e.g. the draft being saved); defaults to the saved URL. */
  mcpSetToken: (value: string, forUrl?: string) => Promise<{ held: boolean }>;
  mcpTokenStatus: () => Promise<McpTokenStatus>;
  mcpSaveTokenFile: (forUrl?: string) => Promise<{ status: 'stored' | 'missing' }>;
  secretStore: () => Promise<SecretStoreInfo>;
  setSecretStore: (choice: SecretStoreInfo['override']) => Promise<{ ok: boolean }>;
  mcpSaveToken: (value?: string, forUrl?: string) => Promise<{ status: 'stored' | 'secret-storage-blocked' }>;
  mcpForgetToken: () => Promise<{ status: 'removed' }>;
  /** Signs in to the saved MCP URL through the system browser; resolves when the browser comes back (or fails). */
  mcpDetectAuth: (url?: string) => Promise<McpAuthProbe>;
  mcpOAuthLogin: () => Promise<McpOAuthLoginResult>;
  /** Forgets the browser sign-in for the saved MCP URL's origin. */
  mcpOAuthLogout: () => Promise<McpOAuthStatus>;
  /** Sign-in state for the saved MCP URL. Never carries a token. */
  mcpOAuthStatus: () => Promise<McpOAuthStatus>;
  graphCompatibility: () => Promise<
    | { ok: true; missingNodes: string[]; missingModels: Array<{ directory: string; name: string }> }
    | { ok: false; error: string }
  >;
  commitCommand: (input: unknown) => Promise<import('../shared/commands/types').CommandResponse>;
  startRun: (projectId: string) => Promise<import('../shared/commands/types').RunStart>;
  resumeRun: (projectId: string) => Promise<import('../shared/commands/types').RunStart>;
  pauseRun: (projectId: string, runId: string) => Promise<import('../shared/commands/types').CommandResponse>;
  cancelRun: (projectId: string, runId: string) => Promise<import('../shared/commands/types').CommandResponse>;
  closeRun: (projectId: string, runId: string) => Promise<import('../shared/commands/types').CommandResponse>;
  switchProject: (projectId: string) => Promise<import('../shared/commands/types').Projection | null>;
  readProjection: (projectId: string) => Promise<import('../shared/commands/types').Projection | null>;
  llmSetConfig: (config: {
    provider: string;
    model: string;
    apiKey?: string;
    baseURL?: string;
  }) => Promise<void>;
  llmGetConfig: () => Promise<ChatRuntimeConfig>;
  /** Holds a key for one cloud provider in main; an empty value forgets that provider's key only. */
  llmSetSessionKey: (provider: CloudKeyProvider, value: string) => Promise<{ held: boolean; source: KeySourceName }>;
  llmSessionStatus: () => Promise<SessionKeyStatus>;
  /** Settings ▸ Assistant ▸ Check connection. Errors come back redacted. */
  llmProbe: (draft: { provider: string; model: string; baseURL: string }) => Promise<LlmProbeResult>;
  /** Settings ▸ Assistant: the models the draft provider or local server offers. A cloud key is used in main only. */
  llmListModels: (draft: { provider: string; model?: string; baseURL: string }) => Promise<ModelListResult>;
  /** Settings ▸ Assistant ▸ Find local servers: the MCP server's Ollama targets and servers answering on this computer. */
  llmDiscoverLocal: () => Promise<LocalDiscovery>;
  /** Settings ▸ Connection: reported, saved and recent addresses; with `probe`, also a ComfyUI answering on this computer. */
  connectionSuggestions: (probe?: boolean) => Promise<ConnectionSuggestions>;
  llmStreamChat: (
    messages: Array<{ role: string; content: string }>,
    toolSpecs: Array<{ name: string; description: string; parameters: any }>,
    onChunk: (chunk: { type: string; content: any }) => void,
    run: { projectId: string; runId: string; expectedRevisionId: string },
    context?: AgentTurnContext,
  ) => Promise<void>;
  /** Aborts the main-process turn of this window for runId (every turn of the window when omitted). */
  llmCancel: (runId?: string) => Promise<{ cancelled: number }>;
  sendToolResult: (resultChannel: string, result: any) => void;
  loadChatHistory: (projectId: string) => Promise<ChatRecord[]>;
  saveChatMessage: (record: ChatRecord) => Promise<{ ok: boolean }>;
  clearChatHistory: (projectId: string) => Promise<{ ok: true; removed: number } | { ok: false; error: string }>;
  searchNodeTypes: (request: SearchNodesRequest) => Promise<NodeClassSummary[]>;
  nodeTypeDetail: (classType: string) => Promise<NodeClassDetail | null>;
  validateNodeClass: (classType: string) => Promise<NodeClassVerdict>;
  searchModels: (request: SearchModelsRequest) => Promise<ModelSummary[]>;
  modelDetail: (directory: string, name: string) => Promise<ModelDetail | null>;
  listExplanations: (request: ListExplanationsRequest) => Promise<Explanation[]>;
  saveExplanation: (input: ExplanationInput) => Promise<Explanation>;
  checkGraph: (projectId: string) => Promise<GraphCheckReport>;
  syncStatus: () => Promise<SyncStatus>;
  syncNow: () => Promise<SyncStatus>;
  syncSetAuto: (enabled: boolean, intervalMinutes: number) => Promise<SyncStatus>;
  /** Stops background model-metadata reading until the next sync. */
  syncPauseEnrichment: () => Promise<SyncStatus>;
  onSyncEvent: (listener: (status: SyncStatus) => void) => () => void;
  listProposals: (projectId: string) => Promise<Proposal[]>;
  resolveProposal: (request: ResolveProposalRequest) => Promise<ProposalResolution>;
  onProposalsEvent: (listener: (proposals: Proposal[]) => void) => () => void;
  /** Revision rows of a project, oldest first (at most REVISION_LIST_LIMIT). */
  listRevisions: (projectId: string) => Promise<RevisionSummary[]>;
  /** Snapshot of one revision, read-only; null when it does not exist. Never changes the current revision. */
  loadRevision: (projectId: string, revisionId: string) => Promise<RevisionSnapshot | null>;
  /** Help ▸ Copy diagnostics: a redacted text report (versions, settings without secrets, log tail). */
  collectDiagnostics: () => Promise<string>;
  /** Help ▸ Open logs folder. */
  openLogsFolder: () => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Logs a renderer error in main (redacted, rate-limited). */
  reportRendererError: (report: RendererErrorReport) => Promise<{ logged: boolean }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
