import { ipcMain, dialog, BrowserWindow } from 'electron';
import * as fs from 'fs';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import { getDatabase } from './database';
import { mainLLMService } from './llmService';

export function setupIPC() {
  // File operations
  ipcMain.handle(IPC_CHANNELS.FILE_IMPORT_WORKFLOW, async () => {
    const result = await dialog.showOpenDialog({
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

  ipcMain.handle(IPC_CHANNELS.FILE_EXPORT_WORKFLOW, async (_event, workflow) => {
    const result = await dialog.showSaveDialog({
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
  ipcMain.handle(IPC_CHANNELS.DB_SAVE_PROJECT, async (_event, project) => {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO projects (id, name, created_at, updated_at, graph_data, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      project.id,
      project.name,
      project.created_at,
      project.updated_at,
      JSON.stringify(project.graph_data),
      JSON.stringify(project.metadata || {})
    );

    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.DB_LOAD_PROJECT, async (_event, id) => {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM projects WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      created_at: row.created_at,
      updated_at: row.updated_at,
      graph_data: JSON.parse(row.graph_data),
      metadata: JSON.parse(row.metadata),
    };
  });

  ipcMain.handle(IPC_CHANNELS.DB_LIST_PROJECTS, async () => {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM projects ORDER BY updated_at DESC');
    const rows = stmt.all() as any[];

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
  ipcMain.handle(IPC_CHANNELS.LLM_SET_CONFIG, async (_event, config) => {
    console.log('[IPC] Setting LLM config (credentials NOT logged)');
    mainLLMService.setConfig(config);
  });

  ipcMain.handle(
    IPC_CHANNELS.LLM_STREAM_CHAT,
    async (event, messages: any[], toolSpecs: any[], responseChannel: string) => {
      console.log(`[IPC] Starting LLM stream with ${messages.length} messages, ${toolSpecs.length} tools`);
      const window = BrowserWindow.fromWebContents(event.sender);
      if (!window) {
        throw new Error('Window not found');
      }

      console.log(`[IPC] LLM_STREAM_CHAT handler START`);
      
      try {
        // Build AI SDK tools with IPC round-trip for execution
        const tools: Record<string, any> = {};
        console.log(`[IPC] Building tools...`);
        for (const spec of toolSpecs) {
          tools[spec.name] = {
            description: spec.description,
            parameters: spec.parameters,
            execute: async (args: any, options?: { toolCallId?: string }) => {
              const executeId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
              const toolCallId = options?.toolCallId;
              console.log(`[IPC:${executeId}] Tool ${spec.name} execute START, toolCallId=${toolCallId || 'none'}`);
              
              const resultChannel = `tool-result-${executeId}`;
              const resultPromise = new Promise((resolve) => {
                console.log(`[IPC:${executeId}] Registering result listener on ${resultChannel}`);
                
                ipcMain.once(resultChannel, (_e, result) => {
                  console.log(`[IPC:${executeId}] Tool ${spec.name} result RECEIVED:`, JSON.stringify(result));
                  resolve(result);
                });
                
                console.log(`[IPC:${executeId}] Sending tool-execute to renderer`);
                window.webContents.send('tool-execute', {
                  tool: spec.name,
                  args,
                  resultChannel,
                  executeId,
                  toolCallId,
                });
              });
              
              console.log(`[IPC:${executeId}] Awaiting result promise...`);
              const result = await resultPromise;
              console.log(`[IPC:${executeId}] Execute promise RESOLVED`);
              return result;
            },
          };
        }

        console.log(`[IPC] Tools built, starting stream consumption...`);
        let chunkCount = 0;
        for await (const chunk of mainLLMService.streamChatWithTools(messages, tools)) {
          chunkCount++;
          console.log(`[IPC] Chunk ${chunkCount}: type=${chunk.type}`);
          if (chunk.type === 'text-delta' || chunk.type === 'text-start' || chunk.type === 'text-end') {
            console.log('[IPC] Text chunk:', chunk.type, chunk.content?.text || '');
          }
          window.webContents.send(responseChannel, chunk);
        }

        console.log(`[IPC] Stream complete after ${chunkCount} chunks, sending done`);
        window.webContents.send(responseChannel, { type: 'done' });
      } catch (error: any) {
        console.error('[IPC] LLM stream error:', error.message);
        window.webContents.send(responseChannel, { type: 'error', content: error.message });
      }
    }
  );

  console.log('[IPC] Handlers registered');
}
