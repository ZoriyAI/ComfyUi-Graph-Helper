import { z } from 'zod';
import type { McpSession } from '../../shared/mcp/catalogSource';

const name = z.string().min(1).max(1000);
/**
 * A folder or file name the server listed: never absolute, never climbing with `..`, no control character or
 * backslash. Subfolders (`sub/file.safetensors`) are fine.
 */
const listedName = name.refine((value) => !value.startsWith('/') && !/[\u0000-\u001f\u007f\\]/.test(value)
  && value.split('/').every((part) => part !== '..' && part !== '.'));
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

/** Longest path the app asks about; control characters (NUL, newline, …) are never part of one. */
const PATH_MAX = 1024;
const CONTROL = /[\u0000-\u001f\u007f]/;

/** An absolute POSIX path inside some folder, with no empty, `.` or `..` part, no NUL and no backslash. */
function isPlainAbsolutePath(path: string): boolean {
  if (!path.startsWith('/') || path.length > PATH_MAX || CONTROL.test(path) || path.includes('\\')) return false;
  const parts = path.split('/').slice(1);
  return parts.length >= 2 && parts.every((part) => part !== '' && part !== '.' && part !== '..');
}

/**
 * What a node pack says about itself: the `pyproject.toml` and the README at the top of its folder. The folder is
 * one level under a folder named `custom_nodes`, which is where ComfyUI keeps its packs, so the path is exactly
 * `/…/custom_nodes/<pack>/<file>`. A file deeper in the pack (its code, `docs/README.md`), a file of ComfyUI
 * itself and a path that climbs with `..` are none of these, and the app never asks for anything else there.
 */
export const PACK_FILE_NAMES = ['pyproject.toml', 'README.md', 'readme.md', 'README.MD', 'Readme.md'] as const;

export function isPackFilePath(path: string): boolean {
  if (!path.startsWith('/') || path.length > PATH_MAX || CONTROL.test(path) || path.includes('\\')) return false;
  const parts = path.split('/').slice(1);
  if (parts.length < 3 || !parts.every((part) => part !== '' && part !== '.' && part !== '..')) return false;
  const [root, , file] = parts.slice(-3);
  return root === 'custom_nodes' && (PACK_FILE_NAMES as readonly string[]).includes(file);
}

/**
 * Exact argument shapes, `.strict()` so an extra field (a body, a filename, a target) is refused rather than
 * passed through to a tool that might act on it.
 */
export const READ_ONLY_SCHEMAS = {
  studio_info: z.object({ action: z.enum(['describe', 'paths']) }).strict(),
  // `roots` names the folders ComfyUI reads from, among them where its node packs lie (custom_node_roots).
  studio_capabilities: z.object({
    section: z.enum(['nodes', 'models', 'roots']),
    kind: z.enum(['classes', 'packs']).optional(),
    limit,
    cursor,
  }).strict(),
  models: z.object({ action: z.literal('list'), category: listedName.optional(), limit, cursor }).strict(),
  list_local_models: z.object({ action: z.literal('list'), model_type: listedName.optional() }).strict(),
  model_metadata: z.object({ action: z.literal('read'), category: listedName, name: listedName }).strict(),
  comfy_api: z.object({ method: z.literal('GET'), route: z.enum(['/object_info', '/system_stats']) }).strict(),
  // Settings ▸ Assistant: the Ollama servers the MCP server runs and the models each one lists. Both only read;
  // ollama_pull / ollama_load / ollama_unload / ollama_chat are not listed and stay refused.
  ollama_targets: z.object({}).strict(),
  ollama_models: z.object({ target: z.string().min(1).max(100).regex(/^[^\u0000-\u001f\u007f/\\]+$/) }).strict(),
  // The description and the preview a model manager keeps next to a model file, and the pyproject.toml and README
  // at the top of a node pack. The tool can also write, patch, move and trash: only `read` is listed, only as
  // exact bytes, and only for a path that is one of these files.
  // And `hash` of a model file, with nothing else: its SHA-256 is what Civitai finds the file by. Asked only when
  // the person clicks "Find on the internet" in its card; it reads the file on the server and changes nothing.
  workspace_files: z.union([
    z.object({
      action: z.literal('read'),
      absolute_path: z.string().min(2).max(1024).refine((path) => isSideFilePath(path) || isPackFilePath(path)),
      encoding: z.literal('base64'),
      offset: z.number().int().min(0).max(SIDE_FILE_MAX_BYTES).optional(),
      length: z.number().int().min(1).max(SIDE_FILE_CHUNK_BYTES).optional(),
    }).strict(),
    z.object({
      action: z.literal('hash'),
      absolute_path: z.string().min(2).max(1024).refine(isModelFilePath),
    }).strict(),
  ]),
} as const;

