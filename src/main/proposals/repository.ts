import type Database from 'better-sqlite3';
import type { Proposal, ProposalInput, ProposalResolution, ResolveProposalRequest } from '../../shared/contracts/proposals';

/**
 * Proposal (ghost) repository contract. The Engine workstream implements these against SQLite (migration v9).
 * Accepting a proposal commits its payload through commitCommand with actor 'manual' and actionId `proposal-<id>`.
 */
export function createProposal(_db: Database.Database, _input: ProposalInput): Proposal {
  throw new Error('proposals: createProposal is not implemented yet');
}

export function listProposals(_db: Database.Database, _projectId: string, _status?: Proposal['status']): Proposal[] {
  throw new Error('proposals: listProposals is not implemented yet');
}

export function resolveProposal(_db: Database.Database, _request: ResolveProposalRequest): ProposalResolution {
  throw new Error('proposals: resolveProposal is not implemented yet');
}
