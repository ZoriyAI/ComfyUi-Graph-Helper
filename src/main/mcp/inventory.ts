import type { McpModelFile, McpSession, PagedItems } from '../../shared/mcp/catalogSource';
import { isModelFile, McpPageError, readAllPages } from '../../shared/mcp/catalogSource';
import type { NodePackRow } from '../catalog/repository';

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

export type McpModelFileWithRoot = McpModelFile & { rootPath: string | null };

/**
 * `models` action list, keeping root_path: with several roots per folder the root tells same-named files apart.
 * The current server answers the plain listing with one row per category (no filename) and lists files only when
 * asked with `category`; older servers list files directly. Both shapes are read: every category row is expanded
 * with its own paged listing. Throws McpPageError when the plain listing or every category fails; `complete` is
 * false when any listing was cut short (a cursor loop, one failed category), so stale rows are then kept.
 */
export async function readModelFilesWithRoots(session: McpSession, pageLimit = 1000, maxPages?: number): Promise<PagedItems<McpModelFileWithRoot>> {
  const files: McpModelFileWithRoot[] = [];
  const seen = new Set<string>();
  const keep = (rows: Array<Record<string, unknown>>) => {
    for (const row of rows) {
      const directory = text(row.category);
      const name = text(row.filename);
      if (!directory || !name || !isModelFile(name)) continue;
      const key = `${directory}/${name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const size = row.size_bytes;
      files.push({
        directory,
        name,
        sizeBytes: typeof size === 'number' && Number.isFinite(size) ? size : null,
        rootPath: textOrNull(row.root_path),
      });
    }
  };
  const plain = await readAllPages(session, 'models', { action: 'list', limit: pageLimit }, maxPages);
  let complete = plain.complete;
  keep(plain.items);
  const categories: string[] = [];
  for (const row of plain.items) {
    const directory = text(row.category);
    // A row without a filename names a folder to list. Hidden folders (.cache) hold no loader files.
    if (directory && text(row.filename) === '' && !directory.startsWith('.') && !categories.includes(directory)) categories.push(directory);
  }
  let failed = 0;
  for (const category of categories) {
    try {
      const listed = await readAllPages(session, 'models', { action: 'list', category, limit: pageLimit }, maxPages);
      if (!listed.complete) complete = false;
      keep(listed.items);
    } catch (error) {
      if (!(error instanceof McpPageError)) throw error;
      // One folder that could not be read does not lose the others; the run is marked incomplete instead.
      failed += 1;
      complete = false;
    }
  }
  if (categories.length > 0 && failed === categories.length) throw new McpPageError();
  return { items: files, complete };
}

/** `studio_capabilities` section nodes, kind packs. */
export async function readNodePacks(session: McpSession, pageLimit = 100, maxPages?: number): Promise<PagedItems<NodePackRow>> {
  const packs: NodePackRow[] = [];
  const seen = new Set<string>();
  const read = await readAllPages(session, 'studio_capabilities', { section: 'nodes', kind: 'packs', limit: pageLimit }, maxPages);
  for (const row of read.items) {
    const name = text(row.name);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const count = row.imported_class_count;
    packs.push({
      name,
      version: textOrNull(row.version),
      commitSha: textOrNull(row.commit),
      installedState: text(row.installed_state),
      importState: text(row.import_state),
      classCount: typeof count === 'number' && Number.isFinite(count) ? count : null,
    });
  }
  return { items: packs, complete: read.complete };
}

export interface ServerIdentity {
  installationId: string | null;
  comfyuiUrl: string | null;
}

export function identityFromStudioInfo(payload: unknown): ServerIdentity {
  const row = record(payload);
  return { installationId: textOrNull(row?.installation_id), comfyuiUrl: textOrNull(row?.comfyui_url) };
}
