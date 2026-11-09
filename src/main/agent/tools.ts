import type Database from 'better-sqlite3';
import { jsonSchema } from 'ai';
import { z } from 'zod';
import * as knowledgeRepository from '../knowledge/repository';
import * as proposalRepository from '../proposals/repository';
import { readProjection } from '../commands/commit';
import { mutationFromTool, type ToolContext } from '../../shared/commands/tools';
import { GRAPH_PAGE_LIMIT, summarizeGraph } from '../../shared/agent/graph';
import { carriesSecret } from '../../shared/config/draft';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type { Projection } from '../../shared/commands/types';
import type { AgentProposalTool, ObjectRef, ProposalKind } from '../../shared/contracts';
import { MAIN_TOOL_SPECS } from './toolSpecs';
import { fetchPageText, searchWebFallback, type FetchLike } from './web';

/** The knowledge functions the agent reads through. Defaults to the KB repository. */
export type KnowledgeApi = Pick<typeof knowledgeRepository,
  'searchNodeClasses' | 'nodeClassDetail' | 'searchModels' | 'modelDetail' | 'saveExplanation' | 'checkGraph'>;
/** The proposal functions the agent writes ghosts through. Defaults to the Engine repository. */
export type ProposalApi = Pick<typeof proposalRepository, 'createProposal' | 'listProposals'>;

export interface AgentToolDeps {
  db: Database.Database;
  projectId: string;
  runId: string | null;
  /** Revision the turn works against. A function when build tools move it during the turn. */
  revision: string | (() => string);
  knowledge?: KnowledgeApi;
  proposals?: ProposalApi;
  fetchImpl?: FetchLike;
  /** Push to the renderer (window.webContents.send in the IPC layer). */
  notify?: (channel: string, payload: unknown) => void;
  /** Provider-executed web search tool, or null for the main-process fallback. */
  nativeSearch?: unknown | null;
  readGraph?: (db: Database.Database, projectId: string) => Projection | null;
  /** Snapshot and catalog for resolving port names and slot indices in proposals. */
  toolContext?: () => ToolContext | undefined;
  /** Aborted when the turn is cancelled: nothing more is written. */
  signal?: AbortSignal;
}

export interface AgentToolDefinition {
  description: string;
  inputSchema: ReturnType<typeof jsonSchema>;
  execute: (args: unknown) => Promise<unknown>;
}

type Failure = { success: false; error: string };

const fail = (error: string): Failure => ({ success: false, error });

function errorText(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : '';
  // Messages from our repositories are plain sentences; anything secret-shaped is replaced.
  if (!message || carriesSecret({ message })) return fallback;
  return message.slice(0, 300);
}

const objectRefSchema = z.object({
  kind: z.enum(['node', 'port', 'edge', 'subgraph', 'group', 'nodeClass', 'model', 'process']),
  id: z.string().min(1).max(500),
  nodeId: z.string().max(200).optional(),
  portName: z.string().max(200).optional(),
  direction: z.enum(['input', 'output']).optional(),
  classType: z.string().max(200).optional(),
  directory: z.string().max(200).optional(),
  name: z.string().max(500).optional(),
});

const schemas = {
  getGraph: z.object({
    offset: z.number().int().min(0).optional(),
    limit: z.number().int().min(1).max(500).optional(),
    ids: z.array(z.string().max(200)).max(500).optional(),
  }).passthrough(),
  searchNodeTypes: z.object({ query: z.string().max(200), category: z.string().max(200).optional(), limit: z.number().int().min(1).max(50).optional() }),
  describeNodeType: z.object({ classType: z.string().min(1).max(200) }),
  findInstalledModels: z.object({
    query: z.string().max(200),
    directory: z.string().max(200).optional(),
    baseModel: z.string().max(40).optional(),
    kind: z.string().max(40).optional(),
    limit: z.number().int().min(1).max(50).optional(),
  }),
  describeModel: z.object({ directory: z.string().min(1).max(200), name: z.string().min(1).max(500) }),
  checkGraph: z.object({}).passthrough(),
  searchWeb: z.object({ query: z.string().min(1).max(400) }),
  fetchPage: z.object({ url: z.string().min(1).max(2000) }),
  explain: z.object({
    owner: objectRefSchema,
    aspect: z.enum(['what', 'why', 'connect', 'next', 'risk']),
    text: z.string().min(1).max(8000),
    provenance: z.enum(['fact', 'inference', 'web']),
    sourceUrl: z.string().max(2000).optional(),
  }),
  proposal: z.object({ note: z.string().min(1).max(500) }).passthrough(),
};

