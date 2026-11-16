/**
 * One assistant turn from start to end, in main: reads the graph, the catalog and the preferences, builds the
 * system message and the data block, picks the tools (fewer in a small context window), streams the model's answer
 * to the renderer and closes or pauses the run. ipc/agentIpc.ts runs it for every llm:stream-chat request.
 * It lives in main because the renderer cannot see the catalog, the action log or the held keys.
 */
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
import { classifyTurnError, parseTurnError } from '../../shared/agent/turnError';
import { createAgentTools, widgetNamesOf, type KnowledgeApi, type ProposalApi } from './tools';
import type { FetchLike } from './web';
import { readPreferences } from '../settings/repository';
import { COMPACT_WINDOW } from '../llm/localContext';
import { readStoredWindow, writeStoredWindow } from '../llm/localContextStore';
import type { Preferences } from '../../shared/config/preferences';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

/** Everything one turn needs; the optional fields are test seams with the app's real objects as defaults. */
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
  /** The model service; the app's one by default, a fake in tests. */
  llm?: Pick<typeof mainLLMService, 'streamChatWithTools' | 'nativeSearchTool'>
    & Partial<Pick<typeof mainLLMService, 'redact' | 'charsPerToken' | 'localContextTokens' | 'rememberLocalContext' | 'nextSendConfig' | 'ensureLocalWindow' | 'listedContextTokens'>>;
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

/** The renderer's messages reduced to user and assistant text; its system messages are dropped (main writes its own). */
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

/** The renderer's build-tool specs, keeping only entries that have a name. */
function specs(input: unknown): RendererToolSpec[] {
  if (!Array.isArray(input)) return [];
  return input.filter((item): item is RendererToolSpec => !!item && typeof item === 'object' && typeof (item as RendererToolSpec).name === 'string');
}

/** Tool names a renderer spec may define even when main has a tool of that name. */
const BUILD = new Set<string>(AGENT_BUILD_TOOLS);
/** A recency window, not a cap on data: the prompt says when the list is the latest 30 only; the graph is complete. */
const RECENT_LIMIT = 30;

