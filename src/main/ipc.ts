/**
 * The IPC setup of the main process: setupIPC (called once by main/index.ts after the database opens) holds the
 * saved keys and tokens again, applies the network settings, registers every area's handlers (ipc/*.ts) and
 * itself handles files, settings, keys and tokens, the MCP connection, graph commands and the model settings.
 * Every handler goes through guardedIpcMain, so only the app's own page can call it; keys and tokens never go back
 * to the renderer, which gets statuses only.
 */
import { ipcMain as rawIpcMain, app, BrowserWindow, dialog, safeStorage } from 'electron';
import { guardedIpcMain } from './ipc/guard';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import { fileWriteErrorCode, writeFileAtomic } from './files/atomicWrite';
import * as path from 'path';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import { getDatabase } from './database';
import { reseedCoreKnowledge } from './knowledge/seedCore';
import { KEYED, mainLLMService, type KeySource } from './llmService';
import { applyNetworkSettings } from './llm/network';
import { attemptSaveSecret, forgetProviderKey, forgetSecret, migrateLegacyProviderKey, readProviderKeyCipher, readSecretCipher, readSettings, saveNamedSecretIfProven, saveSecretIfProven, saveSettings, saveViewPreferences } from './settings/repository';
import { secretStatus } from './settings/secretDecision';
import { isUnprotectedCipher } from '../shared/config/secretPolicy';
import { checkComfy } from './comfy/direct';
import { registerKnowledgeIpc } from './ipc/knowledgeIpc';
import { registerEngineIpc } from './ipc/engineIpc';
import { registerAgentIpc } from './ipc/agentIpc';
import { registerDiagnosticsIpc } from './ipc/diagnosticsIpc';
import { registerAboutIpc } from './ipc/aboutIpc';
import { registerUpdateIpc } from './updates/updateIpc';
import { registerStartIpc, watchReplacingCommit } from './ipc/startIpc';
import { noteExported, openFileAtPath, registerOpenIpc } from './ipc/openIpc';
import { OPENABLE_EXTENSIONS } from './files/openFile';
import { rememberRecent, sourceOf } from './files/recentFiles';
import { clearPreviewsForNewAddress, registerPrivacyIpc } from './ipc/privacyIpc';
import { confirmingOpener } from './signInSite';
import { registerLessonsIpc } from './lessons/lessonsIpc';
import { mcpOriginOf, mcpToken, mcpTokenFor, mcpTokenOrigin, mcpTokenStatus, releaseMcpTokenIfOriginChanged, setMcpToken } from './mcp/token';
import { readTokenFile, removeTokenFile, tokenFileHolds, writeTokenFile } from './mcp/tokenFile';
import { isPasswordStoreChoice, readPasswordStoreOverride, writePasswordStoreOverride } from './settings/passwordStoreOverride';
import { keyFileHolds, readKeyFile, readKeyFileOrigins, removeKeyFile, removeKeyFromFile, writeKeyFile } from './settings/keyFile';
import { decodeKeyRecord, encodeKeyRecord, isKeyProvider, officialOrigin, type KeyProvider } from '../shared/config/keyOrigin';
import { configureMcpOAuth, loginToMcp, logoutFromMcp, mcpOAuth, oauthStatus } from './mcp/oauth';
import { detectMcpAuth } from './mcp/detect';
import { connectStreamableHttp, openReadOnlySession } from './mcp/client';
import { discoverLocalServers, type OpenMcp } from './llm/localDiscovery';
import { connectionSuggestions, rememberSavedAddresses } from './settings/connectionSuggestions';
import { browserOpener } from './mcp/browser';
import { mcpReadOutcome, reportedComfyUrl, syncService } from './mcp/sync';
import { withLoopbackScheme } from '../shared/mcp/loopback';
import { listProjectRecords, loadProjectRecord } from './ipc/projectRecord';
import { redactSecrets } from '../shared/config/draft';
import { forgetEverySecret, secretInventory } from './settings/forgetAll';
import { guardSecretsIn, type SecretField } from './exportSecrets';
import { setBlockedWebOrigins } from './agent/web';
import { missingOnGraph } from '../shared/graph/compatibility';
import { cancelRun, closeRun, commitCommand, pauseRun, readProjection, resumeRun, startRun, switchProject } from './commands/commit';
import { DESKTOP_PROJECT_ID } from '../shared/project';
import { assertObjectInfoSize, ObjectInfoError, parseObjectInfo } from '../shared/catalog/objectInfo';
import { bumpCatalogRevision, readCatalog, upsertObjectInfo } from './catalog/repository';
import { nativeProjectFile, openNativeFile } from './ipc/projectFile';
import { contentDigest, defaultSavePaths, projectFileState, rememberProjectFile, withFileExtension } from './projectFiles';
import { exportWorkflow, type GraphSnapshot } from '../shared/workflow/codec';
import { createTranslator, fileDialogCopy, languageOf } from '../shared/i18n';


