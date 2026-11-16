/**
 * The names of the IPC channels between the window and main. Main's handlers register on these names (main/ipc.ts
 * and main/ipc/*.ts, main/knowledge/handlers.ts, main/lessons/lessonsIpc.ts and others). The sandboxed preload
 * cannot import this file, so src/preload/index.ts repeats the whole list; tests/unit/ipcChannelCopy.test.ts keeps
 * the two equal, so a channel added, renamed or removed here must change there too.
 */
export const IPC_CHANNELS = {
  // Database operations
  DB_LOAD_PROJECT: 'db:load-project',
  DB_LIST_PROJECTS: 'db:list-projects',
  
  // Graph operations
  GRAPH_LOAD_REVISION: 'graph:load-revision',
  GRAPH_LIST_REVISIONS: 'graph:list-revisions',
  
  // Chat operations
  CHAT_SAVE_MESSAGE: 'chat:save-message',
  CHAT_LOAD_HISTORY: 'chat:load-history',
  CHAT_CLEAR_HISTORY: 'chat:clear-history',
  
  // File operations
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
  
  // Non-secret settings. Secret saves are rejected without a write.
  BROWSER_STATUS: 'browser:status',
  BROWSER_PAIR_CODE: 'browser:pair-code',
  BROWSER_REVOKE: 'browser:revoke',
  BROWSER_REFRESH: 'browser:refresh',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SAVE: 'settings:save',
  SETTINGS_SAVE_VIEW: 'settings:save-view',
  SETTINGS_PATCH_PREFERENCES: 'settings:patch-preferences',
  SETTINGS_SAVE_SECRET: 'settings:save-secret',
  SETTINGS_FORGET_SECRET: 'settings:forget-secret',
  /** Settings ▸ Privacy ▸ Forget all: every key and token, every address, memory, files and database. */
  SECRETS_FORGET_ALL: 'secrets:forget-all',
  /** What Forget all would remove: providers, how many server tokens and sign-ins. Never a value. */
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
  /** OAuth sign-in to the saved MCP URL through the system browser. Tokens stay in main; status only. */
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

  // LLM operations (main process only)
  LLM_SET_CONFIG: 'llm:set-config',
  LLM_GET_CONFIG: 'llm:get-config',
  LLM_SET_SESSION_KEY: 'llm:set-session-key',
  LLM_SESSION_STATUS: 'llm:session-status',
  LLM_STREAM_CHAT: 'llm:stream-chat',
  /** Checks a draft provider/model/base URL with one tiny request. Never part of a chat turn. */
  LLM_PROBE: 'llm:probe',
  /** The models a draft provider / base URL offers, for the Settings picker. The key stays in main. */
  LLM_LIST_MODELS: 'llm:list-models',
  /** Local OpenAI-compatible servers: named by the MCP server, or answering on this computer. */
  LLM_DISCOVER_LOCAL: 'llm:discover-local',
  LLM_OLLAMA_WINDOW: 'llm:ollama-window',
  SERVICES_STATUS: 'services:status',
  SERVICES_CONTROL: 'services:control',
  LLM_LOCAL_STATUS: 'llm:local-status',
  LLM_LOCAL_CONTROL: 'llm:local-control',
  ASSISTANT_MEMORY_STATUS: 'assistant:memory-status',
  ASSISTANT_MEMORY_RELEASE: 'assistant:memory-release',
  ASSISTANT_MEMORY_RESUME: 'assistant:memory-resume',
  /** Addresses to pick from in Settings ▸ Connection. */
  SETTINGS_CONNECTION_SUGGESTIONS: 'settings:connection-suggestions',
  LLM_CANCEL: 'llm:cancel',
  
  // Knowledge and sync
  KNOWLEDGE_SEARCH_NODES: 'knowledge:search-nodes',
  KNOWLEDGE_NODE_DETAIL: 'knowledge:node-detail',
  KNOWLEDGE_SEARCH_MODELS: 'knowledge:search-models',
  KNOWLEDGE_MODEL_DETAIL: 'knowledge:model-detail',
  /** The preview picture or clip that lies next to a model file, as bytes. */
  KNOWLEDGE_MODEL_PREVIEW: 'knowledge:model-preview',
  /** Has the MCP server make a model file's SHA-256 (the card's "Find on the internet", first step). */
  KNOWLEDGE_MODEL_HASH: 'knowledge:model-hash',
  /** Asks Civitai by the fingerprint and Hugging Face by the name about a model file, and keeps the answer. */
  KNOWLEDGE_MODEL_LOOKUP: 'knowledge:model-lookup',
  KNOWLEDGE_LIST_EXPLANATIONS: 'knowledge:list-explanations',
  KNOWLEDGE_SAVE_EXPLANATION: 'knowledge:save-explanation',
  KNOWLEDGE_DELETE_EXPLANATION: 'knowledge:delete-explanation',
  KNOWLEDGE_DELETE_ASSISTANT_EXPLANATIONS: 'knowledge:delete-assistant-explanations',
  KNOWLEDGE_CHECK_GRAPH: 'knowledge:check-graph',
  KNOWLEDGE_VALIDATE_NODE_CLASS: 'knowledge:validate-node-class',
  /** The model files a model field can take, with family and fit to the checkpoint upstream . */
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

  // Proposals (drafts on the canvas)
  PROPOSALS_LIST: 'proposals:list',
  PROPOSALS_RESOLVE: 'proposals:resolve',
  PROPOSALS_EVENT: 'proposals:event',

  // Diagnostics: log folder, redacted report, renderer error reports
  DIAGNOSTICS_COLLECT: 'diagnostics:collect',
  DIAGNOSTICS_OPEN_LOGS: 'diagnostics:open-logs',
  DIAGNOSTICS_RENDERER_ERROR: 'diagnostics:renderer-error',
  /** The model conversation log (src/main/trace/modelTrace.ts): list, short report, save to a file, clear, folder. */
  TRACE_LIST: 'trace:list',
  TRACE_REPORT: 'trace:report',
  TRACE_EXPORT: 'trace:export',
  TRACE_CLEAR: 'trace:clear',
  TRACE_OPEN_FOLDER: 'trace:open-folder',
  TRACE_REVEAL_EXPORT: 'trace:reveal-export',
  /** About and Help (src/main/ipc/aboutIpc.ts): app facts, licence, third-party notices, data folder, help pages. */
  ABOUT_INFO: 'about:info',
  ABOUT_LICENCE: 'about:licence',
  ABOUT_NOTICES: 'about:notices',
  ABOUT_OPEN_DATA_FOLDER: 'about:open-data-folder',
  ABOUT_OPEN_CHROMIUM_LICENCES: 'about:open-chromium-licences',
  ABOUT_ISSUE_DRAFT: 'about:issue-draft',
  ABOUT_OPEN_PROJECT_LINK: 'about:open-project-link',
  HELP_GUIDE_SOURCE: 'help:guide-source',
  HELP_TREE: 'help:tree',
  HELP_PAGE: 'help:page',
  HELP_SEARCH: 'help:search',
  /** The update notice (src/main/updates/updateIpc.ts): off by default; status, close, open its links. */
  UPDATES_STATUS: 'updates:status',
  UPDATES_DISMISS: 'updates:dismiss',
  UPDATES_OPEN: 'updates:open',
  /** Safe start (src/main/startGuard.ts): asked before the graph is drawn; told once it is on screen. */
  APP_START_STATE: 'app:start-state',
  APP_GRAPH_DRAWN: 'app:graph-drawn',
  PRIVACY_PREVIEW_CACHE: 'privacy:preview-cache',
  PRIVACY_CLEAR_PREVIEWS: 'privacy:clear-previews',
  /** Lessons as files (src/main/lessons/lessonsIpc.ts): My lessons, import, export, save, remove, adult mark, assistant drafts. */
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
