/**
 * Turns the tool calls of one assistant message into what the chat shows: build step sentences, quiet phrases,
 * step errors, the build's progress against the canvas reveal queue, and the closing summary. Used by Message.tsx,
 * BuildCard.tsx, BuildSummary.tsx, QuietGroup.tsx, ToolCard.tsx and stepNames.ts; tests/unit/buildSteps.test.ts
 * pins the wording. Pure functions, so the tests need no React.
 */
import { redactDiagnostic, translateKnownError } from '../../../shared/i18n';
import type { ToolCall } from '../../types/chat';
import { INTERRUPTED_ERROR, isRecord } from '../../services/llm/chatModel';
import { stepKey as queueStepKey } from '../graph/lib/buildQueue';

/**
 * Pure helpers that turn the tool calls of one assistant message into what the chat shows: one build card with a
 * sentence per step, one quiet row group for what the helper only looked at, and the build's summary.
 * Sentences are made from the structured arguments and result, never from the English `message` the model reads.
 */

/** The i18next `t` narrowed to a string result, so these helpers stay free of React. */
export type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Names the chat can look up on the current canvas and in the catalog. Every lookup may come back empty. */
export interface StepNames {
  /** The node's name on the canvas now (title, catalog display name, class). */
  node: (id: string) => string | undefined;
  /** A class's display name from the catalog. */
  nodeClass?: (classType: string) => string | undefined;
  /** A port's name by its handle. */
  port?: (nodeId: string, handle: string, direction: 'input' | 'output') => string | undefined;
  /** A subgraph definition's name. */
  subgraph?: (id: string) => string | undefined;
}

/** One block of a message's tool calls, in the order the first call of each block came. */
export type ToolSegment =
  | { type: 'build'; calls: ToolCall[] }
  | { type: 'quiet'; calls: ToolCall[] }
  | { type: 'card'; call: ToolCall };

/**
 * Groups a message's calls: every graph change into one build card, every read (graph, catalog, models, web)
 * into one quiet group, and explanations, suggestions and unknown tools as their own cards. A read between two
 * build steps does not split the build, so the step count stays one count.
 */
export function groupToolCalls(calls: readonly ToolCall[]): ToolSegment[] {
  const segments: ToolSegment[] = [];
  let build: ToolCall[] | null = null;
  let quiet: ToolCall[] | null = null;
  for (const call of calls) {
    if (call.kind === 'build') {
      if (!build) {
        build = [];
        segments.push({ type: 'build', calls: build });
      }
      build.push(call);
    } else if (call.kind === 'read') {
      if (!quiet) {
        quiet = [];
        segments.push({ type: 'quiet', calls: quiet });
      }
      quiet.push(call);
    } else {
      segments.push({ type: 'card', call });
    }
  }
  return segments;
}

/** A trimmed string or a finite number as text; anything else (and an empty string) is undefined. */
function text(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

/** One text field of a tool's arguments or result, when the record has it. */
function field(record: unknown, key: string): string | undefined {
  return isRecord(record) ? text(record[key]) : undefined;
}

/** Longest name and field value a step sentence shows before it clips with an ellipsis. */
const NAME_CAP = 60;
const VALUE_CAP = 40;

/** Text from a tool call shown in a sentence: one line, clipped, and never a secret-looking value. */
function clean(value: string, cap = NAME_CAP): string {
  const line = redactDiagnostic(value.replace(/\s+/g, ' ').trim());
  return line.length > cap ? `${line.slice(0, cap - 1)}…` : line;
}

/** A field value as the sentence shows it (the sentence puts text values in the language's quotes). */
export function valueText(value: unknown): string {
  if (typeof value === 'string') return clean(value, VALUE_CAP);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null || value === undefined) return '—';
  try {
    return clean(JSON.stringify(value) ?? '—', VALUE_CAP);
  } catch {
    return '…';
  }
}

