import { ipcMain, dialog, BrowserWindow } from 'electron';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import { getDatabase } from './database';
import { mainLLMService } from './llmService';
import { attemptSaveSecret, readSettings, saveSettings } from './settings/repository';
import { cancelRun, commitCommand, pauseRun, readProjection, resumeRun, startRun, switchProject } from './commands/commit';
import { DESKTOP_PROJECT_ID } from '../shared/project';
import { exportWorkflow, type GraphSnapshot } from '../shared/workflow/codec';
import type { CommandResponse, GraphMutation } from '../shared/commands/types';

export function setupIPC() {
  // File operations
  ipcMain.handle(IPC_CHANNELS.FILE_IMPORT_WORKFLOW, async () => {
    const result = await dialog.showOpenDialog({
      filters: [{ name: 'ComfyUI Workflow', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { status: 'cancelled', projection: null, result: null };
    }
    try {
      const document = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf-8'));
      return importWorkflowDocument(document);
    } catch {
      return { status: 'rejected', projection: readProjection(getDatabase(), DESKTOP_PROJECT_ID), result: { error: 'Workflow JSON could not be parsed.' } };
    }
  });

  ipcMain.handle(IPC_CHANNELS.FILE_EXPORT_WORKFLOW, async () => {
    const exported = exportWorkflowDocument();
    if (!exported.ok) return exported;
    const result = await dialog.showSaveDialog({
      filters: [{ name: 'ComfyUI Workflow', extensions: ['json'] }],
      defaultPath: 'workflow.json',
    });
    if (result.canceled || !result.filePath) return { ok: false, canceled: true };
    try {
      fs.writeFileSync(result.filePath, JSON.stringify(exported.workflow, null, 2), 'utf-8');
    } catch {
      return { ok: false, error: 'The workflow file could not be written.' };
    }
    return { ok: true };
  });

  ipcMain.handle(IPC_CHANNELS.WORKFLOW_EXPORT_DOCUMENT, () => exportWorkflowDocument());

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

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () => {
    return readSettings(getDatabase());
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SAVE, (_event, input: unknown) => {
    return saveSettings(getDatabase(), input);
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SAVE_SECRET, () => {
    return attemptSaveSecret(getDatabase());
  });

  ipcMain.handle(IPC_CHANNELS.COMMAND_COMMIT, (_event, input: unknown) => {
    return commitCommand(getDatabase(), input);
  });

  ipcMain.handle(IPC_CHANNELS.COMMAND_START_RUN, (_event, projectId: string) => {
    return startRun(getDatabase(), projectId);
  });

  ipcMain.handle(IPC_CHANNELS.COMMAND_RESUME_RUN, (_event, projectId: string) => {
    return resumeRun(getDatabase(), projectId);
  });

  ipcMain.handle(IPC_CHANNELS.COMMAND_PAUSE_RUN, (_event, projectId: string, runId: string) => {
    return pauseRun(getDatabase(), projectId, runId);
  });

  ipcMain.handle(IPC_CHANNELS.COMMAND_CANCEL_RUN, (_event, projectId: string, runId: string) => {
    return cancelRun(getDatabase(), projectId, runId);
  });

  ipcMain.handle(IPC_CHANNELS.COMMAND_SWITCH_PROJECT, (_event, projectId: string) => {
    return switchProject(getDatabase(), projectId);
  });

  ipcMain.handle(IPC_CHANNELS.COMMAND_READ_PROJECTION, (_event, projectId: string) => {
    return readProjection(getDatabase(), projectId);
  });

  // LLM operations
  ipcMain.handle(IPC_CHANNELS.LLM_SET_CONFIG, async (_event, config) => {
    console.log('[IPC] Setting LLM config (credentials NOT logged)');
    mainLLMService.setConfig(config);
  });

  ipcMain.handle(
    IPC_CHANNELS.LLM_STREAM_CHAT,
    async (event, messages: any[], toolSpecs: any[], responseChannel: string, runContext: { projectId: string; runId: string; expectedRevisionId: string }) => {
      console.log(`[IPC] Starting LLM stream with ${messages.length} messages, ${toolSpecs.length} tools`);
      const window = BrowserWindow.fromWebContents(event.sender);
      if (!window) {
        throw new Error('Window not found');
      }

      console.log(`[IPC] LLM_STREAM_CHAT handler START`);
      
      try {
        // Build AI SDK tools with IPC round-trip for execution
        const tools: Record<string, any> = {};
        let expectedRevisionId = runContext.expectedRevisionId;
        console.log(`[IPC] Building tools...`);
        for (const spec of toolSpecs) {
          tools[spec.name] = {
            description: spec.description,
            parameters: spec.parameters,
            execute: async (args: any, options?: { toolCallId?: string }) => {
              const toolCallId = options?.toolCallId || `${spec.name}-missing-id`;
              const payload = mutationFromTool(spec.name, args);
              console.log(`[IPC] Tool ${spec.name} commit ${toolCallId}`);
              if (!payload) {
                return { success: false, error: `Unknown tool: ${spec.name}` };
              }
              const outcome = commitCommand(getDatabase(), {
                projectId: runContext.projectId,
                runId: runContext.runId,
                actionId: toolCallId,
                expectedRevisionId,
                actor: 'ai',
                payload,
              });
              if (outcome.status === 'applied' && outcome.projection?.activeRun) {
                expectedRevisionId = outcome.projection.activeRun.expectedRevisionId;
              }
              if (outcome.projection) {
                window.webContents.send(responseChannel, { type: 'projection', content: outcome.projection });
              }
              return toolOutcome(spec.name, args, outcome);
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

function importWorkflowDocument(document: unknown) {
  const db = getDatabase();
  const current = readProjection(db, DESKTOP_PROJECT_ID);
  if (!current) return { status: 'rejected', projection: null, result: { error: 'Project is not ready.' } };
  return commitCommand(db, {
    projectId: DESKTOP_PROJECT_ID,
    actionId: `import-${randomUUID()}`,
    expectedRevisionId: current.currentRevisionId,
    actor: 'manual',
    runId: null,
    payload: { type: 'import-workflow', document },
  });
}

function exportWorkflowDocument() {
  const projection = readProjection(getDatabase(), DESKTOP_PROJECT_ID);
  if (!projection) return { ok: false as const, error: 'Project is not ready.' };
  const snapshot = projection.snapshot as GraphSnapshot;
  return exportWorkflow(snapshot, new Date().toISOString());
}

function mutationFromTool(name: string, args: Record<string, unknown> | undefined): GraphMutation | null {
  const input = args ?? {};
  if (name === 'addNode' && typeof input.nodeType === 'string') {
    return {
      type: 'add-node',
      nodeType: input.nodeType,
      title: typeof input.title === 'string' ? input.title : undefined,
      x: typeof input.x === 'number' ? input.x : undefined,
      y: typeof input.y === 'number' ? input.y : undefined,
      parameters: input.parameters && typeof input.parameters === 'object' ? input.parameters as Record<string, unknown> : undefined,
    };
  }
  if (name === 'annotateNode' && typeof input.nodeId === 'string' && typeof input.annotation === 'string') {
    return { type: 'annotate-node', nodeId: input.nodeId, annotation: input.annotation };
  }
  return null;
}

function toolOutcome(name: string, args: Record<string, unknown> | undefined, outcome: CommandResponse) {
  if (outcome.status === 'applied' || outcome.status === 'historical') {
    const result = outcome.result as { nodeId?: string; nodeType?: string } | null;
    if (name === 'addNode') {
      return {
        success: true,
        message: `Added ${result?.nodeType || args?.nodeType || 'node'} node`,
        nodeType: result?.nodeType || args?.nodeType,
        nodeId: result?.nodeId,
      };
    }
    return { success: true, message: `Annotated node ${result?.nodeId || ''}` };
  }
  return { success: false, conflict: outcome.status === 'conflict', error: outcome.status };
}
