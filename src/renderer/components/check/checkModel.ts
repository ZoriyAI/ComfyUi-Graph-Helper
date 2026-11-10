import type { GraphCheckReport, ObjectRef } from '../../../shared/contracts';

/** Pure helpers for the Check panel: one row per finding, grouped by finding type in report order. */

export type CheckFindingType =
  | 'missingNodes'
  | 'missingModels'
  | 'typeMismatches'
  | 'baseModelMismatches'
  | 'unconnectedRequiredInputs'
  | 'unknownNodeTypes'
  | 'unsetWidgets';

export const CHECK_FINDING_TYPES: readonly CheckFindingType[] = [
  'missingNodes',
  'missingModels',
  'typeMismatches',
  'baseModelMismatches',
  'unconnectedRequiredInputs',
  'unknownNodeTypes',
  'unsetWidgets',
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
  type: CheckFindingType;
  /** i18n key of the group title, `check.<type>`. */
  titleKey: string;
  findings: CheckFinding[];
}

/** Finds the React Flow handle of a named input; the check report names inputs, the canvas knows handles. */
export type PortResolver = (nodeId: string, inputName: string) => string | undefined;

/** The name a person sees for a node id (its title, else its type); undefined when the graph has no such node. */
export type NodeNamer = (nodeId: string) => string | undefined;

/** The parts of the graph store a namer needs. */
interface NamedNode { id: string; data: { title?: string; comfyType?: string } }

export function nodeNamer(nodes: ReadonlyArray<NamedNode>): NodeNamer {
  return (nodeId) => {
    const node = nodes.find((item) => item.id === nodeId);
    return node ? node.data.title || node.data.comfyType || undefined : undefined;
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
  const out: CheckFinding[] = [];
  const add = (type: CheckFindingType, key: string, values: Record<string, string>, ref: ObjectRef) => {
    out.push({ key: `${type}:${key}`, type, textKey: `check.${type}Item`, values: nameFindingValues(values, nameOf), ref });
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
  return out;
}

export function groupCheckReport(report: GraphCheckReport, resolvePort?: PortResolver, nameOf?: NodeNamer): CheckGroup[] {
  const findings = findingsOf(report, resolvePort, nameOf);
  return CHECK_FINDING_TYPES.flatMap((type) => {
    const items = findings.filter((item) => item.type === type);
    return items.length > 0 ? [{ type, titleKey: `check.${type}`, findings: items }] : [];
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
    + (report.unsetWidgets ?? []).length;
}
