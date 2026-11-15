import type { GraphCheckReport, ObjectRef, PromptNote } from '../../../shared/contracts';
import { nodeDisplayName } from '../graph/lib/nodeName';

/** Pure helpers for the Check panel: one row per finding, grouped by finding type in report order. */

/** What stops a graph from running as it is. */
export type CheckProblemType =
  | 'missingNodes'
  | 'missingModels'
  | 'typeMismatches'
  | 'baseModelMismatches'
  | 'unconnectedRequiredInputs'
  | 'unknownNodeTypes'
  | 'unsetWidgets'
  | 'cycles'
  | 'brokenEdges'
  | 'invalidParameters'
  | 'noOutputNode'
  | 'valuesOutOfRange'
  | 'valuesNotInList';


/** A problem, or advice about a description (a prompt): shown apart from the problems and never counted as one. */
export type CheckFindingType = CheckProblemType | 'promptNotes';

export const CHECK_FINDING_TYPES: readonly CheckProblemType[] = [
  'missingNodes',
  'missingModels',
  'typeMismatches',
  'baseModelMismatches',
  'unconnectedRequiredInputs',
  'unknownNodeTypes',
  'unsetWidgets',
  'cycles',
  'brokenEdges',
  'invalidParameters',
  'noOutputNode',
  'valuesOutOfRange',
  'valuesNotInList',
];

export interface CheckFinding {
  key: string;
  type: CheckFindingType;
  /** i18n key of the sentence, `check.<type>Item`. */
  textKey: string;
  values: Record<string, string>;
  /** What the row focuses on the canvas. */
  ref: ObjectRef;
}

export interface CheckGroup {
  type: CheckProblemType;
  /** i18n key of the group title, `check.<type>`. */
  titleKey: string;
  findings: CheckFinding[];
}

/** Finds the React Flow handle of a named input; the check report names inputs, the canvas knows handles. */
export type PortResolver = (nodeId: string, inputName: string, subgraphId?: string) => string | undefined;

/** The name a person sees for a node id (its title, else its type); undefined when the graph has no such node. */
export type NodeNamer = (nodeId: string, subgraphId?: string) => string | undefined;

/** The parts of the graph store a namer needs. */
interface NamedNode { id: string; data: { title?: string; comfyType?: string } }

export function nodeNamer(nodes: ReadonlyArray<NamedNode>, definitions: ReadonlyArray<{ id: string; nodes: Array<Record<string, any>> }> = []): NodeNamer {
  return (nodeId, subgraphId) => {
    const level = subgraphId ? definitions.find((item) => item.id === subgraphId)?.nodes ?? [] : nodes;
    const node = (level as ReadonlyArray<NamedNode>).find((item) => item.id === nodeId);
    return node ? nodeDisplayName(node.data) || undefined : undefined;
  };
}

/**
 * Puts names where the sentence says who: `node` for `nodeId`, `source` and `target` for `sourceId` and
 * `targetId`. A node the graph does not know falls back to its type, then to its id. The ids stay in the values
 * for the row's tooltip.
 */
export function nameFindingValues(values: Record<string, string>, nameOf?: NodeNamer): Record<string, string> {
  const out = { ...values };
  const name = (id: string, fallback?: string) => nameOf?.(id) ?? fallback ?? id;
  if (values.nodeId) out.node = name(values.nodeId, values.classType);
  if (values.sourceId) out.source = name(values.sourceId);
  if (values.targetId) out.target = name(values.targetId);
  return out;
}

/** The node ids a finding is about, for the "Node number …" tooltip. */
export function findingNodeIds(values: Record<string, string>): string[] {
  return [...new Set([values.nodeId, values.otherNodeId, values.sourceId, values.targetId].filter((id): id is string => Boolean(id)))];
}

