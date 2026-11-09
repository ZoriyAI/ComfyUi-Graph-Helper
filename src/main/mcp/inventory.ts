import type { McpModelFile, McpSession, PagedItems } from '../../shared/mcp/catalogSource';
import { isModelFile, readAllPages } from '../../shared/mcp/catalogSource';
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
 * Reads until the server reports the end; throws McpPageError when any page fails; `complete` is false on a cursor loop.
 */
export async function readModelFilesWithRoots(session: McpSession, pageLimit = 1000, maxPages?: number): Promise<PagedItems<McpModelFileWithRoot>> {
  const files: McpModelFileWithRoot[] = [];
  const seen = new Set<string>();
  const read = await readAllPages(session, 'models', { action: 'list', limit: pageLimit }, maxPages);
  for (const row of read.items) {
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
  return { items: files, complete: read.complete };
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
