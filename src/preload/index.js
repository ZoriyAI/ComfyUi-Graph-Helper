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
    // LLM operations
    llmSetConfig: (config) => ipcRenderer.invoke(IPC_CHANNELS.LLM_SET_CONFIG, config),
    llmStreamChat: (messages, toolSpecs, onChunk, onToolExecute) => {
        const channel = `llm-stream-${Date.now()}`;
        ipcRenderer.on(channel, (_event, chunk) => onChunk(chunk));
        ipcRenderer.on('tool-execute', (_event, request) => onToolExecute(request));
        return ipcRenderer.invoke(IPC_CHANNELS.LLM_STREAM_CHAT, messages, toolSpecs, channel);
    },
    sendToolResult: (resultChannel, result) => {
        ipcRenderer.send(resultChannel, result);
    },
});
