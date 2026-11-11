import type { McpModelFile, McpSession, PagedItems } from '../../shared/mcp/catalogSource';
import { isModelFile, McpPageError, readAllPages, toolPayload } from '../../shared/mcp/catalogSource';
import { SideFileIndex, sideFileOf } from '../../shared/knowledge/sidecar';
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

/**
 * A model file with the folder it lies in and the files a model manager keeps next to it: its description and
 * its preview. A `*Sig` is the file's name and size, so a file that appears, changes or goes is noticed.
 */
export type McpModelFileWithRoot = McpModelFile & {
  rootPath: string | null;
  sidecarFile: string | null;
  sidecarSig: string | null;
  previewFile: string | null;
  previewSig: string | null;
};

/**
 * `models` action list, keeping root_path: with several roots per folder the root tells same-named files apart.
 * The listing names every regular file of a folder, so the descriptions and previews next to the models come with
 * it at no extra call.
 * The current server answers the plain listing with one row per category (no filename) and lists files only when
 * asked with `category`; older servers list files directly. Both shapes are read: every category row is expanded
 * with its own paged listing. Throws McpPageError when the plain listing or every category fails; `complete` is
 * false when any listing was cut short (a cursor loop, one failed category), so stale rows are then kept.
 */
export async function readModelFilesWithRoots(session: McpSession, pageLimit = 1000, maxPages?: number): Promise<PagedItems<McpModelFileWithRoot>> {
  const files: McpModelFileWithRoot[] = [];
  const seen = new Set<string>();
  // Side files by the folder they lie in: the same name under another root belongs to another model.
  const sides = new Map<string, { index: SideFileIndex; sizes: Map<string, number | null> }>();
  const folderOf = (directory: string, rootPath: string | null) => `${directory}\n${rootPath ?? ''}`;
  const keep = (rows: Array<Record<string, unknown>>) => {
    for (const row of rows) {
      const directory = text(row.category);
      const name = text(row.filename);
      if (!directory || !name) continue;
      const size = typeof row.size_bytes === 'number' && Number.isFinite(row.size_bytes) ? row.size_bytes : null;
      const rootPath = textOrNull(row.root_path);
      if (!isModelFile(name)) {
        if (sideFileOf(name)) {
          const folder = sides.get(folderOf(directory, rootPath)) ?? { index: new SideFileIndex(), sizes: new Map<string, number | null>() };
          folder.index.add(name);
          folder.sizes.set(name, size);
          sides.set(folderOf(directory, rootPath), folder);
        }
        continue;
      }
      const key = `${directory}/${name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      files.push({ directory, name, sizeBytes: size, rootPath, sidecarFile: null, sidecarSig: null, previewFile: null, previewSig: null });
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
  for (const file of files) {
    const folder = sides.get(folderOf(file.directory, file.rootPath));
    if (!folder) continue;
    const found = folder.index.for(file.name);
    const sig = (name: string | null) => (name === null ? null : `${name}:${folder.sizes.get(name) ?? ''}`);
    file.sidecarFile = found.sidecar;
    file.sidecarSig = sig(found.sidecar);
    file.previewFile = found.preview;
    file.previewSig = sig(found.preview);
  }
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

/** More folders than this for node packs is not a ComfyUI setup the app reads pack files from. */
const MAX_CUSTOM_NODE_ROOTS = 4;

/**
 * The folders ComfyUI loads node packs from, as `studio_capabilities` section roots names them
 * (`roots.custom_node_roots`, or `roots.model_categories.custom_nodes.roots`). Only absolute POSIX paths of a
 * folder named `custom_nodes` count: that is the only place the read-only gate lets the app read a pack's files.
 * An empty list when the server does not say. Transport errors and refusals are thrown.
 */
export async function readCustomNodeRoots(session: McpSession): Promise<string[]> {
  const payload = record(toolPayload(await session.callTool('studio_capabilities', { section: 'roots' })));
  const roots = record(payload?.roots) ?? payload;
  const categories = record(roots?.model_categories);
  const listed = [
    ...(Array.isArray(roots?.custom_node_roots) ? roots.custom_node_roots : []),
    ...(Array.isArray(record(categories?.custom_nodes)?.roots) ? (record(categories?.custom_nodes)?.roots as unknown[]) : []),
  ];
  const found: string[] = [];
  for (const item of listed) {
    const path = typeof item === 'string' ? item.replace(/\/+$/, '') : '';
    if (!path.startsWith('/') || !path.endsWith('/custom_nodes') || path.includes('\\') || found.includes(path)) continue;
    found.push(path);
  }
  return found.slice(0, MAX_CUSTOM_NODE_ROOTS);
}
