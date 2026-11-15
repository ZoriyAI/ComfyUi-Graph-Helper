/**
 * Paths a ComfyUI or an MCP server reports about its own machine. That machine can run Linux or macOS
 * (`/srv/comfyui/models/loras`) or Windows (`C:\ComfyUI\models\loras`, sometimes written with `/`). The app never
 * opens these paths itself: it only names them back to the server that reported them, so a path is accepted when
 * it is absolute on one of the two systems, has no empty, `.` or `..` part and no control character.
 * Used by main's catalog and MCP code (main/catalog/repository.ts, main/mcp, main/comfy/direct.ts,
 * main/knowledge/modelWeb.ts).
 */

/** Control characters: never part of a real path, and a way to hide text in one. */
const CONTROL = /[\u0000-\u001f\u007f]/;
/** `C:\…` or `C:/…`. A UNC share (`\\server\share`) is not accepted: nothing the app reads lives there by default. */
const DRIVE = /^[A-Za-z]:[\\/]/;
/** Longest server path accepted. */
export const SERVER_PATH_MAX = 1024;

/** The two path styles a server machine can use. */
export type PathStyle = 'posix' | 'windows';

/** Which system the absolute path belongs to, or null when it is not absolute on either. */
export function pathStyle(path: string): PathStyle | null {
  if (path.startsWith('/')) return 'posix';
  if (DRIVE.test(path)) return 'windows';
  return null;
}

/** The parts after the root (`/` or `C:\`), split on `/`, and on `\` too for a Windows path. */
export function pathParts(path: string): string[] {
  const style = pathStyle(path);
  if (style === 'posix') return path.split('/').slice(1);
  if (style === 'windows') return path.slice(3).split(/[\\/]/);
  return [];
}

/** An absolute path with no empty, `.` or `..` part and no control character. `minParts`: how deep at least. */
export function isPlainServerPath(path: string, minParts = 2): boolean {
  if (path.length > SERVER_PATH_MAX || CONTROL.test(path)) return false;
  const style = pathStyle(path);
  if (!style) return false;
  // A POSIX path with a backslash is unusual and could be read as two things; it stays refused.
  if (style === 'posix' && path.includes('\\')) return false;
  const parts = pathParts(path);
  return parts.length >= minParts && parts.every((part) => part !== '' && part !== '.' && part !== '..');
}

/** A folder without its trailing separators; null when it is not a plain absolute folder. */
export function normalServerFolder(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const style = pathStyle(value);
  const trimmed = style === 'windows' ? value.replace(/[\\/]+$/, '') : value.replace(/\/+$/, '');
  // `C:` alone (a bare drive) is not a folder the app reads from.
  if (style === 'windows' && trimmed.length < 3) return null;
  return isPlainServerPath(trimmed, 1) ? trimmed : null;
}

/** The separator a path uses: `\` for a Windows path written with backslashes, `/` otherwise. */
export function separatorOf(path: string): '/' | '\\' {
  return pathStyle(path) === 'windows' && path.includes('\\') ? '\\' : '/';
}

/** `root` joined with relative `parts` in the root's own style; null when a part is not a plain relative name. */
export function joinServerPath(root: string, ...parts: string[]): string | null {
  const folder = normalServerFolder(root);
  if (!folder) return null;
  const separator = separatorOf(folder);
  const pieces: string[] = [];
  for (const part of parts) {
    for (const piece of part.split(/[\\/]/)) {
      if (piece === '') continue;
      if (piece === '.' || piece === '..' || CONTROL.test(piece)) return null;
      pieces.push(piece);
    }
  }
  if (pieces.length === 0) return null;
  return `${folder}${separator}${pieces.join(separator)}`;
}

/** True when `path` lies inside `root` (not the root itself), comparing Windows paths without case and either slash. */
export function isUnderServerFolder(path: string, root: string): boolean {
  const style = pathStyle(root);
  if (!style || pathStyle(path) !== style) return false;
  if (style === 'posix') return path.startsWith(`${root}/`) && path.length > root.length + 1;
  const norm = (value: string) => value.replace(/\\/g, '/').toLowerCase();
  const folder = norm(root);
  const target = norm(path);
  return target.startsWith(`${folder}/`) && target.length > folder.length + 1;
}

/** A name relative to a model folder, as a server lists it: never absolute, never climbing, sub-folders allowed. */
export function isPlainRelativeName(value: string): boolean {
  if (value.length === 0 || value.length > SERVER_PATH_MAX || CONTROL.test(value) || pathStyle(value)) return false;
  if (value.startsWith('\\')) return false;
  return value.split(/[\\/]/).every((part) => part !== '..' && part !== '.' && part !== '');
}
