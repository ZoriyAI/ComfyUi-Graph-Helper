import type Database from 'better-sqlite3';
import { turnLinesAllowed, turnLog } from '../trace/modelTrace';
import { closeRun, listRecentCommands, pauseRun, readProjection } from '../commands/commit';
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
import { omittedHistoryText, trimHistory } from './history';
import { effectiveContextWindow, historyBudgetTokens } from '../../shared/agent/contextWindow';
import { buildSystemPrompt, buildTurnData, catalogSummaryText, withTurnData } from './prompt';
import { conversationLinks, linksInText } from './links';
import { errorMessage } from './streamParts';
import { classifyTurnError } from '../../shared/agent/turnError';
import { createAgentTools, type KnowledgeApi, type ProposalApi } from './tools';
import type { FetchLike } from './web';
import { readPreferences } from '../settings/repository';
import { COMPACT_WINDOW } from '../llm/localContext';
import { readStoredWindow, writeStoredWindow } from '../llm/localContextStore';
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
  llm?: Pick<typeof mainLLMService, 'streamChatWithTools' | 'nativeSearchTool'>
    & Partial<Pick<typeof mainLLMService, 'redact' | 'charsPerToken' | 'localContextTokens' | 'rememberLocalContext' | 'nextSendConfig'>>;
  /** Model id for the context window table. Default: the configured model of the next send. */
  model?: string;
  knowledge?: KnowledgeApi;
  proposals?: ProposalApi;
  fetchImpl?: FetchLike;
  /** Preferences for this turn. Default: read from the settings row now, so a save applies to the next turn. */
  preferences?: Preferences;
  /** The app version, for the turn's record in the model conversation log. */
  appVersion?: string;
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
/** A recency window, not a cap on data: the prompt says when the list is the latest 30 only; the graph is complete. */
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

/**
 * With a small context window on the person's own server every tool description costs room the build needs for
 * its steps: only the tools a turn cannot do without are offered. A build keeps reading and the four step tools;
 * an ask or chat turn keeps reading, explaining and the three everyday proposals.
 */
const COMPACT_READ = ['getGraph', 'searchNodeTypes', 'describeNodeType', 'findInstalledModels', 'checkGraph'] as const;
const COMPACT_BUILD = [...COMPACT_READ, 'addNode', 'connectNodes', 'setParameter', 'removeNode'] as const;
const COMPACT_ASK = [...COMPACT_READ, 'describeModel', 'explain', 'proposeNode', 'proposeConnection', 'proposeParameter'] as const;
/** Roughly what one tool's name, description and schema take in the request, in characters. */
const TOOL_CHARS = 700;

export function compactToolNames(buildAllowed: boolean): readonly string[] {
  return buildAllowed ? COMPACT_BUILD : COMPACT_ASK;
}

/** Nodes the prompt lists even past its cap: the selection, the object asked about, nodes touched recently. */
function priorityIds(context: AgentTurnContext, recent: RecentCommand[]): string[] {
  const ids = context.selection.flatMap((ref) => (ref.kind === 'node' ? [ref.id] : ref.nodeId ? [ref.nodeId] : []));
  const asked = context.objectRef;
  if (asked?.kind === 'node') ids.push(asked.id);
  if (asked?.nodeId) ids.push(asked.nodeId);
  // Which nodes a compact (300+ node) prompt writes in full; every node is listed either way.
  for (const command of recent.slice(-10)) ids.push(...command.ids);
  return [...new Set(ids)];
}

/** Pauses the turn's run at a checkpoint (step limit, failure streak). */
function pauseIfRunning(db: Database.Database, run: RunContext): void {
  try {
    const active = readProjection(db, run.projectId)?.activeRun;
    if (active && active.runId === run.runId && active.status === 'running') pauseRun(db, run.projectId, run.runId);
  } catch (error) {
    console.warn('[Agent] Run was not paused:', error instanceof Error ? error.message.slice(0, 200) : 'unknown error');
  }
}

/**
 * Closes the turn's run when the turn ends. A run paused at a checkpoint stays paused so Continue can reopen it;
 * a run the person paused in the middle of a turn that then ended (the model finished, failed or was stopped) is
 * closed too, so nothing keeps saying the helper is paused.
 */
