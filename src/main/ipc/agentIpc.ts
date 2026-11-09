import { BrowserWindow, type IpcMain } from 'electron';
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

/** Agent workstream: llm:stream-chat and chat history. */
export function registerAgentIpc(ipcMain: IpcMain): void {
  ipcMain.handle(
    IPC_CHANNELS.LLM_STREAM_CHAT,
    async (event, messages: unknown, toolSpecs: unknown, responseChannel: string, runContext: RunContext, context?: unknown) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (!window) {
        throw new Error('Window not found');
      }
      const send = (channel: string, payload: unknown) => {
        if (!window.isDestroyed()) window.webContents.send(channel, payload);
      };
      await runAgentTurn({
        db: getDatabase(),
        messages,
        toolSpecs,
        run: runContext,
        context,
        language: settingsLanguage(),
        send: (chunk) => send(responseChannel, chunk),
        notify: send,
      });
    },
  );

  ipcMain.handle(IPC_CHANNELS.CHAT_LOAD_HISTORY, (_event, projectId: unknown) => loadChatHistory(getDatabase(), projectId));

  // Preferences ▸ Privacy ▸ "Save chat history" off: messages stay in the window and are not written.
  ipcMain.handle(IPC_CHANNELS.CHAT_SAVE_MESSAGE, (_event, record: unknown) => {
    const db = getDatabase();
    if (!readPreferences(db).privacy.saveChatHistory) return { ok: true as const };
    return saveChatMessage(db, record);
  });

  ipcMain.handle(IPC_CHANNELS.CHAT_CLEAR_HISTORY, (_event, projectId: unknown) => clearChatHistory(getDatabase(), projectId));
}
