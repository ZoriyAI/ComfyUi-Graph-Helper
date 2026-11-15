/**
 * IPC of the assistant chat: run one agent turn with streamed chunks, cancel turns, and the stored chat history.
 * Registered once from setupIPC in ipc.ts; the turn itself is agent/turn.ts.
 * Turns are tied to the window that asked, so a closed or crashed window never leaves a turn running on its own.
 */
import { app, BrowserWindow, type IpcMain, type WebContents } from 'electron';
import { languageOf, type AppLanguage } from '../../shared/i18n';
import { turnLinesAllowed } from '../trace/modelTrace';
import { reportInterruptedRun } from '../agent/interrupted';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import { getDatabase } from '../database';
import { readPreferences, readSettings } from '../settings/repository';
import { runAgentTurn } from '../agent/turn';
import { clearChatHistory, loadChatHistory, saveChatMessage } from '../agent/chatHistory';
import type { RunContext } from '../agent/buildTools';
import { mainLLMService } from '../llmService';
import { log } from '../log';
import { forgetConversationLinks } from '../agent/links';

function settingsLanguage(): AppLanguage {
  return languageOf(readSettings(getDatabase()));
}

/** One turn in flight: how to stop it and whose it is. */
interface LiveTurn {
  controller: AbortController;
  senderId: number;
  runId: string;
}

/** Turns in flight. llm:cancel aborts by run id (or every turn of the sender when no id is given). */
const live = new Set<LiveTurn>();

/** Aborts the turns of one sender, or only the one for runId. Returns how many were aborted. */
export function cancelTurns(senderId: number, runId?: unknown): number {
  let count = 0;
  for (const turn of live) {
    if (turn.senderId !== senderId) continue;
    if (typeof runId === 'string' && runId !== '' && turn.runId !== runId) continue;
    if (!turn.controller.signal.aborted) {
      turn.controller.abort();
      count += 1;
    }
  }
  return count;
}

/** Aborts the turn when its window crashes, closes, or navigates away. Returns the cleanup. */
function abortWithSender(sender: WebContents, controller: AbortController, onGone?: () => void): () => void {
  const abort = () => {
    onGone?.();
    controller.abort();
  };
  const events = ['render-process-gone', 'destroyed', 'will-navigate'] as const;
  // The cast only satisfies Electron's overloaded `on` typing; each event gets the same handler.
  for (const name of events) sender.on(name as 'destroyed', abort);
  return () => {
    for (const name of events) sender.removeListener(name as 'destroyed', abort);
  };
}

/** The assistant: llm:stream-chat, llm:cancel and chat history. */
export function registerAgentIpc(ipcMain: IpcMain): void {
  ipcMain.handle(
    IPC_CHANNELS.LLM_STREAM_CHAT,
    async (event, messages: unknown, toolSpecs: unknown, responseChannel: string, runContext: RunContext, context?: unknown) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (!window) {
        throw new Error('Window not found');
      }
      const send = (channel: string, payload: unknown) => {
        if (!window.isDestroyed() && !event.sender.isDestroyed()) window.webContents.send(channel, payload);
      };
      const turn: LiveTurn = { controller: new AbortController(), senderId: event.sender.id, runId: String(runContext?.runId ?? '') };
      live.add(turn);
      // The window went away during the turn (closed in a pause or a build): the chat keeps a trace of it.
      let windowGone = false;
      const release = abortWithSender(event.sender, turn.controller, () => { windowGone = true; });
      // The log records which runtime ran the turn and how it ended; never the prompt or a key.
      const runtime = mainLLMService.nextSendConfig();
      const started = Date.now();
      let steps = 0;
      let failure: string | null = null;
      if (turnLinesAllowed()) log.info(`[Agent] Turn start provider=${runtime.provider || 'none'} model=${runtime.model || 'none'} run=${turn.runId}`);
      try {
        await runAgentTurn({
          db: getDatabase(),
          messages,
          toolSpecs,
          run: runContext,
          context,
          language: settingsLanguage(),
          send: (chunk) => {
            if (chunk?.type === 'start-step') steps += 1;
            if (chunk?.type === 'error') failure = typeof chunk.content === 'string' ? chunk.content : 'stream error';
            send(responseChannel, chunk);
          },
          notify: send,
          signal: turn.controller.signal,
          appVersion: app.getVersion(),
        });
      } finally {
        const outcome = turn.controller.signal.aborted ? 'cancelled' : failure ? `error: ${String(failure).slice(0, 300)}` : 'ok';
        if (turnLinesAllowed()) log.info(`[Agent] Turn end provider=${runtime.provider || 'none'} model=${runtime.model || 'none'} steps=${steps} ms=${Date.now() - started} ${outcome}`);
        release();
        live.delete(turn);
        if (windowGone && runContext?.projectId && runContext?.runId) {
          reportInterruptedRun(getDatabase(), String(runContext.projectId), String(runContext.runId), settingsLanguage());
        }
      }
    },
  );

  ipcMain.handle(IPC_CHANNELS.LLM_CANCEL, (event, runId?: unknown) => ({ cancelled: cancelTurns(event.sender.id, runId) }));

  ipcMain.handle(IPC_CHANNELS.CHAT_LOAD_HISTORY, (_event, projectId: unknown, page?: unknown) => loadChatHistory(getDatabase(), projectId, page));

  // Preferences ▸ Privacy ▸ "Save chat history" off: messages stay in the window and are not written.
  ipcMain.handle(IPC_CHANNELS.CHAT_SAVE_MESSAGE, (_event, record: unknown) => {
    const db = getDatabase();
    if (!readPreferences(db).privacy.saveChatHistory) return { ok: true as const };
    return saveChatMessage(db, record);
  });

  ipcMain.handle(IPC_CHANNELS.CHAT_CLEAR_HISTORY, (_event, projectId: unknown) => {
    // The addresses written or found in the cleared conversation may no longer be opened.
    if (typeof projectId === 'string') forgetConversationLinks(projectId);
    return clearChatHistory(getDatabase(), projectId);
  });
}
