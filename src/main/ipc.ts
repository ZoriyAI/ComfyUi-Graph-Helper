import { ipcMain, dialog, BrowserWindow, safeStorage } from 'electron';
import { jsonSchema } from 'ai';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import { getDatabase } from './database';
import { mainLLMService } from './llmService';
import { attemptSaveSecret, forgetProviderKey, readProviderKeyCipher, readSettings, saveSecretIfProven, saveSettings } from './settings/repository';
import { probeSecretBackend } from './settings/secretProbe';
import { isUnprotectedCipher, secretPersistenceDecision } from '../shared/config/secretPolicy';
import { applyComfyRead } from './comfy/read';
import { missingOnGraph } from '../shared/graph/compatibility';
import { cancelRun, commitCommand, pauseRun, readProjection, resumeRun, startRun, switchProject } from './commands/commit';
import { DESKTOP_PROJECT_ID } from '../shared/project';
import { assertObjectInfoSize, ObjectInfoError, parseObjectInfo } from '../shared/catalog/objectInfo';
import { readCatalog, upsertObjectInfo } from './catalog/repository';
import { mutationFromTool } from '../shared/commands/tools';
import { parseNativeProject, serializeNativeProject } from '../shared/native-project';
import { exportWorkflow, type GraphSnapshot } from '../shared/workflow/codec';
import type { CommandResponse } from '../shared/commands/types';
import { fileDialogCopy, languageOf } from '../shared/i18n';

let secretDecision: { persist: boolean; backend: string; reason: string } | null = null;

async function secretStatus() {
  if (secretDecision) return secretDecision;
  const probe = await probeSecretBackend();
  const decision = secretPersistenceDecision(probe);
  secretDecision = { persist: decision.persist, backend: probe.backend, reason: decision.reason };
  return secretDecision;
}

function dialogCopy() {
  return fileDialogCopy(languageOf(readSettings(getDatabase())));
}

function adoptStoredChatRuntime(): void {
  const read = readSettings(getDatabase());
  if (read.source === 'corrupt') return;
  mainLLMService.setConfig({
    provider: read.values.provider,
    model: read.values.model,
    baseURL: read.values.baseURL,
  });
}

async function adoptStoredKey(): Promise<void> {
  const decision = await secretStatus();
  if (!decision.persist) return;
  const cipher = readProviderKeyCipher(getDatabase());
  if (!cipher || isUnprotectedCipher(cipher)) return;
  try {
    const opened = await safeStorage.decryptStringAsync(cipher);
    if (opened.result) mainLLMService.holdOsKey(opened.result);
  } catch {
    // The OS store did not unlock the ciphertext. Memory stays empty.
  }
}

