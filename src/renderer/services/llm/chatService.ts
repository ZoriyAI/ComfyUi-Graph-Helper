/**
 * The chat's engine in the window: sends a turn to main, reads its stream and keeps the chat, canvas and knowledge
 * stores current.
 *
 * Who uses it: components/chat (ChatDock, Message), components/shell/StatusBar.tsx,
 * components/graph/layers/LiveBuildStrip.tsx, components/journey/ComfyErrorDialog.tsx, App.tsx, and
 * commands/actions.ts and commands/buildGuard.ts (pause, resume, stop).
 */
import { useChatStore } from '../../state/chatState';
import { useGraphStore } from '../../state/graphState';
import { useKnowledgeStore } from '../../state/knowledgeState';
import { useProposalsStore } from '../../state/proposalsState';
import { useRevisionStore } from '../../state/revisionState';
import { useUiStore } from '../../state/uiState';
import { agentGraphContext } from '../../../shared/agent/context';
import { translateKnownError, type Translator } from '../../../shared/i18n';
import { providerErrorKey, TOOL_CAPABLE_EXAMPLES } from '../../../shared/agent/providerErrors';
import { parseTurnError } from '../../../shared/agent/turnError';
import { turnErrorText } from './turnErrorText';
import { BUILD_TOOL_SPECS } from '../../../shared/commands/toolSpecs';
import { CHAT_PAGE_SIZE, type AgentBuildStep, type AgentTurnContext, type Explanation } from '../../../shared/contracts';
import { useCanvasStore } from '../../components/graph/canvasStore';
import { stepKey } from '../../components/graph/lib/buildQueue';
import { DESKTOP_PROJECT_ID } from '../../../shared/project';
import type { Projection } from '../../../shared/commands/types';
import { parseTurnNotice, type ChatMessage, type ToolCall, type TurnCheckpoint, type TurnNotice } from '../../types/chat';
import { i18n } from '../../i18n';
import { applyProjection, useProjectionStore } from '../commands/projection';
import { showToast } from '../../ui/toastStore';
import { closeReplayForBuild } from '../../commands/replayGate';
import {
  asObjectRef,
  chatRecordFromMessage,
  isFailedTurn,
  isRecord,
  messageFromChatRecord,
  newToolCall,
  parseToolArgs,
  settleFromResult,
  turnLanguage,
  withResultIds,
} from './chatModel';

const translate: Translator = (key, options) => (options ? String(i18n.t(key, options)) : String(i18n.t(key)));

/**
 * Renderer chat service. Build tools commit in the main process; this service streams the turn,
 * keeps the chat store current, routes explain/proposal results to their stores, and persists messages.
 *
 * Stream protocol (main/agent/turn.ts): text-delta, tool-call, tool-result, tool-error, projection, build-step,
 * turn-paused, done, error. A turn-paused chunk ({ reason, steps, canContinue }) means the loop reached the step
 * checkpoint or the failed-tools guard: the run stays paused and the turn's message gets a Continue / Stop card.
 * A build-step (AgentBuildStep) follows the projection of a build tool commit: its `why` goes to the canvas
 * queue (the live build's callout) and its saved explanation straight into the knowledge store, so the node's
 * description card has it the moment the node appears.
 */

/** One chunk of the turn's stream, as main sends it. */
type StreamChunk = { type: string; content?: unknown };
/** How a tool call ended; kept until the matching tool-call chunk is seen, as the order may differ. */
type Settled = { status: 'success' | 'error'; result: unknown; error?: string };

function newId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** A local model that cannot call tools gets an explanation; other errors keep the catalog sentence or the raw text. */
function shownError(provider: string, raw: string): string {
  const key = providerErrorKey(provider, raw);
  if (key) return translate(key, { examples: TOOL_CAPABLE_EXAMPLES.join(', ') });
  return translateKnownError(translate, raw) ?? raw;
}

/** Readable text from whatever an error chunk or a thrown value carries. */
function errorText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (isRecord(content)) {
    const nested = content.error;
    if (isRecord(nested) && typeof nested.message === 'string') return nested.message;
    if (typeof content.message === 'string') return content.message;
  }
  try {
    return JSON.stringify(content) ?? 'Unknown error';
  } catch {
    return 'Unknown error';
  }
}

