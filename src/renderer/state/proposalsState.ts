import { create } from 'zustand';
import type { Proposal, ResolveProposalRequest } from '../../shared/contracts';
import { DESKTOP_PROJECT_ID } from '../../shared/project';
import { applyProjection } from '../services/commands/projection';

/**
 * Ghost proposals of the current project. The canvas draws `proposed` ones; the chat shows cards for them.
 * Owned by the Canvas workstream; the Chat workstream reads it and calls `resolve`.
 */
interface ProposalsState {
  proposals: Proposal[];
  /** Ids the person is resolving right now, so a card or ghost can show a pending state. */
  resolving: string[];
  setProposals: (proposals: Proposal[]) => void;
  load: (projectId?: string) => Promise<void>;
  resolve: (proposalId: string, decision: ResolveProposalRequest['decision'], projectId?: string) => Promise<void>;
}

export const useProposalsStore = create<ProposalsState>((set, get) => ({
  proposals: [],
  resolving: [],
  setProposals: (proposals) => set({ proposals }),
  load: async (projectId = DESKTOP_PROJECT_ID) => {
    const proposals = await window.electronAPI.listProposals(projectId);
    set({ proposals });
  },
  resolve: async (proposalId, decision, projectId = DESKTOP_PROJECT_ID) => {
    if (get().resolving.includes(proposalId)) return;
    set((state) => ({ resolving: [...state.resolving, proposalId] }));
    try {
      const result = await window.electronAPI.resolveProposal({ projectId, proposalId, decision });
      if (result.command?.projection) applyProjection(result.command.projection);
      set((state) => ({
        proposals: state.proposals.map((item) => (item.id === result.proposal.id ? result.proposal : item)),
      }));
    } finally {
      set((state) => ({ resolving: state.resolving.filter((id) => id !== proposalId) }));
    }
  },
}));

/** Open proposals only: what the canvas draws as ghosts. */
export function openProposals(proposals: Proposal[]): Proposal[] {
  return proposals.filter((item) => item.status === 'proposed');
}

let subscribed = false;

/** Loads the list once and keeps it current from main-process pushes. Safe to call more than once. */
export function startProposalsSubscription(projectId = DESKTOP_PROJECT_ID): void {
  if (subscribed) return;
  subscribed = true;
  void useProposalsStore.getState().load(projectId).catch(() => undefined);
  // The push carries open proposals only; re-read everything so cards of resolved proposals keep their final status.
  window.electronAPI.onProposalsEvent(() => {
    void useProposalsStore.getState().load(projectId).catch(() => undefined);
  });
}
