import { BrowserWindow, type IpcMain, type WebContents } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import { getDatabase } from '../database';
import { readPreferences, readSettings } from '../settings/repository';
import { runAgentTurn } from '../agent/turn';
import { clearChatHistory, loadChatHistory, saveChatMessage } from '../agent/chatHistory';
import type { RunContext } from '../agent/buildTools';

function settingsLanguage(): 'en' | 'ru' {
  const read = readSettings(getDatabase());
  return read.source === 'corrupt' ? 'ru' : read.values.language;
}

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
function abortWithSender(sender: WebContents, controller: AbortController): () => void {
  const abort = () => controller.abort();
  const events = ['render-process-gone', 'destroyed', 'will-navigate'] as const;
  for (const name of events) sender.on(name as 'destroyed', abort);
  return () => {
    for (const name of events) sender.removeListener(name as 'destroyed', abort);
  };
}

/** Agent workstream: llm:stream-chat, llm:cancel and chat history. */
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
      const release = abortWithSender(event.sender, turn.controller);
      try {
        await runAgentTurn({
          db: getDatabase(),
          messages,
          toolSpecs,
          run: runContext,
          context,
          language: settingsLanguage(),
          send: (chunk) => send(responseChannel, chunk),
          notify: send,
          signal: turn.controller.signal,
        });
      } finally {
        release();
        live.delete(turn);
      }
    },
  );

  ipcMain.handle(IPC_CHANNELS.LLM_CANCEL, (event, runId?: unknown) => ({ cancelled: cancelTurns(event.sender.id, runId) }));

  ipcMain.handle(IPC_CHANNELS.CHAT_LOAD_HISTORY, (_event, projectId: unknown) => loadChatHistory(getDatabase(), projectId));

  // Preferences ▸ Privacy ▸ "Save chat history" off: messages stay in the window and are not written.
  ipcMain.handle(IPC_CHANNELS.CHAT_SAVE_MESSAGE, (_event, record: unknown) => {
    const db = getDatabase();
    if (!readPreferences(db).privacy.saveChatHistory) return { ok: true as const };
    return saveChatMessage(db, record);
  });

  ipcMain.handle(IPC_CHANNELS.CHAT_CLEAR_HISTORY, (_event, projectId: unknown) => clearChatHistory(getDatabase(), projectId));
}