export async function setupIPC(): Promise<void> {
  adoptStoredChatRuntime();
  await adoptStoredKey();
  // File operations
  ipcMain.handle(IPC_CHANNELS.FILE_IMPORT_WORKFLOW, async () => {
    const copy = dialogCopy().importWorkflow;
    const result = await dialog.showOpenDialog({
      title: copy.title,
      buttonLabel: copy.buttonLabel,
      filters: [{ name: copy.filter, extensions: ['json'] }],
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

  ipcMain.handle(IPC_CHANNELS.FILE_IMPORT_CATALOG, async () => {
    const copy = dialogCopy().importCatalog;
    const result = await dialog.showOpenDialog({
      title: copy.title,
      buttonLabel: copy.buttonLabel,
      filters: [{ name: copy.filter, extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return { status: 'cancelled' as const };
    return importCatalogFile(result.filePaths[0]);
  });

  ipcMain.handle(IPC_CHANNELS.FILE_EXPORT_WORKFLOW, async () => {
    const exported = exportWorkflowDocument();
    if (!exported.ok) return exported;
    const copy = dialogCopy().exportWorkflow;
    const result = await dialog.showSaveDialog({
      title: copy.title,
      buttonLabel: copy.buttonLabel,
      filters: [{ name: copy.filter, extensions: ['json'] }],
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

  ipcMain.handle(IPC_CHANNELS.FILE_OPEN_PROJECT, async () => {
    const copy = dialogCopy().openProject;
    const result = await dialog.showOpenDialog({
      title: copy.title,
      buttonLabel: copy.buttonLabel,
      filters: [{ name: copy.filter, extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { status: 'cancelled', projection: null, result: null };
    }
    try {
      const document = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf-8'));
      return openNativeDocument(document);
    } catch {
      return { status: 'rejected', projection: readProjection(getDatabase(), DESKTOP_PROJECT_ID), result: { error: 'The project file could not be parsed.' } };
    }
  });

  ipcMain.handle(IPC_CHANNELS.FILE_SAVE_PROJECT, async () => {
    const saved = nativeProjectDocument();
    if (!saved.ok) return saved;
    const copy = dialogCopy().saveProject;
    const result = await dialog.showSaveDialog({
      title: copy.title,
      buttonLabel: copy.buttonLabel,
      filters: [{ name: copy.filter, extensions: ['json'] }],
      defaultPath: 'project.graph-helper.json',
    });
    if (result.canceled || !result.filePath) return { ok: false, canceled: true };
    try {
      fs.writeFileSync(result.filePath, JSON.stringify(saved.project, null, 2), 'utf-8');
    } catch {
      return { ok: false, error: 'The project file could not be written.' };
    }
    return { ok: true };
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

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () => {
    return readSettings(getDatabase());
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SAVE, (_event, input: unknown) => {
    const result = saveSettings(getDatabase(), input);
    if (result.ok) {
      mainLLMService.setConfig({
        provider: result.values.provider,
        model: result.values.model,
        baseURL: result.values.baseURL,
      });
    }
    return result;
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SAVE_SECRET, async (_event, value: unknown) => {
    const decision = await secretStatus();
    if (!decision.persist || typeof value !== 'string' || value.length === 0) return attemptSaveSecret(getDatabase());
    const cipher = await safeStorage.encryptStringAsync(value);
    const saved = saveSecretIfProven(getDatabase(), decision, value, cipher);
    if (saved.status === 'stored') mainLLMService.holdOsKey(value);
    return saved;
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_FORGET_SECRET, () => {
    forgetProviderKey(getDatabase());
    mainLLMService.setSessionKey('');
    return { status: 'removed' as const };
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SECRET_STATUS, async () => {
    const decision = await secretStatus();
    return { ...decision, stored: readProviderKeyCipher(getDatabase()) != null };
  });

  ipcMain.handle(IPC_CHANNELS.COMFY_READ, async () => {
    const read = readSettings(getDatabase());
    const origin = read.source === 'corrupt' ? '' : read.values.comfyOrigin;
    if (!origin) return { ok: false as const, error: 'Comfy origin is empty.' };
    return applyComfyRead(getDatabase(), origin, globalThis.fetch);
  });

  ipcMain.handle(IPC_CHANNELS.GRAPH_COMPATIBILITY, () => {
    const projection = readProjection(getDatabase(), DESKTOP_PROJECT_ID);
    if (!projection) return { ok: false as const, error: 'Project is not ready.' };
    const nodes = Array.isArray(projection.snapshot.nodes) ? projection.snapshot.nodes as Array<{ data?: { comfyType?: unknown } }> : [];
    const report = missingOnGraph(nodes, readCatalog(getDatabase()), projection.snapshot.document);
    return { ok: true as const, ...report };
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
    mainLLMService.setConfig(config ?? {});
  });

  ipcMain.handle(IPC_CHANNELS.LLM_GET_CONFIG, () => {
    return mainLLMService.nextSendConfig();
  });

  ipcMain.handle(IPC_CHANNELS.LLM_SET_SESSION_KEY, (_event, value: unknown) => {
    console.log('[IPC] Session key updated (value NOT logged)');
    return mainLLMService.setSessionKey(value);
  });

  ipcMain.handle(IPC_CHANNELS.LLM_SESSION_STATUS, () => mainLLMService.sessionStatus());

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
          const schema = spec.parameters && typeof spec.parameters === 'object'
            ? spec.parameters
            : { type: 'object', properties: {} };
          tools[spec.name] = {
            description: spec.description,
            inputSchema: jsonSchema(schema),
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

function importCatalogFile(filePath: string) {
  try {
    const size = fs.statSync(filePath).size;
    assertObjectInfoSize(size);
    const bytes = fs.readFileSync(filePath);
    assertObjectInfoSize(bytes.length);
    const parsed = parseObjectInfo(JSON.parse(bytes.toString('utf8')));
    const result = upsertObjectInfo(getDatabase(), parsed);
    return { status: 'applied' as const, result };
  } catch (error) {
    if (error instanceof ObjectInfoError) return { status: 'rejected' as const, error: error.message };
    if (error instanceof SyntaxError) return { status: 'rejected' as const, error: 'Catalog JSON could not be parsed.' };
    return { status: 'rejected' as const, error: 'Catalog snapshot could not be read.' };
  }
}

function exportWorkflowDocument() {
  const projection = readProjection(getDatabase(), DESKTOP_PROJECT_ID);
  if (!projection) return { ok: false as const, error: 'Project is not ready.' };
  const snapshot = projection.snapshot as GraphSnapshot;
  return exportWorkflow(snapshot, new Date().toISOString(), readCatalog(getDatabase()));
}

function nativeProjectDocument() {
  const projection = readProjection(getDatabase(), DESKTOP_PROJECT_ID);
  if (!projection) return { ok: false as const, error: 'Project is not ready.' };
  const snapshot = projection.snapshot as GraphSnapshot;
  return {
    ok: true as const,
    project: serializeNativeProject({
      process: snapshot.process ?? { title: '', notes: '' },
      graph: {
        nodes: snapshot.nodes,
        edges: snapshot.edges,
        document: snapshot.document,
      },
      components: snapshot.components ?? [],
    }),
  };
}

function openNativeDocument(document: unknown) {
  const parsed = parseNativeProject(document);
  if (!parsed.ok) {
    return { status: 'rejected' as const, projection: readProjection(getDatabase(), DESKTOP_PROJECT_ID), result: { error: parsed.error } };
  }
  const db = getDatabase();
  const current = readProjection(db, DESKTOP_PROJECT_ID);
  if (!current) return { status: 'rejected' as const, projection: null, result: { error: 'Project is not ready.' } };
  return commitCommand(db, {
    projectId: DESKTOP_PROJECT_ID,
    actionId: `open-native-${randomUUID()}`,
    expectedRevisionId: current.currentRevisionId,
    actor: 'manual',
    runId: null,
    payload: { type: 'open-native', project: parsed.project },
  });
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
    if (name === 'setComponentDocumentation') {
      return {
        success: true,
        message: 'Stored component documentation',
        ownerKind: args?.ownerKind,
        ownerId: args?.ownerId,
      };
    }
    if (name === 'setProcess') {
      return { success: true, message: 'Stored the process', title: args?.title };
    }
    return { success: true, message: `Annotated node ${result?.nodeId || ''}` };
  }
  const detail = outcome.result as { error?: unknown } | null;
  const reason = typeof detail?.error === 'string' ? detail.error : outcome.status;
  return { success: false, conflict: outcome.status === 'conflict', error: reason };
}
