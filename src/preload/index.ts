/**
 * The preload script of the window (main/index.ts loads its build, dist/preload/index.js): the one bridge between
 * the page and the main process. It exposes window.electronAPI, a fixed list of calls, each one IPC channel; the
 * page gets no ipcRenderer and no Node. The whole renderer calls through it, and ElectronAPI below is the type it
 * reads. The window runs sandboxed and this file is compiled without a bundler, so it cannot import the app's own
 * modules at run time: only types, and the channel names are copied here (tests/unit/ipcChannelCopy.test.ts checks
 * they equal src/shared/ipc-channels.ts).
 */
import { contextBridge, ipcRenderer, webFrame, webUtils } from 'electron';
import type { ServicesStatus, ServiceActionRequest, ServiceActionResult } from '../shared/contracts/services';
import type { LocalModelStatus, LocalModelAction, LocalGenerationStyle } from '../shared/contracts/localModels';
import type { ChatRuntimeConfig, NonSecretSettings, SettingsRead } from '../shared/config/schema';
import type { Preferences } from '../shared/config/preferences';
import type { KeyProvider } from '../shared/config/keyOrigin';
import type { AboutInfo, HelpPage, HelpSearchHit, HelpTree, IssueDraft, ProjectLinkKind, ThirdPartyComponent } from '../shared/contracts/about';
import type { UpdateLink, UpdateStatus } from '../shared/contracts/updates';
import type { LessonDraft, LessonDraftResolution, LessonExportOutcome, LessonImportOutcome, MyLesson } from '../shared/lessons/share/mine';
import type { LessonDoc, LessonFile } from '../shared/lessons/share/format';
import type {
  AgentTurnContext,
  ChatRecord,
  ConnectionSuggestions,
  Explanation,
  ExplanationInput,
  ObjectRef,
  GraphCheckReport,
  ListExplanationsRequest,
  LocalDiscovery,
  McpAuthProbe,
  ModelLogExportRequest,
  ModelLogExportResult,
  ModelLogList,
  McpTokenStatus,
  SecretStoreInfo,
  CloudKeyProvider,
  KeySourceName,
  SecretStatus,
  SessionKeyStatus,
  McpOAuthLoginResult,
  McpOAuthStatus,
  ModelDetail,
  ModelPreview,
  ModelLookupResult,
  ModelListResult,
  ModelSummary,
  NodeClassDetail,
  FieldModelsRequest,
  FieldModelsResult,
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
  RetryItemResult,
  ImportModelHeaderRequest,
  ImportModelHeaderResult,
  McpReadOutcome,
} from '../shared/contracts';

