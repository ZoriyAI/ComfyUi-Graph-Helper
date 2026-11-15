/**
 * Safe start: if the last window load never finished drawing the graph (a graph so large or broken that it hung
 * or crashed the canvas), the next start asks whether to open an empty canvas instead.
 * Registered from setupIPC in ipc.ts; ipc.ts and ipc/openIpc.ts call watchReplacingCommit after a graph is replaced.
 * The "drawing" mark lives in a small file (startGuard.ts) so it survives the crash it is meant to detect.
 */
import { app, BrowserWindow, dialog, type IpcMain, type MessageBoxOptions } from 'electron';
import { randomUUID } from 'crypto';
import type Database from 'better-sqlite3';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import { DESKTOP_PROJECT_ID } from '../../shared/project';
import { createTranslator, languageOf, type Translator } from '../../shared/i18n';
import { graphSize } from '../../shared/workflow/graphLimits';
import { commitCommand, readProjection } from '../commands/commit';
import { getDatabase } from '../database';
import { readSettings } from '../settings/repository';
import { log } from '../log';
import { beginDrawing, finishDrawing, readStartMark } from '../startGuard';

/** The empty graph "Start with an empty canvas" opens (the same document as File ▸ New). */
export const EMPTY_GRAPH = { last_node_id: 0, last_link_id: 0, nodes: [], links: [], groups: [], config: {}, extra: {}, version: 0.4 };

/**
 * Payload types that replace the whole graph: the next draw of their revision is watched like a start. Opening a
 * workflow or a project file is watched where the file is read (ipc/openIpc.ts); through the command channel it is
 * Undo and Redo that can bring back a graph the canvas cannot draw.
 */
const REPLACING = new Set(['import-workflow', 'open-native', 'restore-revision']);
const REPLACING_BY_COMMAND = new Set(['restore-revision']);

/** What startChoice needs, passed in so tests run it without Electron dialogs. */
export interface StartChoiceDeps {
  db: Database.Database;
  userData: string;
  translate: Translator;
  /** Shows the question; resolves with the index of the button pressed. */
  ask: (options: MessageBoxOptions) => Promise<number>;
}

/**
 * What a window load does before it draws: mark "drawing" and, when the last load of this graph never finished,
 * ask. "Start with an empty canvas" commits an empty graph (the old one stays in the history: Undo brings it back).
 */
export async function startChoice(deps: StartChoiceDeps & { firstLoad?: boolean }): Promise<{ unfinished: boolean; emptied: boolean }> {
  const projection = readProjection(deps.db, DESKTOP_PROJECT_ID);
  const revisionId = projection?.currentRevisionId ?? null;
  const left = beginDrawing(deps.userData, revisionId);
  // Asked once per run of the app, at its first window load: a reload in the same run (the window was reloaded or
  // came back after a renderer crash) draws as usual, and a graph that hangs it again is asked about at the next start.
  const unfinished = left && deps.firstLoad !== false;
  const size = graphSize(projection?.snapshot as { nodes?: unknown; edges?: unknown; subgraphs?: unknown } | undefined);
  if (!unfinished || !projection || size.nodes === 0) return { unfinished: false, emptied: false };
  log.warn(`[Start] The last start did not finish drawing the graph (${size.nodes} nodes, ${size.links} links)`);
  const t = deps.translate;
  const answer = await deps.ask({
    type: 'warning',
    title: t('safeStart.title'),
    message: t('safeStart.message'),
    detail: t('safeStart.detail', { nodes: size.nodes, links: size.links }),
    buttons: [t('safeStart.empty'), t('safeStart.again')],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  });
  if (answer !== 0) return { unfinished: true, emptied: false };
  const response = commitCommand(deps.db, {
    projectId: DESKTOP_PROJECT_ID,
    actionId: `safe-start-${randomUUID()}`,
    expectedRevisionId: projection.currentRevisionId,
    actor: 'manual',
    runId: null,
    payload: { type: 'import-workflow', document: EMPTY_GRAPH },
  });
  const next = readProjection(deps.db, DESKTOP_PROJECT_ID)?.currentRevisionId ?? null;
  beginDrawing(deps.userData, next);
  return { unfinished: true, emptied: response.status === 'applied' };
}

/** A commit that replaced the graph: its first draw is watched as a start is. */
export function watchReplacingCommit(userData: string, input: unknown, response: { status?: unknown; projection?: unknown }, viaCommand = false): void {
  const type = (input as { payload?: { type?: unknown } } | null)?.payload?.type;
  if (typeof type !== 'string' || !(viaCommand ? REPLACING_BY_COMMAND : REPLACING).has(type) || response?.status !== 'applied') return;
  const revisionId = (response.projection as { currentRevisionId?: unknown } | null)?.currentRevisionId;
  beginDrawing(userData, typeof revisionId === 'string' ? revisionId : null);
}

/** The window drew this revision: only a pending mark changes. */
export function drawn(userData: string, revisionId: unknown): boolean {
  if (typeof revisionId !== 'string' || revisionId.length > 200) return false;
  const mark = readStartMark(userData);
  if (mark?.state !== 'drawing') return true;
  finishDrawing(userData, revisionId);
  return true;
}

/** app:start-state (asked by the window before it draws) and app:graph-drawn (sent once it drew). */
export function registerStartIpc(ipcMain: IpcMain): void {
  const userData = () => app.getPath('userData');
  let loads = 0;
  ipcMain.handle(IPC_CHANNELS.APP_START_STATE, async (event) => {
    loads += 1;
    let language: 'en' | 'ru' = 'ru';
    try {
      language = languageOf(readSettings(getDatabase()));
    } catch {
      // Russian until the settings can be read, as the other start-up dialogs.
    }
    const owner = BrowserWindow.fromWebContents(event.sender);
    return startChoice({
      firstLoad: loads === 1,
      db: getDatabase(),
      userData: userData(),
      translate: createTranslator(language),
      ask: async (options) => (owner && !owner.isDestroyed() ? dialog.showMessageBox(owner, options) : dialog.showMessageBox(options)).then((choice) => choice.response),
    });
  });
  ipcMain.handle(IPC_CHANNELS.APP_GRAPH_DRAWN, (_event, revisionId: unknown) => ({ ok: drawn(userData(), revisionId) }));
}
