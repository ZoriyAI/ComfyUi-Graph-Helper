import { setupPage } from '../../shared/journeyLinks';
export { DOWNLOAD_PAGES } from '../../shared/journeyLinks';
/**
 * Every way a file, an example or a remembered file reaches the canvas, and the bridge back to ComfyUI after a save.
 *
 * Who uses it: File ▸ Open workflow and File ▸ Open project (dialogs in main/ipc.ts), a file dropped on the window,
 * a file named on the command line or handed over by a second start, File ▸ Recent and File ▸ Examples, all in the
 * renderer through the preload bridge; the "Run it in ComfyUI" card after a save (show the file in its folder).
 * Why one module: they must behave the same. Each ends in `openFileAtPath` (or, for an example, in the same import
 * commit with the same follow-ups), which recognises the file, turns the API format into a canvas workflow, commits
 * one import or open, marks the drawing for the safe start, and remembers the file. The renderer then runs the same
 * `finishOpen` for all of them (commands/actions.ts): the camera, the one merged import message, the check.
 */
import * as fs from 'fs';
import * as path from 'path';
import { app, BrowserWindow, shell, type IpcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import { apiPromptToWorkflow, isApiPromptDocument } from '../../shared/workflow/apiPrompt';
import { exampleFromLesson } from '../../shared/lessons/example';
import { LESSONS, lessonById } from '../../shared/lessons/lessons';
import { DESKTOP_PROJECT_ID } from '../../shared/project';
import { readCatalog } from '../catalog/repository';
import { readSettings } from '../settings/repository';
import { reportedComfyUrl } from '../mcp/sync';
import { readProjection } from '../commands/commit';
import { getDatabase } from '../database';
import { currentGraphKey } from '../knowledge/projectExplanations';
import { rememberProjectFile } from '../projectFiles';
import { fileOpenErrorCode } from '../files/atomicWrite';
import { isOpenablePath, PNG_TEXT_TOO_LARGE, readOpenedFile } from '../files/openFile';
import { VIDEO_METADATA_CANCELLED, VIDEO_METADATA_INVALID, VIDEO_METADATA_LIMIT } from '../../shared/workflow/videoMetadata';
import { isRecent, recentFiles, rememberRecent, rememberSource } from '../files/recentFiles';
import { watchReplacingCommit } from './startIpc';

/** What the renderer's open helpers get back: the commit's response plus what was opened. */
export interface OpenResponse {
  status: string;
  projection: unknown;
  result: unknown;
  opened?: { kind: 'project' | 'workflow'; from: 'json' | 'picture' | 'video' | 'api' | 'example'; name: string };
}

/** The two commits a file can end in; ipc.ts owns them (they are the same ones the File menu used before). */
export interface OpenCommits {
  importWorkflow: (document: unknown) => { status: string; projection: unknown; result: unknown };
  openProject: (document: unknown) => { status: string; projection: unknown; result: unknown };
}

/** Set by registerOpenIpc; until then every open is refused as "not ready". */
let commits: OpenCommits | null = null;
/** A file named on the command line or by a second start, waiting for the window to ask for it. */
let pending: string | null = null;
/** The last workflow file written for ComfyUI, for "Show in folder" on the run card. */
let lastExport: string | null = null;
let reading: AbortController | null = null;

/** A refused open, with the graph as it is so the window redraws nothing new. */
function rejected(error: string): OpenResponse {
  return { status: 'rejected', projection: readProjection(getDatabase(), DESKTOP_PROJECT_ID), result: { error } };
}

/**
 * Opens one file: the single path behind every way of opening. A project of this app opens as a project and is
 * remembered as the graph's file (Ctrl+S writes back there); anything else opens as a workflow.
 */
export async function openFileAtPath(filePath: string): Promise<OpenResponse> {
  if (!commits) return rejected('Project is not ready.');
  reading?.abort();
  const controller = new AbortController(); reading = controller;
  const revision = readProjection(getDatabase(), DESKTOP_PROJECT_ID)?.currentRevisionId;
  let file;
  try {
    file = await readOpenedFile(filePath, controller.signal);
  } catch (error) {
    // Only known codes pass through; any other message (a system error with a path in it) becomes a fixed code.
    const message = error instanceof Error ? error.message : '';
    if (controller.signal.aborted || message === VIDEO_METADATA_CANCELLED) return { status: 'cancelled', projection: null, result: null };
    return rejected(['This file holds no workflow.', 'Workflow JSON could not be parsed.', PNG_TEXT_TOO_LARGE, VIDEO_METADATA_INVALID, VIDEO_METADATA_LIMIT].includes(message) ? message : fileOpenErrorCode(error, 'Workflow JSON could not be parsed.'));
  } finally { if (reading === controller) reading = null; }
  if (controller.signal.aborted) return { status: 'cancelled', projection: null, result: null };
  if (readProjection(getDatabase(), DESKTOP_PROJECT_ID)?.currentRevisionId !== revision) return rejected('The graph changed while the file was being read. Open it again.');
  const userData = app.getPath('userData');
  const name = path.basename(filePath);
  if (file.kind === 'project') {
    const opened = commits.openProject(file.document);
    if (opened.status === 'applied') {
      // The commit has restored this graph's explanations before the saved fingerprint is captured.
      rememberProjectFile(getDatabase(), DESKTOP_PROJECT_ID, filePath);
      rememberRecent(userData, filePath, 'project');
    }
    watchReplacingCommit(userData, { payload: { type: 'open-native' } }, opened as { status: string; projection: unknown });
    return { ...opened, opened: { kind: 'project', from: 'json', name } };
  }
  const api = isApiPromptDocument(file.document);
  const document = api ? apiPromptToWorkflow(file.document as never, readCatalog(getDatabase())) : file.document;
  const response = commitWorkflow(document, name);
  if (response.status === 'applied') rememberRecent(userData, filePath, 'workflow');
  return { ...response, opened: { kind: 'workflow', from: api ? 'api' : file.from, name } };
}

/** The import commit with what follows every import: the safe-start mark and the file name for the app bar. */
function commitWorkflow(document: unknown, name: string): OpenResponse {
  if (!commits) return rejected('Project is not ready.');
  const userData = app.getPath('userData');
  const response = commits.importWorkflow(document);
  watchReplacingCommit(userData, { payload: { type: 'import-workflow' } }, response as { status: string; projection: unknown });
  if (response.status === 'applied') rememberSource(userData, currentGraphKey(getDatabase(), DESKTOP_PROJECT_ID) ?? '', name);
  return response;
}

/** The lessons whose example this ComfyUI can build, in lesson order. */
export function availableExamples(): string[] {
  const catalog = readCatalog(getDatabase());
  if (catalog.nodes.length === 0) return [];
  return LESSONS.filter((lesson) => exampleFromLesson(lesson, catalog) !== null).map((lesson) => lesson.id);
}

/** Opens the example of a lesson through the same import commit as a file. */
export function openExample(lessonId: string): OpenResponse {
  const lesson = lessonById(lessonId);
  const catalog = readCatalog(getDatabase());
  const prompt = lesson ? exampleFromLesson(lesson, catalog) : null;
  if (!prompt) return rejected('This example cannot be built from your node list.');
  return { ...commitWorkflow(apiPromptToWorkflow(prompt, catalog), lessonId), opened: { kind: 'workflow', from: 'example', name: lessonId } };
}

/**
 * The first argument that names a file this app opens. Chromium's own switches start with "-"; the app's script
 * path and anything that is not a file are skipped.
 */
export function fileFromArgs(argv: readonly string[], cwd: string): string | null {
  for (const arg of argv.slice(1)) {
    if (arg.startsWith('-')) continue;
    const full = path.resolve(cwd, arg);
    if (!isOpenablePath(full)) continue;
    try {
      if (fs.statSync(full).isFile()) return full;
    } catch {
      // Not a file here.
    }
  }
  return null;
}

/**
 * A file from the command line (at start) or from a second start: kept until the window asks for it, and the window
 * is told at once when it is already open.
 */
export function requestOpen(filePath: string | null): void {
  if (!filePath) return;
  pending = filePath;
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send(IPC_CHANNELS.FILE_OPEN_REQUEST, { name: path.basename(filePath) });
  }
}