export function findingsOf(report: GraphCheckReport, resolvePort?: PortResolver, nameOf?: NodeNamer): CheckFinding[] {
  const scopes = new Set<string | undefined>([undefined]);
  for (const value of Object.values(report)) if (Array.isArray(value)) for (const item of value) {
    if (item && typeof item === 'object' && 'subgraphId' in item) scopes.add(item.subgraphId);
  }
  return [...scopes].flatMap((scope) => {
    const local = Object.fromEntries(Object.entries(report).map(([key, value]) => [key,
      Array.isArray(value) ? value.filter((item) => (item && typeof item === 'object' ? item.subgraphId : undefined) === scope)
        : key === 'noOutputNode' && scope ? null : value,
    ])) as unknown as GraphCheckReport;
    return localFindings(local, (id, input) => resolvePort?.(id, input, scope), (id) => nameOf?.(id, scope)).map((finding) => scope
      ? { ...finding, key: `${scope}:${finding.key}`, ref: { ...finding.ref, subgraphId: scope } } : finding);
  });
}
function localFindings(report: GraphCheckReport, resolvePort?: PortResolver, nameOf?: NodeNamer): CheckFinding[] {
  const out: CheckFinding[] = [];
  const add = (type: CheckProblemType, key: string, values: Record<string, string>, ref: ObjectRef, textKey?: string) => {
    out.push({ key: `${type}:${key}`, type, textKey: textKey ?? `check.${type}Item`, values: nameFindingValues(values, nameOf), ref });
  };
  report.missingNodes.forEach((item) => add('missingNodes', item.nodeId, { ...item }, { kind: 'node', id: item.nodeId, classType: item.classType }));
  report.missingModels.forEach((item) => add('missingModels', `${item.nodeId}:${item.directory}/${item.name}`, { ...item }, { kind: 'node', id: item.nodeId }));
  report.typeMismatches.forEach((item) => add(
    'typeMismatches',
    item.edgeId,
    { edgeId: item.edgeId, sourceId: item.source, targetId: item.target, sourceType: item.sourceType, targetType: item.targetType },
    { kind: 'edge', id: item.edgeId },
  ));
  report.baseModelMismatches.forEach((item) => add(
    'baseModelMismatches',
    `${item.nodeId}:${item.otherNodeId}`,
    { model: item.model, modelBase: item.modelBase, otherModel: item.otherModel, otherBase: item.otherBase, nodeId: item.nodeId, otherNodeId: item.otherNodeId },
    { kind: 'node', id: item.nodeId },
  ));
  report.unconnectedRequiredInputs.forEach((item) => {
    const handle = resolvePort?.(item.nodeId, item.input) ?? item.input;
    add('unconnectedRequiredInputs', `${item.nodeId}:${item.input}`, { ...item }, {
      kind: 'port',
      id: `${item.nodeId}:${handle}`,
      nodeId: item.nodeId,
      portName: handle,
      direction: 'input',
    });
  });
  report.unknownNodeTypes.forEach((classType) => add('unknownNodeTypes', classType, { classType }, { kind: 'nodeClass', id: classType, classType }));
  (report.unsetWidgets ?? []).forEach((item) => add('unsetWidgets', `${item.nodeId}:${item.name}`, { ...item }, { kind: 'node', id: item.nodeId, classType: item.classType }));
  (report.brokenEdges ?? []).forEach((item) => add(
    'brokenEdges',
    item.edgeId,
    { edgeId: item.edgeId, sourceId: item.source, targetId: item.target },
    { kind: 'edge', id: item.edgeId },
  ));
  (report.invalidParameters ?? []).forEach((item) => add(
    'invalidParameters',
    `${item.nodeId}:${item.name}:${item.reason}:${item.expected}`,
    { nodeId: item.nodeId, classType: item.classType, name: item.name, expected: item.expected, found: item.found },
    { kind: 'node', id: item.nodeId, classType: item.classType },
    `check.invalidParameterMessages.${item.reason}Item`,
  ));
  if (report.noOutputNode) add('noOutputNode', report.noOutputNode.nodeId, { nodeId: report.noOutputNode.nodeId }, { kind: 'node', id: report.noOutputNode.nodeId });
  (report.valuesOutOfRange ?? []).forEach((item) => {
    const limit = item.min !== undefined && item.value < item.min ? 'min' : 'max';
    const handle = resolvePort?.(item.nodeId, item.input);
    add('valuesOutOfRange', `${item.nodeId}:${item.input}`, {
      nodeId: item.nodeId,
      classType: item.classType,
      input: item.input,
      value: String(item.value),
      limit: String(limit === 'min' ? item.min : item.max),
      // The sentence differs for "too small" and "too large"; the key picks it.
      bound: limit,
    }, handle ? { kind: 'port', id: `${item.nodeId}:${handle}`, nodeId: item.nodeId, portName: handle, direction: 'input' } : { kind: 'node', id: item.nodeId, classType: item.classType });
  });
  (report.valuesNotInList ?? []).forEach((item) => {
    const handle = resolvePort?.(item.nodeId, item.input);
    add('valuesNotInList', `${item.nodeId}:${item.input}`, { ...item }, handle
      ? { kind: 'port', id: `${item.nodeId}:${handle}`, nodeId: item.nodeId, portName: handle, direction: 'input' }
      : { kind: 'node', id: item.nodeId, classType: item.classType });
  });
  (report.cycles ?? []).forEach((item) => {
    const names = item.nodeIds.map((id) => nameOf?.(id) ?? id);
    add('cycles', item.nodeIds.join(','), { nodeId: item.nodeIds[0] ?? '', nodes: names.join(', ') }, { kind: 'node', id: item.nodeIds[0] ?? '' });
  });
  for (const finding of out) {
    // Two sentences for one finding type: below the minimum, above the maximum.
    if (finding.type === 'valuesOutOfRange') finding.textKey = finding.values.bound === 'min' ? 'check.valuesBelowMinItem' : 'check.valuesAboveMaxItem';
  }
  return out;
}

