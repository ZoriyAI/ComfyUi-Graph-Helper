import { z } from 'zod';
import type { McpSession } from '../../shared/mcp/catalogSource';

const name = z.string().min(1).max(1000);
const limit = z.number().int().min(1).max(1000).optional();
const cursor = z.string().min(1).max(2000).optional();

/** The largest file the app reads from next to a model: a preview clip. A description is far smaller. */
export const SIDE_FILE_MAX_BYTES = 16 * 1024 * 1024;
/** One read of `workspace_files` returns at most this many bytes (the server's own cap). */
export const SIDE_FILE_CHUNK_BYTES = 1024 * 1024;

/**
 * A file a model manager keeps next to a model: `<name>.metadata.json` or `<name>.civitai.info` (what the author
 * said about it) and `<name>.webp`, `.png`, `.jpg`, `.gif`, `.mp4`, `.webm` (its preview). Nothing else on the
 * machine has such a name the app would ask for, and a path that climbs with `..` is not one.
 */
const SIDE_FILE_NAME = /\.(?:metadata\.json|civitai\.info|webp|png|jpe?g|gif|mp4|webm)$/i;

export function isSideFilePath(path: string): boolean {
  return SIDE_FILE_NAME.test(path) && isPlainAbsolutePath(path);
}

/** A model file: what a loader reads. Its fingerprint is the one thing the app asks the server to make of it. */
const MODEL_FILE_NAME = /\.(?:safetensors|sft|ckpt|pt|pth|bin|gguf)$/i;

export function isModelFilePath(path: string): boolean {
  return MODEL_FILE_NAME.test(path) && isPlainAbsolutePath(path);
}

/** An absolute POSIX path inside some folder, with no empty, `.` or `..` part, no NUL and no backslash. */
function isPlainAbsolutePath(path: string): boolean {
  if (!path.startsWith('/') || path.includes('\0') || path.includes('\\')) return false;
  const parts = path.split('/').slice(1);
  return parts.length >= 2 && parts.every((part) => part !== '' && part !== '.' && part !== '..');
}

/**
 * Exact argument shapes, `.strict()` so an extra field (a body, a filename, a target) is refused rather than
 * passed through to a tool that might act on it.
 */
export const READ_ONLY_SCHEMAS = {
  studio_info: z.object({ action: z.enum(['describe', 'paths']) }).strict(),
  studio_capabilities: z.object({
    section: z.enum(['nodes', 'models']),
    kind: z.enum(['classes', 'packs']).optional(),
    limit,
    cursor,
  }).strict(),
  models: z.object({ action: z.literal('list'), category: name.optional(), limit, cursor }).strict(),
  list_local_models: z.object({ action: z.literal('list'), model_type: name.optional() }).strict(),
  model_metadata: z.object({ action: z.literal('read'), category: name, name }).strict(),
  comfy_api: z.object({ method: z.literal('GET'), route: z.enum(['/object_info', '/system_stats']) }).strict(),
  // Settings ▸ Assistant: the Ollama servers the MCP server runs and the models each one lists. Both only read;
  // ollama_pull / ollama_load / ollama_unload / ollama_chat are not listed and stay refused.
  ollama_targets: z.object({}).strict(),
  ollama_models: z.object({ target: z.string().min(1).max(100) }).strict(),
  // The description and the preview a model manager keeps next to a model file. The tool can also write, patch,
  // move and trash: only `read` is listed, only as exact bytes, and only for a path that is such a file.
  // And `hash` of a model file, with nothing else: its SHA-256 is what Civitai finds the file by. Asked only when
  // the person clicks "Find on the internet" in its card; it reads the file on the server and changes nothing.
  workspace_files: z.union([
    z.object({
      action: z.literal('read'),
      absolute_path: z.string().min(2).max(4000).refine(isSideFilePath),
      encoding: z.literal('base64'),
      offset: z.number().int().min(0).max(SIDE_FILE_MAX_BYTES).optional(),
      length: z.number().int().min(1).max(SIDE_FILE_CHUNK_BYTES).optional(),
    }).strict(),
    z.object({
      action: z.literal('hash'),
      absolute_path: z.string().min(2).max(4000).refine(isModelFilePath),
    }).strict(),
  ]),
} as const;

