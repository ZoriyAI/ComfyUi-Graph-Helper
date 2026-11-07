import { contextBridge, ipcRenderer } from 'electron';

// IPC channel constants (inlined for sandbox-compatible preload)
const IPC_CHANNELS = {
  FILE_IMPORT_WORKFLOW: 'file:import-workflow',
  FILE_EXPORT_WORKFLOW: 'file:export-workflow',
  DB_SAVE_PROJECT: 'db:save-project',
  DB_LOAD_PROJECT: 'db:load-project',
  DB_LIST_PROJECTS: 'db:list-projects',
  LLM_SET_CONFIG: 'llm:set-config',
  LLM_STREAM_CHAT: 'llm:stream-chat',
} as const;

// Expose safe IPC API to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Platform info
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },

  // File operations
  importWorkflow: () => ipcRenderer.invoke(IPC_CHANNELS.FILE_IMPORT_WORKFLOW),
  exportWorkflow: (workflow: any) => ipcRenderer.invoke(IPC_CHANNELS.FILE_EXPORT_WORKFLOW, workflow),

  // Project operations
  saveProject: (project: any) => ipcRenderer.invoke(IPC_CHANNELS.DB_SAVE_PROJECT, project),
  loadProject: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.DB_LOAD_PROJECT, id),
  listProjects: () => ipcRenderer.invoke(IPC_CHANNELS.DB_LIST_PROJECTS),

  // LLM operations
  llmSetConfig: (config: { provider: string; model: string; apiKey?: string; baseURL?: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.LLM_SET_CONFIG, config),
  llmStreamChat: (
    messages: Array<{ role: string; content: string }>,
    toolSpecs: Array<{ name: string; description: string; parameters: any }>,
    onChunk: (chunk: { type: string; content: any }) => void,
    onToolExecute: (request: { tool: string; args: any; resultChannel: string; executeId?: string }) => void
  ) => {
    const channel = `llm-stream-${Date.now()}`;
    ipcRenderer.on(channel, (_event, chunk) => onChunk(chunk));
    ipcRenderer.on('tool-execute', (_event, request) => onToolExecute(request));
    return ipcRenderer.invoke(IPC_CHANNELS.LLM_STREAM_CHAT, messages, toolSpecs, channel);
  },
  sendToolResult: (resultChannel: string, result: any) => {
    ipcRenderer.send(resultChannel, result);
  },
});

// Type declaration for renderer
export interface ElectronAPI {
  platform: string;
  versions: {
    node: string;
    chrome: string;
    electron: string;
  };
  importWorkflow: () => Promise<any>;
  exportWorkflow: (workflow: any) => Promise<boolean>;
  saveProject: (project: any) => Promise<{ success: boolean }>;
  loadProject: (id: string) => Promise<any>;
  listProjects: () => Promise<any[]>;
  llmSetConfig: (config: {
    provider: string;
    model: string;
    apiKey?: string;
    baseURL?: string;
  }) => Promise<void>;
  llmStreamChat: (
    messages: Array<{ role: string; content: string }>,
    toolSpecs: Array<{ name: string; description: string; parameters: any }>,
    onChunk: (chunk: { type: string; content: any }) => void,
    onToolExecute: (request: { tool: string; args: any; resultChannel: string; executeId?: string }) => void
  ) => Promise<void>;
  sendToolResult: (resultChannel: string, result: any) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
