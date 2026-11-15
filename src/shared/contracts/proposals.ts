/**
 * Proposals ("ghosts"): changes the helper suggests and the person accepts or rejects on the canvas. Main stores
 * them (main/proposals) and applies an accepted one as a graph command; the renderer draws them
 * (renderer/components/graph/layers/GhostLayer.tsx); commands/tools.ts makes them from the model's tool calls.
 */
import type { GraphMutation } from '../commands/types';

/** What a proposal does; equal to the `type` of its payload. */
export type ProposalKind = 'add-node' | 'connect' | 'set-parameter' | 'create-subgraph' | 'insert-subgraph' | 'remove-node' | 'remove-edge' | 'annotate-node' | 'set-component' | 'set-process';
/** Every ProposalKind, for validation. A proposal's kind equals its payload's mutation type. */
export const PROPOSAL_KINDS: readonly ProposalKind[] = ['add-node', 'connect', 'set-parameter', 'create-subgraph', 'insert-subgraph', 'remove-node', 'remove-edge', 'annotate-node', 'set-component', 'set-process'];
/** Open until accepted or rejected; superseded when a graph change removed what it refers to. */
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

/** What storing a new proposal needs; main fills in the id, status and times. */
export type ProposalInput = Pick<Proposal, 'projectId' | 'runId' | 'kind' | 'payload' | 'note' | 'revisionId'>;

/** The person's answer to one proposal, as the renderer sends it. */
export interface ResolveProposalRequest {
  projectId: string;
  proposalId: string;
  decision: 'accept' | 'reject';
  /** Accepting an add-node ghost: the free spot the canvas showed it at (flow coordinates), so it lands there. */
  at?: { x: number; y: number };
}

/** The proposal after the answer, and the graph command's result when it was accepted. */
export interface ProposalResolution {
  proposal: Proposal;
  /** Present when the decision was accept: the command outcome. */
  command: import('../commands/types').CommandResponse | null;
}

/** A proposal produced from an agent tool call; the caller adds projectId, runId and revisionId. */
export type ProposalDraft = Pick<Proposal, 'kind' | 'payload' | 'note'>;
