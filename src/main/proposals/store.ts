import type Database from 'better-sqlite3';
import type { Proposal, ProposalKind, ProposalStatus } from '../../shared/contracts/proposals';
import type { GraphMutation } from '../../shared/commands/types';

interface ProposalRow {
  id: string;
  project_id: string;
  run_id: string | null;
  kind: string;
  status: string;
  payload: string;
  note: string;
  revision_id: string;
  created_at: number;
  resolved_at: number | null;
}

export function rowToProposal(row: ProposalRow): Proposal {
  return {
    id: row.id,
    projectId: row.project_id,
    runId: row.run_id,
    kind: row.kind as ProposalKind,
    status: row.status as ProposalStatus,
    payload: JSON.parse(row.payload) as GraphMutation,
    note: row.note,
    revisionId: row.revision_id,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

export function readProposal(db: Database.Database, id: string): Proposal | null {
  const row = db.prepare('SELECT * FROM proposals WHERE id = ?').get(id) as ProposalRow | undefined;
  return row ? rowToProposal(row) : null;
}

/** Proposals of a project in creation order, optionally only one status. */
export function listProposals(db: Database.Database, projectId: string, status?: ProposalStatus): Proposal[] {
  const rows = status
    ? db.prepare('SELECT * FROM proposals WHERE project_id = ? AND status = ? ORDER BY created_at, rowid').all(projectId, status)
    : db.prepare('SELECT * FROM proposals WHERE project_id = ? ORDER BY created_at, rowid').all(projectId);
  return (rows as ProposalRow[]).map(rowToProposal);
}