/** Remembers the workflow file just written, for the run card's "Show in folder". */
export function noteExported(filePath: string): void {
  lastExport = filePath;
  rememberRecent(app.getPath('userData'), filePath, 'workflow');
}

/**
 * The address for a journey link: the ComfyUI address saved in Settings ▸ Connection (http or https only), or one of
 * DOWNLOAD_PAGES; null for anything else.
 */
export function journeyLink(kind: unknown, comfyOrigin = savedComfyOrigin()): string | null {
  if (kind === 'comfyui') {
    try {
      const url = new URL(comfyOrigin);
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin + '/' : null;
    } catch {
      return null;
    }
  }
  return setupPage(kind);
}

/** The ComfyUI address: the one saved in Settings ▸ Connection, else the one an MCP server reported. */
function savedComfyOrigin(): string {
  try {
    const read = readSettings(getDatabase());
    const saved = read.source === 'corrupt' ? '' : read.values.comfyOrigin;
    return saved || reportedComfyUrl(getDatabase()) || '';
  } catch {
    return '';
  }
}

/** Registers the channels; `opening` are the two commits of ipc.ts. */
export function registerOpenIpc(ipcMain: IpcMain, opening: OpenCommits): void {
  commits = opening;
  ipcMain.handle(IPC_CHANNELS.FILE_OPEN_CANCEL, () => { reading?.abort(); return { ok: true }; });
  // A dropped file: the renderer passes its path (webUtils in the preload). Only kinds of file the app opens.
  ipcMain.handle(IPC_CHANNELS.FILE_OPEN_PATH, (_event, filePath: unknown) => {
    if (typeof filePath !== 'string' || filePath.length > 4096 || !path.isAbsolute(filePath) || !isOpenablePath(filePath)) return rejected('This file cannot be opened here.');
    try {
      if (!fs.statSync(filePath).isFile()) return rejected('This file cannot be opened here.');
    } catch {
      return rejected('This file cannot be opened here.');
    }
    return openFileAtPath(filePath);
  });
  ipcMain.handle(IPC_CHANNELS.FILE_RECENT_LIST, () => recentFiles(app.getPath('userData')).map((item) => ({ path: item.path, name: path.basename(item.path), kind: item.kind, at: item.at })));
  ipcMain.handle(IPC_CHANNELS.FILE_OPEN_RECENT, (_event, filePath: unknown) => {
    if (typeof filePath !== 'string' || !isRecent(app.getPath('userData'), filePath)) return rejected('This file cannot be opened here.');
    if (!fs.existsSync(filePath)) return rejected('The file is no longer there.');
    return openFileAtPath(filePath);
  });
  ipcMain.handle(IPC_CHANNELS.FILE_EXAMPLES_LIST, () => availableExamples());
  ipcMain.handle(IPC_CHANNELS.FILE_OPEN_EXAMPLE, (_event, lessonId: unknown) => (typeof lessonId === 'string' && lessonId.length < 100 ? openExample(lessonId) : rejected('This example cannot be built from your node list.')));
  // The command line's file: its name first (the window asks before replacing a graph), then the open itself.
  ipcMain.handle(IPC_CHANNELS.FILE_PENDING_OPEN, () => (pending ? { name: path.basename(pending) } : null));
  ipcMain.handle(IPC_CHANNELS.FILE_OPEN_PENDING, () => {
    const filePath = pending;
    pending = null;
    return filePath ? openFileAtPath(filePath) : { status: 'cancelled', projection: null, result: null };
  });
  // Pages the journey cards open, only on a click: the person's own ComfyUI, and two fixed download pages.
  ipcMain.handle(IPC_CHANNELS.JOURNEY_OPEN_LINK, async (_event, kind: unknown) => {
    const url = journeyLink(kind);
    if (!url) return { ok: false as const, error: kind === 'comfyui' ? 'no-comfy-address' : 'unknown' };
    await shell.openExternal(url);
    return { ok: true as const };
  });
  // The run card's "Copy workflow": the file as it was written (after the key check), so the copy holds no more.
  ipcMain.handle(IPC_CHANNELS.FILE_COPY_EXPORTED, () => {
    try {
      return lastExport ? fs.readFileSync(lastExport, 'utf8') : null;
    } catch {
      return null;
    }
  });
  // Whether "Open ComfyUI" has an address to open (the run card says where to set one when not).
  ipcMain.handle(IPC_CHANNELS.JOURNEY_COMFY_KNOWN, () => journeyLink('comfyui') !== null);
  ipcMain.handle(IPC_CHANNELS.FILE_SHOW_EXPORTED, () => {
    if (lastExport && fs.existsSync(lastExport)) shell.showItemInFolder(lastExport);
    return lastExport ? { name: path.basename(lastExport) } : null;
  });
}
