/**
 * Ghost proposals of the current project: changes the assistant suggested instead of making them.
 *
 * Who uses it: the canvas draws the `proposed` ones (components/graph/layers/GhostLayer.tsx, GraphContextMenu,
 * CanvasToolbar), the chat shows cards for them and calls `resolve` (components/chat/ProposalCard.tsx);
 * GraphWorkspace.tsx starts the subscription; services/llm/chatService.ts and appCommands.ts read it.
 */
import { create } from 'zustand';
import type { Proposal, ResolveProposalRequest } from '../../shared/contracts';
import { DESKTOP_PROJECT_ID } from '../../shared/project';
import { applyProjection } from '../services/commands/projection';

interface ProposalsState {
  proposals: Proposal[];
  /** Ids the person is resolving right now, so a card or ghost can show a pending state. */
  resolving: string[];
  setProposals: (proposals: Proposal[]) => void;
  load: (projectId?: string) => Promise<void>;
  resolve: (proposalId: string, decision: ResolveProposalRequest['decision'], projectId?: string) => Promise<void>;
}

/**
 * Where the canvas drew the ghost of each suggested node or subgraph (flow coordinates, a spot that covers no
 * node). Accepting sends it, so the node lands exactly where the person saw the ghost, from the canvas chips, the
 * chat card or "accept all". GhostLayer.tsx fills it and drops spots of proposals that are no longer open.
 */
export const ghostSpots = new Map<string, { x: number; y: number }>();

/** All proposals of the project (any status) and the ids being resolved now. */
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
      const at = decision === 'accept' ? ghostSpots.get(proposalId) : undefined;
      const result = await window.electronAPI.resolveProposal({ projectId, proposalId, decision, ...(at ? { at } : {}) });
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

/** Whether the push listener is installed; it is installed once per window. */
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