/** The context a plain composer send carries: intent chat, the canvas selection and camera, the interface language. */
export function defaultTurnContext(): AgentTurnContext {
  const viewport = useCanvasStore.getState().viewport;
  return {
    intent: 'chat',
    selection: useUiStore.getState().selection,
    language: turnLanguage(i18n.language || i18n.resolvedLanguage),
    ...(viewport ? { viewport } : {}),
  };
}

/** Whether an untrusted value has the shape of a saved explanation. */
function isExplanation(value: unknown): value is Explanation {
  return isRecord(value) && typeof value.id === 'string' && typeof value.text === 'string' && isRecord(value.owner)
    && typeof value.owner.kind === 'string' && typeof value.owner.id === 'string' && typeof value.aspect === 'string';
}

/** Reads a build-step chunk without trusting its shape; null when it is not one. */
export function parseBuildStep(content: unknown): AgentBuildStep | null {
  if (!isRecord(content) || typeof content.toolName !== 'string' || typeof content.why !== 'string') return null;
  const id = (value: unknown) => (typeof value === 'string' && value !== '' ? value : undefined);
  return {
    toolName: content.toolName as AgentBuildStep['toolName'],
    toolCallId: id(content.toolCallId) ?? '',
    nodeId: id(content.nodeId),
    edgeId: id(content.edgeId),
    subgraphId: id(content.subgraphId),
    key: id(content.key),
    why: content.why,
    explanationId: id(content.explanationId) ?? null,
    explanation: isExplanation(content.explanation) ? content.explanation : null,
    revisionId: id(content.revisionId) ?? '',
  };
}

/** Reads a turn-paused chunk without trusting its shape; null when it is not one. */
export function parseTurnPaused(content: unknown): Omit<TurnCheckpoint, 'state' | 'context'> | null {
  if (!isRecord(content)) return null;
  const reason = content.reason === 'step-limit' || content.reason === 'failure-streak' ? content.reason : null;
  if (!reason) return null;
  const steps = typeof content.steps === 'number' && Number.isFinite(content.steps) ? Math.max(0, Math.round(content.steps)) : 0;
  const failures = typeof content.failures === 'number' && Number.isFinite(content.failures) ? Math.round(content.failures) : undefined;
  return { reason, steps, ...(failures !== undefined ? { failures } : {}) };
}

/** Marks every open checkpoint card as moved past: a new turn supersedes its buttons. */
function closeOpenCheckpoints(state: 'closed' | 'stopped' = 'closed'): void {
  const { messages, updateMessage } = useChatStore.getState();
  for (const message of messages) {
    if (message.checkpoint?.state === 'open') updateMessage(message.id, { checkpoint: { ...message.checkpoint, state } });
  }
}

/** Hands one build step to the canvas queue and its saved explanation to the knowledge store. */
export function acceptBuildStep(content: unknown): void {
  const step = parseBuildStep(content);
  if (!step) return;
  // The helper builds on the main canvas: if a subgraph is open, the canvas goes back to the main level so the
  // person sees what is built, and a toast says why.
  if (useGraphStore.getState().activeSubgraphId) {
    useGraphStore.getState().exitSubgraph(0);
    showToast({ id: 'helper-on-main', tone: 'info', title: String(i18n.t('canvas.helperOnMain')), duration: 5000 });
  }
  if (step.explanation) useKnowledgeStore.getState().addExplanation(step.explanation);
  const key = stepKey(step);
  if (key) useCanvasStore.getState().noteBuildStep(key, { toolName: step.toolName, why: step.why });
  if (step.toolName === 'removeNode' && step.why) {
    const canvas = useCanvasStore.getState();
    canvas.setLive({ ...canvas.live, why: step.why });
  }
}

