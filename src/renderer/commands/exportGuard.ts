/**
 * The list of problems the export guard shows before File ▸ Export writes a workflow.
 *
 * Who uses it: commands/actions.ts (exportWorkflowFile counts the findings to decide whether to ask) and
 * components/shell/CommandDialogs.tsx (the guard dialog lists them).
 * Why one function: the count that opens the dialog and the rows it shows must come from the same list.
 */
import type { GraphCheckReport } from '../../shared/contracts';
import { findingsOf } from '../components/check/checkModel';

/** One row of the guard: a stable key, the i18n key of its text and the values that fill it. */
export interface GuardFinding {
  key: string;
  textKey: string;
  values: Record<string, string>;
}

/**
 * Every finding the export guard lists: the Check panel's rows, plus widgets with no value when the report
 * carries them and the panel does not list them yet.
 */
export function exportGuardFindings(report: GraphCheckReport | null | undefined): GuardFinding[] {
  if (!report) return [];
  const rows: GuardFinding[] = findingsOf(report).map((finding) => ({ key: finding.key, textKey: finding.textKey, values: finding.values }));
  const listed = rows.some((row) => row.key.startsWith('unsetWidgets:'));
  if (!listed) {
    for (const item of report.unsetWidgets ?? []) {
      rows.push({ key: `unsetWidgets:${item.nodeId}:${item.name}`, textKey: 'check.unsetWidgetsItem', values: { ...item } });
    }
  }
  return rows;
}
