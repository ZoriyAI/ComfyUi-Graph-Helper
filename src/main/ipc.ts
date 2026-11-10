import { ipcMain as rawIpcMain, app, dialog, safeStorage } from 'electron';
import { guardedIpcMain } from './ipc/guard';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import { getDatabase } from './database';
import { reseedCoreKnowledge } from './knowledge/seedCore';
import { mainLLMService } from './llmService';
import { attemptSaveSecret, forgetProviderKey, forgetSecret, readProviderKeyCipher, readSecretCipher, readSettings, saveNamedSecretIfProven, saveSecretIfProven, saveSettings } from './settings/repository';
import { secretStatus } from './settings/secretDecision';
import { isUnprotectedCipher } from '../shared/config/secretPolicy';
import { applyComfyRead } from './comfy/read';
import { readCatalogViaMcp } from './mcp/client';
import { registerKnowledgeIpc } from './ipc/knowledgeIpc';
import { registerEngineIpc } from './ipc/engineIpc';
import { registerAgentIpc } from './ipc/agentIpc';
import { registerDiagnosticsIpc } from './ipc/diagnosticsIpc';
import { mcpOriginOf, mcpToken, mcpTokenFor, mcpTokenStatus, releaseMcpTokenIfOriginChanged, setMcpToken } from './mcp/token';
import { readTokenFile, removeTokenFile, tokenFileHolds, writeTokenFile } from './mcp/tokenFile';
import { isPasswordStoreChoice, readPasswordStoreOverride, writePasswordStoreOverride } from './settings/passwordStoreOverride';
import { keyFileHolds, readKeyFile, removeKeyFile, writeKeyFile } from './settings/keyFile';
import { configureMcpOAuth, loginToMcp, logoutFromMcp, mcpOAuth, oauthStatus } from './mcp/oauth';
import { detectMcpAuth } from './mcp/detect';
import { connectStreamableHttp, openReadOnlySession } from './mcp/client';
import { discoverLocalServers, type OpenMcp } from './llm/localDiscovery';
import { connectionSuggestions, rememberSavedAddresses } from './settings/connectionSuggestions';
import { browserOpener } from './mcp/browser';
import { reportedComfyUrl, syncService } from './mcp/sync';
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


/** The saved ComfyUI origin and MCP URL, or empty strings when settings are unreadable. */
function savedEndpoints(): { comfyOrigin: string; mcpUrl: string } {
  const read = readSettings(getDatabase());
  return read.source === 'corrupt' ? { comfyOrigin: '', mcpUrl: '' } : { comfyOrigin: read.values.comfyOrigin, mcpUrl: read.values.mcpUrl };
}

/**
 * The agent's page reader must never reach the person's ComfyUI or MCP server, at whatever address and port they
 * run: the saved Comfy origin, the MCP server origin and the ComfyUI address the server reported at the last sync.
 * Refreshed whenever settings change and after every sync; no port number is built in.
 */
