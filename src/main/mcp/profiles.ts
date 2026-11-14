import type Database from 'better-sqlite3';
import type { McpModelFile, McpSession } from '../../shared/mcp/catalogSource';
import { isModelFileIn, parseLocalModelsMarkdown, toolPayload } from '../../shared/mcp/catalogSource';
import { isPlainRelativeName } from '../../shared/mcp/serverPaths';
import { removeStaleModelFiles, removeStaleModelFilesIn, upsertModelFiles } from '../catalog/repository';

/*
 * Kinds of MCP server the app knows how to read, recognised by the tools a server lists (their names and input
 * schemas), never by its name or address. Each kind has its own short list of read-only calls; everything else a
 * server offers (queueing, downloads, installs) is never called, whatever the kind (readOnly.ts holds the
 * allowlist and the exact argument shapes).
 *
 * - 'catalog': a server with catalog tools (studio_capabilities, models, studio_info, comfy_api): node classes,
 *   packs, model files with folders, descriptions and fingerprints. Read as before (client.ts). `model_metadata`
 *   alone does not make one: the comfyui-mcp family has a tool of that name whose answer is another shape.
 * - 'modelList': the comfyui-mcp family that lists models as markdown with `list_local_models` action "list"
 *   (artokun/comfyui-mcp). Gives model names by folder, with sizes when it read its disk.
 * - 'checkpointList': the comfyui-mcp-server family whose `list_models` takes no arguments and answers
 *   `{models: [...]}` (joenorton/comfyui-mcp-server). Gives checkpoint names only.
 *
 * For the last two, the nodes come from the ComfyUI address in Settings (comfy/direct.ts).
 */
export type McpProfile = 'catalog' | 'modelList' | 'checkpointList';

/** The tools that make a server a 'catalog' one. Any of them is enough: the reader asks only for what is listed. */
const CATALOG_TOOLS = ['studio_capabilities', 'models', 'studio_info', 'comfy_api'];

interface ListedTool {
  name: string;
  inputSchema?: unknown;
}

function schemaOf(tool: ListedTool | undefined): { properties: Record<string, unknown>; required: string[] } | null {
  if (!tool) return null;
  const schema = tool.inputSchema;
  if (schema === undefined) return { properties: {}, required: [] };
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return null;
  const { properties, required } = schema as { properties?: unknown; required?: unknown };
  return {
    properties: properties && typeof properties === 'object' && !Array.isArray(properties) ? (properties as Record<string, unknown>) : {},
    required: Array.isArray(required) ? required.filter((item): item is string => typeof item === 'string') : [],
  };
}

/** Whether a property's schema allows the string `value` (an enum or const holding it, or a plain string). */
function allows(property: unknown, value: string): boolean {
  if (!property || typeof property !== 'object') return false;
  const { enum: options, const: constant, type } = property as { enum?: unknown; const?: unknown; type?: unknown };
  if (Array.isArray(options)) return options.includes(value);
  if (constant !== undefined) return constant === value;
  return type === 'string';
}

/** Which kind of server this is, from its tool list; null when the app does not know how to read it. */
export function recognizeProfile(tools: readonly ListedTool[]): McpProfile | null {
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  if (CATALOG_TOOLS.some((name) => byName.has(name))) return 'catalog';
  const local = schemaOf(byName.get('list_local_models'));
  if (local && allows(local.properties.action, 'list') && local.required.every((name) => name === 'action')) return 'modelList';
  const checkpoints = schemaOf(byName.get('list_models'));
  if (checkpoints && checkpoints.required.length === 0) return 'checkpointList';
  return null;
}

export interface ProfileModels {
  /** Files stored, or null when the listing could not be read (the old list stays). */
  models: number | null;
  /** The listing said it was partial: files it does not name were not dropped. */
  partial: boolean;
}

/** `list_local_models` action "list": markdown by folder. A partial or empty answer drops nothing. */
async function readModelList(db: Database.Database, session: McpSession, now: number): Promise<ProfileModels> {
  const result = await session.callTool('list_local_models', { action: 'list' });
  const payload = toolPayload(result);
  const text = typeof payload === 'string' ? payload : null;
  if (result.isError || text === null || !/^## /m.test(text)) return { models: null, partial: false };
  const files = parseLocalModelsMarkdown(text).filter((file) => isPlainRelativeName(file.name));
  const partial = /Partial listing/i.test(text);
  const models = upsertModelFiles(db, files, now);
  if (!partial) removeStaleModelFiles(db, now);
  return { models, partial };
}

/** `list_models` with no arguments: `{models: [checkpoint names]}`. Only the checkpoints folder is replaced. */
async function readCheckpointList(db: Database.Database, session: McpSession, now: number): Promise<ProfileModels> {
  const result = await session.callTool('list_models', {});
  const payload = toolPayload(result);
  const listed = payload && typeof payload === 'object' && !Array.isArray(payload) ? (payload as { models?: unknown }).models : undefined;
  if (result.isError || !Array.isArray(listed)) return { models: null, partial: false };
  const files: McpModelFile[] = listed
    .slice(0, 100_000)
    .filter((name): name is string => typeof name === 'string' && isPlainRelativeName(name) && isModelFileIn('checkpoints', name))
    .map((name) => ({ directory: 'checkpoints', name, sizeBytes: null }));
  const models = upsertModelFiles(db, files, now);
  removeStaleModelFilesIn(db, now, ['checkpoints']);
  return { models, partial: false };
}

/** The model list of a 'modelList' or 'checkpointList' server. Transport errors and refusals are thrown. */
export function readProfileModels(profile: Exclude<McpProfile, 'catalog'>, db: Database.Database, session: McpSession, now: number): Promise<ProfileModels> {
  return profile === 'modelList' ? readModelList(db, session, now) : readCheckpointList(db, session, now);
}