/** Each proposal tool proposes what its build twin would do. */
export const PROPOSAL_BUILD_TWIN: Record<AgentProposalTool, string> = {
  proposeNode: 'addNode',
  proposeConnection: 'connectNodes',
  proposeParameter: 'setParameter',
  proposeSubgraph: 'createSubgraph',
};

const PROPOSAL_KINDS: readonly ProposalKind[] = ['add-node', 'connect', 'set-parameter', 'create-subgraph', 'insert-subgraph', 'remove-node'];

function parse<T>(schema: z.ZodType<T>, args: unknown): { ok: true; value: T } | { ok: false; failure: Failure } {
  const parsed = schema.safeParse(args ?? {});
  if (parsed.success) return { ok: true, value: parsed.data };
  const issue = parsed.error.issues[0];
  return { ok: false, failure: fail(`Invalid arguments${issue ? ` at ${issue.path.join('.') || 'input'}: ${issue.message}` : ''}.`) };
}

/** Knowledge about a class or a model is shared across projects; everything else belongs to this project. */
function globalOwner(owner: ObjectRef): boolean {
  return owner.kind === 'nodeClass' || owner.kind === 'model';
}

/** Inputs in slot order (sockets first, then widget inputs, as ComfyUI adds them) with their handles. */
function withHandles<T extends { inputs?: unknown; outputs?: unknown }>(detail: T): T {
  const inputs = Array.isArray(detail.inputs) ? detail.inputs as Array<Record<string, unknown>> : [];
  const outputs = Array.isArray(detail.outputs) ? detail.outputs as Array<Record<string, unknown>> : [];
  const ordered = [...inputs.filter((input) => input.widget !== true), ...inputs.filter((input) => input.widget === true)];
  return {
    ...detail,
    inputs: ordered.map((input, index) => ({ ...input, handle: `in-${index}` })),
    outputs: outputs.map((output, index) => ({ ...output, handle: `out-${index}` })),
  };
}

