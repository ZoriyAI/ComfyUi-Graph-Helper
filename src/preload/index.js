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
    exportWorkflow: (workflow) => ipcRenderer.invoke(IPC_CHANNELS.FILE_EXPORT_WORKFLOW, workflow),
    // Project operations
    saveProject: (project) => ipcRenderer.invoke(IPC_CHANNELS.DB_SAVE_PROJECT, project),
    loadProject: (id) => ipcRenderer.invoke(IPC_CHANNELS.DB_LOAD_PROJECT, id),
    listProjects: () => ipcRenderer.invoke(IPC_CHANNELS.DB_LIST_PROJECTS),
});