/** A full turn context: the given fields, the rest from defaultTurnContext. */
function completeContext(context?: Partial<AgentTurnContext>): AgentTurnContext {
  const base = defaultTurnContext();
  if (!context) return base;
  return {
    intent: context.intent ?? base.intent,
    selection: context.selection ?? base.selection,
    language: context.language ?? base.language,
    ...(context.objectRef ? { objectRef: context.objectRef } : {}),
    ...(context.viewport ?? base.viewport ? { viewport: context.viewport ?? base.viewport } : {}),
  };
}

/** The newest assistant message (the answer of the turn the person stops) gets the stopped mark. */
function markLastAnswerStopped(): void {
  const messages = useChatStore.getState().messages;
  const last = messages[messages.length - 1];
  if (last && last.role === 'assistant') useChatStore.getState().updateMessage(last.id, { stopped: true });
}

/** One per window (getChatService): the turn in flight, the run it builds in, and the loaded chat history. */
export class ChatService {
  private isStreaming = false;
  private currentBaseRevisionId: string | null = null;
  private currentRunId: string | null = null;
  private historyLoaded = false;
  /** Increments per turn and on cancel, so a finished or cancelled turn cannot flip the state of a newer one. */
  private turnToken = 0;
  /** A run reopened by resume(): the next turn continues it instead of starting a new run. */
  private resumed: { runId: string; expectedRevisionId: string } | null = null;

  /** Loads saved messages once per project when the chat is still empty. Safe to call more than once. */
  async loadHistory(projectId: string = DESKTOP_PROJECT_ID): Promise<void> {
    if (this.historyLoaded) return;
    this.historyLoaded = true;
    const load = window.electronAPI?.loadChatHistory;
    if (typeof load !== 'function') return;
    try {
      // The newest page only; older messages come when the person scrolls up (loadEarlier).
      const records = await load(projectId, { limit: CHAT_PAGE_SIZE });
      const state = useChatStore.getState();
      if (!Array.isArray(records) || records.length === 0 || state.messages.length > 0 || state.isStreaming) return;
      this.olderLeft = records.length >= CHAT_PAGE_SIZE;
      useChatStore.setState({ messages: records.map(messageFromChatRecord) });
    } catch (error) {
      console.warn('[ChatService] Chat history could not be loaded:', errorText(error));
    }
  }

  /** True while older stored messages may exist beyond those shown. */
  private olderLeft = false;
  private loadingEarlier = false;

  get hasEarlier(): boolean {
    return this.olderLeft;
  }

  /** Loads the page of messages before the oldest one shown; resolves to how many came. Nothing is deleted. */
  async loadEarlier(projectId: string = DESKTOP_PROJECT_ID): Promise<number> {
    const load = window.electronAPI?.loadChatHistory;
    const oldest = useChatStore.getState().messages[0];
    if (!this.olderLeft || this.loadingEarlier || !oldest || typeof load !== 'function') return 0;
    this.loadingEarlier = true;
    try {
      const records = await load(projectId, { limit: CHAT_PAGE_SIZE, beforeId: oldest.id });
      if (!Array.isArray(records)) return 0;
      this.olderLeft = records.length >= CHAT_PAGE_SIZE;
      const known = new Set(useChatStore.getState().messages.map((message) => message.id));
      const older = records.map(messageFromChatRecord).filter((message) => !known.has(message.id));
      if (older.length > 0) useChatStore.setState((state) => ({ messages: [...older, ...state.messages] }));
      return older.length;
    } catch (error) {
      console.warn('[ChatService] Earlier messages could not be loaded:', errorText(error));
      return 0;
    } finally {
      this.loadingEarlier = false;
    }
  }

  /** Saves one message to main's chat store; a refusal is logged, never shown. */
  private persist(message: ChatMessage | undefined): void {
    const save = window.electronAPI?.saveChatMessage;
    if (!message || typeof save !== 'function') return;
    const revision = useRevisionStore.getState().currentRevisionId;
    const record = chatRecordFromMessage(message, DESKTOP_PROJECT_ID, revision || null);
    void Promise.resolve()
      .then(() => save(record))
      .then((result) => {
        if (result && result.ok === false) console.warn('[ChatService] Message not stored:', (result as { error?: string }).error ?? 'refused');
      })
      .catch((error: unknown) => console.warn('[ChatService] Message not stored:', errorText(error)));
  }

