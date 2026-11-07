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
  FILE_EXPORT_WORKFLOW: 'file:export-workflow',
  FILE_SELECT_DIRECTORY: 'file:select-directory',
} as const;