/** A node's name for a sentence: the name it had when the step ran, then the canvas, then the class. */
function nodeName(id: string | undefined, names: StepNames, t: Translate, fallback?: { title?: string; classType?: string; at?: string }): string {
  // The name the node had when the step ran comes first: a card never renames itself after a restart or a new
  // project. Older cards without it read the canvas as before.
  const onCanvas = fallback?.at ?? (id ? names.node(id) : undefined);
  const title = onCanvas ?? fallback?.title ?? (fallback?.classType ? names.nodeClass?.(fallback.classType) ?? fallback.classType : undefined);
  return title ? clean(title) : t('chat.step.unknownNode');
}

/** "Load Checkpoint · MODEL": a node and one of its ports. */
function end(nodeId: string | undefined, port: string | undefined, names: StepNames, t: Translate, at?: string): string {
  const node = nodeName(nodeId, names, t, at ? { at } : undefined);
  return port ? `${node} · ${clean(port, 40)}` : node;
}

/** The port a connect call named: the name main resolved, then the canvas handle's name, then what was passed. */
function portName(call: ToolCall, side: 'source' | 'target', nodeId: string | undefined, names: StepNames): string | undefined {
  const resolved = field(call.result, side === 'source' ? 'sourcePort' : 'targetPort');
  if (resolved) return resolved;
  const handle = field(call.args, side === 'source' ? 'sourceHandle' : 'targetHandle');
  const index = call.args[side === 'source' ? 'sourceOutputIndex' : 'targetInputIndex'];
  const asHandle = handle ?? (typeof index === 'number' ? `${side === 'source' ? 'out' : 'in'}-${index}` : undefined);
  if (!asHandle) return undefined;
  const named = nodeId ? names.port?.(nodeId, asHandle, side === 'source' ? 'output' : 'input') : undefined;
  if (named) return named;
  // A raw handle such as "out-0" says nothing to a person; a name the model passed does.
  return /^(in|out)-\d+$/.test(asHandle) ? undefined : asHandle;
}

/** Both ends of a connect call, each as "node · port". Ids come from the result first (main resolved them). */
function linkEnds(call: ToolCall, names: StepNames, t: Translate): { from: string; to: string } {
  const sourceId = field(call.result, 'sourceNodeId') ?? field(call.args, 'sourceNodeId') ?? field(call.args, 'source');
  const targetId = field(call.result, 'targetNodeId') ?? field(call.args, 'targetNodeId') ?? field(call.args, 'target');
  return {
    from: end(sourceId, portName(call, 'source', sourceId, names), names, t, field(call.result, 'sourceTitle')),
    to: end(targetId, portName(call, 'target', targetId, names), names, t, field(call.result, 'targetTitle')),
  };
}

/** A subgraph's name from the call's arguments, else from the canvas definitions. */
function subgraphName(call: ToolCall, names: StepNames, t: Translate): string {
  const id = field(call.result, 'definitionId') ?? field(call.args, 'definitionId');
  const name = field(call.args, 'name') ?? field(call.args, 'title') ?? (id ? names.subgraph?.(id) : undefined);
  return name ? clean(name) : t('chat.step.unknownSubgraph');
}

