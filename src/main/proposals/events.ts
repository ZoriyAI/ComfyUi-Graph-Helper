import type { Proposal } from '../../shared/contracts/proposals';

/**
 * Change notification for proposals. The IPC layer sets the callback (engineIpc.ts) so this module,
 * and the repository that calls it, stay free of Electron imports and run in unit tests.
 */
export type ProposalsNotifier = (projectId: string, open: Proposal[]) => void;

let notifier: ProposalsNotifier | null = null;

export function setProposalsNotifier(next: ProposalsNotifier | null): void {
  notifier = next;
}

export function proposalsChanged(projectId: string, open: Proposal[]): void {
  if (!notifier) return;
  try {
    notifier(projectId, open);
  } catch {
    // A failed push must never undo or fail the write that caused it.
  }
}
