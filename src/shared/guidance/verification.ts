/** Checks scenario-specific evidence without treating an empty graph or an unread file as success. */
import type { GraphCheckReport, SyncStatus } from '../contracts/knowledge';
import type { GuideProblem } from './catalog';

export interface GuideVerification { state: 'clear' | 'attention' | 'unavailable' | 'observed'; count?: number }
/** Only the named static checks can pass. Image quality, runtime success and touch behaviour remain observed. */
export function verifyGuide(problem: GuideProblem, input: { graph?: GraphCheckReport; sync?: SyncStatus; nodes?: number }): GuideVerification {
  if (problem.verify.kind === 'observed') return { state: 'observed' };
  if (problem.verify.kind === 'sync') {
    const sync = input.sync;
    if (!sync || sync.state === 'never' || !sync.metadataReport) return { state: 'unavailable' };
    const count = sync.metadataReport.pending + sync.metadataReport.failed + sync.metadataReport.skipped;
    return sync.state === 'idle' && count === 0 ? { state: 'clear', count: 0 } : { state: 'attention', count };
  }
  if (!input.graph || !input.nodes) return { state: 'unavailable' };
  const report = input.graph as unknown as Record<string, unknown>;
  if (problem.verify.fields.some(key => !(key in report))) return { state: 'unavailable' };
  const count = problem.verify.fields.reduce((total, key) => total + (Array.isArray(report[key]) ? report[key].length : report[key] ? 1 : 0), 0);
  return { state: count ? 'attention' : 'clear', count };
}
