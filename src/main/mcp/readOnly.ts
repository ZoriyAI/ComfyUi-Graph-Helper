import type { McpSession } from '../../shared/mcp/catalogSource';

/**
 * The only MCP tools this app may call, each with the argument shapes that keep it read-only.
 * The owner's server also exposes tools that install, download, delete, write metadata, or queue prompts;
 * none of them is listed here, so none can be called (brief §2.1, §4).
 */
export const READ_ONLY_TOOLS: Readonly<Record<string, (args: Record<string, unknown>) => boolean>> = {
  studio_info: () => true,
  studio_capabilities: () => true,
  models: (args) => args.action === 'list' || args.action === 'inspect',
  list_local_models: (args) => args.action === 'list',
  model_metadata: (args) => args.action === 'read',
  comfy_api: (args) => typeof args.method === 'string' && args.method.toUpperCase() === 'GET',
};

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
