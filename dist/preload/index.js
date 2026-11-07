"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const ipc_channels_1 = require("../shared/ipc-channels");
// Expose safe IPC API to renderer
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    // Platform info
    platform: process.platform,
    versions: {
        node: process.versions.node,
        chrome: process.versions.chrome,
        electron: process.versions.electron,
    },
    // File operations
    importWorkflow: () => electron_1.ipcRenderer.invoke(ipc_channels_1.IPC_CHANNELS.FILE_IMPORT_WORKFLOW),
    exportWorkflow: (workflow) => electron_1.ipcRenderer.invoke(ipc_channels_1.IPC_CHANNELS.FILE_EXPORT_WORKFLOW, workflow),
    // Project operations
    saveProject: (project) => electron_1.ipcRenderer.invoke(ipc_channels_1.IPC_CHANNELS.DB_SAVE_PROJECT, project),
    loadProject: (id) => electron_1.ipcRenderer.invoke(ipc_channels_1.IPC_CHANNELS.DB_LOAD_PROJECT, id),
    listProjects: () => electron_1.ipcRenderer.invoke(ipc_channels_1.IPC_CHANNELS.DB_LIST_PROJECTS),
    // LLM operations
    llmSetConfig: (config) => electron_1.ipcRenderer.invoke(ipc_channels_1.IPC_CHANNELS.LLM_SET_CONFIG, config),
    llmStreamChat: (messages, toolSpecs, onChunk, onToolExecute) => {
        const channel = `llm-stream-${Date.now()}`;
        electron_1.ipcRenderer.on(channel, (_event, chunk) => onChunk(chunk));
        electron_1.ipcRenderer.on('tool-execute', (_event, request) => onToolExecute(request));
        return electron_1.ipcRenderer.invoke(ipc_channels_1.IPC_CHANNELS.LLM_STREAM_CHAT, messages, toolSpecs, channel);
    },
    sendToolResult: (resultChannel, result) => {
        electron_1.ipcRenderer.send(resultChannel, result);
    },
});
