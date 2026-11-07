import * as path from 'path';

export const DATABASE_FILE_NAME = 'comfyui-desktop.db';

export function databasePath(userDataDir: string): string {
  return path.join(userDataDir, DATABASE_FILE_NAME);
}