  /**
   * Sends one turn. `context` defaults to intent chat with the current selection and language;
   * a partial context is completed from those defaults.
   */
  async sendMessage(content: string, context?: Partial<AgentTurnContext>): Promise<void> {
    if (this.isStreaming) {
      console.warn('[ChatService] Already streaming');
      return;
    }
    const turn = completeContext(context);
    // A build changes the real graph; History replay shows an old version read-only. The replay closes first, so
    // the person sees what the helper builds and nothing changes behind the replay.
    if (turn.intent === 'build') closeReplayForBuild();
    const token = ++this.turnToken;
    const current = () => token === this.turnToken;

    this.isStreaming = true;
    closeOpenCheckpoints();
    useChatStore.setState({ isStreaming: true, isPaused: false });
    const { messages, addMessage } = useChatStore.getState();

    const userMessage: ChatMessage = {
      id: newId(),
      role: 'user',
      content,
      timestamp: Date.now(),
      context: turn,
    };
    addMessage(userMessage);
    this.persist(userMessage);

    let assistantContent = '';
    let pausedAtCheckpoint = false;
    let currentAssistantMessageId: string | null = null;
    // The id of this turn's record in the conversation log; main sends it first when the log is kept.
    let turnLogId: string | undefined;
    let turnNotices: TurnNotice[] = [];
    const currentToolCalls = new Map<string, ToolCall>();
    const settledById = new Map<string, Settled>();
    const settledByName = new Map<string, Settled>();

    const currentAssistant = () => (currentAssistantMessageId
      ? useChatStore.getState().messages.find((m) => m.id === currentAssistantMessageId)
      : undefined);

    // The main process closes the run when the turn ends (a paused run stays paused for Resume) and sends the
    // projection; this only ends the streaming state, and only for the turn that is still current.
    const finish = () => {
      if (!current()) return;
      this.isStreaming = false;
      useChatStore.setState({ isStreaming: false });
    };

    let provider = '';
    try {
      // No provider means nothing can be sent. Say so in the chat instead of failing a stream.
      const getConfig = window.electronAPI?.llmGetConfig;
      const config = typeof getConfig === 'function' ? await getConfig().catch(() => null) : null;
      provider = config?.provider ?? '';
      if (config && !config.provider) {
        addMessage({ id: newId(), role: 'assistant', content: translate('chat.noProvider'), timestamp: Date.now() });
        finish();
        return;
      }
      let run: { runId: string; expectedRevisionId: string };
      if (this.resumed) {
        // Resume reopened the paused run: this turn continues it.
        run = this.resumed;
        this.resumed = null;
      } else {
        const started = await window.electronAPI.startRun(DESKTOP_PROJECT_ID);
        applyProjection(started.projection);
        this.currentBaseRevisionId = started.baseRevisionId;
        run = { runId: started.runId, expectedRevisionId: started.expectedRevisionId };
      }
      this.currentRunId = run.runId;
      if (!current()) return;

      const graph = useGraphStore.getState();
      const messageHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
        {
          role: 'system',
          content: agentGraphContext({ nodes: graph.nodes, components: graph.components, process: graph.process }),
        },
        ...messages
          // Earlier failed-turn messages are the app's words, not the model's; they are not sent back to it.
          .filter((m) => m.role !== 'system' && !(m.role === 'assistant' && isFailedTurn(m)))
          .map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content },
      ];

      // The turn's assistant message is made on the first thing to show, then updated in place.
      const publish = (patch: Partial<ChatMessage>) => {
        if (!currentAssistantMessageId) {
          currentAssistantMessageId = newId();
          addMessage({
            id: currentAssistantMessageId,
            role: 'assistant',
            content: assistantContent,
            timestamp: Date.now(),
            toolCalls: Array.from(currentToolCalls.values()),
            logId: turnLogId,
            ...patch,
          });
          return;
        }
        useChatStore.getState().updateMessage(currentAssistantMessageId, patch);
      };
      const publishToolCalls = () => publish({ content: assistantContent, toolCalls: Array.from(currentToolCalls.values()) });

