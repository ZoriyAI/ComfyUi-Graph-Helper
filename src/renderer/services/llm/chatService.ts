import { useChatStore } from '../../state/chatState';
import { useGraphStore } from '../../state/graphState';
import { useKnowledgeStore } from '../../state/knowledgeState';
import { useProposalsStore } from '../../state/proposalsState';
import { useRevisionStore } from '../../state/revisionState';
import { useUiStore } from '../../state/uiState';
import { agentGraphContext } from '../../../shared/agent/context';
import { translateKnownError, type Translator } from '../../../shared/i18n';
import { BUILD_TOOL_SPECS } from '../../../shared/commands/toolSpecs';
import type { AgentBuildStep, AgentTurnContext, Explanation } from '../../../shared/contracts';
import { useCanvasStore } from '../../components/graph/canvasStore';
import { stepKey } from '../../components/graph/lib/buildQueue';
import { DESKTOP_PROJECT_ID } from '../../../shared/project';
import type { Projection } from '../../../shared/commands/types';
import type { ChatMessage, ToolCall } from '../../types/chat';
import { i18n } from '../../i18n';
import { applyProjection } from '../commands/projection';
import {
  asObjectRef,
  chatRecordFromMessage,
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
 * Stream protocol (main/agent/turn.ts): text-delta, tool-call, tool-result, tool-error, projection, build-step, done, error.
 * A build-step (AgentBuildStep) follows the projection of a build tool commit: its `why` goes to the canvas
 * queue (the live build's callout) and its saved explanation straight into the knowledge store, so the node's
 * description card has it the moment the node appears.
 */

type StreamChunk = { type: string; content?: unknown };
type Settled = { status: 'success' | 'error'; result: unknown; error?: string };

function newId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

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

/** Hands one build step to the canvas queue and its saved explanation to the knowledge store. */
export function acceptBuildStep(content: unknown): void {
  const step = parseBuildStep(content);
  if (!step) return;
  if (step.explanation) useKnowledgeStore.getState().addExplanation(step.explanation);
  const key = stepKey(step);
  if (key) useCanvasStore.getState().noteBuildStep(key, { toolName: step.toolName, why: step.why });
  if (step.toolName === 'removeNode' && step.why) {
    const canvas = useCanvasStore.getState();
    canvas.setLive({ ...canvas.live, why: step.why });
  }
}

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

export class ChatService {
  private isStreaming = false;
  private currentBaseRevisionId: string | null = null;
  private currentRunId: string | null = null;
  private historyLoaded = false;

  /** Loads saved messages once per project when the chat is still empty. Safe to call more than once. */
  async loadHistory(projectId: string = DESKTOP_PROJECT_ID): Promise<void> {
    if (this.historyLoaded) return;
    this.historyLoaded = true;
    const load = window.electronAPI?.loadChatHistory;
    if (typeof load !== 'function') return;
    try {
      const records = await load(projectId);
      const state = useChatStore.getState();
      if (!Array.isArray(records) || records.length === 0 || state.messages.length > 0 || state.isStreaming) return;
      useChatStore.setState({ messages: records.map(messageFromChatRecord) });
    } catch (error) {
      console.warn('[ChatService] Chat history could not be loaded:', errorText(error));
    }
  }

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

    this.isStreaming = true;
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
    let currentAssistantMessageId: string | null = null;
    const currentToolCalls = new Map<string, ToolCall>();
    const settledById = new Map<string, Settled>();
    const settledByName = new Map<string, Settled>();

    const currentAssistant = () => (currentAssistantMessageId
      ? useChatStore.getState().messages.find((m) => m.id === currentAssistantMessageId)
      : undefined);

    let activeRunId: string | null = null;
    const finish = () => {
      this.isStreaming = false;
      useChatStore.setState({ isStreaming: false });
      // The turn is over: close the run so later commits are refused and the run strip goes quiet.
      const runId = activeRunId;
      activeRunId = null;
      const close = window.electronAPI?.closeRun;
      if (runId && typeof close === 'function') {
        void close(DESKTOP_PROJECT_ID, runId)
          .then((result) => { if (result?.projection) applyProjection(result.projection); })
          .catch(() => undefined);
      }
    };

    try {
      // No provider means nothing can be sent. Say so in the chat instead of failing a stream.
      const getConfig = window.electronAPI?.llmGetConfig;
      const config = typeof getConfig === 'function' ? await getConfig().catch(() => null) : null;
      if (config && !config.provider) {
        addMessage({ id: newId(), role: 'assistant', content: translate('chat.noProvider'), timestamp: Date.now() });
        finish();
        return;
      }
      const started = await window.electronAPI.startRun(DESKTOP_PROJECT_ID);
      activeRunId = started.runId;
      applyProjection(started.projection);
      this.currentBaseRevisionId = started.baseRevisionId;
      this.currentRunId = started.runId;

      const graph = useGraphStore.getState();
      const messageHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
        {
          role: 'system',
          content: agentGraphContext({ nodes: graph.nodes, components: graph.components, process: graph.process }),
        },
        ...messages
          .filter((m) => m.role !== 'system' && !(m.role === 'assistant' && m.content.startsWith('Error')))
          .map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content },
      ];

      const publish = (patch: Partial<ChatMessage>) => {
        if (!currentAssistantMessageId) {
          currentAssistantMessageId = newId();
          addMessage({
            id: currentAssistantMessageId,
            role: 'assistant',
            content: assistantContent,
            timestamp: Date.now(),
            toolCalls: Array.from(currentToolCalls.values()),
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
        const body = isRecord(chunk.content) ? chunk.content : {};
        if (chunk.type === 'projection') {
          applyProjection(chunk.content as Projection);
        } else if (chunk.type === 'build-step') {
          acceptBuildStep(chunk.content);
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
            settleTool(id, name, { status: 'error', result: output, error: message });
          } else if (output !== undefined) {
            const settled = settleFromResult(output);
            settleTool(id, name, { status: settled.status, result: output, error: settled.error });
          }
        } else if (chunk.type === 'done') {
          finish();
          // 'done' is the last chunk of the turn; the invoke can settle before late chunks arrive, so save here too.
          this.persist(currentAssistant());
        } else if (chunk.type === 'error') {
          const errorMessage = errorText(chunk.content);
          console.error('[ChatService] Error:', errorMessage);
          finish();
          if (!currentAssistantMessageId) {
            const shown = translateKnownError(translate, errorMessage) ?? errorMessage;
            currentAssistantMessageId = newId();
            addMessage({ id: currentAssistantMessageId, role: 'assistant', content: `Error: ${shown}`, timestamp: Date.now() });
          }
          this.persist(currentAssistant());
        }
      };

      await window.electronAPI.llmStreamChat(
        messageHistory,
        BUILD_TOOL_SPECS,
        onChunk,
        {
          projectId: DESKTOP_PROJECT_ID,
          runId: started.runId,
          expectedRevisionId: started.expectedRevisionId,
        },
        turn,
      );
    } catch (error) {
      const raw = error instanceof Error ? error.message : errorText(error);
      console.error('[ChatService] Stream error:', raw);
      const shown = translateKnownError(translate, raw) ?? raw;
      if (!currentAssistantMessageId) {
        currentAssistantMessageId = newId();
        addMessage({ id: currentAssistantMessageId, role: 'assistant', content: `Error: ${shown}`, timestamp: Date.now() });
      }
    } finally {
      finish();
      this.persist(currentAssistant());
    }
  }

  /** Stops showing the stream and cancels the run, so later build tools of this turn are refused. */
  cancel(): void {
    this.isStreaming = false;
    useChatStore.setState({ isStreaming: false, isPaused: false });
    const runId = this.currentRunId;
    const cancelRun = window.electronAPI?.cancelRun;
    if (runId && typeof cancelRun === 'function') {
      void Promise.resolve()
        .then(() => cancelRun(DESKTOP_PROJECT_ID, runId))
        .then((result) => applyProjection(result?.projection))
        .catch((error: unknown) => console.warn('[ChatService] Cancel failed:', errorText(error)));
    }
  }

  async pause(): Promise<void> {
    useChatStore.setState({ isPaused: true });
    if (this.currentRunId) {
      const result = await window.electronAPI.pauseRun(DESKTOP_PROJECT_ID, this.currentRunId);
      applyProjection(result.projection);
    }
  }

  async resume(): Promise<void> {
    const started = await window.electronAPI.resumeRun(DESKTOP_PROJECT_ID);
    this.currentRunId = started.runId;
    this.currentBaseRevisionId = started.baseRevisionId;
    applyProjection(started.projection);
    useChatStore.setState({ isPaused: false });
  }

  /** The revision the current run started from, for callers that show it. */
  get baseRevisionId(): string | null {
    return this.currentBaseRevisionId;
  }
}

let chatServiceInstance: ChatService | null = null;

export function getChatService(): ChatService {
  if (!chatServiceInstance) {
    chatServiceInstance = new ChatService();
  }
  return chatServiceInstance;
}
