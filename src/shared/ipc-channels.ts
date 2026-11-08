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
  
  // File operations
  FILE_IMPORT_WORKFLOW: 'file:import-workflow',
  FILE_IMPORT_CATALOG: 'file:import-catalog',
  FILE_EXPORT_WORKFLOW: 'file:export-workflow',
  WORKFLOW_EXPORT_DOCUMENT: 'workflow:export-document',
  FILE_SELECT_DIRECTORY: 'file:select-directory',
  
  // Non-secret settings. Secret saves are rejected without a write.
  SETTINGS_GET: 'settings:get',
  SETTINGS_SAVE: 'settings:save',
  SETTINGS_SAVE_SECRET: 'settings:save-secret',

  COMMAND_COMMIT: 'command:commit',
  COMMAND_START_RUN: 'command:start-run',
  COMMAND_RESUME_RUN: 'command:resume-run',
  COMMAND_PAUSE_RUN: 'command:pause-run',
  COMMAND_CANCEL_RUN: 'command:cancel-run',
  COMMAND_SWITCH_PROJECT: 'command:switch-project',
  COMMAND_READ_PROJECTION: 'command:read-projection',

  // LLM operations (main process only)
  LLM_SET_CONFIG: 'llm:set-config',
  LLM_STREAM_CHAT: 'llm:stream-chat',
  LLM_CANCEL: 'llm:cancel',
  
  // Action executor control
  ACTION_PAUSE: 'action:pause',
  ACTION_RESUME: 'action:resume',
  ACTION_CANCEL: 'action:cancel',
  ACTION_GET_STATUS: 'action:get-status',
} as const;
