import type Database from 'better-sqlite3';
import { closeRun, listRecentCommands, readProjection } from '../commands/commit';
import { readCatalog } from '../catalog/repository';
import { mainLLMService } from '../llmService';
import * as knowledgeRepository from '../knowledge/repository';
import { summarizeGraph } from '../../shared/agent/graph';
import { parseTurnContext } from '../../shared/agent/turnContext';
import { redactSecrets } from '../../shared/agent/redact';
import { AGENT_BUILD_TOOLS } from '../../shared/contracts/agentTools';
import type { ToolContext } from '../../shared/commands/tools';
import type { CatalogView } from '../../shared/catalog/types';
import type { Projection } from '../../shared/commands/types';
import type { RecentCommand } from '../../shared/agent/recentActions';
import type { AgentTurnContext } from '../../shared/contracts';
import { createBuildTools, type RendererToolSpec, type RunContext } from './buildTools';
import { trimHistory } from './history';
import { buildSystemPrompt, catalogSummaryText } from './prompt';
import { errorMessage } from './streamParts';
import { createAgentTools, type KnowledgeApi, type ProposalApi } from './tools';
import type { FetchLike } from './web';
import { readPreferences } from '../settings/repository';
import type { Preferences } from '../../shared/config/preferences';

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
  /** Aborted by llm:cancel or when the window goes away: the provider request and the tool loop stop. */
  signal?: AbortSignal;
  llm?: Pick<typeof mainLLMService, 'streamChatWithTools' | 'nativeSearchTool'> & Partial<Pick<typeof mainLLMService, 'redact'>>;
  knowledge?: KnowledgeApi;
  proposals?: ProposalApi;
  fetchImpl?: FetchLike;
  /** Preferences for this turn. Default: read from the settings row now, so a save applies to the next turn. */
  preferences?: Preferences;
}

function dialog(input: unknown): ChatMessage[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const { role, content } = item as { role?: unknown; content?: unknown };
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') return [];
    // A tool-only assistant turn has no text; providers such as Gemini reject an empty part.
    if (role === 'assistant' && content.trim() === '') return [];
    return [{ role, content }];
  });
}

function specs(input: unknown): RendererToolSpec[] {
  if (!Array.isArray(input)) return [];
  return input.filter((item): item is RendererToolSpec => !!item && typeof item === 'object' && typeof (item as RendererToolSpec).name === 'string');
}

const BUILD = new Set<string>(AGENT_BUILD_TOOLS);
const RECENT_LIMIT = 30;

/**
 * Build tools exist in a build turn, and in a chat turn when the person set "build directly" as their default
 * (Preferences ▸ Assistant). Ask turns, and chat turns by default, read, explain and propose ghosts.
 */
export function buildToolsAllowed(context: AgentTurnContext, defaultIntent?: 'ask' | 'build'): boolean {
  if (context.intent === 'build') return true;
  return context.intent === 'chat' && defaultIntent === 'build';
}

/** The person's recent commands for the prompt; a read failure only drops that section. */
function readRecent(db: Database.Database, projectId: string): RecentCommand[] {
  try {
    return listRecentCommands(db, projectId, RECENT_LIMIT, { actor: 'manual' });
  } catch {
    return [];
  }
}

/** Nodes the prompt lists even past its cap: the selection, the object asked about, nodes touched recently. */
function priorityIds(context: AgentTurnContext, recent: RecentCommand[]): string[] {
  const ids = context.selection.flatMap((ref) => (ref.kind === 'node' ? [ref.id] : ref.nodeId ? [ref.nodeId] : []));
  const asked = context.objectRef;
  if (asked?.kind === 'node') ids.push(asked.id);
  if (asked?.nodeId) ids.push(asked.nodeId);
  for (const command of recent.slice(-10)) ids.push(...command.ids);
  return [...new Set(ids)];
}

/** Closes the turn's run when it is still running. A paused run stays paused so Resume can reopen it. */
function closeIfRunning(db: Database.Database, run: RunContext): Projection | null {
  try {
    const active = readProjection(db, run.projectId)?.activeRun;
    if (active && active.runId === run.runId && active.status === 'running') return closeRun(db, run.projectId, run.runId).projection;
    return readProjection(db, run.projectId);
  } catch (error) {
    console.warn('[Agent] Run was not closed:', error instanceof Error ? error.message.slice(0, 200) : 'unknown error');
    return null;
  }
}

/**
 * One llm:stream-chat turn. The renderer's system messages are replaced by the main-built teaching prompt
 * (the renderer cannot see the catalog or the action log). Chunk protocol: the fullStream parts with only the
 * fields the chat uses (main/agent/streamParts.ts), 'projection' on commits followed by 'build-step' for a step
 * tool (addNode, connectNodes, …; content AgentBuildStep), then a final 'projection' after the run is closed,
 * then 'done' or 'error'. Renderers that do not know 'build-step' ignore it.
 */
