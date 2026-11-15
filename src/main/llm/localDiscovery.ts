/**
 * Settings ▸ Assistant ▸ "Find local servers": the Ollama servers the person's MCP server runs, and whatever
 * answers on this computer at the usual ports of Ollama, LM Studio, vLLM and llama.cpp's server. These ports are
 * only places to look: a server is offered only when it answered, labelled as found on this computer, and any other
 * address can be typed. Served by main/ipc.ts.
 */
import type { LocalDiscovery, LocalServer } from '../../shared/contracts/pickers';
import type { McpSession } from '../../shared/mcp/catalogSource';
import { toolPayload } from '../../shared/mcp/catalogSource';
import { failure, type McpReadFailure } from '../mcp/client';
import { listLocalModels, parseOllamaCatalog } from './modelList';

/** The usual ports of the local servers the app knows, each tried on 127.0.0.1. */
export const LOCAL_PROBES: ReadonlyArray<{ port: number; name: string }> = [
  { port: 11434, name: 'Ollama' },
  { port: 1234, name: 'LM Studio' },
  { port: 8000, name: 'vLLM' },
  { port: 8080, name: 'llama.cpp' },
];
/** A local server answers at once or not at all; a short wait keeps the search quick. */
export const PROBE_TIMEOUT_MS = 1_500;
/** The MCP server is asked about at most this many targets. */
const MAX_TARGETS = 8;

/** Opens a session to the saved MCP server, or says why it could not. */
export type OpenMcp = () => Promise<{ ok: true; session: McpSession } | McpReadFailure>;

/** What the search needs from outside; tests pass a fake fetch and a fake MCP session. */
export interface DiscoveryDeps {
  fetchImpl: typeof fetch;
  /** Opens a read-only MCP session to the saved server, or null when no MCP URL is saved. */
  openMcp: OpenMcp | null;
  probeTimeoutMs?: number;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function text(value: unknown, max = 200): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/** An http(s) server root with no user info, as a base URL ending in /v1; null for anything else. */
export function openAiBase(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2000) return null;
  try {
    const url = new URL(value.trim());
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password) return null;
    const path = url.pathname.replace(/\/+$/, '');
    return `${url.origin}${path.endsWith('/v1') ? path : `${path}/v1`}`;
  } catch {
    return null;
  }
}

/** One Ollama server as the MCP server names it: its name, its /v1 base, its GPU and its default model. */
export interface OllamaTarget {
  target: string;
  base: string;
  gpu?: string;
  defaultModel?: string;
}

/**
 * `ollama_targets`: `{targets:[{target, base_url, gpu_uuid, default_model}], telemetry:{gpu:{<uuid>:{name}}}}`.
 * A target without a usable name or http(s) address is skipped.
 */
export function parseOllamaTargets(json: unknown): OllamaTarget[] {
  const payload = record(json);
  const targets = payload?.targets;
  if (!Array.isArray(targets)) return [];
  const gpus = record(record(payload?.telemetry)?.gpu) ?? {};
  const out: OllamaTarget[] = [];
  for (const item of targets) {
    const row = record(item);
    const target = text(row?.target, 100);
    const base = openAiBase(row?.base_url);
    if (!target || !base) continue;
    const gpu = text(record(gpus[text(row?.gpu_uuid)])?.name);
    const defaultModel = text(row?.default_model, 300);
    out.push({ target, base, ...(gpu ? { gpu } : {}), ...(defaultModel ? { defaultModel } : {}) });
  }
  return out;
}

/** The Ollama servers the MCP server knows, with their models; a failure becomes a note, not an error. */
async function fromMcp(openMcp: OpenMcp): Promise<{ servers: LocalServer[]; note?: string }> {
  const opened = await openMcp();
  if (!opened.ok) return { servers: [], note: opened.error };
  const session = opened.session;
  try {
    // Another MCP server may not run Ollama at all; that is not an error worth showing.
    const tools = new Set((await session.listTools()).map((tool) => tool.name));
    if (!tools.has('ollama_targets')) return { servers: [] };
    const targets = parseOllamaTargets(toolPayload(await session.callTool('ollama_targets', {}))).slice(0, MAX_TARGETS);
    const servers: LocalServer[] = [];
    for (const target of targets) {
      let models: LocalServer['models'] = [];
      if (tools.has('ollama_models')) {
        try {
          models = parseOllamaCatalog(toolPayload(await session.callTool('ollama_models', { target: target.target })));
        } catch {
          models = [];
        }
      }
      servers.push({
        value: target.base,
        origin: 'mcp',
        name: target.target,
        ...(target.gpu ? { gpu: target.gpu } : {}),
        ...(target.defaultModel ? { defaultModel: target.defaultModel } : {}),
        models,
      });
    }
    return { servers };
  } catch (error) {
    return { servers: [], note: failure(error).error };
  } finally {
    await session.close().catch(() => undefined);
  }
}

/** The known ports on this computer that answered with a model list, all asked at once. */
async function fromProbes(fetchImpl: typeof fetch, timeoutMs: number): Promise<LocalServer[]> {
  const found = await Promise.all(LOCAL_PROBES.map(async ({ port, name }) => {
    const value = `http://127.0.0.1:${port}/v1`;
    const listed = await listLocalModels(value, fetchImpl, timeoutMs);
    return listed.ok ? { value, origin: 'probe' as const, name, models: listed.models } : null;
  }));
  return found.filter((server): server is NonNullable<typeof server> => server !== null);
}

/** Same server named twice (by the MCP server and by a probe): the MCP entry, which knows more, is kept. */
export function mergeServers(mcp: LocalServer[], probed: LocalServer[]): LocalServer[] {
  const out = new Map<string, LocalServer>();
  for (const server of [...mcp, ...probed]) {
    const key = server.value.toLowerCase().replace('://localhost', '://127.0.0.1');
    if (!out.has(key)) out.set(key, server);
  }
  return [...out.values()];
}

/** Both searches at once; the result lists every server found and a note when the MCP server could not be asked. */
export async function discoverLocalServers(deps: DiscoveryDeps): Promise<LocalDiscovery> {
  const [mcp, probed] = await Promise.all([
    deps.openMcp ? fromMcp(deps.openMcp) : Promise.resolve<{ servers: LocalServer[]; note?: string }>({ servers: [] }),
    fromProbes(deps.fetchImpl, deps.probeTimeoutMs ?? PROBE_TIMEOUT_MS),
  ]);
  return { servers: mergeServers(mcp.servers, probed), notes: mcp.note ? [mcp.note] : [] };
}