export function closeIfRunning(db: Database.Database, run: RunContext, keepPaused = false): Projection | null {
  try {
    const active = readProjection(db, run.projectId)?.activeRun;
    const open = active?.status === 'running' || (!keepPaused && active?.status === 'paused');
    if (active && active.runId === run.runId && open) return closeRun(db, run.projectId, run.runId).projection;
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
 * then 'done' or 'error'. When the loop stopped on a guard (step checkpoint, failed tools) a 'turn-paused' chunk
 * ({ reason, steps, canContinue }) comes before the final projection and the run stays paused for Continue.
 * Renderers that do not know 'build-step' or 'turn-paused' ignore them.
 */
export async function runAgentTurn(options: AgentTurnOptions): Promise<void> {
  const { db, send } = options;
  let run = options.run;
  const llm = options.llm ?? mainLLMService;
  const redact = (text: string) => (llm.redact ?? mainLLMService.redact)(redactSecrets(text));
  const knowledge = options.knowledge ?? knowledgeRepository;
  let terminal: { type: string; content?: unknown } = { type: 'done' };
  let checkpoint = false;
  // A build step that could not be stored stops the turn: the provider stream is aborted and the turn ends with
  // that sentence (kind 'storage').
  const stopper = new AbortController();
  let storageFailure: string | null = null;
  const outer = options.signal;
  const onOuterAbort = () => stopper.abort();
  if (outer?.aborted) stopper.abort();
  else outer?.addEventListener('abort', onOuterAbort);
  const signal = stopper.signal;
  try {
    const preferences = options.preferences ?? readPreferences(db);
    const { assistant, privacy } = preferences;
    const context = parseTurnContext(options.context, options.language);
    const whole = dialog(options.messages).map((message) => ({ ...message, content: redact(message.content) }));
    const question = [...whole].reverse().find((message) => message.role === 'user')?.content ?? '';
    const projection: Projection | null = readProjection(db, run.projectId);
    // The engine keeps the run's expected revision current (a manual commit or a resumed run moves it).
    const active = projection?.activeRun;
    if (active && active.runId === run.runId && active.expectedRevisionId) run = { ...run, expectedRevisionId: active.expectedRevisionId };
    let revision = run.expectedRevisionId;

    // The window the person's own server loads this model with, when it was seen (now or in an earlier run).
    const runtime = (llm.nextSendConfig ?? (() => null)).call(llm);
    let loadedWindow = llm.localContextTokens?.() ?? null;
    if (loadedWindow === null && runtime?.provider === 'local') {
      loadedWindow = readStoredWindow(db, runtime.baseURL, runtime.model);
      if (loadedWindow !== null) llm.rememberLocalContext?.(loadedWindow);
    }
    const buildAllowed = buildToolsAllowed(context, assistant.defaultIntent);
    const compact = loadedWindow !== null && loadedWindow < COMPACT_WINDOW ? { offered: compactToolNames(buildAllowed), window: loadedWindow } : null;

    const recent = readRecent(db, run.projectId);
    const selectedIds = context.selection.filter((ref) => ref.kind === 'node').map((ref) => ref.id);
    const promptInput = {
      context,
      graph: projection ? summarizeGraph(projection.snapshot, { selectedIds, priorityIds: priorityIds(context, recent), omitValues: !privacy.sendFieldValues }) : null,
      catalog: catalogSummaryText(db, knowledge, question),
      recent,
      recentWindow: RECENT_LIMIT,
      question,
      preferences: { ...assistant, sendFieldValues: privacy.sendFieldValues },
      ...(compact ? { compact } : {}),
    };
    // The system message holds the app's instructions only; the graph and catalog travel as marked data with the
    // person's message (an imported workflow's notes and values are someone else's text).
    const prompt = redact(buildSystemPrompt(promptInput));
    const turnData = redact(buildTurnData(promptInput));

    // History budget: 70 % of the model's context window (Preferences ▸ Assistant overrides it) minus the prompt.
    // With "auto" the window the server was seen to load the model with IS the window; a setting of the person's
    // stands unless the server loaded less (shared/agent/contextWindow.ts effectiveContextWindow, also the page's).
    const window = effectiveContextWindow(options.model ?? mainLLMService.nextSendConfig().model, assistant.contextTokens, loadedWindow);
    const charsPerToken = (llm.charsPerToken ?? (() => 4)).call(llm);
    // In a small window the tool descriptions are a large share of the request; count them against the history.
    const toolChars = compact ? compact.offered.length * TOOL_CHARS : 0;
    const trimmed = trimHistory(whole, historyBudgetTokens(window.tokens, prompt.length + turnData.length + toolChars, charsPerToken), charsPerToken);
    const messages = withTurnData(trimmed.messages, turnData);
    const system = trimmed.omitted > 0 ? `${prompt}\n\n${omittedHistoryText(trimmed.omitted)}` : prompt;
    if (trimmed.omitted > 0) turnLog(`[Agent] ${trimmed.omitted} earlier messages left out (window ${window.tokens} tokens, ${window.source})`);

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

    // The page reader opens only addresses the person wrote in this conversation or a web search returned.
    const links = conversationLinks(run.projectId);
    for (const message of whole) if (message.role === 'user') links.add(linksInText(message.content));
    const mainTools = createAgentTools({
      db,
      links,
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
      signal,
    });
    const tools: Record<string, unknown> = { ...mainTools };
    if (buildAllowed) {
      const buildTools = createBuildTools(specs(options.toolSpecs), {
        db,
        run,
        onProjection: (next) => send({ type: 'projection', content: next }),
        onRevision: (next) => { revision = next; },
        onBuildStep: (step) => send({ type: 'build-step', content: step }),
        saveWhy: (database, input) => knowledge.saveExplanation(database, input),
        toolContext,
        signal,
        onStorageFailure: (error) => {
          storageFailure = error;
          stopper.abort();
        },
      });
      // Main tools first; a renderer spec replaces one only when it is a build tool.
      for (const [name, definition] of Object.entries(buildTools)) {
        if (BUILD.has(name) || !(name in tools)) tools[name] = definition;
      }
    }

    if (compact) {
      const keep = new Set<string>(compact.offered);
      for (const name of Object.keys(tools)) if (!keep.has(name)) delete tools[name];
    }

    turnLog(`[Agent] Turn with ${messages.length} messages, ${Object.keys(tools).length} tools, intent=${context.intent}${compact ? `, compact for a ${compact.window}-token window` : ''}`);
    for await (const chunk of llm.streamChatWithTools([{ role: 'system', content: system }, ...messages], tools as Record<string, any>, {
      maxSteps: assistant.maxStepsPerTurn,
      allowWebSearch: assistant.allowWebSearch,
      allowFetchPage: assistant.allowFetchPage,
      abortSignal: signal,
      compact: compact !== null,
      onSource: (url) => links.add([url]),
      // The top of this turn's record in the model conversation log.
      trace: {
        intent: context.intent,
        language: context.language,
        runId: run.runId,
        projectId: run.projectId,
        app: options.appVersion,
        omittedMessages: trimmed.omitted,
        contextTokens: window.tokens,
        contextSource: window.source,
      },
    })) {
      if (signal.aborted) break;
      if (chunk.type === 'turn-paused') {
        // A checkpoint, not an end: the run stays paused so Continue (resume) carries on with the same run.
        pauseIfRunning(db, run);
        checkpoint = true;
      }
      send(chunk);
    }
    // What the server showed during this turn is kept, so the first turn after a restart already fits.
    const seen = llm.localContextTokens?.() ?? null;
    if (seen !== null && seen !== loadedWindow && runtime?.provider === 'local') writeStoredWindow(db, runtime.baseURL, runtime.model, seen);
  } catch (error) {
    if (storageFailure) {
      // Reported below.
    } else if (options.signal?.aborted) {
      turnLog('[Agent] Turn cancelled');
    } else {
      const message = errorMessage(error, redact);
      if (turnLinesAllowed()) console.error('[Agent] LLM stream error:', message);
      terminal = { type: 'error', content: { message, ...classifyTurnError(error, redact) } };
    }
  } finally {
    outer?.removeEventListener('abort', onOuterAbort);
    if (storageFailure) terminal = { type: 'error', content: { message: storageFailure, kind: 'storage', details: storageFailure } };
    const closed = closeIfRunning(db, run, checkpoint);
    if (closed) send({ type: 'projection', content: closed });
    send(terminal);
  }
}