export async function runAgentTurn(options: AgentTurnOptions): Promise<void> {
  const { db, send } = options;
  let run = options.run;
  const llm = options.llm ?? mainLLMService;
  const redact = (text: string) => (llm.redact ?? mainLLMService.redact)(redactSecrets(text));
  const knowledge = options.knowledge ?? knowledgeRepository;
  let terminal: { type: string; content?: unknown } = { type: 'done' };
  try {
    const preferences = options.preferences ?? readPreferences(db);
    const { assistant, privacy } = preferences;
    const context = parseTurnContext(options.context, options.language);
    const messages = trimHistory(dialog(options.messages)).map((message) => ({ ...message, content: redact(message.content) }));
    const question = [...messages].reverse().find((message) => message.role === 'user')?.content ?? '';
    const projection: Projection | null = readProjection(db, run.projectId);
    // The engine keeps the run's expected revision current (a manual commit or a resumed run moves it).
    const active = projection?.activeRun;
    if (active && active.runId === run.runId && active.expectedRevisionId) run = { ...run, expectedRevisionId: active.expectedRevisionId };
    let revision = run.expectedRevisionId;

    const recent = readRecent(db, run.projectId);
    const selectedIds = context.selection.filter((ref) => ref.kind === 'node').map((ref) => ref.id);
    const system = redact(buildSystemPrompt({
      context,
      graph: projection ? summarizeGraph(projection.snapshot, { selectedIds, priorityIds: priorityIds(context, recent), omitValues: !privacy.sendFieldValues }) : null,
      catalog: catalogSummaryText(db, knowledge, question),
      recent,
      question,
      preferences: { ...assistant, sendFieldValues: privacy.sendFieldValues },
    }));

    // Port names and slot indices resolve against the current snapshot and the installed catalog.
    let catalog: CatalogView | undefined;
    const toolContext = (): ToolContext => {
      if (!catalog) {
        try {
          catalog = readCatalog(db);
        } catch {
          catalog = { nodeTypes: [], models: [], nodes: [] };
        }
      }
      const snapshot = readProjection(db, run.projectId)?.snapshot as ToolContext['snapshot'] | undefined;
      return { snapshot, catalog };
    };

    const mainTools = createAgentTools({
      db,
      projectId: run.projectId,
      runId: run.runId,
      revision: () => revision,
      knowledge,
      proposals: options.proposals,
      fetchImpl: options.fetchImpl,
      notify: options.notify,
      nativeSearch: assistant.allowWebSearch ? llm.nativeSearchTool() : null,
      allowWebSearch: assistant.allowWebSearch,
      allowFetchPage: assistant.allowFetchPage,
      omitValues: !privacy.sendFieldValues,
      toolContext,
      signal: options.signal,
    });
    const tools: Record<string, unknown> = { ...mainTools };
    if (buildToolsAllowed(context, assistant.defaultIntent)) {
      const buildTools = createBuildTools(specs(options.toolSpecs), {
        db,
        run,
        onProjection: (next) => send({ type: 'projection', content: next }),
        onRevision: (next) => { revision = next; },
        onBuildStep: (step) => send({ type: 'build-step', content: step }),
        saveWhy: (database, input) => knowledge.saveExplanation(database, input),
        toolContext,
      });
      // Main tools first; a renderer spec replaces one only when it is a build tool.
      for (const [name, definition] of Object.entries(buildTools)) {
        if (BUILD.has(name) || !(name in tools)) tools[name] = definition;
      }
    }

    console.log(`[Agent] Turn with ${messages.length} messages, ${Object.keys(tools).length} tools, intent=${context.intent}`);
    for await (const chunk of llm.streamChatWithTools([{ role: 'system', content: system }, ...messages], tools as Record<string, any>, {
      maxSteps: assistant.maxStepsPerTurn,
      allowWebSearch: assistant.allowWebSearch,
      allowFetchPage: assistant.allowFetchPage,
      abortSignal: options.signal,
    })) {
      if (options.signal?.aborted) break;
      send(chunk);
    }
  } catch (error) {
    if (options.signal?.aborted) {
      console.log('[Agent] Turn cancelled');
    } else {
      const message = errorMessage(error, redact);
      console.error('[Agent] LLM stream error:', message);
      terminal = { type: 'error', content: message };
    }
  } finally {
    const closed = closeIfRunning(db, run);
    if (closed) send({ type: 'projection', content: closed });
    send(terminal);
  }
}
