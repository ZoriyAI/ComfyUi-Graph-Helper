import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc-channels';

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
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
