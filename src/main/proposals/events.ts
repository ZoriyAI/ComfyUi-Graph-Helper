/**
 * Change notification for proposals (the dashed "ghost" changes the assistant suggests on the canvas). The IPC
 * layer sets the callback (engineIpc.ts, which broadcasts the open list to every window) so this module, and the
 * repository and supersede code that call it, stay free of Electron imports and run in unit tests.
 */
import type { Proposal } from '../../shared/contracts/proposals';

/** Receives the full list of a project's open proposals after any change to them. */
export type ProposalsNotifier = (projectId: string, open: Proposal[]) => void;

let notifier: ProposalsNotifier | null = null;

/** Sets (or with null, clears) the one listener; engineIpc.ts sets it when the IPC handlers are registered. */
export function setProposalsNotifier(next: ProposalsNotifier | null): void {
  notifier = next;
}

/** Tells the listener, if any, that the open proposals of a project changed. Never throws. */
export function proposalsChanged(projectId: string, open: Proposal[]): void {
  if (!notifier) return;
  try {
    notifier(projectId, open);
  } catch {
    // A failed push must never undo or fail the write that caused it.
  }
}
