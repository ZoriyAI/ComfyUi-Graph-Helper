import { ipcMain as rawIpcMain, dialog, safeStorage } from 'electron';
import { guardedIpcMain } from './ipc/guard';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import { getDatabase } from './database';
import { mainLLMService } from './llmService';
import { attemptSaveSecret, forgetProviderKey, readProviderKeyCipher, readSettings, saveSecretIfProven, saveSettings } from './settings/repository';
import { probeSecretBackend } from './settings/secretProbe';
import { isUnprotectedCipher, secretPersistenceDecision } from '../shared/config/secretPolicy';
import { applyComfyRead } from './comfy/read';
import { readCatalogViaMcp } from './mcp/client';
import { registerKnowledgeIpc } from './ipc/knowledgeIpc';
import { registerEngineIpc } from './ipc/engineIpc';
import { registerAgentIpc } from './ipc/agentIpc';
import { mcpTokenFor, mcpTokenStatus, releaseMcpTokenIfOriginChanged, setMcpToken } from './mcp/token';
import { saveProjectRecord } from './ipc/projectRecord';
import { redactSecrets } from '../shared/config/draft';
import { setBlockedWebOrigins } from './agent/web';
import { missingOnGraph } from '../shared/graph/compatibility';
import { cancelRun, closeRun, commitCommand, pauseRun, readProjection, resumeRun, startRun, switchProject } from './commands/commit';
import { DESKTOP_PROJECT_ID } from '../shared/project';
import { assertObjectInfoSize, ObjectInfoError, parseObjectInfo } from '../shared/catalog/objectInfo';
import { readCatalog, upsertObjectInfo } from './catalog/repository';
import { parseNativeProject, serializeNativeProject } from '../shared/native-project';
import { exportWorkflow, type GraphSnapshot } from '../shared/workflow/codec';
import { fileDialogCopy, languageOf } from '../shared/i18n';

let secretDecision: { persist: boolean; backend: string; reason: string } | null = null;

async function secretStatus() {
  if (secretDecision) return secretDecision;
  const probe = await probeSecretBackend();
  const decision = secretPersistenceDecision(probe);
  secretDecision = { persist: decision.persist, backend: probe.backend, reason: decision.reason };
  return secretDecision;
}

/** The saved ComfyUI origin and MCP URL, or empty strings when settings are unreadable. */
function savedEndpoints(): { comfyOrigin: string; mcpUrl: string } {
  const read = readSettings(getDatabase());
  return read.source === 'corrupt' ? { comfyOrigin: '', mcpUrl: '' } : { comfyOrigin: read.values.comfyOrigin, mcpUrl: read.values.mcpUrl };
}

/** The page reader must never reach the saved ComfyUI; refreshed whenever settings change. */
function refreshBlockedWebOrigins(comfyOrigin: string): void {
  setBlockedWebOrigins([comfyOrigin]);
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
  // Every handler below, and the domain handlers, check that the sender is the app's own page.
  const ipcMain = guardedIpcMain(rawIpcMain);
  adoptStoredChatRuntime();
  await adoptStoredKey();
  refreshBlockedWebOrigins(savedEndpoints().comfyOrigin);
  // Domain handlers. Each workstream owns its register function; see docs/superpowers/specs/2026-11-08-helper-brief.md.
  registerKnowledgeIpc(ipcMain);
  registerEngineIpc(ipcMain);
  registerAgentIpc(ipcMain);
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
  ipcMain.handle(IPC_CHANNELS.DB_SAVE_PROJECT, (_event, project: unknown) => saveProjectRecord(getDatabase(), project));

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
      refreshBlockedWebOrigins(result.values.comfyOrigin);
      // A token given for one MCP server is not sent to another.
      releaseMcpTokenIfOriginChanged(result.values.mcpUrl);
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

  ipcMain.handle(IPC_CHANNELS.MCP_READ, async () => {
    const url = savedEndpoints().mcpUrl;
    if (!url) return { ok: false as const, error: 'MCP server URL is empty.' };
    return readCatalogViaMcp(getDatabase(), { url, token: mcpTokenFor(url) }, globalThis.fetch);
  });

  ipcMain.handle(IPC_CHANNELS.MCP_SET_TOKEN, (_event, value: unknown, forUrl?: unknown) => {
    console.log('[IPC] MCP token updated (value NOT logged)');
    // The token is bound to the MCP origin it is meant for: the URL being saved alongside it, or the saved one.
    const url = typeof forUrl === 'string' && forUrl.length > 0 && forUrl.length <= 2000 ? forUrl : savedEndpoints().mcpUrl;
    return setMcpToken(value, url);
  });

  ipcMain.handle(IPC_CHANNELS.MCP_TOKEN_STATUS, () => mcpTokenStatus());

  ipcMain.handle(IPC_CHANNELS.GRAPH_COMPATIBILITY, () => {
    const projection = readProjection(getDatabase(), DESKTOP_PROJECT_ID);
    if (!projection) return { ok: false as const, error: 'Project is not ready.' };
    const nodes = Array.isArray(projection.snapshot.nodes) ? projection.snapshot.nodes as Array<{ data?: { comfyType?: unknown } }> : [];
    // The snapshot stores { formatVersion, raw }; the dependency scan reads the raw workflow document.
    const documentState = projection.snapshot.document as { raw?: unknown } | null | undefined;
    const report = missingOnGraph(nodes, readCatalog(getDatabase()), documentState?.raw ?? null);
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

  ipcMain.handle(IPC_CHANNELS.COMMAND_CLOSE_RUN, (_event, projectId: string, runId: string) => {
    return closeRun(getDatabase(), projectId, runId);
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

  // Settings ▸ Assistant ▸ Check connection: one tiny request with the draft runtime and the held key.
  ipcMain.handle(IPC_CHANNELS.LLM_PROBE, (_event, draft: unknown) => {
    const input = draft && typeof draft === 'object' ? draft as Record<string, unknown> : {};
    return mainLLMService.probe({ provider: input.provider, model: input.model, baseURL: input.baseURL });
  });

  // llm:stream-chat and chat history are registered by registerAgentIpc (src/main/ipc/agentIpc.ts).

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
    if (error instanceof ObjectInfoError) return { status: 'rejected' as const, error: redactSecrets(error.message) };
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
