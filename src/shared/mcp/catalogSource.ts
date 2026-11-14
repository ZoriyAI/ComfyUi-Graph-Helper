/**
 * Pure helpers for reading a ComfyUI catalog through an MCP server.
 * No network here: the main process passes tool results in, and these functions pick them apart.
 * Tool names are never invented. Each strategy is used only when the server lists that exact tool.
 */

export interface McpToolCallResult {
  content?: Array<{ type: string; text?: string }>;
  structuredContent?: unknown;
  isError?: boolean;
}

export interface McpSession {
  /** The tools a server lists; `inputSchema` (as the server sent it) recognises which kind of server it is. */
  listTools(): Promise<Array<{ name: string; inputSchema?: unknown }>>;
  /** `timeoutMs` stretches the wait for one slow call (a file's fingerprint); the client's own wait otherwise. */
  callTool(name: string, args: Record<string, unknown>, options?: { timeoutMs?: number }): Promise<McpToolCallResult>;
  close(): Promise<void>;
}

export interface McpNodeClass {
  classType: string;
  module: string;
  displayName: string;
  category: string;
}

export interface McpModelFile {
  directory: string;
  name: string;
  sizeBytes: number | null;
}

/** Model file extensions ComfyUI loaders read. Dotfiles and cache markers are not models. */
const MODEL_EXTENSIONS = /\.(safetensors|sft|ckpt|pt|pth|bin|gguf|onnx|pkl|yaml)$/i;