// IPC channel names, copied from src/shared/ipc-channels.ts: a sandboxed preload cannot load that module.
const IPC_CHANNELS = {
  FILE_IMPORT_WORKFLOW: 'file:import-workflow',
  FILE_IMPORT_CATALOG: 'file:import-catalog',
  FILE_EXPORT_WORKFLOW: 'file:export-workflow',
  FILE_OPEN_PROJECT: 'file:open-project',
  FILE_SAVE_PROJECT: 'file:save-project',
  FILE_PROJECT_STATE: 'file:project-state',
  WORKFLOW_EXPORT_DOCUMENT: 'workflow:export-document',
  /** Ways of opening that end in one path (main/ipc/openIpc.ts): a dropped file, File ▸ Recent and Examples, the command line. */
  FILE_OPEN_PATH: 'file:open-path',
  FILE_RECENT_LIST: 'file:recent-list',
  FILE_OPEN_RECENT: 'file:open-recent',
  FILE_EXAMPLES_LIST: 'file:examples-list',
  FILE_OPEN_EXAMPLE: 'file:open-example',
  FILE_PENDING_OPEN: 'file:pending-open',
  FILE_OPEN_PENDING: 'file:open-pending',
  /** Main → window: a file arrived from a second start; the window asks before replacing its graph. */
  FILE_OPEN_REQUEST: 'file:open-request',
  /** The run card after a save: shows the written workflow in its folder. */
  FILE_SHOW_EXPORTED: 'file:show-exported',
  FILE_COPY_EXPORTED: 'file:copy-exported',
  /** The journey cards' links: the saved ComfyUI address or a fixed download page, opened in the browser on a click. */
  JOURNEY_OPEN_LINK: 'journey:open-link',
  JOURNEY_COMFY_KNOWN: 'journey:comfy-known',
  DB_LOAD_PROJECT: 'db:load-project',
  DB_LIST_PROJECTS: 'db:list-projects',
  LLM_SET_CONFIG: 'llm:set-config',
  LLM_GET_CONFIG: 'llm:get-config',
  LLM_SET_SESSION_KEY: 'llm:set-session-key',
  LLM_SESSION_STATUS: 'llm:session-status',
  LLM_STREAM_CHAT: 'llm:stream-chat',
  LLM_CANCEL: 'llm:cancel',
  BROWSER_STATUS: 'browser:status',
  BROWSER_PAIR_CODE: 'browser:pair-code',
  BROWSER_REVOKE: 'browser:revoke',
  BROWSER_REFRESH: 'browser:refresh',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SAVE: 'settings:save',
  SETTINGS_SAVE_VIEW: 'settings:save-view',
  SETTINGS_SAVE_SECRET: 'settings:save-secret',
  SETTINGS_FORGET_SECRET: 'settings:forget-secret',
  SECRETS_FORGET_ALL: 'secrets:forget-all',
  SECRETS_INVENTORY: 'secrets:inventory',
  SETTINGS_SECRET_STATUS: 'settings:secret-status',
  COMFY_CHECK: 'comfy:check',
  EXTENSION_DRAFT_GET: 'extension:draft-get',
  EXTENSION_STARTER: 'extension:starter',
  KNOWLEDGE_GRAPH_RESOURCES: 'knowledge:graph-resources',
  COMFY_UPLOAD_MEDIA: 'comfy:upload-media',
  COMFY_INPUT_PREVIEW: 'comfy:input-preview',
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
  LLM_OLLAMA_WINDOW: 'llm:ollama-window',
  SERVICES_STATUS: 'services:status',
  SERVICES_CONTROL: 'services:control',
  LLM_LOCAL_STATUS: 'llm:local-status',
  LLM_LOCAL_CONTROL: 'llm:local-control',
  SETTINGS_CONNECTION_SUGGESTIONS: 'settings:connection-suggestions',
  KNOWLEDGE_SEARCH_NODES: 'knowledge:search-nodes',
  KNOWLEDGE_NODE_DETAIL: 'knowledge:node-detail',
  KNOWLEDGE_SEARCH_MODELS: 'knowledge:search-models',
  KNOWLEDGE_MODEL_DETAIL: 'knowledge:model-detail',
  KNOWLEDGE_MODEL_PREVIEW: 'knowledge:model-preview',
  KNOWLEDGE_MODEL_HASH: 'knowledge:model-hash',
  KNOWLEDGE_MODEL_LOOKUP: 'knowledge:model-lookup',
  KNOWLEDGE_LIST_EXPLANATIONS: 'knowledge:list-explanations',
  KNOWLEDGE_SAVE_EXPLANATION: 'knowledge:save-explanation',
  KNOWLEDGE_DELETE_EXPLANATION: 'knowledge:delete-explanation',
  KNOWLEDGE_DELETE_ASSISTANT_EXPLANATIONS: 'knowledge:delete-assistant-explanations',
  KNOWLEDGE_CHECK_GRAPH: 'knowledge:check-graph',
  KNOWLEDGE_VALIDATE_NODE_CLASS: 'knowledge:validate-node-class',
  KNOWLEDGE_FIELD_MODELS: 'knowledge:field-models',
  SYNC_STATUS: 'sync:status',
  SYNC_NOW: 'sync:now',
  SYNC_SET_AUTO: 'sync:set-auto',
  SYNC_PAUSE_ENRICHMENT: 'sync:pause-enrichment',
  SYNC_RETRY_ITEM: 'sync:retry-item',
  SYNC_IMPORT_HEADER: 'sync:import-header',
  SYNC_SKIP_ITEM: 'sync:skip-item',
  SYNC_RETRY_ALL: 'sync:retry-all',
  SYNC_EVENT: 'sync:event',
  PROPOSALS_LIST: 'proposals:list',
  PROPOSALS_RESOLVE: 'proposals:resolve',
  PROPOSALS_EVENT: 'proposals:event',
  GRAPH_LIST_REVISIONS: 'graph:list-revisions',
  GRAPH_LOAD_REVISION: 'graph:load-revision',
  DIAGNOSTICS_COLLECT: 'diagnostics:collect',
  DIAGNOSTICS_OPEN_LOGS: 'diagnostics:open-logs',
  DIAGNOSTICS_RENDERER_ERROR: 'diagnostics:renderer-error',
  TRACE_LIST: 'trace:list',
  TRACE_REPORT: 'trace:report',
  TRACE_EXPORT: 'trace:export',
  TRACE_CLEAR: 'trace:clear',
  TRACE_OPEN_FOLDER: 'trace:open-folder',
  TRACE_REVEAL_EXPORT: 'trace:reveal-export',
  ABOUT_INFO: 'about:info',
  ABOUT_LICENCE: 'about:licence',
  ABOUT_NOTICES: 'about:notices',
  ABOUT_OPEN_DATA_FOLDER: 'about:open-data-folder',
  ABOUT_OPEN_CHROMIUM_LICENCES: 'about:open-chromium-licences',
  ABOUT_ISSUE_DRAFT: 'about:issue-draft',
  ABOUT_OPEN_PROJECT_LINK: 'about:open-project-link',
  HELP_TREE: 'help:tree',
  HELP_PAGE: 'help:page',
  HELP_SEARCH: 'help:search',
  UPDATES_STATUS: 'updates:status',
  UPDATES_DISMISS: 'updates:dismiss',
  UPDATES_OPEN: 'updates:open',
  APP_START_STATE: 'app:start-state',
  APP_GRAPH_DRAWN: 'app:graph-drawn',
  PRIVACY_PREVIEW_CACHE: 'privacy:preview-cache',
  PRIVACY_CLEAR_PREVIEWS: 'privacy:clear-previews',
  LESSONS_LIST: 'lessons:list',
  LESSONS_IMPORT_DIALOG: 'lessons:import-dialog',
  LESSONS_IMPORT_TEXT: 'lessons:import-text',
  LESSONS_EXPORT: 'lessons:export',
  LESSONS_SAVE: 'lessons:save',
  LESSONS_REMOVE: 'lessons:remove',
  LESSONS_MARK_ADULT: 'lessons:mark-adult',
  LESSONS_DRAFT_GET: 'lessons:draft-get',
  LESSONS_DRAFT_RESOLVE: 'lessons:draft-resolve',
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
  flags: { testProvider: hasFlag('--test-provider=1'), pseudoLocale: hasFlag('--pseudo-locale=1') },

  /**
   * Accessibility: the size of the whole interface (Settings ▸ Appearance ▸ Interface size, View menu), as browser
   * zoom does it, so every text, control and panel grows together. Kept within 0.8 to 2.
   */
  setInterfaceScale: (factor: number) => webFrame.setZoomFactor(Math.min(2, Math.max(0.8, Number(factor) || 1))),

  // File operations
  importWorkflow: () => ipcRenderer.invoke(IPC_CHANNELS.FILE_IMPORT_WORKFLOW),
  importCatalog: () => ipcRenderer.invoke(IPC_CHANNELS.FILE_IMPORT_CATALOG),
  /** `secrets`: the person's answer when key-like fields were reported ('omit' or 'keep'); none the first time. */
  exportWorkflow: (secrets?: 'omit' | 'keep') => ipcRenderer.invoke(IPC_CHANNELS.FILE_EXPORT_WORKFLOW, secrets),
  exportWorkflowDocument: () => ipcRenderer.invoke(IPC_CHANNELS.WORKFLOW_EXPORT_DOCUMENT),
  openProject: () => ipcRenderer.invoke(IPC_CHANNELS.FILE_OPEN_PROJECT),
  /** `options.saveAs`: always ask where (File ▸ Save project as…); otherwise the project's own file is written in place. */
  saveProjectFile: (secrets?: 'omit' | 'keep', options?: { saveAs?: boolean }) => ipcRenderer.invoke(IPC_CHANNELS.FILE_SAVE_PROJECT, secrets, options ?? {}),
  projectFileState: () => ipcRenderer.invoke(IPC_CHANNELS.FILE_PROJECT_STATE),
  // Every other way of opening a file ends in main's one open path (main/ipc/openIpc.ts).
  /** The path of a file dropped on the window (Electron no longer puts it on File), '' when it has none. */
  pathForFile: (file: File) => {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      return '';
    }
  },
  openPath: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.FILE_OPEN_PATH, filePath),
  recentFiles: () => ipcRenderer.invoke(IPC_CHANNELS.FILE_RECENT_LIST),
  openRecent: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.FILE_OPEN_RECENT, filePath),
  examples: () => ipcRenderer.invoke(IPC_CHANNELS.FILE_EXAMPLES_LIST),
  openExample: (lessonId: string) => ipcRenderer.invoke(IPC_CHANNELS.FILE_OPEN_EXAMPLE, lessonId),
  pendingOpen: () => ipcRenderer.invoke(IPC_CHANNELS.FILE_PENDING_OPEN),
  openPending: () => ipcRenderer.invoke(IPC_CHANNELS.FILE_OPEN_PENDING),
  onOpenRequest: (listener: (request: { name: string }) => void) => {
    const handler = (_event: unknown, request: { name: string }) => listener(request);
    ipcRenderer.on(IPC_CHANNELS.FILE_OPEN_REQUEST, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.FILE_OPEN_REQUEST, handler);
    };
  },
  showExported: () => ipcRenderer.invoke(IPC_CHANNELS.FILE_SHOW_EXPORTED),
  /** The text of the workflow file last written for ComfyUI, for the run card's copy; null when there is none. */
  exportedText: () => ipcRenderer.invoke(IPC_CHANNELS.FILE_COPY_EXPORTED),
  /** Whether the app knows a ComfyUI address to open (saved, or reported by an MCP server). */
  comfyAddressKnown: () => ipcRenderer.invoke(IPC_CHANNELS.JOURNEY_COMFY_KNOWN),
  /** 'comfyui' (the saved address), 'comfyui-download' or 'ollama-download'; main builds the address. */
  openJourneyLink: (kind: 'comfyui' | 'comfyui-download' | 'ollama-download') => ipcRenderer.invoke(IPC_CHANNELS.JOURNEY_OPEN_LINK, kind),

  // Project operations
  loadProject: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.DB_LOAD_PROJECT, id),
  listProjects: () => ipcRenderer.invoke(IPC_CHANNELS.DB_LIST_PROJECTS),

  browserAccessStatus: () => ipcRenderer.invoke(IPC_CHANNELS.BROWSER_STATUS),
  browserPairingCode: () => ipcRenderer.invoke(IPC_CHANNELS.BROWSER_PAIR_CODE),
  browserRevoke: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.BROWSER_REVOKE, id),
  onBrowserRefresh: (listener: (notice?: { knowledgeChanged?: boolean }) => void) => {
    const handler = (_event: unknown, notice?: { knowledgeChanged?: boolean }) => listener(notice);
    ipcRenderer.on(IPC_CHANNELS.BROWSER_REFRESH, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.BROWSER_REFRESH, handler);
  },
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
  saveSettings: (input: unknown) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SAVE, input),
  /** How the window was left (preferences.view) only; the rest of the settings row is not touched. */
  saveViewPreferences: (patch: unknown) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SAVE_VIEW, patch),
  /** Remembers one provider's key in the OS store. Without a value, the key held for that provider is the one saved. */
  saveSecret: (provider: CloudKeyProvider, value?: string) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SAVE_SECRET, provider, value),
  saveSecretFile: (provider: CloudKeyProvider) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SAVE_SECRET_FILE, provider) as Promise<{ status: 'stored' | 'missing' }>,
  /** With a provider: that provider's key. Without: every model key. */
  forgetSecret: (provider?: CloudKeyProvider) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_FORGET_SECRET, provider) as Promise<{ status: 'removed' | 'partial' }>,
  secretStatus: (provider?: CloudKeyProvider) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SECRET_STATUS, provider) as Promise<SecretStatus>,
  /** Every key and token: all providers, all server addresses, browser sign-ins, files, memory. */
  forgetAllSecrets: () => ipcRenderer.invoke(IPC_CHANNELS.SECRETS_FORGET_ALL) as Promise<ForgetAllSecretsResult>,
  /** What Forget all would remove now: names and counts, never a value. */
  secretInventory: () => ipcRenderer.invoke(IPC_CHANNELS.SECRETS_INVENTORY) as Promise<SecretInventoryReport>,
  /** Settings ▸ Connection ▸ "Check": whether ComfyUI answers at this address (one read-only GET). */
  checkComfy: (address: string) => ipcRenderer.invoke(IPC_CHANNELS.COMFY_CHECK, address) as Promise<
    | { ok: true; origin: string; local: boolean; version: string; os: string; devices: number; device: string }
    | { ok: false; error: string }
  >,
  readMcp: () => ipcRenderer.invoke(IPC_CHANNELS.MCP_READ) as Promise<McpReadOutcome>,
  extensionDraft: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.EXTENSION_DRAFT_GET, id) as Promise<import('../shared/contracts/extensions').ExtensionDraft | null>,
  extensionStarter: () => ipcRenderer.invoke(IPC_CHANNELS.EXTENSION_STARTER) as Promise<import('../shared/contracts/extensions').ExtensionDraft>,
  graphResources: (projectId: string, refresh = false) => ipcRenderer.invoke(IPC_CHANNELS.KNOWLEDGE_GRAPH_RESOURCES, projectId, refresh) as Promise<import('../shared/contracts/resources').GraphResources>,
  inputImagePreview: (name: string) => ipcRenderer.invoke(IPC_CHANNELS.COMFY_INPUT_PREVIEW, name) as Promise<string | null>,
  uploadNodeFile: (name: string, data: ArrayBuffer) => ipcRenderer.invoke(IPC_CHANNELS.COMFY_UPLOAD_MEDIA, name, data) as Promise<import('../shared/contracts/media').MediaUploadResult>,
  mcpSetToken: (value: string, forUrl?: string) => ipcRenderer.invoke(IPC_CHANNELS.MCP_SET_TOKEN, value, forUrl) as Promise<{ held: boolean }>,
  mcpTokenStatus: () => ipcRenderer.invoke(IPC_CHANNELS.MCP_TOKEN_STATUS) as Promise<McpTokenStatus>,
  /** Without a value, the token held for this session is the one saved. */
  mcpSaveToken: (value?: string, forUrl?: string) => ipcRenderer.invoke(IPC_CHANNELS.MCP_SAVE_TOKEN, value, forUrl) as Promise<{ status: 'stored' | 'secret-storage-blocked' }>,
  mcpSaveTokenFile: (forUrl?: string) => ipcRenderer.invoke(IPC_CHANNELS.MCP_SAVE_TOKEN_FILE, forUrl) as Promise<{ status: 'stored' | 'missing' }>,
  secretStore: () => ipcRenderer.invoke(IPC_CHANNELS.SECRET_STORE_GET) as Promise<SecretStoreInfo>,
  setSecretStore: (choice: SecretStoreInfo['override']) => ipcRenderer.invoke(IPC_CHANNELS.SECRET_STORE_SET, choice) as Promise<{ ok: boolean }>,
  mcpForgetToken: () => ipcRenderer.invoke(IPC_CHANNELS.MCP_FORGET_TOKEN) as Promise<{ status: 'removed' | 'partial' }>,
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
  llmSetSessionKey: (provider: CloudKeyProvider, value: string, forBase?: string) => ipcRenderer.invoke(IPC_CHANNELS.LLM_SET_SESSION_KEY, provider, value, forBase ?? '') as Promise<{ held: boolean; source: KeySourceName }>,
  llmSessionStatus: () => ipcRenderer.invoke(IPC_CHANNELS.LLM_SESSION_STATUS) as Promise<SessionKeyStatus>,
  llmProbe: (draft: { provider: string; model: string; baseURL: string }) => ipcRenderer.invoke(IPC_CHANNELS.LLM_PROBE, draft) as Promise<LlmProbeResult>,
  llmListModels: (draft: { provider: string; model?: string; baseURL: string }) => ipcRenderer.invoke(IPC_CHANNELS.LLM_LIST_MODELS, draft) as Promise<ModelListResult>,
  llmDiscoverLocal: () => ipcRenderer.invoke(IPC_CHANNELS.LLM_DISCOVER_LOCAL) as Promise<LocalDiscovery>,
  servicesStatus: () => ipcRenderer.invoke(IPC_CHANNELS.SERVICES_STATUS) as Promise<ServicesStatus>,
  servicesControl: (request: ServiceActionRequest) => ipcRenderer.invoke(IPC_CHANNELS.SERVICES_CONTROL, request) as Promise<ServiceActionResult>,
  llmLocalStatus: (draft: ChatRuntimeConfig) => ipcRenderer.invoke(IPC_CHANNELS.LLM_LOCAL_STATUS, draft) as Promise<LocalModelStatus>,
  llmLocalControl: (draft: ChatRuntimeConfig, model: string, action: LocalModelAction) => ipcRenderer.invoke(IPC_CHANNELS.LLM_LOCAL_CONTROL, draft, model, action) as Promise<LocalModelStatus>,
  llmOllamaWindow: (draft: { provider: string; model: string; baseURL: string }, window: number, style: LocalGenerationStyle = 'model') => ipcRenderer.invoke(IPC_CHANNELS.LLM_OLLAMA_WINDOW, draft, window, style) as Promise<{ ok: true; model: string; contextTokens: number; requestedTokens: number } | { ok: false; error: string }>,
  connectionSuggestions: (probe?: boolean) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_CONNECTION_SUGGESTIONS, probe === true) as Promise<ConnectionSuggestions>,
  llmStreamChat: (
    messages: Array<{ role: string; content: string }>,
    toolSpecs: Array<{ name: string; description: string; parameters: any }>,
    onChunk: (chunk: { type: string; content: any }) => void,
    run: { projectId: string; runId: string; expectedRevisionId: string },
    context?: AgentTurnContext,
  ) => {
    // A channel of its own for each turn, so chunks of two turns can never mix.
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

  // Chat history
  loadChatHistory: (projectId: string, page?: { limit?: number; beforeId?: string }) => ipcRenderer.invoke(IPC_CHANNELS.CHAT_LOAD_HISTORY, projectId, page) as Promise<ChatRecord[]>,
  saveChatMessage: (record: ChatRecord) => ipcRenderer.invoke(IPC_CHANNELS.CHAT_SAVE_MESSAGE, record) as Promise<{ ok: boolean }>,
  clearChatHistory: (projectId: string) => ipcRenderer.invoke(IPC_CHANNELS.CHAT_CLEAR_HISTORY, projectId) as Promise<{ ok: true; removed: number } | { ok: false; error: string }>,

  // Knowledge and sync
  searchNodeTypes: (request: SearchNodesRequest) => ipcRenderer.invoke(IPC_CHANNELS.KNOWLEDGE_SEARCH_NODES, request) as Promise<NodeClassSummary[]>,
  nodeTypeDetail: (classType: string) => ipcRenderer.invoke(IPC_CHANNELS.KNOWLEDGE_NODE_DETAIL, classType) as Promise<NodeClassDetail | null>,
  validateNodeClass: (classType: string) => ipcRenderer.invoke(IPC_CHANNELS.KNOWLEDGE_VALIDATE_NODE_CLASS, classType) as Promise<NodeClassVerdict>,
  searchModels: (request: SearchModelsRequest) => ipcRenderer.invoke(IPC_CHANNELS.KNOWLEDGE_SEARCH_MODELS, request) as Promise<ModelSummary[]>,
  modelDetail: (directory: string, name: string) => ipcRenderer.invoke(IPC_CHANNELS.KNOWLEDGE_MODEL_DETAIL, { directory, name }) as Promise<ModelDetail | null>,
  modelPreview: (directory: string, name: string) => ipcRenderer.invoke(IPC_CHANNELS.KNOWLEDGE_MODEL_PREVIEW, { directory, name }) as Promise<ModelPreview | null>,
  modelHash: (directory: string, name: string) => ipcRenderer.invoke(IPC_CHANNELS.KNOWLEDGE_MODEL_HASH, { directory, name }) as Promise<ModelLookupResult>,
  modelLookup: (directory: string, name: string) => ipcRenderer.invoke(IPC_CHANNELS.KNOWLEDGE_MODEL_LOOKUP, { directory, name }) as Promise<ModelLookupResult>,
  listExplanations: (request: ListExplanationsRequest) => ipcRenderer.invoke(IPC_CHANNELS.KNOWLEDGE_LIST_EXPLANATIONS, request) as Promise<Explanation[]>,
  saveExplanation: (input: ExplanationInput) => ipcRenderer.invoke(IPC_CHANNELS.KNOWLEDGE_SAVE_EXPLANATION, input) as Promise<Explanation>,
  deleteExplanation: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.KNOWLEDGE_DELETE_EXPLANATION, id) as Promise<{ removed: number }>,
  deleteAssistantExplanations: (owner: ObjectRef) => ipcRenderer.invoke(IPC_CHANNELS.KNOWLEDGE_DELETE_ASSISTANT_EXPLANATIONS, owner) as Promise<{ removed: number }>,
  checkGraph: (projectId: string) => ipcRenderer.invoke(IPC_CHANNELS.KNOWLEDGE_CHECK_GRAPH, projectId) as Promise<GraphCheckReport>,
  fieldModels: (request: FieldModelsRequest) => ipcRenderer.invoke(IPC_CHANNELS.KNOWLEDGE_FIELD_MODELS, request) as Promise<FieldModelsResult>,
  syncStatus: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_STATUS) as Promise<SyncStatus>,
  syncNow: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_NOW) as Promise<SyncStatus>,
  syncSetAuto: (enabled: boolean, intervalMinutes: number) => ipcRenderer.invoke(IPC_CHANNELS.SYNC_SET_AUTO, { enabled, intervalMinutes }) as Promise<SyncStatus>,
  syncPauseEnrichment: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_PAUSE_ENRICHMENT) as Promise<SyncStatus>,
  syncRetryItem: (item: { directory: string; name: string }) => ipcRenderer.invoke(IPC_CHANNELS.SYNC_RETRY_ITEM, item) as Promise<RetryItemResult>,
  syncSkipItem: (item: { directory: string; name: string; skip: boolean }) => ipcRenderer.invoke(IPC_CHANNELS.SYNC_SKIP_ITEM, item) as Promise<SyncStatus>,
  syncImportHeader: (request: ImportModelHeaderRequest) => ipcRenderer.invoke(IPC_CHANNELS.SYNC_IMPORT_HEADER, request) as Promise<ImportModelHeaderResult>,
  syncRetryAll: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_RETRY_ALL) as Promise<SyncStatus>,
  onSyncEvent: (listener: (status: SyncStatus) => void) => {
    const handler = (_event: unknown, status: SyncStatus) => listener(status);
    ipcRenderer.on(IPC_CHANNELS.SYNC_EVENT, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SYNC_EVENT, handler);
  },

  // Proposals (drafts on the canvas)
  listProposals: (projectId: string) => ipcRenderer.invoke(IPC_CHANNELS.PROPOSALS_LIST, projectId) as Promise<Proposal[]>,
  resolveProposal: (request: ResolveProposalRequest) => ipcRenderer.invoke(IPC_CHANNELS.PROPOSALS_RESOLVE, request) as Promise<ProposalResolution>,
  onProposalsEvent: (listener: (proposals: Proposal[]) => void) => {
    const handler = (_event: unknown, proposals: Proposal[]) => listener(proposals);
    ipcRenderer.on(IPC_CHANNELS.PROPOSALS_EVENT, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.PROPOSALS_EVENT, handler);
  },

  // Version history for the replay player (handlers in main/ipc/engineIpc.ts)
  listRevisions: (projectId: string) => ipcRenderer.invoke(IPC_CHANNELS.GRAPH_LIST_REVISIONS, projectId) as Promise<RevisionSummary[]>,
  loadRevision: (projectId: string, revisionId: string) => ipcRenderer.invoke(IPC_CHANNELS.GRAPH_LOAD_REVISION, { projectId, revisionId }) as Promise<RevisionSnapshot | null>,

  // Diagnostics (Help menu, error boundary, renderer error reports)
  collectDiagnostics: () => ipcRenderer.invoke(IPC_CHANNELS.DIAGNOSTICS_COLLECT) as Promise<string>,
  openLogsFolder: () => ipcRenderer.invoke(IPC_CHANNELS.DIAGNOSTICS_OPEN_LOGS) as Promise<{ ok: true } | { ok: false; error: string }>,
  reportRendererError: (report: RendererErrorReport) => ipcRenderer.invoke(IPC_CHANNELS.DIAGNOSTICS_RENDERER_ERROR, report) as Promise<{ logged: boolean }>,
  // About and Help: app facts, licence and notices written at build, the data folder, the bundled help pages.
  aboutInfo: () => ipcRenderer.invoke(IPC_CHANNELS.ABOUT_INFO) as Promise<AboutInfo>,
  aboutLicence: () => ipcRenderer.invoke(IPC_CHANNELS.ABOUT_LICENCE) as Promise<string>,
  aboutNotices: () => ipcRenderer.invoke(IPC_CHANNELS.ABOUT_NOTICES) as Promise<ThirdPartyComponent[]>,
  openDataFolder: () => ipcRenderer.invoke(IPC_CHANNELS.ABOUT_OPEN_DATA_FOLDER) as Promise<{ ok: true } | { ok: false; error: string }>,
  openChromiumLicences: () => ipcRenderer.invoke(IPC_CHANNELS.ABOUT_OPEN_CHROMIUM_LICENCES) as Promise<{ ok: true } | { ok: false; error: string }>,
  issueDraft: () => ipcRenderer.invoke(IPC_CHANNELS.ABOUT_ISSUE_DRAFT) as Promise<IssueDraft>,
  openProjectLink: (kind: ProjectLinkKind) => ipcRenderer.invoke(IPC_CHANNELS.ABOUT_OPEN_PROJECT_LINK, kind) as Promise<{ ok: true } | { ok: false; error: string }>,
  helpTree: (language: string) => ipcRenderer.invoke(IPC_CHANNELS.HELP_TREE, language) as Promise<HelpTree>,
  helpPage: (ref: string, language: string) => ipcRenderer.invoke(IPC_CHANNELS.HELP_PAGE, ref, language) as Promise<HelpPage>,
  helpSearch: (query: string, language: string) => ipcRenderer.invoke(IPC_CHANNELS.HELP_SEARCH, query, language) as Promise<HelpSearchHit[]>,
  // The update notice: off unless Settings ▸ Privacy turns it on; main asks the releases page at most once a day.
  updateStatus: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATES_STATUS) as Promise<UpdateStatus>,
  dismissUpdate: (version: string) => ipcRenderer.invoke(IPC_CHANNELS.UPDATES_DISMISS, version) as Promise<{ ok: true }>,
  // Lessons as files (main/lessons/lessonsIpc.ts): every lesson is checked again in main before it is kept or written.
  listMyLessons: () => ipcRenderer.invoke(IPC_CHANNELS.LESSONS_LIST) as Promise<MyLesson[]>,
  importLessonsDialog: () => ipcRenderer.invoke(IPC_CHANNELS.LESSONS_IMPORT_DIALOG) as Promise<LessonImportOutcome>,
  importLessonsText: (name: string, text: string) => ipcRenderer.invoke(IPC_CHANNELS.LESSONS_IMPORT_TEXT, name, text) as Promise<LessonImportOutcome>,
  exportLessons: (file: LessonFile, suggestedName: string) => ipcRenderer.invoke(IPC_CHANNELS.LESSONS_EXPORT, file, suggestedName) as Promise<LessonExportOutcome>,
  saveMyLesson: (doc: LessonDoc) => ipcRenderer.invoke(IPC_CHANNELS.LESSONS_SAVE, doc) as Promise<LessonImportOutcome>,
  removeMyLesson: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.LESSONS_REMOVE, id) as Promise<boolean>,
  markMyLessonAdult: (id: string, adult: boolean) => ipcRenderer.invoke(IPC_CHANNELS.LESSONS_MARK_ADULT, id, adult) as Promise<boolean>,
  lessonDraft: (draftId: string) => ipcRenderer.invoke(IPC_CHANNELS.LESSONS_DRAFT_GET, draftId) as Promise<LessonDraft | null>,
  resolveLessonDraft: (draftId: string, accept: boolean) => ipcRenderer.invoke(IPC_CHANNELS.LESSONS_DRAFT_RESOLVE, draftId, accept) as Promise<LessonDraftResolution>,
  openUpdateLink: (link: UpdateLink) => ipcRenderer.invoke(IPC_CHANNELS.UPDATES_OPEN, link) as Promise<{ ok: boolean }>,
  // The model conversation log: what was sent to a model and what came back. Files stay in main; the renderer
  // gets summaries, a short text report, and asks main to save a file through a system dialog.
  traceList: () => ipcRenderer.invoke(IPC_CHANNELS.TRACE_LIST) as Promise<ModelLogList>,
  traceReport: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.TRACE_REPORT, id) as Promise<{ ok: true; text: string } | { ok: false; error: string }>,
  traceExport: (request: ModelLogExportRequest) => ipcRenderer.invoke(IPC_CHANNELS.TRACE_EXPORT, request) as Promise<ModelLogExportResult>,
  traceClear: () => ipcRenderer.invoke(IPC_CHANNELS.TRACE_CLEAR) as Promise<{ removed: number }>,
  traceOpenFolder: () => ipcRenderer.invoke(IPC_CHANNELS.TRACE_OPEN_FOLDER) as Promise<{ ok: true } | { ok: false; error: string }>,
  traceRevealExport: () => ipcRenderer.invoke(IPC_CHANNELS.TRACE_REVEAL_EXPORT) as Promise<{ ok: boolean }>,
  // Safe start: asked before the graph is drawn (main may offer an empty canvas), told once it is on screen.
  startState: () => ipcRenderer.invoke(IPC_CHANNELS.APP_START_STATE) as Promise<StartState>,
  graphDrawn: (revisionId: string) => ipcRenderer.invoke(IPC_CHANNELS.APP_GRAPH_DRAWN, revisionId) as Promise<{ ok: boolean }>,
  // Settings ▸ Privacy: the picture cache of model previews.
  previewCacheSize: () => ipcRenderer.invoke(IPC_CHANNELS.PRIVACY_PREVIEW_CACHE) as Promise<{ files: number; bytes: number }>,
  clearPreviewCache: () => ipcRenderer.invoke(IPC_CHANNELS.PRIVACY_CLEAR_PREVIEWS) as Promise<{ files: number; bytes: number }>,
});