/**
 * The address of the person's own model server as typed in the draft: `127.0.0.1:11434/v1` or `localhost:1234`
 * without http:// is completed (the same rule the saved settings follow), and the answer says so.
 */
function draftBaseUrl(value: unknown): { url: unknown; completed: boolean } {
  if (typeof value !== 'string') return { url: value, completed: false };
  const url = withLoopbackScheme(value);
  return { url, completed: url !== value.trim() };
}

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

/** The file dialogs' texts in the interface language. */
function dialogCopy() {
  return fileDialogCopy(languageOf(readSettings(getDatabase())));
}

/** At start: the model service takes the provider, model and address saved in settings. */
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
 * Each cloud provider's key is held again at startup, under that provider only: from the OS password manager when
 * it proved encryption, else from the app folder file the person chose on a computer without a password store.
 * The one-key-era record is first moved to the provider saved in settings.
 */
async function adoptStoredKeys(): Promise<void> {
  const migrated = migrateLegacyProviderKey(getDatabase(), savedProvider());
  if (migrated !== 'none') console.log(`[IPC] One-key-era model key record ${migrated} (value NOT logged)`);
  const decision = await secretStatus();
  const file = readKeyFile(app.getPath('userData'));
  const fileOrigins = readKeyFileOrigins(app.getPath('userData'));
  for (const provider of KEYED) {
    if (decision.persist) {
      const cipher = readProviderKeyCipher(getDatabase(), provider);
      if (cipher && !isUnprotectedCipher(cipher)) {
        try {
          const opened = await safeStorage.decryptStringAsync(cipher);
          // A record from before addresses were remembered is a key for the official address.
          const record = opened.result ? decodeKeyRecord(provider, opened.result) : null;
          if (record) {
            mainLLMService.holdOsKey(provider, record.key, record.origin);
            continue;
          }
        } catch {
          // The OS store did not unlock the ciphertext; the file, if any, is tried next.
        }
      }
    }
    const fromFile = file[provider];
    if (fromFile) mainLLMService.holdFileKey(provider, fromFile, fileOrigins[provider] ?? officialOrigin(provider));
  }
}

/** The provider saved in settings, or '' when settings are unreadable. */
function savedProvider(): string {
  const read = readSettings(getDatabase());
  return read.source === 'corrupt' ? '' : read.values.provider;
}

/** The secrets-table name of the MCP token for this URL's origin: one saved token per server. */
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
    // A sign-in page on another site than the server's is opened only after the person agreed (signInSite.ts).
    openExternal: confirmingOpener({
      open: browserOpener(),
      mcpUrl: () => savedEndpoints().mcpUrl,
      translate: () => createTranslator(languageOf(readSettings(getDatabase()))),
      ask: async (options) => {
        const owner = BrowserWindow.getAllWindows()[0];
        return (owner && !owner.isDestroyed() ? dialog.showMessageBox(owner, options) : dialog.showMessageBox(options)).then((choice) => choice.response);
      },
      log: (line) => console.log(line),
    }),
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

