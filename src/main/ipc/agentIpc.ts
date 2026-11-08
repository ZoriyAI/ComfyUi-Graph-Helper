import type { IpcMain } from 'electron';

/** Agent workstream: chat history handlers live here; the llm:stream-chat handler moves here from ipc.ts. */
export function registerAgentIpc(_ipcMain: IpcMain): void {
  // Implemented by the Agent workstream.
}
