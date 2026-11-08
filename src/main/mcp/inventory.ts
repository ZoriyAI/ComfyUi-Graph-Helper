import type { McpModelFile, McpSession } from '../../shared/mcp/catalogSource';
import { isModelFile, toolPayload } from '../../shared/mcp/catalogSource';
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

/** Calls one paged tool until next_cursor runs out, handing each item to `take`. */
async function readPages(
  session: McpSession,
  tool: string,
  baseArgs: Record<string, unknown>,
  take: (item: Record<string, unknown>) => void,
  maxPages: number,
): Promise<void> {
  let cursor: string | undefined;
  for (let page = 0; page < maxPages; page += 1) {
    const args: Record<string, unknown> = { ...baseArgs };
    if (cursor) args.cursor = cursor;
    const payload = record(toolPayload(await session.callTool(tool, args)));
    if (!payload || !Array.isArray(payload.items)) return;
    for (const item of payload.items) {
      const row = record(item);
      if (row) take(row);
    }
    const next = payload.next_cursor;
    if (typeof next !== 'string' || next === '' || payload.items.length === 0) return;
    cursor = next;
  }
}

export type McpModelFileWithRoot = McpModelFile & { rootPath: string | null };

/**
 * `models` action list, keeping root_path: with several roots per folder, `inspect` needs
 * root_path + filename as an absolute location (brief §4).
 */
export async function readModelFilesWithRoots(session: McpSession, pageLimit = 1000, maxPages = 500): Promise<McpModelFileWithRoot[]> {
  const files: McpModelFileWithRoot[] = [];
  const seen = new Set<string>();
  await readPages(session, 'models', { action: 'list', limit: pageLimit }, (row) => {
    const directory = text(row.category);
    const name = text(row.filename);
    if (!directory || !name || !isModelFile(name)) return;
    const key = `${directory}/${name}`;
    if (seen.has(key)) return;
    seen.add(key);
    const size = row.size_bytes;
    files.push({
      directory,
      name,
      sizeBytes: typeof size === 'number' && Number.isFinite(size) ? size : null,
      rootPath: textOrNull(row.root_path),
    });
  }, maxPages);
  return files;
}

/** `studio_capabilities` section nodes, kind packs. */
export async function readNodePacks(session: McpSession, pageLimit = 100, maxPages = 50): Promise<NodePackRow[]> {
  const packs: NodePackRow[] = [];
  const seen = new Set<string>();
  await readPages(session, 'studio_capabilities', { section: 'nodes', kind: 'packs', limit: pageLimit }, (row) => {
    const name = text(row.name);
    if (!name || seen.has(name)) return;
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
  }, maxPages);
  return packs;
}

export interface ServerIdentity {
  installationId: string | null;
  comfyuiUrl: string | null;
}

export function identityFromStudioInfo(payload: unknown): ServerIdentity {
  const row = record(payload);
  return { installationId: textOrNull(row?.installation_id), comfyuiUrl: textOrNull(row?.comfyui_url) };
}
