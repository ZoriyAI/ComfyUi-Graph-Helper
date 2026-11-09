import { z } from 'zod';
import type { McpSession } from '../../shared/mcp/catalogSource';

const name = z.string().min(1).max(1000);
const limit = z.number().int().min(1).max(1000).optional();
const cursor = z.string().min(1).max(2000).optional();

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

/**
 * Wraps a session so that every tool call passes this one check. All MCP reads in the app go through
 * a wrapped session, which makes this the single call site for the allowlist.
 */
export function readOnlySession(session: McpSession): McpSession {
  return {
    listTools: () => session.listTools(),
    async callTool(name, args) {
      if (!isReadOnlyCall(name, args)) throw new McpRefusedError(name);
      return session.callTool(name, args);
    },
    close: () => session.close(),
  };
}