      const afterSuccess = (call: ToolCall) => {
        if (call.status !== 'success') return;
        if (call.kind === 'knowledge' && call.toolName === 'explain') {
          const owner = asObjectRef(isRecord(call.result) ? call.result.owner : undefined) ?? asObjectRef(call.args.owner);
          if (owner) {
            void useKnowledgeStore.getState().loadExplanations(owner).catch(() => undefined);
            useUiStore.getState().setFocus(owner);
          }
        } else if (call.kind === 'proposal') {
          // proposals:event pushes the list; this read is the fallback when the push was missed.
          void Promise.resolve().then(() => useProposalsStore.getState().load()).catch(() => undefined);
        }
      };

      const applyRecord = (call: ToolCall, record: Settled): ToolCall => {
        const next = withResultIds({ ...call, status: record.status, result: record.result, error: record.error });
        if (call.status === 'pending') afterSuccess(next);
        return next;
      };

      // A result may come before its tool-call chunk, or with a different id: match by id, then by name, else keep
      // it until the call is seen.
      const settleTool = (id: string | undefined, name: string | undefined, record: Settled) => {
        if (id) settledById.set(id, record);
        const byId = id ? currentToolCalls.get(id) : undefined;
        if (byId && id) {
          currentToolCalls.set(id, applyRecord(byId, record));
          publishToolCalls();
          return;
        }
        const pending = name
          ? Array.from(currentToolCalls.values()).find((call) => call.name === name && call.status === 'pending')
          : undefined;
        if (pending) {
          const next = applyRecord(pending, record);
          if (id && pending.id !== id) {
            currentToolCalls.delete(pending.id);
            next.id = id;
          }
          currentToolCalls.set(next.id, next);
          publishToolCalls();
          return;
        }
        if (name) settledByName.set(name, record);
      };

      const noteToolCall = (id: string, name: string, args: Record<string, unknown>) => {
        const prior = settledById.get(id) ?? (name ? settledByName.get(name) : undefined);
        if (name && prior && settledByName.get(name) === prior) settledByName.delete(name);
        const call = newToolCall(id, name, args);
        currentToolCalls.set(id, prior ? applyRecord(call, prior) : call);
        publishToolCalls();
      };

      const onChunk = (chunk: StreamChunk) => {
        // A projection is the graph's truth whichever turn sent it; anything else from a cancelled turn is dropped.
        if (chunk.type !== 'projection' && !current()) return;
        const body = isRecord(chunk.content) ? chunk.content : {};
        if (chunk.type === 'projection') {
          applyProjection(chunk.content as Projection);
        } else if (chunk.type === 'trace') {
          if (typeof body.id === 'string' && body.id !== '') turnLogId = body.id;
        } else if (chunk.type === 'notice') {
          const notice = parseTurnNotice(chunk.content);
          if (notice) {
            turnNotices = [...turnNotices, notice];
            publish({ notices: turnNotices });
          }
        } else if (chunk.type === 'build-step') {
          acceptBuildStep(chunk.content);
        } else if (chunk.type === 'turn-paused') {
          const paused = parseTurnPaused(chunk.content);
          if (paused) {
            pausedAtCheckpoint = true;
            publish({ checkpoint: { ...paused, context: turn, state: 'open' } });
          }
        } else if (chunk.type === 'text-delta' && typeof body.text === 'string' && body.text) {
          assistantContent += body.text;
          publish({ content: assistantContent });
        } else if (chunk.type === 'tool-call') {
          const id = typeof body.toolCallId === 'string' ? body.toolCallId : `tool-${Date.now()}`;
          const name = typeof body.toolName === 'string' ? body.toolName : 'tool';
          noteToolCall(id, name, parseToolArgs(body.input ?? body.args));
        } else if (chunk.type === 'tool-result' || chunk.type === 'tool-error') {
          // AI SDK fullStream puts the execute() return value on `output`. Older fixtures used `result`.
          const output = body.output !== undefined ? body.output : body.result;
          const id = typeof body.toolCallId === 'string' ? body.toolCallId : undefined;
          const name = typeof body.toolName === 'string' ? body.toolName : undefined;
          if (chunk.type === 'tool-error') {
            const source = output ?? body.error;
            const message = isRecord(source)
              ? (typeof source.message === 'string' ? source.message : typeof source.error === 'string' ? source.error : 'Tool failed')
              : typeof source === 'string' ? source : 'Tool failed';
            // Raw SDK errors (NoSuchToolError and friends) read as a stack of tool names; show the catalog sentence.
            settleTool(id, name, { status: 'error', result: output, error: translateKnownError(translate, message) ?? message });
          } else if (output !== undefined) {
            const settled = settleFromResult(output);
            settleTool(id, name, { status: settled.status, result: output, error: settled.error });
          }
        } else if (chunk.type === 'done') {
          finish();
          // The run is paused at the checkpoint, not closed: the status bar and the card say so.
          if (pausedAtCheckpoint && current()) useChatStore.setState({ isPaused: true });
          // 'done' is the last chunk of the turn; the invoke can settle before late chunks arrive, so save here too.
          this.persist(currentAssistant());
        } else if (chunk.type === 'error') {
          const errorMessage = errorText(chunk.content);
          const kind = parseTurnError(chunk.content);
          console.error('[ChatService] Error:', kind ? `${kind.kind}: ${kind.details}` : errorMessage);
          finish();
          // One plain sentence with the next step; the server's words stay in the log and in `details`.
          const shown = kind ? turnErrorText(kind, translate) : shownError(provider, errorMessage);
          const failure: ChatMessage = {
            id: newId(),
            role: 'assistant',
            content: `Error: ${shown}`,
            timestamp: Date.now(),
            logId: turnLogId,
            failed: true,
            ...(kind ? { turnError: { ...kind, question: content, context: turn } } : {}),
          };
          if (!currentAssistantMessageId) currentAssistantMessageId = failure.id;
          else this.persist(currentAssistant());
          addMessage(failure);
          this.persist(failure);
        }
      };