/**
 * The only MCP tools this app may call, each with the argument shapes that keep it read-only.
 * The owner's server also exposes tools that install, download, delete, write metadata, or queue prompts;
 * none of them is listed here, so none can be called (brief §2.1, §4).
 */
export const READ_ONLY_TOOLS: Readonly<Record<string, (args: Record<string, unknown>) => boolean>> = Object.fromEntries(
  Object.entries(READ_ONLY_SCHEMAS).map(([tool, schema]) => [tool, (args: Record<string, unknown>) => schema.safeParse(args).success]),
);

export class McpRefusedError extends Error {
  constructor(tool: string) {
    super(`MCP tool call refused: ${tool} is not on the read-only list.`);
    this.name = 'McpRefusedError';
  }
}

export function isReadOnlyCall(name: string, args: Record<string, unknown>): boolean {
  const allowed = Object.prototype.hasOwnProperty.call(READ_ONLY_TOOLS, name) ? READ_ONLY_TOOLS[name] : undefined;
  return allowed !== undefined && allowed(args ?? {});
}

/** What one MCP tool call looked like from outside: never the payload, only its shape. */
export interface McpCallNote {
  tool: string;
  /** The arguments as JSON, cut to a readable length. They never carry a credential. */
  args: string;
  ok: boolean;
  ms: number;
  /** Size of the answer as JSON text. */
  chars: number | null;
  /** Length of `items` when the answer is a page. */
  items: number | null;
  /** The server's own error text, or the thrown message. */
  error: string | null;
}

let observer: ((note: McpCallNote) => void) | null = null;

/** Main points this at its log, so a sync that reads nothing can be explained from the log alone. */
export function setMcpCallObserver(next: ((note: McpCallNote) => void) | null): void {
  observer = next;
}

function noteOf(tool: string, args: Record<string, unknown>, started: number, result: unknown, error: unknown): McpCallNote {
  let argsText = '';
  try {
    argsText = JSON.stringify(args ?? {}).slice(0, 300);
  } catch {
    argsText = '{}';
  }
  let chars: number | null = null;
  let items: number | null = null;
  let failure: string | null = null;
  if (error !== undefined) failure = error instanceof Error ? error.message.slice(0, 300) : 'error';
  if (result && typeof result === 'object') {
    const record = result as { isError?: unknown; structuredContent?: unknown; content?: unknown };
    try {
      chars = JSON.stringify(record.structuredContent ?? record.content ?? null).length;
    } catch {
      chars = null;
    }
    const structured = record.structuredContent as { items?: unknown } | undefined;
    let page: unknown = structured?.items;
    if (page === undefined && Array.isArray(record.content)) {
      const text = (record.content as Array<{ type?: unknown; text?: unknown }>).find((block) => block?.type === 'text' && typeof block.text === 'string')?.text;
      if (typeof text === 'string') {
        if (record.isError === true) failure = text.slice(0, 300);
        try {
          page = (JSON.parse(text) as { items?: unknown })?.items;
        } catch {
          page = undefined;
        }
      }
    }
    if (Array.isArray(page)) items = page.length;
    if (record.isError === true && failure === null) failure = 'tool error';
  }
  return { tool, args: argsText, ok: failure === null, ms: Date.now() - started, chars, items, error: failure };
}

/**
 * Wraps a session so that every tool call passes this one check. All MCP reads in the app go through
 * a wrapped session, which makes this the single call site for the allowlist, and for the call log.
 */
export function readOnlySession(session: McpSession): McpSession {
  return {
    listTools: () => session.listTools(),
    async callTool(name, args, options) {
      if (!isReadOnlyCall(name, args)) throw new McpRefusedError(name);
      const started = Date.now();
      try {
        const result = await (options ? session.callTool(name, args, options) : session.callTool(name, args));
        try {
          observer?.(noteOf(name, args, started, result, undefined));
        } catch {
          // The log never breaks a read.
        }
        return result;
      } catch (error) {
        try {
          observer?.(noteOf(name, args, started, undefined, error));
        } catch {
          // The log never breaks a read.
        }
        throw error;
      }
    },
    close: () => session.close(),
  };
}