/** The values one step sentence needs, shared by its success and failure wording. */
function stepValues(call: ToolCall, names: StepNames, t: Translate): Record<string, unknown> {
  switch (call.toolName) {
    case 'addNode':
      return {
        name: nodeName(field(call.result, 'nodeId'), names, t, {
          title: field(call.args, 'title'),
          classType: field(call.result, 'nodeType') ?? field(call.args, 'nodeType'),
          at: field(call.result, 'nodeTitle'),
        }),
      };
    case 'connectNodes':
      return linkEnds(call, names, t);
    case 'setParameter':
      return {
        key: clean(field(call.args, 'key') ?? '—', 40),
        value: valueText(call.args.value),
        text: typeof call.args.value === 'string',
        node: nodeName(field(call.args, 'nodeId'), names, t, { at: field(call.result, 'nodeTitle') }),
      };
    case 'removeNode':
      return {
        name: nodeName(field(call.args, 'nodeId'), names, t, {
          title: field(call.result, 'removedTitle'),
          classType: field(call.result, 'removedType'),
          at: field(call.result, 'removedTitle') ?? field(call.result, 'nodeTitle'),
        }),
      };
    case 'createSubgraph':
      return { name: subgraphName(call, names, t), count: Array.isArray(call.args.nodeIds) ? call.args.nodeIds.length : 0 };
    case 'insertSubgraph':
      return { name: subgraphName(call, names, t) };
    case 'annotateNode':
      return { name: nodeName(field(call.args, 'nodeId'), names, t, { at: field(call.result, 'nodeTitle') }) };
    case 'setComponentDocumentation': {
      const ownerId = field(call.args, 'ownerId');
      const subgraph = field(call.args, 'ownerKind') === 'subgraph';
      const name = subgraph ? (ownerId ? names.subgraph?.(ownerId) : undefined) : undefined;
      return { name: subgraph ? clean(name ?? t('chat.step.unknownSubgraph')) : nodeName(ownerId, names, t, { at: field(call.result, 'nodeTitle') }), subgraph };
    }
    case 'setProcess':
      return { title: clean(field(call.args, 'title') ?? '—') };
    default:
      return {};
  }
}

/** The catalog keys of each build tool's sentence, for a step that worked and one that failed. */
const SENTENCE_KEYS: Record<string, { ok: string; failed: string }> = {
  addNode: { ok: 'chat.step.addNode', failed: 'chat.stepFailed.addNode' },
  connectNodes: { ok: 'chat.step.connectNodes', failed: 'chat.stepFailed.connectNodes' },
  setParameter: { ok: 'chat.step.setParameter', failed: 'chat.stepFailed.setParameter' },
  removeNode: { ok: 'chat.step.removeNode', failed: 'chat.stepFailed.removeNode' },
  createSubgraph: { ok: 'chat.step.createSubgraph', failed: 'chat.stepFailed.createSubgraph' },
  insertSubgraph: { ok: 'chat.step.insertSubgraph', failed: 'chat.stepFailed.insertSubgraph' },
  annotateNode: { ok: 'chat.step.annotateNode', failed: 'chat.stepFailed.annotateNode' },
  setComponentDocumentation: { ok: 'chat.step.documentNode', failed: 'chat.stepFailed.documentNode' },
  setProcess: { ok: 'chat.step.setProcess', failed: 'chat.stepFailed.setProcess' },
};

/** The catalog keys of a step that was left as a grey draft instead of applied. */
const DRAFT_KEYS: Record<string, string> = {
  connectNodes: 'chat.stepDraft.connectNodes',
  setParameter: 'chat.stepDraft.setParameter',
  removeNode: 'chat.stepDraft.removeNode',
  createSubgraph: 'chat.stepDraft.createSubgraph',
  annotateNode: 'chat.stepDraft.annotateNode',
  setComponentDocumentation: 'chat.stepDraft.documentNode',
  setProcess: 'chat.stepDraft.setProcess',
};

/** True when a build step was not applied but left as a grey draft (it would change what the person made). */
export function isDraftStep(call: ToolCall): boolean {
  return call.status === 'success' && isRecord(call.result) && call.result.drafted === true;
}

/**
 * One build step as a sentence: "Added the node Load Checkpoint", "Link: Load Checkpoint · MODEL → KSampler · model",
 * "Field steps = 20 on KSampler". A failed step says what it tried: "Could not add the node …".
 */
export function stepSentence(call: ToolCall, t: Translate, names: StepNames): string {
  const keys = SENTENCE_KEYS[call.toolName];
  const values = stepValues(call, names, t);
  if (isDraftStep(call)) return t(DRAFT_KEYS[call.toolName] ?? 'chat.stepDraft.other', values);
  if (!keys) return t(call.status === 'error' ? 'chat.stepFailed.other' : 'chat.step.other');
  if (call.toolName === 'setParameter' && values.text && call.status !== 'error') return t('chat.step.setParameterText', values);
  if (call.toolName === 'setComponentDocumentation' && values.subgraph && call.status !== 'error') {
    return t('chat.step.documentSubgraph', values);
  }
  return t(call.status === 'error' ? keys.failed : keys.ok, values);
}

