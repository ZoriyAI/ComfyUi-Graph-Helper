import type { GraphCheckReport } from '../../shared/contracts';
import { findingsOf } from '../components/check/checkModel';

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