/**
 * The only MCP tools this app may call, each with the argument shapes that keep it read-only.
 * The MCP server the app was built against also exposes tools that install, download, delete, write metadata, or queue prompts;
 * none of them is listed here, so none can be called: the app only reads.
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
  /** The name the call went out under when a gateway prefixes the server's tools (`gateway_comfy-models`). */
  remote?: string;
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

function noteOf(tool: string, args: Record<string, unknown>, started: number, result: unknown, error: unknown, remote: string = tool): McpCallNote {
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
  return { tool, ...(remote !== tool ? { remote } : {}), args: argsText, ok: failure === null, ms: Date.now() - started, chars, items, error: failure };
}

// ---------------------------------------------------------------------------------------------------------------
// Where workspace_files may read: under a folder the server itself named
// ---------------------------------------------------------------------------------------------------------------

/**
 * Folders the app has seen the server name as model or node-pack folders, outside a session (main points this at
 * the catalog: the distinct `root_path` of the model rows). A session also learns the folders named in the answers
 * that pass through it. A `workspace_files` call is let through only for a path inside one of these folders.
 */
let knownRootsSource: (() => Iterable<string>) | null = null;

export function setKnownRootsSource(source: (() => Iterable<string>) | null): void {
  knownRootsSource = source;
}

/** An absolute POSIX folder with no `.`/`..` part, without its trailing slash; null for anything else. */
export function normalRoot(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const root = value.replace(/\/+$/, '');
  if (!root.startsWith('/') || root.length < 2 || root.length > 1024 || /[\u0000-\u001f\u007f\\]/.test(root)) return null;
  const parts = root.split('/').slice(1);
  return parts.every((part) => part !== '' && part !== '.' && part !== '..') ? root : null;
}

/** True when `path` lies inside `root` (not the root itself). */
export function isUnderRoot(path: string, root: string): boolean {
  return path.startsWith(`${root}/`) && path.length > root.length + 1;
}

/**
 * Folder paths an answer names: every `root_path`, and every absolute path in a list under a key named `roots` or
 * `custom_node_roots` (the shapes of `models` list and `studio_capabilities` roots). Looked at to depth 5 only.
 */
export function rootsNamedIn(payload: unknown, found: Set<string> = new Set(), depth = 0): Set<string> {
  if (depth > 5 || !payload || typeof payload !== 'object') return found;
  if (Array.isArray(payload)) {
    for (const item of payload.slice(0, 5000)) rootsNamedIn(item, found, depth + 1);
    return found;
  }
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (key === 'root_path') {
      const root = normalRoot(value);
      if (root) found.add(root);
    } else if ((key === 'roots' || key === 'custom_node_roots') && Array.isArray(value)) {
      for (const item of value) {
        const root = normalRoot(item);
        if (root) found.add(root);
      }
      rootsNamedIn(value, found, depth + 1);
    } else if (value && typeof value === 'object') {
      rootsNamedIn(value, found, depth + 1);
    }
  }
  return found;
}