/** Build tools exist in a build turn only. Ask and chat turns read, explain and propose grey drafts. */
export function buildToolsAllowed(context: AgentTurnContext, _defaultIntent?: 'ask' | 'build'): boolean {
  // Ask never builds, whatever the setting: it answers and offers grey drafts, so its hint stays true. The
  // "When I ask for a change" setting picks the mode the composer opens in (Build when it is "build directly").
  return context.intent === 'build';
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
const COMPACT_READ = ['assessResources', 'getGraph', 'searchNodeTypes', 'describeNodeType', 'findInstalledModels', 'checkGraph'] as const;
const COMPACT_BUILD = [...COMPACT_READ, 'addNode', 'connectNodes', 'setParameter', 'removeNode'] as const;
const COMPACT_ASK = [...COMPACT_READ, 'describeModel', 'explain', 'proposeNode', 'proposeConnection', 'proposeParameter'] as const;
/** Roughly what one tool's name, description and schema take in the request, in characters. */
const TOOL_CHARS = 700;

/** The tools a compact turn offers: the build set in a build turn, the ask set otherwise. */
export function compactToolNames(buildAllowed: boolean, question = ''): readonly string[] {
  const names = new Set<string>(buildAllowed ? COMPACT_BUILD : COMPACT_ASK);
  if (/blueprint|template|шаблон|темплейт|блюпринт|визард|wizard/i.test(question)) {
    names.add('searchBlueprints'); names.add('inspectBlueprint');
    if (buildAllowed) names.add('insertBlueprint');
  }
  if (/subgraph|субграф|подграф/i.test(question)) {
    for (const name of (buildAllowed ? ['createSubgraph', 'configureSubgraph', 'insertSubgraph'] : ['proposeSubgraph'])) names.add(name);
  }
  // Exact tools requested by the person stay available; the regular permissions still filter execution below.
  for (const name of ['searchBlueprints', 'inspectBlueprint', 'describeModel', 'searchWeb', 'fetchPage']) {
    if (question.includes(name)) names.add(name);
  }
  return [...names];
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

/** What a model that cannot call tools is told when the turn is asked again without them. */
export const NO_TOOLS_LINE = 'This model cannot call tools, so none are offered now. Answer only from the data block: you cannot read more, look anything up, change the graph or save anything. If the person asked for a change, describe it in words and say in one short sentence that the change itself needs a model that can call tools.';

/** The share of the context window the data block may take: the rest is for the rules, the dialog and the answer. */
export const DATA_SHARE = 0.35;

/** Characters the data block may take in a window of `tokens`. */
export function dataBudgetChars(tokens: number, charsPerToken: number): number {
  // A floor: even a tiny window gets 2000 characters of data rather than none.
  return Math.max(2000, Math.floor(tokens * DATA_SHARE * charsPerToken));
}

/**
 * The turn's data within its budget: the whole graph when it fits, else the short plan, else the plan of fewer
 * nodes (the focus nodes always stay) with a line that getGraph has the rest.
 */
export function fitTurnData(
  input: Parameters<typeof buildTurnData>[0],
  projection: Projection | null,
  options: { selectedIds: string[]; priority: string[]; omitValues: boolean; widgetNames: (classType: string) => readonly string[] | null; budgetChars: number },
): string {
  let data = buildTurnData(input);
  if (data.length <= options.budgetChars || !projection) return data;
  const planned = { ...input, graphPlan: true };
  data = buildTurnData(planned);
  // Halve the number of nodes in the plan until it fits; below 10 nodes the plan says too little, so it stops there.
  for (let limit = Math.max(10, Math.floor((input.graph?.totalNodes ?? 0) / 2)); data.length > options.budgetChars && limit >= 10; limit = Math.floor(limit / 2)) {
    const graph = summarizeGraph(projection.snapshot, { selectedIds: options.selectedIds, priorityIds: options.priority, omitValues: options.omitValues, widgetNames: options.widgetNames, limit });
    data = buildTurnData({ ...planned, graph });
  }
  return data;
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
  let runEnded = false;
  // The caller's signal (cancel, window closed) feeds the turn's own stopper, which the turn can also fire itself.
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
    // Provider detail: the window before the first question (Ollama loads the model to say it), so the first turn fits.
    if (loadedWindow === null && runtime?.provider === 'local') loadedWindow = await (llm.ensureLocalWindow?.() ?? Promise.resolve(null));
    const buildAllowed = buildToolsAllowed(context, assistant.defaultIntent);
    // A small window, or the person's own server before its window was seen: the turn starts in the short mode,
    // so the first question already fits (a later turn knows the window and may use the full one).
    const unknownLocal = loadedWindow === null && runtime?.provider === 'local';
    const small = (loadedWindow !== null && loadedWindow < COMPACT_WINDOW) || unknownLocal;
    // The page reader stays when the person's own message holds a link: they asked for that page.
    const personLink = assistant.allowFetchPage !== false && linksInText(question).length > 0;
    const compact = small ? { offered: [...compactToolNames(buildAllowed, question), ...(personLink ? ['fetchPage'] : [])], window: loadedWindow ?? 0 } : null;
    let catalogView: CatalogView | null = null;
    try {
      catalogView = readCatalog(db);
    } catch {
      catalogView = null;
    }
    const widgetNames = widgetNamesOf(catalogView ?? undefined);

    const recent = readRecent(db, run.projectId);
    const selectedIds = context.selection.filter((ref) => ref.kind === 'node').map((ref) => ref.id);
    const promptInput = {
      context,
      graph: projection ? summarizeGraph(projection.snapshot, { selectedIds, priorityIds: priorityIds(context, recent), omitValues: !privacy.sendFieldValues, widgetNames }) : null,
      catalog: catalogSummaryText(db, knowledge, question),
      recent,
      recentWindow: RECENT_LIMIT,
      question,
      // Ask never builds: the default intent setting only picks the mode the composer opens in.
      preferences: { ...assistant, defaultIntent: buildAllowed ? 'build' as const : 'ask' as const, sendFieldValues: privacy.sendFieldValues },
      ...(compact ? { compact, graphPlan: true } : {}),
    };
    // The system message holds the app's instructions only; the graph and catalog travel as marked data with the
    // person's message (an imported workflow's notes and values are someone else's text).
    const prompt = redact(buildSystemPrompt(promptInput));
    // The one context window of this turn, for both the data budget here and the history budget below (70 % of it
    // minus the prompt and data); the model's listed window counts, Preferences ▸ Assistant overrides it. With "auto"
    // the window the server was seen to load the model with IS the window; a setting of the person's stands unless
    // the server loaded less (shared/agent/contextWindow.ts effectiveContextWindow, also the page's).
    const window = effectiveContextWindow(options.model ?? mainLLMService.nextSendConfig().model, assistant.contextTokens, loadedWindow, llm.listedContextTokens?.() ?? null);
    const charsPerTokenNow = (llm.charsPerToken ?? (() => 4)).call(llm);
    const turnData = redact(fitTurnData(promptInput, projection, {
      selectedIds,
      priority: priorityIds(context, recent),
      omitValues: !privacy.sendFieldValues,
      widgetNames,
      // A local window not known yet is taken as half the compact size, so the first turn surely fits.
      budgetChars: dataBudgetChars(unknownLocal ? COMPACT_WINDOW / 2 : window.tokens, charsPerTokenNow),
    }));

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

    // The page reader opens only addresses the person wrote in this conversation or the app's own web search
    // returned. Sources cited by a provider's built-in search are not added: outside text can steer that search to
    // cite any address, a query string full of the person's data included.
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
        onRunEnded: () => {
          runEnded = true;
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
    const streamOptions = {
      maxSteps: assistant.maxStepsPerTurn,
      allowWebSearch: assistant.allowWebSearch,
      allowFetchPage: assistant.allowFetchPage,
      abortSignal: signal,
      compact: compact !== null,
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
    };
    // A model that cannot call tools refuses the request: the turn is asked again without tools, with the graph in
    // the data block, and the chat says truthfully that the answer came without them.
    let toolsRefused = false;
    const offered = Object.keys(tools).length > 0;
    /** Streams one model request to the renderer; `refusable` swallows a "no tools" refusal so the turn can retry. */
    const run1 = async (toolSet: Record<string, unknown>, systemText: string, refusable: boolean) => {
      for await (const chunk of llm.streamChatWithTools([{ role: 'system', content: systemText }, ...messages], toolSet as Record<string, any>, streamOptions)) {
        if (signal.aborted) break;
        if (refusable && chunk.type === 'error' && parseTurnError(chunk.content)?.kind === 'no-tools') {
          toolsRefused = true;
          continue;
        }
        if (chunk.type === 'turn-paused') {
          // A checkpoint, not an end: the run stays paused so Continue (resume) carries on with the same run.
          pauseIfRunning(db, run);
          checkpoint = true;
        }
        send(chunk);
      }
    };
    try {
      await run1(tools, system, offered);
    } catch (error) {
      if (!offered || classifyTurnError(error, redact).kind !== 'no-tools') throw error;
      toolsRefused = true;
    }
    if (toolsRefused && !signal.aborted) {
      turnLog('[Agent] The model cannot call tools; asking again without them');
      send({ type: 'notice', content: { code: 'no-tools', model: runtime?.model ?? '' } });
      await run1({}, `${system}\n\n${NO_TOOLS_LINE}`, false);
    }
    // What the server showed during this turn is kept, so the first turn after a restart already fits.
    const seen = llm.localContextTokens?.() ?? null;
    if (seen !== null && seen !== loadedWindow && runtime?.provider === 'local') writeStoredWindow(db, runtime.baseURL, runtime.model, seen);
  } catch (error) {
    if (storageFailure) {
      // Reported below.
    } else if (options.signal?.aborted || runEnded) {
      turnLog('[Agent] Turn cancelled');
    } else {
      const message = errorMessage(error, redact);
      if (turnLinesAllowed()) console.error('[Agent] LLM stream error:', message);
      terminal = { type: 'error', content: { message, ...classifyTurnError(error, redact) } };
    }
  } finally {
    outer?.removeEventListener('abort', onOuterAbort);
    if (storageFailure) terminal = { type: 'error', content: { message: storageFailure, kind: 'storage', details: storageFailure } };
    // Always the same ending: close (or keep paused) the run, send the final projection, then done or error.
    const closed = closeIfRunning(db, run, checkpoint);
    if (closed) send({ type: 'projection', content: closed });
    send(terminal);
  }
}
