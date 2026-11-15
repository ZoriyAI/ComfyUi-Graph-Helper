/**
 * Plain reads of the proposals table: one row to a Proposal object, one proposal by id, a project's list.
 * Used by repository.ts (which re-exports listProposals) and supersede.ts. It holds no writes, so supersede.ts can
 * read here without a circular import through the repository, which imports supersede.ts.
 */
import type Database from 'better-sqlite3';
import type { Proposal, ProposalKind, ProposalStatus } from '../../shared/contracts/proposals';
import type { GraphMutation } from '../../shared/commands/types';

/** One row of the proposals table as SQLite returns it; the payload is JSON text. */
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

/** A table row as the Proposal object the rest of the app uses (payload parsed, names in camelCase). */
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
    // rowid breaks ties between proposals made in the same millisecond, so the order stays the creation order.
    ? db.prepare('SELECT * FROM proposals WHERE project_id = ? AND status = ? ORDER BY created_at, rowid').all(projectId, status)
    : db.prepare('SELECT * FROM proposals WHERE project_id = ? ORDER BY created_at, rowid').all(projectId);
  return (rows as ProposalRow[]).map(rowToProposal);
}