/** Safe start: `unfinished` when the previous start did not finish drawing the graph; `emptied` when the person chose an empty canvas. */
export interface StartState {
  unfinished: boolean;
  emptied: boolean;
}

/**
 * What Forget all removes: providers with a key, how many server tokens and browser sign-ins. `providers` is every
 * provider a key can be held for (shared/config/keyOrigin KEY_PROVIDERS), a compatible service and an own server
 * included, as main's secretInventory returns them.
 */
export interface SecretInventoryReport {
  providers: KeyProvider[];
  serverTokens: number;
  signIns: number;
  /** Nonempty crash files or unreadable files not already counted by their known contents. */
  files?: number;
  /** Storage places whose contents could not be checked. */
  unverified?: number;
}

/** Confirmed removal and remaining inventory; failures contain only store kinds, never paths or values. */
export interface ForgetAllSecretsResult {
  status: 'removed' | 'partial';
  removed: SecretInventoryReport;
  remaining: SecretInventoryReport;
  failed: string[];
}

/** A field that looks like a key or token, reported before a file is written. Never the value. */
export interface SecretFieldReport {
  nodeId: string;
  classType: string;
  title: string;
  name: string;
}

/** What the renderer sends about an error; main clips, redacts and rate-limits it. */
export interface RendererErrorReport {
  kind: 'error' | 'unhandledrejection' | 'boundary';
  message: string;
  source?: string;
  stack?: string;
}