export function groupCheckReport(report: GraphCheckReport, resolvePort?: PortResolver, nameOf?: NodeNamer): CheckGroup[] {
  const findings = findingsOf(report, resolvePort, nameOf);
  return CHECK_FINDING_TYPES.flatMap((type) => {
    const items = findings.filter((item) => item.type === type);
    return items.length > 0 ? [{ type, titleKey: `check.${type}`, findings: items }] : [];
  });
}

/** The sentence of each kind of advice about a description, `check.prompt.<name>`. */
const PROMPT_TEXT: Record<PromptNote['kind'], string> = {
  'lora-tag': 'loraTag',
  'foreign-syntax': 'foreignSyntax',
  unbalanced: 'unbalanced',
  'weight-high': 'weightHigh',
  'weight-ignored': 'weightIgnored',
  'negative-ignored': 'negativeIgnored',
  'empty-positive': 'emptyPositive',
  contradiction: 'contradiction',
  negation: 'negation',
  'not-english': 'notEnglish',
  'too-long': 'tooLongClip',
  'missing-trigger': 'missingTrigger',
};

/**
 * Advice about the descriptions in the graph, one row each. The graph saves and runs with these; they say where
 * the result will differ from what the person expects, and what to change.
 */
export function adviceOf(report: GraphCheckReport, nameOf?: NodeNamer): CheckFinding[] {
  return (report.promptNotes ?? []).map((note, index) => {
    const name = note.kind === 'too-long' && note.found === 't5' ? 'tooLongT5' : PROMPT_TEXT[note.kind];
    const values: Record<string, string> = { nodeId: note.nodeId, classType: note.classType, found: note.found };
    for (const [key, value] of Object.entries(note.numbers ?? {})) values[key] = String(Math.round(value * 100) / 100);
    if (note.model) values.model = note.model;
    if (note.words) values.words = note.words.join(', ');
    const named = nameFindingValues(values, nameOf);
    if (note.samplerId) named.sampler = nameOf?.(note.samplerId) ?? note.samplerId;
    return {
      key: `promptNotes:${index}:${note.kind}:${note.nodeId}`,
      type: 'promptNotes',
      textKey: `check.prompt.${name}`,
      values: named,
      ref: { kind: 'node', id: note.nodeId, classType: note.classType },
    };
  });
}

/** Number of findings; the AppBar shows it as the check badge. */
export function checkFindingCount(report: GraphCheckReport | null | undefined): number {
  if (!report) return 0;
  return report.missingNodes.length
    + report.missingModels.length
    + report.typeMismatches.length
    + report.baseModelMismatches.length
    + report.unconnectedRequiredInputs.length
    + report.unknownNodeTypes.length
    + (report.unsetWidgets ?? []).length
    + (report.noOutputNode ? 1 : 0)
    + (report.valuesOutOfRange ?? []).length
    + (report.valuesNotInList ?? []).length
    + (report.cycles ?? []).length
    + (report.brokenEdges ?? []).length
    + (report.invalidParameters ?? []).length;
}
