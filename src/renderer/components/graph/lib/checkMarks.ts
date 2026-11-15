/**
 * Marks of the Check tab's findings on the canvas: which nodes a finding is about, how many findings each has and
 * how serious the worst one is. Used by the check mark layer (layers/CheckMarkLayer.tsx, mounted by CanvasFlow), so
 * a person sees on the graph itself where the problems are, not only in the list. Pure, so the mapping is tested
 * without React.
 */
import type { GraphCheckReport } from '../../../../shared/contracts';
import { findingNodeIds, findingsOf, type CheckProblemType } from '../../check/checkModel';

/** "error": the graph will not run (a node or model is missing, a link joins wrong types). "warn": it may run badly or stop at a field. */
export type CheckMarkLevel = 'error' | 'warn';

/** What one node carries: the number of findings about it and the worst of them. */
export interface CheckMark {
  count: number;
  level: CheckMarkLevel;
}

/** Finding types that stop the graph from running; every other finding is a warning. */
const ERROR_TYPES: ReadonlySet<CheckProblemType> = new Set(['missingNodes', 'missingModels', 'typeMismatches', 'unknownNodeTypes']);

/**
 * One mark per node a finding names. A link with wrong types marks both of its ends. Advice about a description is
 * not a problem and leaves no mark; a class that is unknown everywhere has no node of its own to mark.
 */
export function checkMarks(report: GraphCheckReport | null | undefined): Map<string, CheckMark> {
  const marks = new Map<string, CheckMark>();
  if (!report) return marks;
  for (const finding of findingsOf(report)) {
    if (finding.type === 'promptNotes') continue;
    const level: CheckMarkLevel = ERROR_TYPES.has(finding.type as CheckProblemType) ? 'error' : 'warn';
    // The other node of a family mismatch is named for the sentence; the mark belongs to the node the finding is on.
    const values = { ...finding.values, otherNodeId: '' };
    for (const nodeId of findingNodeIds(values)) {
      const mark = marks.get(nodeId);
      marks.set(nodeId, { count: (mark?.count ?? 0) + 1, level: mark?.level === 'error' || level === 'error' ? 'error' : 'warn' });
    }
  }
  return marks;
}