      await window.electronAPI.llmStreamChat(
        messageHistory,
        BUILD_TOOL_SPECS,
        onChunk,
        {
          projectId: DESKTOP_PROJECT_ID,
          runId: run.runId,
          expectedRevisionId: run.expectedRevisionId,
        },
        turn,
      );
    } catch (error) {
      const raw = error instanceof Error ? error.message : errorText(error);
      console.error('[ChatService] Stream error:', raw);
      const shown = shownError(provider, raw);
      if (!currentAssistantMessageId && current()) {
        currentAssistantMessageId = newId();
        addMessage({ id: currentAssistantMessageId, role: 'assistant', content: `Error: ${shown}`, timestamp: Date.now(), logId: turnLogId, failed: true });
      }
    } finally {
      finish();
      this.persist(currentAssistant());
    }
  }

  /**
   * Stops the turn: aborts the main-process stream (llm:cancel), then cancels the run so nothing else of
   * this turn is committed or proposed. The cancelled turn can no longer change the streaming state.
   */
  cancel(): void {
    // The answer the person stopped is marked: a build card says "Stopped" (chat.summaryStopped), not "Done".
    if (this.isStreaming) markLastAnswerStopped();
    this.turnToken += 1;
    this.isStreaming = false;
    this.resumed = null;
    useChatStore.setState({ isStreaming: false, isPaused: false });
    // A run ended from anywhere (the status bar, the chat's Stop) ends the pause it was waiting in: the card of
    // that pause says it stopped and no longer offers Continue on a run that is gone.
    closeOpenCheckpoints('stopped');
    const runId = this.currentRunId;
    const llmCancel = window.electronAPI?.llmCancel;
    const cancelRun = window.electronAPI?.cancelRun;
    void Promise.resolve()
      .then(() => (typeof llmCancel === 'function' ? llmCancel(runId ?? undefined) : undefined))
      .catch((error: unknown) => console.warn('[ChatService] Stream cancel failed:', errorText(error)))
      .then(() => (runId && typeof cancelRun === 'function' ? cancelRun(DESKTOP_PROJECT_ID, runId) : undefined))
      .then((result) => { if (result?.projection) applyProjection(result.projection); })
      .catch((error: unknown) => console.warn('[ChatService] Cancel failed:', errorText(error)));
  }

  /**
   * Stops the turn and the open run and resolves once main has cancelled it (Open, New and Import wait for this
   * before another graph takes the canvas).
   */
  async cancelAndWait(): Promise<void> {
    const runId = this.currentRunId ?? useProjectionStore.getState().activeRun?.runId ?? null;
    this.turnToken += 1;
    this.isStreaming = false;
    this.resumed = null;
    useChatStore.setState({ isStreaming: false, isPaused: false });
    try {
      await window.electronAPI?.llmCancel?.(runId ?? undefined);
    } catch (error) {
      console.warn('[ChatService] Stream cancel failed:', errorText(error));
    }
    try {
      const result = runId ? await window.electronAPI?.cancelRun?.(DESKTOP_PROJECT_ID, runId) : null;
      if (result?.projection) applyProjection(result.projection);
    } catch (error) {
      console.warn('[ChatService] Cancel failed:', errorText(error));
    }
  }

  /** Pauses the open run in main; the chat shows the paused state at once. */
  async pause(): Promise<void> {
    useChatStore.setState({ isPaused: true });
    if (this.currentRunId) {
      const result = await window.electronAPI.pauseRun(DESKTOP_PROJECT_ID, this.currentRunId);
      applyProjection(result.projection);
    }
  }

  /** Reopens the paused run (same run id); the next turn continues it instead of starting a new run. */
  async resume(): Promise<void> {
    const started = await window.electronAPI.resumeRun(DESKTOP_PROJECT_ID);
    this.currentRunId = started.runId;
    this.currentBaseRevisionId = started.baseRevisionId;
    // Mid-turn (the person paused a build and pressed Continue) the turn still running carries on with this run;
    // only a run paused at a checkpoint is handed to the next turn.
    this.resumed = this.isStreaming ? null : { runId: started.runId, expectedRevisionId: started.expectedRevisionId };
    applyProjection(started.projection);
    useChatStore.setState({ isPaused: false });
  }

  /**
   * Continue on a checkpoint card: reopens the paused run (resume) and sends "continue" with the paused turn's
   * context, so a long build carries on across checkpoints in the same run.
   */
  async continueFromCheckpoint(messageId: string): Promise<void> {
    const message = useChatStore.getState().messages.find((item) => item.id === messageId);
    const checkpoint = message?.checkpoint;
    if (!checkpoint || checkpoint.state !== 'open' || this.isStreaming) return;
    useChatStore.getState().updateMessage(messageId, { checkpoint: { ...checkpoint, state: 'continued' } });
    try {
      await this.resume();
    } catch (error) {
      console.warn('[ChatService] Resume failed; continuing in a new run:', errorText(error));
    }
    const word = translate('chat.continueMessage');
    await this.sendMessage(word && word !== 'chat.continueMessage' ? word : 'continue', checkpoint.context);
  }

  /** "Retry" (chat.retry) on a failed turn: the same question goes again, with the context it was asked in. */
  async retry(messageId: string): Promise<void> {
    const message = useChatStore.getState().messages.find((item) => item.id === messageId);
    const failure = message?.turnError;
    if (!failure || this.isStreaming) return;
    await this.sendMessage(failure.question, failure.context);
  }

  /** Stop on a checkpoint card: the paused run is cancelled; changes already applied stay. */
  stopAtCheckpoint(messageId: string): void {
    const message = useChatStore.getState().messages.find((item) => item.id === messageId);
    const checkpoint = message?.checkpoint;
    if (!checkpoint || checkpoint.state !== 'open') return;
    useChatStore.getState().updateMessage(messageId, { checkpoint: { ...checkpoint, state: 'stopped' } });
    this.cancel();
  }

  /** The revision the current run started from, for callers that show it. */
  get baseRevisionId(): string | null {
    return this.currentBaseRevisionId;
  }
}

let chatServiceInstance: ChatService | null = null;

/** The window's one ChatService, made on first use. */
export function getChatService(): ChatService {
  if (!chatServiceInstance) {
    chatServiceInstance = new ChatService();
  }
  return chatServiceInstance;
}
