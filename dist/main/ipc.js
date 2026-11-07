"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupIPC = setupIPC;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const ipc_channels_1 = require("../shared/ipc-channels");
const database_1 = require("./database");
const llmService_1 = require("./llmService");
function setupIPC() {
    // File operations
    electron_1.ipcMain.handle(ipc_channels_1.IPC_CHANNELS.FILE_IMPORT_WORKFLOW, async () => {
        const result = await electron_1.dialog.showOpenDialog({
            filters: [{ name: 'ComfyUI Workflow', extensions: ['json'] }],
            properties: ['openFile'],
        });
        if (result.canceled || result.filePaths.length === 0) {
            return null;
        }
        const filePath = result.filePaths[0];
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
    });
    electron_1.ipcMain.handle(ipc_channels_1.IPC_CHANNELS.FILE_EXPORT_WORKFLOW, async (_event, workflow) => {
        const result = await electron_1.dialog.showSaveDialog({
            filters: [{ name: 'ComfyUI Workflow', extensions: ['json'] }],
            defaultPath: 'workflow.json',
        });
        if (result.canceled || !result.filePath) {
            return false;
        }
        fs.writeFileSync(result.filePath, JSON.stringify(workflow, null, 2), 'utf-8');
        return true;
    });
    // Project operations
    electron_1.ipcMain.handle(ipc_channels_1.IPC_CHANNELS.DB_SAVE_PROJECT, async (_event, project) => {
        const db = (0, database_1.getDatabase)();
        const stmt = db.prepare(`
      INSERT OR REPLACE INTO projects (id, name, created_at, updated_at, graph_data, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        stmt.run(project.id, project.name, project.created_at, project.updated_at, JSON.stringify(project.graph_data), JSON.stringify(project.metadata || {}));
        return { success: true };
    });
    electron_1.ipcMain.handle(ipc_channels_1.IPC_CHANNELS.DB_LOAD_PROJECT, async (_event, id) => {
        const db = (0, database_1.getDatabase)();
        const stmt = db.prepare('SELECT * FROM projects WHERE id = ?');
        const row = stmt.get(id);
        if (!row)
            return null;
        return {
            id: row.id,
            name: row.name,
            created_at: row.created_at,
            updated_at: row.updated_at,
            graph_data: JSON.parse(row.graph_data),
            metadata: JSON.parse(row.metadata),
        };
    });
    electron_1.ipcMain.handle(ipc_channels_1.IPC_CHANNELS.DB_LIST_PROJECTS, async () => {
        const db = (0, database_1.getDatabase)();
        const stmt = db.prepare('SELECT * FROM projects ORDER BY updated_at DESC');
        const rows = stmt.all();
        return rows.map((row) => ({
            id: row.id,
            name: row.name,
            created_at: row.created_at,
            updated_at: row.updated_at,
            graph_data: JSON.parse(row.graph_data),
            metadata: JSON.parse(row.metadata),
        }));
    });
    // LLM operations
    electron_1.ipcMain.handle(ipc_channels_1.IPC_CHANNELS.LLM_SET_CONFIG, async (_event, config) => {
        console.log('[IPC] Setting LLM config (credentials NOT logged)');
        llmService_1.mainLLMService.setConfig(config);
    });
    electron_1.ipcMain.handle(ipc_channels_1.IPC_CHANNELS.LLM_STREAM_CHAT, async (event, messages, toolSpecs, responseChannel) => {
        console.log(`[IPC] Starting LLM stream with ${messages.length} messages, ${toolSpecs.length} tools`);
        const window = electron_1.BrowserWindow.fromWebContents(event.sender);
        if (!window) {
            throw new Error('Window not found');
        }
        try {
            // Build AI SDK tools with IPC round-trip for execution
            const tools = {};
            for (const spec of toolSpecs) {
                tools[spec.name] = {
                    description: spec.description,
                    parameters: spec.parameters,
                    execute: async (args) => {
                        console.log(`[IPC] Tool ${spec.name} called with args:`, JSON.stringify(args));
                        // Request renderer to execute tool
                        const resultPromise = new Promise((resolve) => {
                            const resultChannel = `tool-result-${Date.now()}-${Math.random()}`;
                            electron_1.ipcMain.once(resultChannel, (_e, result) => {
                                console.log(`[IPC] Tool ${spec.name} result:`, JSON.stringify(result));
                                resolve(result);
                            });
                            window.webContents.send('tool-execute', {
                                tool: spec.name,
                                args,
                                resultChannel,
                            });
                        });
                        return await resultPromise;
                    },
                };
            }
            for await (const chunk of llmService_1.mainLLMService.streamChatWithTools(messages, tools)) {
                window.webContents.send(responseChannel, chunk);
            }
            window.webContents.send(responseChannel, { type: 'done' });
        }
        catch (error) {
            console.error('[IPC] LLM stream error:', error.message);
            window.webContents.send(responseChannel, { type: 'error', content: error.message });
        }
    });
    console.log('[IPC] Handlers registered');
}
