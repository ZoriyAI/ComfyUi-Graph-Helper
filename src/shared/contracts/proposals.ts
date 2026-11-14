import type { GraphMutation } from '../commands/types';

export type ProposalKind = 'add-node' | 'connect' | 'set-parameter' | 'create-subgraph' | 'insert-subgraph' | 'remove-node' | 'remove-edge' | 'annotate-node' | 'set-component' | 'set-process';
/** Every ProposalKind, for validation. A proposal's kind equals its payload's mutation type. */
export const PROPOSAL_KINDS: readonly ProposalKind[] = ['add-node', 'connect', 'set-parameter', 'create-subgraph', 'insert-subgraph', 'remove-node', 'remove-edge', 'annotate-node', 'set-component', 'set-process'];
export type ProposalStatus = 'proposed' | 'accepted' | 'rejected' | 'superseded';

/** A ghost: something the helper suggests. It touches the graph only when a person accepts it. */
export interface Proposal {
  id: string;
  projectId: string;
  runId: string | null;
  kind: ProposalKind;
  status: ProposalStatus;
  payload: GraphMutation;
  /** Short reason shown next to the ghost. Data, not instructions. */
  note: string;
  /** Revision the proposal was made against. */
  revisionId: string;
  createdAt: number;
  resolvedAt: number | null;
}

export type ProposalInput = Pick<Proposal, 'projectId' | 'runId' | 'kind' | 'payload' | 'note' | 'revisionId'>;

export interface ResolveProposalRequest {
  projectId: string;
  proposalId: string;
  decision: 'accept' | 'reject';
  /** Accepting an add-node ghost: the free spot the canvas showed it at (flow coordinates), so it lands there. */
  at?: { x: number; y: number };
}

export interface ProposalResolution {
  proposal: Proposal;
  /** Present when the decision was accept: the command outcome. */
  command: import('../commands/types').CommandResponse | null;
}

/** A proposal produced from an agent tool call; the caller adds projectId, runId and revisionId. */
export type ProposalDraft = Pick<Proposal, 'kind' | 'payload' | 'note'>;
