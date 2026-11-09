/**
 * IPC channel constants for Electron main/renderer communication
 */
export const IPC_CHANNELS = {
  // Database operations
  DB_SAVE_PROJECT: 'db:save-project',
  DB_LOAD_PROJECT: 'db:load-project',
  DB_LIST_PROJECTS: 'db:list-projects',
  DB_DELETE_PROJECT: 'db:delete-project',
  
  // Graph operations
  GRAPH_SAVE_REVISION: 'graph:save-revision',
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
  WORKFLOW_EXPORT_DOCUMENT: 'workflow:export-document',
  FILE_SELECT_DIRECTORY: 'file:select-directory',
  
  // Non-secret settings. Secret saves are rejected without a write.
  SETTINGS_GET: 'settings:get',
  SETTINGS_SAVE: 'settings:save',
  SETTINGS_SAVE_SECRET: 'settings:save-secret',
  SETTINGS_FORGET_SECRET: 'settings:forget-secret',
  SETTINGS_SECRET_STATUS: 'settings:secret-status',
  COMFY_READ: 'comfy:read',
  MCP_READ: 'mcp:read',
  MCP_SET_TOKEN: 'mcp:set-token',
  MCP_TOKEN_STATUS: 'mcp:token-status',
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
  LLM_CANCEL: 'llm:cancel',
  
  // Knowledge and sync (KB workstream)
  KNOWLEDGE_SEARCH_NODES: 'knowledge:search-nodes',
  KNOWLEDGE_NODE_DETAIL: 'knowledge:node-detail',
  KNOWLEDGE_SEARCH_MODELS: 'knowledge:search-models',
  KNOWLEDGE_MODEL_DETAIL: 'knowledge:model-detail',
  KNOWLEDGE_LIST_EXPLANATIONS: 'knowledge:list-explanations',
  KNOWLEDGE_SAVE_EXPLANATION: 'knowledge:save-explanation',
  KNOWLEDGE_CHECK_GRAPH: 'knowledge:check-graph',
  SYNC_STATUS: 'sync:status',
  SYNC_NOW: 'sync:now',
  SYNC_SET_AUTO: 'sync:set-auto',
  SYNC_EVENT: 'sync:event',

  // Proposals / ghosts (Engine workstream)
  PROPOSALS_LIST: 'proposals:list',
  PROPOSALS_RESOLVE: 'proposals:resolve',
  PROPOSALS_EVENT: 'proposals:event',

  // Action executor control
  ACTION_PAUSE: 'action:pause',
  ACTION_RESUME: 'action:resume',
  ACTION_CANCEL: 'action:cancel',
  ACTION_GET_STATUS: 'action:get-status',
} as const;
