/**
 * Where the app's SQLite database lives inside the profile folder. main/database.ts opens it there. The file name
 * keeps its first spelling on purpose: renaming it would leave existing profiles with an empty database.
 */
import * as path from 'path';

export const DATABASE_FILE_NAME = 'comfyui-desktop.db';

/** The database file inside a profile folder. */
export function databasePath(userDataDir: string): string {
  return path.join(userDataDir, DATABASE_FILE_NAME);
}