function webSource(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Builds the main-process agent tools (read, knowledge, proposals). Build tools are added by the IPC layer
 * from renderer specs. Nothing here installs, downloads, queues, or calls MCP.
 */
export function createAgentTools(deps: AgentToolDeps): Record<string, AgentToolDefinition | unknown> {
  const knowledge = deps.knowledge ?? knowledgeRepository;
  const proposals = deps.proposals ?? proposalRepository;
  const fetchImpl = deps.fetchImpl ?? ((input: string, init?: RequestInit) => globalThis.fetch(input, init));
  const readGraph = deps.readGraph ?? readProjection;
  const revision = () => (typeof deps.revision === 'function' ? deps.revision() : deps.revision);
  const { db, projectId } = deps;
  const context = (): ToolContext | undefined => {
    try {
      return deps.toolContext?.();
    } catch {
      return undefined;
    }
  };
  /** Why this turn may no longer write, or null while its run is still running. */
  const stopped = (): string | null => {
    if (deps.signal?.aborted) return 'The turn was cancelled; nothing was saved.';
    if (!deps.runId) return null;
    const active = readGraph(db, projectId)?.activeRun;
    if (!active || active.runId !== deps.runId || active.status !== 'running') {
      return 'The run is no longer running (cancelled, paused, or closed); nothing was saved.';
    }
    return null;
  };

  const define = <T>(name: keyof typeof MAIN_TOOL_SPECS, schema: z.ZodType<T>, run: (args: T) => unknown | Promise<unknown>): AgentToolDefinition => ({
    description: MAIN_TOOL_SPECS[name].description,
    inputSchema: jsonSchema(MAIN_TOOL_SPECS[name].parameters as any),
    execute: async (args: unknown) => {
      const parsed = parse(schema, args);
      if (!parsed.ok) return parsed.failure;
      try {
        return await run(parsed.value);
      } catch (error) {
        return fail(errorText(error, `${name} failed.`));
      }
    },
  });

  const propose = (name: AgentProposalTool): AgentToolDefinition => define(name, schemas.proposal, (args) => {
    const { note, ...rest } = args as { note: string } & Record<string, unknown>;
    if (carriesSecret({ note })) return fail('The note looks like it carries a secret.');
    const halt = stopped();
    if (halt) return fail(halt);
    const twin = PROPOSAL_BUILD_TWIN[name];
    const payload = mutationFromTool(twin, rest, context());
    if (!payload) return fail(`${name} cannot be proposed yet: the ${twin} shape is not mapped to a graph change.`);
    const kind = PROPOSAL_KINDS.find((item) => item === payload.type);
    if (!kind) return fail(`${name} produced a ${payload.type} change, which is not a proposal kind.`);
    const proposal = proposals.createProposal(db, {
      projectId,
      runId: deps.runId,
      kind,
      payload,
      note,
      revisionId: revision(),
    });
    try {
      deps.notify?.(IPC_CHANNELS.PROPOSALS_EVENT, proposals.listProposals(db, projectId, 'proposed'));
    } catch {
      // The ghost exists; the renderer picks it up on its next proposals:list.
    }
    return {
      success: true,
      message: `Proposed ${kind} as a ghost. It changes the graph only if the person accepts it.`,
      proposalId: proposal.id,
      kind,
      note: proposal.note,
    };
  });

  const tools: Record<string, AgentToolDefinition | unknown> = {
    getGraph: define('getGraph', schemas.getGraph, (args) => {
      const projection = readGraph(db, projectId);
      if (!projection) return fail('Project is not ready.');
      return {
        success: true,
        revisionId: projection.currentRevisionId,
        ...summarizeGraph(projection.snapshot, { offset: args.offset, limit: args.limit ?? GRAPH_PAGE_LIMIT, ids: args.ids }),
      };
    }),
    searchNodeTypes: define('searchNodeTypes', schemas.searchNodeTypes, (args) => ({
      success: true,
      results: knowledge.searchNodeClasses(db, { query: args.query, category: args.category, limit: args.limit ?? 20 }),
    })),
    describeNodeType: define('describeNodeType', schemas.describeNodeType, (args) => {
      const detail = knowledge.nodeClassDetail(db, args.classType);
      if (!detail) return fail(`${args.classType} is not installed in this ComfyUI catalog.`);
      return { success: true, provenance: detail.detailed ? 'fact' : 'inference', node: withHandles(detail) };
    }),
    findInstalledModels: define('findInstalledModels', schemas.findInstalledModels, (args) => ({
      success: true,
      results: knowledge.searchModels(db, {
        query: args.query,
        directory: args.directory,
        baseModel: args.baseModel as never,
        kind: args.kind as never,
        limit: args.limit ?? 20,
      }),
    })),
    describeModel: define('describeModel', schemas.describeModel, (args) => {
      const detail = knowledge.modelDetail(db, args.directory, args.name);
      if (!detail) return fail(`${args.directory}/${args.name} is not in the model catalog.`);
      return { success: true, model: detail };
    }),
    checkGraph: define('checkGraph', schemas.checkGraph, () => ({ success: true, report: knowledge.checkGraph(db, projectId) })),
    fetchPage: define('fetchPage', schemas.fetchPage, async (args) => ({
      success: true,
      provenance: 'web',
      ...(await fetchPageText(args.url, fetchImpl)),
    })),
    explain: define('explain', schemas.explain, (args) => {
      if (carriesSecret({ text: args.text })) return fail('The explanation looks like it carries a secret and was not saved.');
      const halt = stopped();
      if (halt) return fail(halt);
      const sourceUrl = webSource(args.sourceUrl);
      if (args.provenance === 'web' && !sourceUrl) return fail('A web explanation needs the http(s) sourceUrl it came from.');
      const owner = args.owner as ObjectRef;
      const global = globalOwner(owner);
      const saved = knowledge.saveExplanation(db, {
        projectId: global ? null : projectId,
        owner,
        aspect: args.aspect,
        text: args.text,
        provenance: args.provenance,
        sourceUrl,
        revisionId: global ? null : revision(),
        createdBy: 'ai',
      });
      return { success: true, message: 'Saved the explanation to the object.', explanationId: saved.id, provenance: saved.provenance, owner: saved.owner };
    }),
    proposeNode: propose('proposeNode'),
    proposeConnection: propose('proposeConnection'),
    proposeParameter: propose('proposeParameter'),
    proposeSubgraph: propose('proposeSubgraph'),
  };

  const native = deps.nativeSearch === undefined ? null : deps.nativeSearch;
  tools.searchWeb = native ?? define('searchWeb', schemas.searchWeb, async (args) => ({
    success: true,
    provenance: 'web',
    results: await searchWebFallback(args.query, fetchImpl),
  }));
  return tools;
}
