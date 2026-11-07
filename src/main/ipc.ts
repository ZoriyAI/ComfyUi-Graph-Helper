import { ipcMain, dialog, BrowserWindow } from 'electron';
import * as fs from 'fs';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import { getDatabase } from './database';
import { mainLLMService } from './llmService';

export function setupIPC() {
  // File operations
  ipcMain.handle(IPC_CHANNELS.FILE_IMPORT_WORKFLOW, async () => {
    const result = await dialog.showOpenDialog({
      filters: [{ name: 'ComfyUI Workflow', extensions: ['json'] }],
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const filePath = result.filePaths[0];
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  });

  ipcMain.handle(IPC_CHANNELS.FILE_EXPORT_WORKFLOW, async (_event, workflow) => {
    const result = await dialog.showSaveDialog({
      filters: [{ name: 'ComfyUI Workflow', extensions: ['json'] }],
      defaultPath: 'workflow.json',
    });

    if (result.canceled || !result.filePath) {
      return false;
    }

    fs.writeFileSync(result.filePath, JSON.stringify(workflow, null, 2), 'utf-8');
    return true;
  });

  // Project operations
  ipcMain.handle(IPC_CHANNELS.DB_SAVE_PROJECT, async (_event, project) => {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO projects (id, name, created_at, updated_at, graph_data, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      project.id,
      project.name,
      project.created_at,
      project.updated_at,
      JSON.stringify(project.graph_data),
      JSON.stringify(project.metadata || {})
    );

    return { success: true };
  });

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

  console.log('[IPC] Handlers registered');
}
