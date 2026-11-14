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

/** Payload types that replace the whole graph: the next draw of their revision is watched like a start. */
const REPLACING = new Set(['import-workflow', 'open-native', 'restore-revision']);

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
export async function startChoice(deps: StartChoiceDeps): Promise<{ unfinished: boolean; emptied: boolean }> {
  const projection = readProjection(deps.db, DESKTOP_PROJECT_ID);
  const revisionId = projection?.currentRevisionId ?? null;
  const unfinished = beginDrawing(deps.userData, revisionId);
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
export function watchReplacingCommit(userData: string, input: unknown, response: { status?: unknown; projection?: unknown }): void {
  const type = (input as { payload?: { type?: unknown } } | null)?.payload?.type;
  if (typeof type !== 'string' || !REPLACING.has(type) || response?.status !== 'applied') return;
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

export function registerStartIpc(ipcMain: IpcMain): void {
  const userData = () => app.getPath('userData');
  ipcMain.handle(IPC_CHANNELS.APP_START_STATE, async (event) => {
    let language: 'en' | 'ru' = 'ru';
    try {
      language = languageOf(readSettings(getDatabase()));
    } catch {
      // Russian until the settings can be read, as the other start-up dialogs.
    }
    const owner = BrowserWindow.fromWebContents(event.sender);
    return startChoice({
      db: getDatabase(),
      userData: userData(),
      translate: createTranslator(language),
      ask: async (options) => (owner && !owner.isDestroyed() ? dialog.showMessageBox(owner, options) : dialog.showMessageBox(options)).then((choice) => choice.response),
    });
  });
  ipcMain.handle(IPC_CHANNELS.APP_GRAPH_DRAWN, (_event, revisionId: unknown) => ({ ok: drawn(userData(), revisionId) }));
}
