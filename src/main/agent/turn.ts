import type Database from 'better-sqlite3';
import { readProjection } from '../commands/commit';
import { mainLLMService } from '../llmService';
import * as knowledgeRepository from '../knowledge/repository';
import { summarizeGraph } from '../../shared/agent/graph';
import { parseTurnContext } from '../../shared/agent/turnContext';
import { AGENT_BUILD_TOOLS } from '../../shared/contracts/agentTools';
import type { Projection } from '../../shared/commands/types';
import { createBuildTools, type RendererToolSpec, type RunContext } from './buildTools';
import { buildSystemPrompt, catalogSummaryText } from './prompt';
import { createAgentTools, type KnowledgeApi, type ProposalApi } from './tools';
import type { FetchLike } from './web';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export interface AgentTurnOptions {
  db: Database.Database;
  messages: unknown;
  toolSpecs: unknown;
  run: RunContext;
  /** Optional 5th argument of llm:stream-chat. Validated here; malformed means a plain chat turn. */
  context?: unknown;
  /** Settings language, used when the context does not name one. */
  language: 'en' | 'ru';
  /** Stream chunks on the renderer's response channel. */
  send: (chunk: { type: string; content?: unknown }) => void;
  /** Push on a named channel (proposals:event). */
  notify: (channel: string, payload: unknown) => void;
  llm?: Pick<typeof mainLLMService, 'streamChatWithTools' | 'nativeSearchTool'>;
  knowledge?: KnowledgeApi;
  proposals?: ProposalApi;
  fetchImpl?: FetchLike;
}

function dialog(input: unknown): ChatMessage[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const { role, content } = item as { role?: unknown; content?: unknown };
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') return [];
    return [{ role, content }];
  });
}

function specs(input: unknown): RendererToolSpec[] {
  if (!Array.isArray(input)) return [];
  return input.filter((item): item is RendererToolSpec => !!item && typeof item === 'object' && typeof (item as RendererToolSpec).name === 'string');
}

const BUILD = new Set<string>(AGENT_BUILD_TOOLS);

/**
 * One llm:stream-chat turn. The renderer's system messages are replaced by the main-built teaching prompt
 * (the renderer cannot see the catalog and must not ship widget values). Chunk protocol is unchanged:
 * every fullStream part, then 'projection' on commits, then 'done' or 'error'.
 */
export async function runAgentTurn(options: AgentTurnOptions): Promise<void> {
  const { db, run, send } = options;
  const llm = options.llm ?? mainLLMService;
  const knowledge = options.knowledge ?? knowledgeRepository;
  try {
    const context = parseTurnContext(options.context, options.language);
    const messages = dialog(options.messages);
    const question = [...messages].reverse().find((message) => message.role === 'user')?.content ?? '';
    let revision = run.expectedRevisionId;

    const projection: Projection | null = readProjection(db, run.projectId);
    const system = buildSystemPrompt({
      context,
      graph: projection ? summarizeGraph(projection.snapshot) : null,
      catalog: catalogSummaryText(db, knowledge, question),
    });

    const mainTools = createAgentTools({
      db,
      projectId: run.projectId,
      runId: run.runId,
      revision: () => revision,
      knowledge,
      proposals: options.proposals,
      fetchImpl: options.fetchImpl,
      notify: options.notify,
      nativeSearch: llm.nativeSearchTool(),
    });
    const rendererSpecs = specs(options.toolSpecs);
    const buildTools = createBuildTools(rendererSpecs, {
      db,
      run,
      onProjection: (next) => send({ type: 'projection', content: next }),
      onRevision: (next) => { revision = next; },
    });
    // Main tools first; a renderer spec replaces one only when it is a build tool.
    const tools: Record<string, unknown> = { ...mainTools };
    for (const [name, definition] of Object.entries(buildTools)) {
      if (BUILD.has(name) || !(name in tools)) tools[name] = definition;
    }

    console.log(`[Agent] Turn with ${messages.length} messages, ${Object.keys(tools).length} tools, intent=${context.intent}`);
    for await (const chunk of llm.streamChatWithTools([{ role: 'system', content: system }, ...messages], tools as Record<string, any>)) {
      send(chunk);
    }
    send({ type: 'done' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The assistant could not complete the request.';
    console.error('[Agent] LLM stream error:', message);
    send({ type: 'error', content: message });
  }
}