/** What "Test connection" answers (llmService.ts ProbeResult plus the completed address). */
export type LlmProbeResult = (
  | { ok: true; latencyMs: number; provider: string; model: string; /** The context window a local server loaded the model with, when it says. */ contextTokens?: number }
  | { ok: false; error: string; latencyMs: number | null }
) & {
  /** The server address asked, with http:// added, when the draft had an address on this computer without it. */
  completedUrl?: string;
};

/** What saving the settings answers: the values as stored, or why nothing was saved. */
export type SettingsSaveResult =
  | { ok: true; values: NonSecretSettings; preferences?: Preferences }
  | { ok: false; error: string };

/** What every way of opening a file answers (main/ipc/openIpc.ts): the commit's response and what was opened. */
export interface OpenResponse {
  status: 'applied' | 'rejected' | 'conflict' | 'cancelled' | string;
  projection: any;
  result: any;
  opened?: { kind: 'project' | 'workflow'; from: 'json' | 'picture' | 'video' | 'api' | 'example'; name: string };
}

/** window.electronAPI as the renderer sees it; it must match the object exposed above. */
export interface ElectronAPI {
  /** Host-only listener controls and shared-project change notifications. */
  browserAccessStatus: () => Promise<import('../shared/browser/contracts').BrowserAccessStatus>;
  browserPairingCode: () => Promise<{ code: string; expiresAt: number }>;
  browserRevoke: (id: string) => Promise<{ ok: boolean }>;
  onBrowserRefresh: (listener: (notice?: { knowledgeChanged?: boolean }) => void) => () => void;
  platform: string;
  /** Sets the size of the whole interface (1 = normal, 2 = twice as large). */
  setInterfaceScale: (factor: number) => void;
  versions: {
    node: string;
    chrome: string;
    electron: string;
    /** package.json version, passed by main; '' when unknown. */
    app?: string;
  };
  /**
   * Build switches from main. `testProvider`: the scripted TEST fixture is offered (unpackaged runs and tests only).
   * `pseudoLocale`: every text drawn 40 % longer with accented letters (layout tests of unpackaged runs only).
   */
  flags: { testProvider: boolean; pseudoLocale?: boolean };
  importWorkflow: () => Promise<import('../shared/commands/types').CommandResponse | { status: 'cancelled'; projection: null; result: null }>;
  importCatalog: () => Promise<
    | { status: 'applied'; result: { nodes: number; models: number; skipped: string[] } }
    | { status: 'cancelled' }
    | { status: 'rejected'; error: string }
  >;
  /** Without an answer, key-like fields come back in `secrets` (node and field, never the value) and nothing is written. */
  exportWorkflow: (secrets?: 'omit' | 'keep') => Promise<{ ok: true; unsetWidgets?: Array<{ nodeId: string; classType: string; name: string }>; fileName?: string } | { ok: false; canceled?: boolean; error?: string; secrets?: SecretFieldReport[] }>;
  exportWorkflowDocument: () => Promise<{ ok: true; workflow: Record<string, unknown>; unsetWidgets?: Array<{ nodeId: string; classType: string; name: string }> } | { ok: false; error: string }>;
  openProject: () => Promise<import('../shared/commands/types').CommandResponse | { status: 'cancelled'; projection: null; result: null }>;
  pathForFile: (file: File) => string;
  openPath: (filePath: string) => Promise<OpenResponse>;
  recentFiles: () => Promise<Array<{ path: string; name: string; kind: 'project' | 'workflow'; at: number }>>;
  openRecent: (filePath: string) => Promise<OpenResponse>;
  examples: () => Promise<string[]>;
  openExample: (lessonId: string) => Promise<OpenResponse>;
  pendingOpen: () => Promise<{ name: string } | null>;
  openPending: () => Promise<OpenResponse>;
  onOpenRequest: (listener: (request: { name: string }) => void) => () => void;
  showExported: () => Promise<{ name: string } | null>;
  exportedText: () => Promise<string | null>;
  comfyAddressKnown: () => Promise<boolean>;
  openJourneyLink: (kind: 'comfyui' | 'comfyui-download' | 'ollama-download') => Promise<{ ok: true } | { ok: false; error: string }>;
  saveProjectFile: (secrets?: 'omit' | 'keep', options?: { saveAs?: boolean }) => Promise<{ ok: true; filePath?: string } | { ok: false; canceled?: boolean; error?: string; secrets?: SecretFieldReport[] }>;
  projectFileState: () => Promise<import('../shared/contracts/projectFile').ProjectFileState>;
  loadProject: (id: string) => Promise<any>;
  listProjects: () => Promise<any[]>;
  getSettings: () => Promise<SettingsRead>;
  /** `input.preferences`, when present, is a patch merged onto the stored preferences. */
  saveSettings: (input: unknown) => Promise<SettingsSaveResult>;
  saveViewPreferences: (patch: unknown) => Promise<import('../shared/config/preferences').Preferences | null>;
  saveSecret: (provider: CloudKeyProvider, value?: string) => Promise<{ status: 'secret-storage-blocked' | 'stored' }>;
  saveSecretFile: (provider: CloudKeyProvider) => Promise<{ status: 'stored' | 'missing' }>;
  forgetSecret: (provider?: CloudKeyProvider) => Promise<{ status: 'removed' | 'partial' }>;
  secretStatus: (provider?: CloudKeyProvider) => Promise<SecretStatus>;
  forgetAllSecrets: () => Promise<ForgetAllSecretsResult>;
  secretInventory: () => Promise<SecretInventoryReport>;
  /** Settings ▸ Connection ▸ ComfyUI address ▸ "Check": whether ComfyUI answers at this address (one read-only GET). */
  checkComfy: (address: string) => Promise<
    | { ok: true; origin: string; local: boolean; version: string; os: string; devices: number; device: string }
    | { ok: false; error: string }
  >;
  /** Runs the ordinary sync, from either address, and says what it read (Settings ▸ Connection ▸ "Read now"). */
  readMcp: () => Promise<McpReadOutcome>;
  extensionDraft: (id: string) => Promise<import('../shared/contracts/extensions').ExtensionDraft | null>;
  extensionStarter: () => Promise<import('../shared/contracts/extensions').ExtensionDraft>;
  graphResources: (projectId: string, refresh?: boolean) => Promise<import('../shared/contracts/resources').GraphResources>;
  inputImagePreview: (name: string) => Promise<string | null>;
  uploadNodeFile: (name: string, data: ArrayBuffer) => Promise<import('../shared/contracts/media').MediaUploadResult>;
  /** `forUrl`: the MCP URL the token is for (e.g. the draft being saved); defaults to the saved URL. */
  mcpSetToken: (value: string, forUrl?: string) => Promise<{ held: boolean }>;
  mcpTokenStatus: () => Promise<McpTokenStatus>;
  mcpSaveTokenFile: (forUrl?: string) => Promise<{ status: 'stored' | 'missing' }>;
  secretStore: () => Promise<SecretStoreInfo>;
  setSecretStore: (choice: SecretStoreInfo['override']) => Promise<{ ok: boolean }>;
  mcpSaveToken: (value?: string, forUrl?: string) => Promise<{ status: 'stored' | 'secret-storage-blocked' }>;
  mcpForgetToken: () => Promise<{ status: 'removed' | 'partial' }>;
  /** Settings ▸ Connection ▸ "Check": what the MCP server wants from a connection, found out by trying. */
  mcpDetectAuth: (url?: string) => Promise<McpAuthProbe>;
  /** Signs in to the saved MCP URL through the system browser; resolves when the browser comes back (or fails). */
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
  /**
   * Holds a key for one cloud provider in main; an empty value forgets that provider's key only. `forBase`: the
   * address the key was pasted for (empty: the official one); the key is sent there and nowhere else.
   */
  llmSetSessionKey: (provider: CloudKeyProvider, value: string, forBase?: string) => Promise<{ held: boolean; source: KeySourceName }>;
  llmSessionStatus: () => Promise<SessionKeyStatus>;
  /** Settings ▸ Assistant ▸ Test connection. Errors come back redacted. */
  llmProbe: (draft: { provider: string; model: string; baseURL: string }) => Promise<LlmProbeResult>;
  /** Settings ▸ Assistant: the models the draft provider or local server offers. A cloud key is used in main only. */
  llmListModels: (draft: { provider: string; model?: string; baseURL: string }) => Promise<ModelListResult>;
  /** Settings ▸ Assistant ▸ Find local servers: the MCP server's Ollama targets and servers answering on this computer. */
  llmDiscoverLocal: () => Promise<LocalDiscovery>;
  /** Asks Ollama for a copy of the draft model that loads with a larger window (Settings ▸ Assistant). */
  servicesStatus: () => Promise<ServicesStatus>;
  servicesControl: (request: ServiceActionRequest) => Promise<ServiceActionResult>;
  llmLocalStatus: (draft: ChatRuntimeConfig) => Promise<LocalModelStatus>;
  llmLocalControl: (draft: ChatRuntimeConfig, model: string, action: LocalModelAction) => Promise<LocalModelStatus>;
  llmOllamaWindow: (draft: { provider: string; model: string; baseURL: string }, window: number, style?: LocalGenerationStyle) => Promise<{ ok: true; model: string; contextTokens: number; requestedTokens: number } | { ok: false; error: string }>;
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
  /** The whole chat, or with `page` the newest `limit` messages before `beforeId` (oldest first). */
  loadChatHistory: (projectId: string, page?: { limit?: number; beforeId?: string }) => Promise<ChatRecord[]>;
  saveChatMessage: (record: ChatRecord) => Promise<{ ok: boolean }>;
  clearChatHistory: (projectId: string) => Promise<{ ok: true; removed: number } | { ok: false; error: string }>;
  searchNodeTypes: (request: SearchNodesRequest) => Promise<NodeClassSummary[]>;
  nodeTypeDetail: (classType: string) => Promise<NodeClassDetail | null>;
  validateNodeClass: (classType: string) => Promise<NodeClassVerdict>;
  searchModels: (request: SearchModelsRequest) => Promise<ModelSummary[]>;
  modelDetail: (directory: string, name: string) => Promise<ModelDetail | null>;
  /** The preview that lies next to a model file; null when it has none or it cannot be read now. */
  modelPreview: (directory: string, name: string) => Promise<ModelPreview | null>;
  /** Has the MCP server make the file's SHA-256, only on the person's click: it reads the whole file there. */
  modelHash: (directory: string, name: string) => Promise<ModelLookupResult>;
  /** Asks Civitai (by fingerprint) and Hugging Face (by name) about the file, on the person's click. */
  modelLookup: (directory: string, name: string) => Promise<ModelLookupResult>;
  listExplanations: (request: ListExplanationsRequest) => Promise<Explanation[]>;
  saveExplanation: (input: ExplanationInput) => Promise<Explanation>;
  /** Removes one note the person wrote (never built-in knowledge or the assistant's words). */
  deleteExplanation: (id: string) => Promise<{ removed: number }>;
  /** Removes what the assistant wrote about one object, in every project. */
  deleteAssistantExplanations: (owner: ObjectRef) => Promise<{ removed: number }>;
  checkGraph: (projectId: string) => Promise<GraphCheckReport>;
  /** Model files a model field can take, joined with the catalog and marked by fit to the checkpoint upstream. */
  fieldModels: (request: FieldModelsRequest) => Promise<FieldModelsResult>;
  syncStatus: () => Promise<SyncStatus>;
  syncNow: () => Promise<SyncStatus>;
  syncSetAuto: (enabled: boolean, intervalMinutes: number) => Promise<SyncStatus>;
  /** Stops background model-metadata reading until the next sync. */
  syncPauseEnrichment: () => Promise<SyncStatus>;
  /** Settings ▸ Sync ▸ "Could not be read": read one model file again now, past its wait. */
  syncRetryItem: (item: { directory: string; name: string }) => Promise<RetryItemResult>;
  /** "Skip this file" on or off: a skipped file is not read until the switch is off. */
  syncSkipItem: (item: { directory: string; name: string; skip: boolean }) => Promise<SyncStatus>;
  /** "Try all again": every wait cleared, and a sync starts. */
  syncImportHeader: (request: ImportModelHeaderRequest) => Promise<ImportModelHeaderResult>;
  syncRetryAll: () => Promise<SyncStatus>;
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
  /** Help ▸ About: version, runtime, system line, the profile folder. */
  aboutInfo: () => Promise<AboutInfo>;
  /** The app's own licence text (dist/notices/LICENSE.txt). */
  aboutLicence: () => Promise<string>;
  /** Every package that ships with the app, with its licence text. */
  aboutNotices: () => Promise<ThirdPartyComponent[]>;
  /** Opens the profile folder in the file manager. */
  openDataFolder: () => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Opens Chromium's licence file that sits next to the executable. */
  openChromiumLicences: () => Promise<{ ok: true } | { ok: false; error: string }>;
  /** What Help ▸ Report a problem puts into a new issue (versions only); shown before anything opens. */
  issueDraft: () => Promise<IssueDraft>;
  /** Opens the project page, its releases or a new issue in the browser; main builds the address. */
  openProjectLink: (kind: ProjectLinkKind) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** The help reader: the section tree, one page (wiki ref or '@whats-new'), and a search over the pages. */
  helpTree: (language: string) => Promise<HelpTree>;
  helpPage: (ref: string, language: string) => Promise<HelpPage>;
  helpSearch: (query: string, language: string) => Promise<HelpSearchHit[]>;
  /** The update notice: { state: 'off' } unless Settings ▸ Privacy turns the check on. */
  updateStatus: () => Promise<UpdateStatus>;
  dismissUpdate: (version: string) => Promise<{ ok: true }>;
  /** "My lessons" in the profile, newest first. */
  listMyLessons: () => Promise<MyLesson[]>;
  /** A lesson file's text the page already has (a dropped file): checked and kept like an imported one. */
  importLessonsText: (name: string, text: string) => Promise<LessonImportOutcome>;
  /** File ▸ Import lessons…: the open dialog, then the file is checked and kept. */
  importLessonsDialog: () => Promise<LessonImportOutcome>;
  /** Writes a lesson file where the person chooses in the save dialog. */
  exportLessons: (file: LessonFile, suggestedName: string) => Promise<LessonExportOutcome>;
  /** Keeps a lesson made in the editor (origin "made"). */
  saveMyLesson: (doc: LessonDoc) => Promise<LessonImportOutcome>;
  removeMyLesson: (id: string) => Promise<boolean>;
  markMyLessonAdult: (id: string, adult: boolean) => Promise<boolean>;
  /** An assistant's lesson draft waiting for the person; null when it is gone (after a restart). */
  lessonDraft: (draftId: string) => Promise<LessonDraft | null>;
  resolveLessonDraft: (draftId: string, accept: boolean) => Promise<LessonDraftResolution>;
  /** Opens the release page or the download in the browser; only addresses main found itself. */
  openUpdateLink: (link: UpdateLink) => Promise<{ ok: boolean }>;
  traceList: () => Promise<ModelLogList>;
  traceReport: (id: string) => Promise<{ ok: true; text: string } | { ok: false; error: string }>;
  traceExport: (request: ModelLogExportRequest) => Promise<ModelLogExportResult>;
  traceClear: () => Promise<{ removed: number }>;
  traceOpenFolder: () => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Shows the log file saved last in the file manager. Takes no path: main remembers what it wrote. */
  traceRevealExport: () => Promise<{ ok: boolean }>;
  /** Before the first draw: whether the last start never finished drawing this graph, and what the person chose. */
  startState: () => Promise<StartState>;
  /** The graph of this revision is on screen. */
  graphDrawn: (revisionId: string) => Promise<{ ok: boolean }>;
  /** How many model previews the app keeps on disk and their size. */
  previewCacheSize: () => Promise<{ files: number; bytes: number }>;
  /** Empties the picture cache; returns what went. */
  clearPreviewCache: () => Promise<{ files: number; bytes: number }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