/** The structured payload of a tool result, or the first text block parsed as JSON. */
export function toolPayload(result: McpToolCallResult): unknown {
  if (result.isError) return undefined;
  if (result.structuredContent !== undefined && result.structuredContent !== null) return result.structuredContent;
  const text = result.content?.find((block) => block.type === 'text' && typeof block.text === 'string')?.text;
  if (text === undefined) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** A page of a paged tool came back as an error or without an items list: the listing is not usable. */
export class McpPageError extends Error {
  constructor() {
    super('MCP catalog page could not be read.');
    this.name = 'McpPageError';
  }
}

/** Every item of a paged listing, and whether the listing ran to its natural end. */
export interface PagedItems<T> {
  items: T[];
  /** False when the server handed back a cursor it had already given (a loop): rows may be missing. */
  complete: boolean;
}

/**
 * Calls one paged tool until the server reports the end (no next_cursor, or an empty page). There is no page cap:
 * the person's install is read in full. Two protections stay: an error or malformed page anywhere makes the whole read
 * fail (McpPageError), so a half listing is never taken for the full one; and a cursor the server already handed out
 * (an echo or a cycle) ends the read as incomplete instead of looping forever.
 * `maxPages` is only a test hook; it defaults to no limit.
 */
export async function readAllPages(
  session: McpSession,
  tool: string,
  baseArgs: Record<string, unknown>,
  maxPages = Number.POSITIVE_INFINITY,
): Promise<PagedItems<Record<string, unknown>>> {
  const items: Array<Record<string, unknown>> = [];
  const seenCursors = new Set<string>();
  let cursor: string | undefined;
  for (let page = 0; page < maxPages; page += 1) {
    const args: Record<string, unknown> = { ...baseArgs };
    if (cursor) args.cursor = cursor;
    const result = await session.callTool(tool, args);
    if (result.isError) throw new McpPageError();
    const payload = record(toolPayload(result));
    if (!payload || !Array.isArray(payload.items)) throw new McpPageError();
    for (const item of payload.items) {
      const row = record(item);
      if (row) items.push(row);
    }
    const next = payload.next_cursor;
    if (typeof next !== 'string' || next === '' || payload.items.length === 0) return { items, complete: true };
    // A server that hands back a cursor it already gave would loop forever.
    if (next === cursor || seenCursors.has(next)) return { items, complete: false };
    seenCursors.add(next);
    cursor = next;
  }
  return { items, complete: false };
}

/**
 * Reads every page of `studio_capabilities` section nodes, kind classes.
 * Each item carries class_type, module, display_name, category. Inputs and outputs are not here.
 */
export async function readNodeClassesPaged(session: McpSession, pageLimit = 100, maxPages?: number): Promise<PagedItems<McpNodeClass>> {
  const read = await readAllPages(session, 'studio_capabilities', { section: 'nodes', kind: 'classes', limit: pageLimit }, maxPages);
  const classes: McpNodeClass[] = [];
  const seen = new Set<string>();
  for (const row of read.items) {
    const classType = text(row.class_type);
    if (!classType || seen.has(classType)) continue;
    seen.add(classType);
    classes.push({
      classType,
      module: text(row.module) || 'nodes',
      displayName: text(row.display_name),
      category: text(row.category),
    });
  }
  return { items: classes, complete: read.complete };
}

export async function readNodeClasses(session: McpSession, pageLimit = 100, maxPages?: number): Promise<McpNodeClass[]> {
  return (await readNodeClassesPaged(session, pageLimit, maxPages)).items;
}

/** Keeps only regular model files: no dotfiles, no cache directories, a loader extension. */
export function isModelFile(filename: string): boolean {
  if (filename === '' || filename.startsWith('.') || filename.includes('/.')) return false;
  return MODEL_EXTENSIONS.test(filename);
}

/**
 * Reads every page of `models` action list. Items carry category, filename, size_bytes.
 * Directory listings are category-only rows and are skipped.
 */
export async function readModelFiles(session: McpSession, pageLimit = 1000, maxPages?: number): Promise<McpModelFile[]> {
  const read = await readAllPages(session, 'models', { action: 'list', limit: pageLimit }, maxPages);
  const files: McpModelFile[] = [];
  const seen = new Set<string>();
  for (const row of read.items) {
    const directory = text(row.category);
    const name = text(row.filename);
    if (!directory || !name || !isModelFileIn(directory, name)) continue;
    const key = `${directory}/${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const size = row.size_bytes;
    files.push({ directory, name, sizeBytes: typeof size === 'number' && Number.isFinite(size) ? size : null });
  }
  return files;
}

/**
 * A model file in its folder. The checkpoint configs ComfyUI keeps in `configs` (`v1-inference.yaml`) are settings
 * an old loader reads, not a model a person chooses, so a `.yaml` there is not listed. A `.yaml` elsewhere still is.
 */
export function isModelFileIn(directory: string, filename: string): boolean {
  if (directory === 'configs' && /\.ya?ml$/i.test(filename)) return false;
  return isModelFile(filename);
}

/**
 * Parses the markdown of `list_local_models` action list:
 * "## loras (316)" headings followed by "- file.safetensors" lines, with " (12.3 MB) — modified …" after the name
 * when the server read its disk. Indented lines under an entry (trigger words, a Civitai link) are not files.
 */
export function parseLocalModelsMarkdown(markdown: string): McpModelFile[] {
  const files: McpModelFile[] = [];
  let directory = '';
  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^##\s+([^\s(]+)/.exec(line);
    if (heading) {
      directory = heading[1];
      continue;
    }
    const item = /^-\s+(.+?)\s*$/.exec(line);
    if (!item || !directory) continue;
    // A listing read from the disk adds the size and the date: `- name.safetensors (12.3 MB) — modified …`.
    const sized = /^(.+?) \((\d+(?:\.\d+)?) MB\)(?: — modified .*)?$/.exec(item[1]);
    const name = sized ? sized[1] : item[1];
    const sizeBytes = sized ? Math.round(Number(sized[2]) * 1024 * 1024) : null;
    if (isModelFileIn(directory, name)) files.push({ directory, name, sizeBytes });
  }
  return files;
}

/** The native ComfyUI http(s) URL that `studio_info` reports, or null. */
export function comfyUrlFromStudioInfo(payload: unknown): string | null {
  const row = record(payload);
  const url = text(row?.comfyui_url);
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || parsed.username || parsed.password) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}