function payloadOf(result: unknown): unknown {
  if (!result || typeof result !== 'object') return undefined;
  const record = result as { isError?: unknown; structuredContent?: unknown; content?: unknown };
  if (record.isError === true) return undefined;
  if (record.structuredContent !== undefined && record.structuredContent !== null) return record.structuredContent;
  if (!Array.isArray(record.content)) return undefined;
  const text = (record.content as Array<{ type?: unknown; text?: unknown }>).find((block) => block?.type === 'text' && typeof block.text === 'string')?.text;
  if (typeof text !== 'string' || text.length > 64 * 1024 * 1024) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Tool names behind a gateway: one common prefix
// ---------------------------------------------------------------------------------------------------------------

/** The tool names the app knows (the allowlist). Used to recognise a gateway's prefix, never to call anything else. */
export const KNOWN_TOOL_NAMES: readonly string[] = Object.keys(READ_ONLY_SCHEMAS);

const PREFIX_END = /[-_.:/]$/;

/**
 * The one prefix a gateway put before every tool name (`gateway_comfy-` in `gateway_comfy-models`), or null.
 * Bare names win: when any known tool is listed under its own name there is no prefix. A prefix ends in `-`, `_`,
 * `.`, `:` or `/` and is shared by at least two known tools; when two different prefixes qualify nothing is mapped.
 */
export function detectToolPrefix(names: readonly string[], known: readonly string[] = KNOWN_TOOL_NAMES): string | null {
  if (names.some((name) => known.includes(name))) return null;
  const byPrefix = new Map<string, Set<string>>();
  for (const name of names) {
    for (const tool of known) {
      if (name.length <= tool.length || !name.endsWith(tool)) continue;
      const prefix = name.slice(0, -tool.length);
      if (!PREFIX_END.test(prefix)) continue;
      const set = byPrefix.get(prefix) ?? new Set<string>();
      set.add(tool);
      byPrefix.set(prefix, set);
    }
  }
  const qualified = [...byPrefix.entries()].filter(([, tools]) => tools.size >= 2).map(([prefix]) => prefix);
  return qualified.length === 1 ? qualified[0] : null;
}

// ---------------------------------------------------------------------------------------------------------------
// The session wrapper
// ---------------------------------------------------------------------------------------------------------------

export class McpRootRefusedError extends McpRefusedError {
  constructor() {
    super('workspace_files');
    this.message = 'MCP tool call refused: workspace_files may read only inside a folder the server named.';
    this.name = 'McpRootRefusedError';
  }
}

export interface ReadOnlySessionOptions {
  /** Folders known before this session (tests; main uses setKnownRootsSource). */
  roots?: Iterable<string>;
}

/**
 * Wraps a session so that every tool call passes this one check. All MCP reads in the app go through
 * a wrapped session, which makes this the single call site for the allowlist, and for the call log.
 * - The allowlist and its argument shapes apply to the bare tool name.
 * - A gateway that lists every tool under one prefix is shown to the app with bare names; a call goes out under the
 *   listed name. Detected once per session, from the server's own listing (fetched before the first call if the
 *   app did not ask for it).
 * - `workspace_files` reads only inside a folder the server named (in this session, or in an earlier sync).
 */
export function readOnlySession(session: McpSession, options: ReadOnlySessionOptions = {}): McpSession {
  const learned = new Set<string>();
  for (const root of options.roots ?? []) {
    const normal = normalRoot(root);
    if (normal) learned.add(normal);
  }
  let prefix: string | null = null;
  let listing: Promise<Array<{ name: string }>> | null = null;
  const list = (): Promise<Array<{ name: string }>> => {
    listing ??= session.listTools().then((tools) => {
      prefix = detectToolPrefix(tools.map((tool) => tool.name));
      if (!prefix) return tools;
      const shown = prefix;
      return tools.map((tool) => (tool.name.startsWith(shown) ? { ...tool, name: tool.name.slice(shown.length) } : tool));
    }).catch((error) => {
      listing = null;
      throw error;
    });
    return listing;
  };
  const roots = (): string[] => {
    const all = new Set(learned);
    try {
      for (const root of knownRootsSource?.() ?? []) {
        const normal = normalRoot(root);
        if (normal) all.add(normal);
      }
    } catch {
      // A failing source only means fewer folders are known.
    }
    return [...all];
  };
  return {
    listTools: () => list(),
    async callTool(name, args, callOptions) {
      if (!isReadOnlyCall(name, args)) throw new McpRefusedError(name);
      if (name === 'workspace_files') {
        const path = String((args as { absolute_path?: unknown }).absolute_path ?? '');
        if (!roots().some((root) => isUnderRoot(path, root))) throw new McpRootRefusedError();
      }
      // The server's own listing says whether its names carry a gateway prefix.
      try {
        await list();
      } catch {
        // A server that cannot list its tools is called by the bare name; the call itself will say what is wrong.
      }
      const remote = prefix ? `${prefix}${name}` : name;
      const started = Date.now();
      try {
        const result = await (callOptions ? session.callTool(remote, args, callOptions) : session.callTool(remote, args));
        if (name === 'models' || name === 'studio_capabilities') {
          try {
            rootsNamedIn(payloadOf(result), learned);
          } catch {
            // Learning folders never breaks a read.
          }
        }
        try {
          observer?.(noteOf(name, args, started, result, undefined, remote));
        } catch {
          // The log never breaks a read.
        }
        return result;
      } catch (error) {
        try {
          observer?.(noteOf(name, args, started, undefined, error, remote));
        } catch {
          // The log never breaks a read.
        }
        throw error;
      }
    },
    close: () => session.close(),
  };
}