/** Registers every IPC handler; the awaits before the handlers make sure stored keys are held before any call. */
export async function setupIPC(): Promise<void> {
  // Every handler below, and the domain handlers, check that the sender is the app's own page.
  const ipcMain = guardedIpcMain(rawIpcMain);
  adoptStoredChatRuntime();
  await applyNetworkSettings(getDatabase());
  await adoptStoredKeys();
  await adoptStoredMcpToken();
  await setupMcpOAuth();
  refreshBlockedWebOrigins();
  // A sync may learn a new ComfyUI address from the server; the page reader refuses it from then on.
  syncService.onStatus(() => refreshBlockedWebOrigins());
  // Domain handlers: one register function per area (assistant, knowledge and sync, drafts, diagnostics, About); see docs/architecture.md.
  registerKnowledgeIpc(ipcMain);
  registerEngineIpc(ipcMain);
  registerAgentIpc(ipcMain);
  registerDiagnosticsIpc(ipcMain);
  registerAboutIpc(ipcMain);
  registerUpdateIpc(ipcMain);
  registerStartIpc(ipcMain);
  registerPrivacyIpc(ipcMain);
  registerLessonsIpc(ipcMain, { language: () => languageOf(readSettings(getDatabase())) });
  // File operations
  // Every way of opening a file ends in openFileAtPath (ipc/openIpc.ts): one recognition, one commit, one follow-up.
  registerOpenIpc(ipcMain, { importWorkflow: importWorkflowDocument, openProject: openNativeDocument });
  ipcMain.handle(IPC_CHANNELS.FILE_IMPORT_WORKFLOW, async () => {
    const copy = dialogCopy().importWorkflow;
    const result = await dialog.showOpenDialog({
      title: copy.title,
      buttonLabel: copy.buttonLabel,
      // A picture or a video ComfyUI saved carries its workflow; the open path reads it from there.
      filters: [{ name: copy.filter, extensions: [...OPENABLE_EXTENSIONS] }],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { status: 'cancelled', projection: null, result: null };
    }
    return openFileAtPath(result.filePaths[0]);
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

  // `secrets`: 'ask' (default) reports key-like fields before anything is written; 'omit' or 'keep' is the
  // person's answer (exportSecrets.ts).
  ipcMain.handle(IPC_CHANNELS.FILE_EXPORT_WORKFLOW, async (_event, secrets?: unknown) => {
    const checked = exportWorkflowDocument();
    if (!checked.ok) return checked;
    const guarded = guardSecrets(checked.workflow, secrets);
    if ('secrets' in guarded) return guarded;
    const exported = { ...checked, workflow: guarded.document };
    const copy = dialogCopy().exportWorkflow;
    const result = await dialog.showSaveDialog({
      title: copy.title,
      buttonLabel: copy.buttonLabel,
      filters: [{ name: copy.filter, extensions: ['json'] }],
      defaultPath: defaultSavePaths(projectFileState(getDatabase(), DESKTOP_PROJECT_ID)).workflow,
      // GTK on Linux replaces an existing file without asking unless told to ask.
      properties: ['showOverwriteConfirmation'],
    });
    if (result.canceled || !result.filePath) return { ok: false, canceled: true };
    try {
      writeFileAtomic(withFileExtension(result.filePath, 'workflow'), JSON.stringify(exported.workflow, null, 2));
    } catch (error) {
      return { ok: false, error: fileWriteErrorCode(error, 'The workflow file could not be written.', withFileExtension(result.filePath, 'workflow')) };
    }
    // For the run card after the save: "Show in folder", and File ▸ Recent.
    noteExported(withFileExtension(result.filePath, 'workflow'));
    return { ok: true, unsetWidgets: exported.unsetWidgets, fileName: path.basename(withFileExtension(result.filePath, 'workflow')) };
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
    // The same path as every other open: a project opens as a project, a workflow picked here opens as a workflow.
    return openFileAtPath(result.filePaths[0]);
  });

  ipcMain.handle(IPC_CHANNELS.FILE_SAVE_PROJECT, async (_event, secrets?: unknown, options?: { saveAs?: boolean }) => {
    const prepared = nativeProjectDocument();
    if (!prepared.ok) return prepared;
    // The key check comes before any write, the silent save in place included: with key-like fields the
    // renderer asks the person and calls again with the answer.
    const guarded = guardSecrets(prepared.project, secrets);
    if ('secrets' in guarded) return guarded;
    const saved = { ...prepared, project: guarded.document };
    const state = projectFileState(getDatabase(), DESKTOP_PROJECT_ID);
    const captured = readProjection(getDatabase(), DESKTOP_PROJECT_ID)!;
    const changedByGuard = JSON.stringify(saved.project) !== JSON.stringify(prepared.project);
    // A file saved without its secret values is not the graph as it stands: the digest is marked, so the app bar
    // keeps showing unsaved changes.
    const written = { graphKey: state.graphKey, digest: changedByGuard ? `omitted:${contentDigest(captured.snapshot)}` : contentDigest(captured.snapshot) };
    // Save writes back to the project's own file without a question; Save as, or a graph with no file, asks where.
    let filePath = options?.saveAs ? null : state.filePath;
    // The folder of the earlier file is gone (a removed drive, a deleted folder): ask where instead of failing.
    if (filePath && !fs.existsSync(path.dirname(filePath))) filePath = null;
    if (!filePath) {
      const copy = dialogCopy().saveProject;
      const result = await dialog.showSaveDialog({
        title: copy.title,
        buttonLabel: copy.buttonLabel,
        filters: [{ name: copy.filter, extensions: ['json'] }],
        defaultPath: defaultSavePaths(state).project,
        // GTK on Linux replaces an existing file without asking unless told to ask.
        properties: ['showOverwriteConfirmation'],
      });
      if (result.canceled || !result.filePath) return { ok: false, canceled: true };
      // A name typed without .json would hide the file from Open, which lists only *.json.
      filePath = withFileExtension(result.filePath, 'project');
    }
    try {
      writeFileAtomic(filePath, JSON.stringify(saved.project, null, 2));
    } catch (error) {
      return { ok: false, error: fileWriteErrorCode(error, 'The project file could not be written.', filePath) };
    }
    rememberProjectFile(getDatabase(), DESKTOP_PROJECT_ID, filePath, written);
    rememberRecent(app.getPath('userData'), filePath, 'project');
    return { ok: true, filePath };
  });

  ipcMain.handle(IPC_CHANNELS.FILE_PROJECT_STATE, () => {
    const state = projectFileState(getDatabase(), DESKTOP_PROJECT_ID);
    // The workflow file the graph came from names it in the app bar when it has no title and no project file.
    return { ...state, sourceName: sourceOf(app.getPath('userData'), state.graphKey) };
  });

  // Project records in the projects table.
  ipcMain.handle(IPC_CHANNELS.DB_LOAD_PROJECT, (_event, id) => loadProjectRecord(getDatabase(), id, createTranslator(languageOf(readSettings(getDatabase())))));

  ipcMain.handle(IPC_CHANNELS.DB_LIST_PROJECTS, () => listProjectRecords(getDatabase()));

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () => {
    return readSettings(getDatabase());
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SAVE_VIEW, (_event, patch: unknown) => saveViewPreferences(getDatabase(), patch));

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
      // Another address: a sync for the old one stops, and the library is marked as read from the old one.
      if (before.mcpUrl.trim() !== result.values.mcpUrl.trim() || before.comfyOrigin.trim() !== result.values.comfyOrigin.trim()) {
        syncService.addressChanged(getDatabase());
        clearPreviewsForNewAddress();
      }
      reseedCoreKnowledge(getDatabase(), result.values.language);
      void applyNetworkSettings(getDatabase());
      mainLLMService.setConfig({
        provider: result.values.provider,
        model: result.values.model,
        baseURL: result.values.baseURL,
      });
    }
    return result;
  });

  // Model keys, one per cloud provider. Every handler names the provider it acts on; a key is only ever
  // stored, held or forgotten under that provider. Values are never returned or logged.

  /** The key to remember for a provider: the one just pasted, or the one already held for it. Never logged. */
  const keyToRemember = (provider: KeyProvider, value: unknown): string | null => {
    if (typeof value === 'string' && value.length > 0 && value.length <= 4000) return value;
    return mainLLMService.heldKey(provider);
  };

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SAVE_SECRET, async (_event, provider: unknown, value: unknown) => {
    if (!isKeyProvider(provider)) return attemptSaveSecret(getDatabase());
    const decision = await secretStatus();
    const text = keyToRemember(provider, value);
    // A key pasted with this call is for the official address; the held key keeps the address it was pasted for.
    // A provider without an official address (compatible, local) only ever remembers a held key with its address.
    const origin = (typeof value === 'string' && value.length > 0 ? officialOrigin(provider) : null) ?? mainLLMService.keyOrigin(provider) ?? officialOrigin(provider);
    if (!decision.persist || !text || !origin) return attemptSaveSecret(getDatabase());
    const record = encodeKeyRecord(provider, text, origin);
    const cipher = await safeStorage.encryptStringAsync(record);
    const saved = saveSecretIfProven(getDatabase(), decision, provider, record, cipher);
    if (saved.status === 'stored') mainLLMService.holdOsKey(provider, text, origin);
    return saved;
  });

  // The person's explicit choice on a computer without a password store: the key in an owner-only file.
  ipcMain.handle(IPC_CHANNELS.SETTINGS_SAVE_SECRET_FILE, (_event, provider: unknown) => {
    if (!isKeyProvider(provider)) return { status: 'missing' as const };
    const text = keyToRemember(provider, undefined);
    const origin = mainLLMService.keyOrigin(provider) ?? officialOrigin(provider);
    if (!text || !origin) return { status: 'missing' as const };
    writeKeyFile(app.getPath('userData'), provider, text, origin === officialOrigin(provider) ? null : origin);
    mainLLMService.holdFileKey(provider, text, origin);
    console.log(`[IPC] ${provider} model key remembered in the app folder file (value NOT logged)`);
    return { status: 'stored' as const };
  });

  // With a provider: that provider's key only. Without one: every model key (Settings ▸ Privacy ▸ Forget all).
  ipcMain.handle(IPC_CHANNELS.SETTINGS_FORGET_SECRET, (_event, provider?: unknown) => {
    if (isKeyProvider(provider)) {
      forgetProviderKey(getDatabase(), provider);
      removeKeyFromFile(app.getPath('userData'), provider);
      mainLLMService.forgetKeys(provider);
    } else {
      forgetProviderKey(getDatabase());
      removeKeyFile(app.getPath('userData'));
      mainLLMService.forgetKeys();
    }
    return { status: 'removed' as const };
  });

  // Settings ▸ Privacy ▸ Forget all: every key and token for every provider and address, in memory, in the
  // database (unrecoverably) and in the app folder files.
  const inventory = () => secretInventory({
    db: getDatabase(),
    userData: app.getPath('userData'),
    heldProviders: () => KEYED.filter((provider) => mainLLMService.keyStatus(provider).held),
    heldTokenOrigin: () => mcpTokenOrigin(),
    heldSignIns: () => mcpOAuth()?.signedInOrigins() ?? [],
  });
  ipcMain.handle(IPC_CHANNELS.SECRETS_INVENTORY, () => inventory());
  // Returns what was there before, i.e. what was removed, so the window can say it truthfully.
  ipcMain.handle(IPC_CHANNELS.SECRETS_FORGET_ALL, () => {
    const before = inventory();
    const result = forgetEverySecret({
      db: getDatabase(),
      userData: app.getPath('userData'),
      forgetKeys: () => mainLLMService.forgetKeys(),
      forgetMcpToken: () => setMcpToken(''),
      forgetSignIns: () => mcpOAuth()?.forgetAll(),
    });
    console.log(`[IPC] Forgot every secret: ${result.records} records, ${result.files} files${result.compacted ? '' : ' (database not compacted)'}`);
    return { status: 'removed' as const, removed: before };
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SECRET_STATUS, async (_event, forProvider?: unknown) => {
    const decision = await secretStatus();
    const userData = app.getPath('userData');
    const providers = Object.fromEntries(KEYED.map((provider) => [provider, {
      source: mainLLMService.keyStatus(provider).source,
      stored: readProviderKeyCipher(getDatabase(), provider) != null,
      inFile: keyFileHolds(userData, provider),
    }])) as Record<KeyProvider, { source: KeySource; stored: boolean; inFile: boolean }>;
    const provider = isKeyProvider(forProvider) ? forProvider : savedProvider();
    const one = isKeyProvider(provider) ? providers[provider] : { stored: false, inFile: false };
    return { ...decision, stored: one.stored, inFile: one.inFile, providers };
  });

  // Settings ▸ Connection ▸ ComfyUI address ▸ "Check": one GET of /system_stats through the read-only gate, for the
  // address as typed (saved or not). Reading the catalog is the ordinary sync (MCP_READ below).
  ipcMain.handle(IPC_CHANNELS.COMFY_CHECK, async (_event, address: unknown) => {
    if (typeof address !== 'string' || address.length > 2000) return { ok: false as const, error: 'ComfyUI address is not an address.' };
    return checkComfy(address, (...args) => globalThis.fetch(...args));
  });

  ipcMain.handle(IPC_CHANNELS.MCP_READ, async () => {
    // "Read through MCP" is the ordinary sync: every status (indicator, welcome card, popover) then says what was
    // read and when, instead of a second kind of read that leaves them saying "not read".
    // Either address will do: without an MCP server, the sync reads ComfyUI itself.
    const saved = savedEndpoints();
    if (!saved.mcpUrl && !saved.comfyOrigin) return { ok: false as const, error: 'Neither a ComfyUI address nor an MCP server address is set.' };
    const status = await syncService.runSync(getDatabase());
    return mcpReadOutcome(status);
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
    const response = commitCommand(getDatabase(), input);
    // A graph that replaced the one on screen is watched until it is drawn (safe start, startGuard.ts).
    watchReplacingCommit(app.getPath('userData'), input, response, true);
    return response;
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

  // `forBase`: the address shown when the key was pasted (empty: the official one). The key goes there only.
  ipcMain.handle(IPC_CHANNELS.LLM_SET_SESSION_KEY, (_event, provider: unknown, value: unknown, forBase?: unknown) => {
    console.log(`[IPC] Session key updated for ${isKeyProvider(provider) ? provider : 'no provider'} (value NOT logged)`);
    return mainLLMService.setSessionKey(provider, value, typeof forBase === 'string' && forBase.length <= 2000 ? forBase : '');
  });

  // The next send's provider status plus every cloud provider's key place, for the cards. Never a key.
  ipcMain.handle(IPC_CHANNELS.LLM_SESSION_STATUS, () => ({ ...mainLLMService.sessionStatus(), providers: mainLLMService.keySources(), origins: mainLLMService.keyOrigins() }));

  // Settings ▸ Assistant ▸ Test connection: one tiny request with the draft runtime and the held key.
  ipcMain.handle(IPC_CHANNELS.LLM_PROBE, async (_event, draft: unknown) => {
    const input = draft && typeof draft === 'object' ? draft as Record<string, unknown> : {};
    const base = draftBaseUrl(input.baseURL);
    const result = await mainLLMService.probe({ provider: input.provider, model: input.model, baseURL: base.url });
    return base.completed ? { ...result, completedUrl: base.url } : result;
  });

  // Settings ▸ Assistant ▸ model list. A cloud request carries the key held in main; the renderer gets ids only.
  ipcMain.handle(IPC_CHANNELS.LLM_LIST_MODELS, async (_event, draft: unknown) => {
    const input = draft && typeof draft === 'object' ? draft as Record<string, unknown> : {};
    const base = draftBaseUrl(input.baseURL);
    const result = await mainLLMService.listModels({ provider: input.provider, model: input.model, baseURL: base.url });
    return base.completed ? { ...result, completedUrl: base.url } : result;
  });

  // Settings ▸ Assistant: an Ollama copy of the model with a larger context window, made only on the person's click.
  ipcMain.handle(IPC_CHANNELS.LLM_OLLAMA_WINDOW, async (_event, draft: unknown, window: unknown) => {
    const input = (draft && typeof draft === 'object' ? draft : {}) as { provider?: unknown; model?: unknown; baseURL?: unknown };
    const size = typeof window === 'number' && Number.isFinite(window) ? window : 0;
    return mainLLMService.makeWindowVariant({ provider: input.provider, model: input.model, baseURL: input.baseURL }, size);
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

  // Settings ▸ Connection: addresses to offer (used before, or found answering on this computer when `probe`).
  ipcMain.handle(IPC_CHANNELS.SETTINGS_CONNECTION_SUGGESTIONS, (_event, probe: unknown) => (
    connectionSuggestions(getDatabase(), (...args) => globalThis.fetch(...args), { probe: probe === true })
  ));

  // llm:stream-chat and chat history are registered by registerAgentIpc (src/main/ipc/agentIpc.ts).

  console.log('[IPC] Handlers registered');
}

/** Commits a read workflow as the person's own import against the current revision (one undoable step). */
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

/** File ▸ Import catalog: an object_info JSON saved from ComfyUI, read into the catalog as a sync would. */
function importCatalogFile(filePath: string) {
  try {
    // The size is checked before the read and again after it, in case the file grew in between.
    const size = fs.statSync(filePath).size;
    assertObjectInfoSize(size);
    const bytes = fs.readFileSync(filePath);
    assertObjectInfoSize(bytes.length);
    const parsed = parseObjectInfo(JSON.parse(bytes.toString('utf8')));
    const db = getDatabase();
    const result = db.transaction(() => {
      const applied = upsertObjectInfo(db, parsed);
      bumpCatalogRevision(db);
      return applied;
    }).immediate();
    syncService.notify(db);
    return { status: 'applied' as const, result };
  } catch (error) {
    if (error instanceof ObjectInfoError) return { status: 'rejected' as const, error: redactSecrets(error.message) };
    if (error instanceof SyntaxError) return { status: 'rejected' as const, error: 'Catalog JSON could not be parsed.' };
    return { status: 'rejected' as const, error: 'Catalog snapshot could not be read.' };
  }
}

/**
 * Key-like fields of the current graph before a file is written: with no answer yet, the list (never the values)
 * goes back to the window; 'omit' blanks them in the document, 'keep' writes it as it is.
 */
function guardSecrets<T>(document: T, choice: unknown): { document: T } | { ok: false; secrets: SecretField[] } {
  return guardSecretsIn(document, readProjection(getDatabase(), DESKTOP_PROJECT_ID)?.snapshot ?? null, choice);
}

/** The graph as a ComfyUI workflow document, with the catalog for widget names. */
function exportWorkflowDocument() {
  const projection = readProjection(getDatabase(), DESKTOP_PROJECT_ID);
  if (!projection) return { ok: false as const, error: 'Project is not ready.' };
  const snapshot = projection.snapshot as GraphSnapshot;
  return exportWorkflow(snapshot, new Date().toISOString(), readCatalog(getDatabase()));
}

/** The graph as a project file document. */
function nativeProjectDocument() {
  return nativeProjectFile(getDatabase(), DESKTOP_PROJECT_ID);
}

/** Opens a read project file document onto the canvas. */
function openNativeDocument(document: unknown) {
  return openNativeFile(getDatabase(), DESKTOP_PROJECT_ID, document);
}
