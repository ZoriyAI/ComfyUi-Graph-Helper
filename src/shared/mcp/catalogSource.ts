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
  listTools(): Promise<Array<{ name: string }>>;
  callTool(name: string, args: Record<string, unknown>): Promise<McpToolCallResult>;
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

/**
 * Reads every page of `studio_capabilities` section nodes, kind classes.
 * Each item carries class_type, module, display_name, category. Inputs and outputs are not here.
 */
export async function readNodeClasses(session: McpSession, pageLimit = 100, maxPages = 200): Promise<McpNodeClass[]> {
  const classes: McpNodeClass[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  for (let page = 0; page < maxPages; page += 1) {
    const args: Record<string, unknown> = { section: 'nodes', kind: 'classes', limit: pageLimit };
    if (cursor) args.cursor = cursor;
    const payload = record(toolPayload(await session.callTool('studio_capabilities', args)));
    if (!payload || !Array.isArray(payload.items)) break;
    for (const item of payload.items) {
      const row = record(item);
      const classType = text(row?.class_type);
      if (!classType || seen.has(classType)) continue;
      seen.add(classType);
      classes.push({
        classType,
        module: text(row?.module) || 'nodes',
        displayName: text(row?.display_name),
        category: text(row?.category),
      });
    }
    const next = payload.next_cursor;
    if (typeof next !== 'string' || next === '' || payload.items.length === 0) break;
    cursor = next;
  }
  return classes;
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
export async function readModelFiles(session: McpSession, pageLimit = 1000, maxPages = 500): Promise<McpModelFile[]> {
  const files: McpModelFile[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  for (let page = 0; page < maxPages; page += 1) {
    const args: Record<string, unknown> = { action: 'list', limit: pageLimit };
    if (cursor) args.cursor = cursor;
    const payload = record(toolPayload(await session.callTool('models', args)));
    if (!payload || !Array.isArray(payload.items)) break;
    for (const item of payload.items) {
      const row = record(item);
      const directory = text(row?.category);
      const name = text(row?.filename);
      if (!directory || !name || !isModelFile(name)) continue;
      const key = `${directory}/${name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const size = row?.size_bytes;
      files.push({ directory, name, sizeBytes: typeof size === 'number' && Number.isFinite(size) ? size : null });
    }
    const next = payload.next_cursor;
    if (typeof next !== 'string' || next === '' || payload.items.length === 0) break;
    cursor = next;
  }
  return files;
}

/**
 * Parses the markdown of `list_local_models` action list:
 * "## loras (316)" headings followed by "- file.safetensors" lines.
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
    const name = item[1];
    if (isModelFile(name)) files.push({ directory, name, sizeBytes: null });
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