function refreshBlockedWebOrigins(): void {
  const { comfyOrigin, mcpUrl } = savedEndpoints();
  let reported: string | null = null;
  try {
    reported = reportedComfyUrl(getDatabase());
  } catch {
    // Without a readable database only the saved addresses are refused.
  }
  setBlockedWebOrigins([comfyOrigin, mcpOriginOf(mcpUrl), reported]);
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

/**
 * The model key is held again at startup: from the OS password manager when it proved encryption, else from the
 * app folder file the person chose on a computer without a password store, for the saved provider only.
 */
async function adoptStoredKey(): Promise<void> {
  const decision = await secretStatus();
  if (decision.persist) {
    const cipher = readProviderKeyCipher(getDatabase());
    if (cipher && !isUnprotectedCipher(cipher)) {
      try {
        const opened = await safeStorage.decryptStringAsync(cipher);
        if (opened.result) {
          mainLLMService.holdOsKey(opened.result);
          return;
        }
      } catch {
        // The OS store did not unlock the ciphertext; the file, if any, is tried next.
      }
    }
  }
  const read = readSettings(getDatabase());
  const provider = read.source === 'corrupt' ? '' : read.values.provider;
  const file = readKeyFile(app.getPath('userData'));
  if (provider && file && file.provider === provider) mainLLMService.holdFileKey(file.key);
}

function savedProvider(): string {
  const read = readSettings(getDatabase());
  return read.source === 'corrupt' ? '' : read.values.provider;
}

function mcpTokenRecordName(url: string | null | undefined): string | null {
  const origin = mcpOriginOf(url);
  return origin ? `mcp-token:${origin}` : null;
}

/**
 * A manual MCP token saved for the saved MCP origin is held again at startup: from the OS password manager when
 * it proved encryption, else from the app folder file the person chose on a computer without a password store.
 */
async function adoptStoredMcpToken(): Promise<void> {
  const url = savedEndpoints().mcpUrl;
  const origin = mcpOriginOf(url);
  if (!origin) return;
  const decision = await secretStatus();
  if (decision.persist) {
    const cipher = readSecretCipher(getDatabase(), `mcp-token:${origin}`);
    if (cipher && !isUnprotectedCipher(cipher)) {
      try {
        const opened = await safeStorage.decryptStringAsync(cipher);
        if (opened.result) {
          setMcpToken(opened.result, url, 'os');
          return;
        }
      } catch {
        // The OS store did not unlock the ciphertext; the file, if any, is tried next.
      }
    }
  }
  const file = readTokenFile(app.getPath('userData'));
  if (file && file.origin === origin) setMcpToken(file.token, url, 'file');
}

/** Wires the MCP OAuth manager to safeStorage (same fail-closed probe as the model key) and the system browser. */
async function setupMcpOAuth(): Promise<void> {
  const manager = configureMcpOAuth({
    db: getDatabase,
    vault: {
      decision: secretStatus,
      encrypt: (plain) => safeStorage.encryptStringAsync(plain),
      decrypt: async (cipher) => (await safeStorage.decryptStringAsync(cipher)).result ?? null,
    },
    openExternal: browserOpener(),
    language: () => languageOf(readSettings(getDatabase())),
    now: () => Date.now(),
  });
  manager.onChange(() => {
    syncService.notify();
  });
  // Stored sign-ins load before the first sync status, so the indicator knows whether one is held.
  const url = savedEndpoints().mcpUrl;
  if (url) {
    try {
      await manager.load(new URL(url).origin);
    } catch {
      // An unreadable URL has no sign-in.
    }
  }
}

export async function setupIPC(): Promise<void> {
  // Every handler below, and the domain handlers, check that the sender is the app's own page.
  const ipcMain = guardedIpcMain(rawIpcMain);
  adoptStoredChatRuntime();
  await adoptStoredKey();
  await adoptStoredMcpToken();
  await setupMcpOAuth();
  refreshBlockedWebOrigins();
  // A sync may learn a new ComfyUI address from the server; the page reader refuses it from then on.
  syncService.onStatus(() => refreshBlockedWebOrigins());
  // Domain handlers. Each workstream owns its register function; see docs/superpowers/specs/2026-11-08-helper-brief.md.
  registerKnowledgeIpc(ipcMain);
  registerEngineIpc(ipcMain);
  registerAgentIpc(ipcMain);
  registerDiagnosticsIpc(ipcMain);
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
    return { ok: true, unsetWidgets: exported.unsetWidgets };
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
    const before = savedEndpoints();
    const result = saveSettings(getDatabase(), input);
    if (result.ok) {
      // Addresses the person used before are offered again in Settings ▸ Connection.
      try {
        rememberSavedAddresses(getDatabase(), before, { comfyOrigin: result.values.comfyOrigin, mcpUrl: result.values.mcpUrl });
      } catch {
        // History is a convenience; a failed write never fails the save.
      }
      refreshBlockedWebOrigins();
      // A token given for one MCP server is not sent to another.
      releaseMcpTokenIfOriginChanged(result.values.mcpUrl);
      reseedCoreKnowledge(getDatabase(), result.values.language);
      mainLLMService.setConfig({
        provider: result.values.provider,
        model: result.values.model,
        baseURL: result.values.baseURL,
      });
    }
    return result;
  });

  /** The key to remember: the one just pasted, or the one already held for this session. Never logged. */
  const keyToRemember = (value: unknown): string | null => {
    if (typeof value === 'string' && value.length > 0 && value.length <= 4000) return value;
    return mainLLMService.heldKey();
  };

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SAVE_SECRET, async (_event, value: unknown) => {
    const decision = await secretStatus();
    const text = keyToRemember(value);
    if (!decision.persist || !text) return attemptSaveSecret(getDatabase());
    const cipher = await safeStorage.encryptStringAsync(text);
    const saved = saveSecretIfProven(getDatabase(), decision, text, cipher);
    if (saved.status === 'stored') mainLLMService.holdOsKey(text);
    return saved;
  });

  // The person's explicit choice on a computer without a password store: the key in an owner-only file.
  ipcMain.handle(IPC_CHANNELS.SETTINGS_SAVE_SECRET_FILE, () => {
    const provider = savedProvider();
    const text = keyToRemember(undefined);
    if (!provider || !text) return { status: 'missing' as const };
    writeKeyFile(app.getPath('userData'), provider, text);
    mainLLMService.holdFileKey(text);
    console.log('[IPC] Model key remembered in the app folder file (value NOT logged)');
    return { status: 'stored' as const };
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_FORGET_SECRET, () => {
    forgetProviderKey(getDatabase());
    removeKeyFile(app.getPath('userData'));
    mainLLMService.setSessionKey('');
    return { status: 'removed' as const };
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SECRET_STATUS, async () => {
    const decision = await secretStatus();
    return { ...decision, stored: readProviderKeyCipher(getDatabase()) != null, inFile: keyFileHolds(app.getPath('userData'), savedProvider()) };
  });

  ipcMain.handle(IPC_CHANNELS.COMFY_READ, async () => {
    const read = readSettings(getDatabase());
    const origin = read.source === 'corrupt' ? '' : read.values.comfyOrigin;
    if (!origin) return { ok: false as const, error: 'Comfy origin is empty.' };
    const started = Date.now();
    console.log('[Comfy] Reading /system_stats and /object_info');
    const result = await applyComfyRead(getDatabase(), origin, globalThis.fetch);
    if (result.ok) console.log(`[Comfy] Read ${result.nodes} node classes, ${result.models} models in ${Date.now() - started} ms (skipped ${result.skipped.length})`);
    else console.warn(`[Comfy] Read failed after ${Date.now() - started} ms: ${result.error}`);
    return result;
  });

  ipcMain.handle(IPC_CHANNELS.MCP_READ, async () => {
    const url = savedEndpoints().mcpUrl;
    if (!url) return { ok: false as const, error: 'MCP server URL is empty.' };
    return readCatalogViaMcp(getDatabase(), { url, token: mcpTokenFor(url) }, globalThis.fetch);
  });

  // Settings ▸ Connection "Check": what this server wants from a connection, found out by trying, never by assuming.
  ipcMain.handle(IPC_CHANNELS.MCP_DETECT_AUTH, async (_event, forUrl?: unknown) => {
    const url = typeof forUrl === 'string' && forUrl.length > 0 && forUrl.length <= 2000 ? forUrl : savedEndpoints().mcpUrl;
    if (!url) return { ok: false as const, error: 'MCP server URL is empty.' };
    // A held token is tried against a 401, so "Check" also says whether the pasted token is accepted.
    return detectMcpAuth(url, { token: mcpTokenFor(url) });
  });

  ipcMain.handle(IPC_CHANNELS.MCP_SET_TOKEN, (_event, value: unknown, forUrl?: unknown) => {
    console.log('[IPC] MCP token updated (value NOT logged)');
    // The token is bound to the MCP origin it is meant for: the URL being saved alongside it, or the saved one.
    const url = typeof forUrl === 'string' && forUrl.length > 0 && forUrl.length <= 2000 ? forUrl : savedEndpoints().mcpUrl;
    return setMcpToken(value, url);
  });

  ipcMain.handle(IPC_CHANNELS.MCP_TOKEN_STATUS, () => {
    const url = savedEndpoints().mcpUrl;
    const name = mcpTokenRecordName(url);
    return {
      ...mcpTokenStatus(),
      stored: name != null && readSecretCipher(getDatabase(), name) != null,
      inFile: tokenFileHolds(app.getPath('userData'), mcpOriginOf(url)),
    };
  });

  /** The token to remember: the one just pasted, or the one already held for this session. Never logged. */
  const tokenToRemember = (value: unknown): string | null => {
    if (typeof value === 'string' && value.length > 0 && value.length <= 8000) return value;
    return mcpToken();
  };

  // The manual token can be kept in the OS password manager under the same fail-closed rule as the model key.
  ipcMain.handle(IPC_CHANNELS.MCP_SAVE_TOKEN, async (_event, value: unknown, forUrl?: unknown) => {
    const decision = await secretStatus();
    const url = typeof forUrl === 'string' && forUrl.length > 0 && forUrl.length <= 2000 ? forUrl : savedEndpoints().mcpUrl;
    const name = mcpTokenRecordName(url);
    const text = tokenToRemember(value);
    if (!decision.persist || !text || !name) return attemptSaveSecret(getDatabase());
    const cipher = await safeStorage.encryptStringAsync(text);
    const saved = saveNamedSecretIfProven(getDatabase(), decision, name, text, cipher);
    if (saved.status === 'stored') setMcpToken(text, url, 'os');
    console.log(`[IPC] MCP token save: ${saved.status} (value NOT logged)`);
    return saved;
  });

  // The person's explicit choice on a computer without a password store: the token in an owner-only file.
  ipcMain.handle(IPC_CHANNELS.MCP_SAVE_TOKEN_FILE, (_event, forUrl?: unknown) => {
    const url = typeof forUrl === 'string' && forUrl.length > 0 && forUrl.length <= 2000 ? forUrl : savedEndpoints().mcpUrl;
    const origin = mcpOriginOf(url);
    const text = tokenToRemember(undefined);
    if (!origin || !text) return { status: 'missing' as const };
    writeTokenFile(app.getPath('userData'), origin, text);
    setMcpToken(text, url, 'file');
    console.log('[IPC] MCP token remembered in the app folder file (value NOT logged)');
    return { status: 'stored' as const };
  });

  ipcMain.handle(IPC_CHANNELS.MCP_FORGET_TOKEN, () => {
    const name = mcpTokenRecordName(savedEndpoints().mcpUrl);
    if (name) forgetSecret(getDatabase(), name);
    removeTokenFile(app.getPath('userData'));
    setMcpToken('');
    return { status: 'removed' as const };
  });

  // Settings ▸ Privacy ▸ Password store: what was found, and the choice for the next start.
  ipcMain.handle(IPC_CHANNELS.SECRET_STORE_GET, async () => {
    const decision = await secretStatus();
    return { backend: decision.backend, persist: decision.persist, reason: decision.reason, override: readPasswordStoreOverride(app.getPath('userData')) };
  });
  ipcMain.handle(IPC_CHANNELS.SECRET_STORE_SET, (_event, choice: unknown) => {
    if (choice !== null && !isPasswordStoreChoice(choice)) return { ok: false };
    writePasswordStoreOverride(app.getPath('userData'), choice);
    return { ok: true };
  });

  // OAuth sign-in for the saved MCP URL. The renderer gets status only; tokens stay in main.
  ipcMain.handle(IPC_CHANNELS.MCP_OAUTH_LOGIN, async () => {
    const url = savedEndpoints().mcpUrl;
    if (!url) return { ok: false as const, error: 'MCP server URL is empty.' };
    console.log('[IPC] MCP sign-in started (tokens NOT logged)');
    return loginToMcp(url);
  });

  ipcMain.handle(IPC_CHANNELS.MCP_OAUTH_LOGOUT, () => logoutFromMcp(savedEndpoints().mcpUrl));

  ipcMain.handle(IPC_CHANNELS.MCP_OAUTH_STATUS, () => oauthStatus(savedEndpoints().mcpUrl));

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

  // Settings ▸ Assistant ▸ model list. A cloud request carries the key held in main; the renderer gets ids only.
  ipcMain.handle(IPC_CHANNELS.LLM_LIST_MODELS, (_event, draft: unknown) => {
    const input = draft && typeof draft === 'object' ? draft as Record<string, unknown> : {};
    return mainLLMService.listModels({ provider: input.provider, model: input.model, baseURL: input.baseURL });
  });

  // Settings ▸ Assistant ▸ Find local servers: the MCP server's Ollama targets (read-only tools) and loopback probes.
  ipcMain.handle(IPC_CHANNELS.LLM_DISCOVER_LOCAL, () => {
    const url = savedEndpoints().mcpUrl;
    const openMcp: OpenMcp | null = url ? async () => {
      // The same offer as a sync makes: what the person chose in Settings ▸ Connection, else whatever is held.
      const read = readSettings(getDatabase());
      const mode = read.source === 'corrupt' ? '' : read.values.mcpAuth;
      const token = mode === 'none' || mode === 'oauth' ? null : mcpTokenFor(url);
      let authProvider = null;
      if (!token && mode !== 'none' && mode !== 'token') {
        try {
          authProvider = (await mcpOAuth()?.backgroundProvider(url)) ?? null;
        } catch {
          authProvider = null;
        }
      }
      return openReadOnlySession({ url, token, authProvider }, connectStreamableHttp);
    } : null;
    return discoverLocalServers({ fetchImpl: (...args) => globalThis.fetch(...args), openMcp });
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_CONNECTION_SUGGESTIONS, (_event, probe: unknown) => (
    connectionSuggestions(getDatabase(), (...args) => globalThis.fetch(...args), { probe: probe === true })
  ));

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
