import type { GraphCheckReport, ObjectRef } from '../../../shared/contracts';

/** Pure helpers for the Check panel: one row per finding, grouped by finding type in report order. */

export type CheckFindingType =
  | 'missingNodes'
  | 'missingModels'
  | 'typeMismatches'
  | 'baseModelMismatches'
  | 'unconnectedRequiredInputs'
  | 'unknownNodeTypes';

export const CHECK_FINDING_TYPES: readonly CheckFindingType[] = [
  'missingNodes',
  'missingModels',
  'typeMismatches',
  'baseModelMismatches',
  'unconnectedRequiredInputs',
  'unknownNodeTypes',
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

export function findingsOf(report: GraphCheckReport, resolvePort?: PortResolver): CheckFinding[] {
  const out: CheckFinding[] = [];
  const add = (type: CheckFindingType, key: string, values: Record<string, string>, ref: ObjectRef) => {
    out.push({ key: `${type}:${key}`, type, textKey: `check.${type}Item`, values, ref });
  };
  report.missingNodes.forEach((item) => add('missingNodes', item.nodeId, { ...item }, { kind: 'node', id: item.nodeId, classType: item.classType }));
  report.missingModels.forEach((item) => add('missingModels', `${item.nodeId}:${item.directory}/${item.name}`, { ...item }, { kind: 'node', id: item.nodeId }));
  report.typeMismatches.forEach((item) => add('typeMismatches', item.edgeId, { ...item }, { kind: 'edge', id: item.edgeId }));
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
  return out;
}

export function groupCheckReport(report: GraphCheckReport, resolvePort?: PortResolver): CheckGroup[] {
  const findings = findingsOf(report, resolvePort);
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
    + report.unknownNodeTypes.length;
}