/** Why the step was made, as the helper wrote it; empty when it gave none or it looks like a secret. */
export function stepWhy(call: ToolCall): string {
  const why = field(call.result, 'why') ?? field(call.args, 'why');
  if (!why) return '';
  const line = why.replace(/\s+/g, ' ').trim();
  return redactDiagnostic(line);
}

/**
 * A failed step's error in plain words, plus the app's own text when no plain wording fits (redacted). An unknown
 * node class names the similar installed ones; a conflict says the graph moved first.
 */
export function stepError(call: ToolCall, t: Translate): { summary: string; detail: string | null } | null {
  if (call.status !== 'error') return null;
  if (call.error === INTERRUPTED_ERROR) return { summary: t('chat.interrupted'), detail: null };
  const error = call.error ?? '';
  const suggestions = isRecord(call.result) && Array.isArray(call.result.suggestions)
    ? call.result.suggestions.filter((item): item is string => typeof item === 'string' && item !== '').slice(0, 5)
    : [];
  if (suggestions.length > 0) return { summary: t('chat.stepError.unknownClassLike', { names: suggestions.map((item) => clean(item)) }), detail: null };
  if (/^Unknown node class/.test(error)) return { summary: t('chat.stepError.unknownClass'), detail: null };
  if (isRecord(call.result) && call.result.conflict === true) return { summary: t('chat.stepError.conflict'), detail: null };
  const known = error ? translateKnownError(t, error) : null;
  if (known) return { summary: known, detail: null };
  return { summary: t('chat.stepError.other'), detail: error ? redactDiagnostic(error).slice(0, 300) : null };
}

/** The canvas key of a step (node id, edge id, `param:<node>:<key>`), to match it with the live reveal queue. */
export function callStepKey(call: ToolCall): string | null {
  const toolName = call.toolName;
  if (!['addNode', 'connectNodes', 'setParameter', 'removeNode', 'createSubgraph', 'insertSubgraph'].includes(toolName)) return null;
  return queueStepKey({
    toolName: toolName as 'addNode',
    nodeId: field(call.result, 'nodeId') ?? field(call.args, 'nodeId'),
    edgeId: field(call.result, 'edgeId') ?? field(call.result, 'linkId'),
    key: field(call.args, 'key'),
  });
}

/**
 * Where the build card is: the step that is running now (a pending call, else the one the canvas shows, else the
 * last one while the turn is live) and the steps still waiting their turn on the canvas.
 */
export function buildProgress(
  calls: readonly ToolCall[],
  canvas: { shownKey: string | null; queuedKeys: ReadonlySet<string> },
  live: boolean,
): { running: number; waiting: Set<number> } {
  const waiting = new Set<number>();
  calls.forEach((call, index) => {
    const key = callStepKey(call);
    if (key && canvas.queuedKeys.has(key)) waiting.add(index);
  });
  const pending = calls.findIndex((call) => call.status === 'pending');
  if (pending >= 0) return { running: pending, waiting };
  if (!live && waiting.size === 0) return { running: -1, waiting };
  const shown = canvas.shownKey ? calls.findIndex((call) => callStepKey(call) === canvas.shownKey) : -1;
  if (shown >= 0) return { running: shown, waiting };
  // Nothing on screen yet: the step before the first waiting one, else the last.
  const firstWaiting = Math.min(...waiting);
  const running = Number.isFinite(firstWaiting) ? Math.max(0, firstWaiting - 1) : calls.length - 1;
  return { running, waiting };
}

/** What a build changed, for the summary under it. */
export interface BuildCounts {
  nodes: number;
  links: number;
  fields: number;
  removed: number;
  subgraphs: number;
  /** Notes and descriptions the build wrote on its own nodes. */
  notes: number;
  /** The build named the graph. */
  named: boolean;
  /** Changes to what the person made, left as grey drafts (not applied). */
  drafts: number;
}

/** Counts what the successful steps of a build made; drafts are counted apart, as they changed nothing yet. */
export function buildCounts(calls: readonly ToolCall[]): BuildCounts {
  const counts: BuildCounts = { nodes: 0, links: 0, fields: 0, removed: 0, subgraphs: 0, notes: 0, named: false, drafts: 0 };
  for (const call of calls) {
    if (call.status !== 'success') continue;
    if (isDraftStep(call)) {
      counts.drafts += 1;
      continue;
    }
    if (call.toolName === 'annotateNode' || call.toolName === 'setComponentDocumentation') counts.notes += 1;
    else if (call.toolName === 'setProcess') counts.named = true;
    if (call.toolName === 'addNode') counts.nodes += 1;
    else if (call.toolName === 'connectNodes') counts.links += 1;
    else if (call.toolName === 'setParameter') counts.fields += 1;
    else if (call.toolName === 'removeNode') counts.removed += 1;
    else if (call.toolName === 'createSubgraph' || call.toolName === 'insertSubgraph') counts.subgraphs += 1;
  }
  return counts;
}

/**
 * "Done: 7 nodes, 9 links." (chat.summaryDone, or chat.summaryStopped); null when the build changed nothing a
 * person can count.
 */
export function buildSummary(counts: BuildCounts, t: Translate, stopped = false): string | null {
  const parts: string[] = [];
  if (counts.nodes) parts.push(t('chat.summaryNodes', { count: counts.nodes }));
  if (counts.links) parts.push(t('chat.summaryLinks', { count: counts.links }));
  if (counts.subgraphs) parts.push(t('chat.summarySubgraphs', { count: counts.subgraphs }));
  if (counts.fields) parts.push(t('chat.summaryFields', { count: counts.fields }));
  if (counts.removed) parts.push(t('chat.summaryRemoved', { count: counts.removed }));
  if (counts.notes) parts.push(t('chat.summaryNotes', { count: counts.notes }));
  if (counts.named) parts.push(t('chat.summaryNamed'));
  if (counts.drafts) parts.push(t('chat.summaryDrafts', { count: counts.drafts }));
  if (parts.length === 0) return null;
  return t(stopped ? 'chat.summaryStopped' : 'chat.summaryDone', { parts });
}

/** The host of a link, never its path or query (where a token could sit). */
function hostOf(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.hostname : undefined;
  } catch {
    return undefined;
  }
}

/** One thing the helper looked at, as a lower-case phrase: "read the graph", "searched the node catalog for “lora”". */
export function quietSentence(call: ToolCall, t: Translate, names: Pick<StepNames, 'nodeClass'> = {}): string {
  const query = field(call.args, 'query');
  switch (call.toolName) {
    case 'getGraph':
      return t('chat.quiet.getGraph');
    case 'searchNodeTypes':
      return query ? t('chat.quiet.searchNodeTypes', { query: clean(query, 40) }) : t('chat.quiet.searchNodeTypesAll');
    case 'describeNodeType': {
      const classType = field(call.args, 'classType');
      return t('chat.quiet.describeNodeType', { name: clean(classType ? names.nodeClass?.(classType) ?? classType : '—') });
    }
    case 'findInstalledModels':
      return query ? t('chat.quiet.findInstalledModels', { query: clean(query, 40) }) : t('chat.quiet.findInstalledModelsAll');
    case 'describeModel':
      return t('chat.quiet.describeModel', { name: clean(field(call.args, 'name') ?? '—') });
    case 'checkGraph':
      return t('chat.quiet.checkGraph');
    case 'searchWeb':
      return t('chat.quiet.searchWeb', { query: clean(query ?? '—', 60) });
    case 'fetchPage': {
      const host = hostOf(field(call.args, 'url'));
      return host ? t('chat.quiet.fetchPage', { host }) : t('chat.quiet.fetchPageAny');
    }
    default:
      return t('chat.quiet.other');
  }
}
