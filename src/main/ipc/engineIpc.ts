import type { IpcMain } from 'electron';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import { guardedHandle } from './guard';
import type { Proposal, ProposalResolution } from '../../shared/contracts/proposals';
import { REVISION_LIST_LIMIT, type RevisionSnapshot, type RevisionSummary } from '../../shared/contracts/revisions';
import { listRevisions, loadRevision } from '../commands/commit';
import { listProposals, resolveProposal, setProposalsNotifier } from '../proposals/repository';

const projectIdSchema = z.string().min(1).max(200);
const resolveSchema = z.object({
  projectId: projectIdSchema,
  proposalId: z.string().min(1).max(200),
  decision: z.enum(['accept', 'reject']),
});
const loadRevisionSchema = z.object({
  projectId: projectIdSchema,
  revisionId: z.string().min(1).max(400),
});

export const ENGINE_IPC_ERRORS = {
  request: 'The request does not match the schema.',
} as const;

/**
 * Handlers without Electron, so unit tests drive the same validation the IPC layer uses.
 * Each throws an Error with a stable English message on a bad request.
 */
export function engineHandlers(getDb: () => Database.Database) {
  const parse = <T>(schema: z.ZodType<T>, input: unknown): T => {
    const parsed = schema.safeParse(input);
    if (!parsed.success) throw new Error(ENGINE_IPC_ERRORS.request);
    return parsed.data;
  };
  return {
    listProposals(projectId: unknown): Proposal[] {
      return listProposals(getDb(), parse(projectIdSchema, projectId));
    },
    resolveProposal(request: unknown): ProposalResolution {
      return resolveProposal(getDb(), parse(resolveSchema, request));
    },
    listRevisions(projectId: unknown): RevisionSummary[] {
      return listRevisions(getDb(), parse(projectIdSchema, projectId), REVISION_LIST_LIMIT);
    },
    loadRevision(request: unknown): RevisionSnapshot | null {
      const { projectId, revisionId } = parse(loadRevisionSchema, request);
      return loadRevision(getDb(), projectId, revisionId);
    },
  };
}

function broadcast(channel: string, payload: unknown): void {
  // Loaded lazily so this module can be imported where Electron is not running.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { BrowserWindow } = require('electron') as typeof import('electron');
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send(channel, payload);
  }
}

/** Engine workstream: proposals:* and graph revision history. Called once from setupIPC. */
export function registerEngineIpc(ipcMain: IpcMain, getDb?: () => Database.Database): void {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const database = getDb ?? (() => (require('../database') as typeof import('../database')).getDatabase());
  const handlers = engineHandlers(database);
  setProposalsNotifier((_projectId, open) => broadcast(IPC_CHANNELS.PROPOSALS_EVENT, open));
  guardedHandle(ipcMain, IPC_CHANNELS.PROPOSALS_LIST, (_event, projectId: unknown) => handlers.listProposals(projectId));
  guardedHandle(ipcMain, IPC_CHANNELS.PROPOSALS_RESOLVE, (_event, request: unknown) => handlers.resolveProposal(request));
  guardedHandle(ipcMain, IPC_CHANNELS.GRAPH_LIST_REVISIONS, (_event, projectId: unknown) => handlers.listRevisions(projectId));
  guardedHandle(ipcMain, IPC_CHANNELS.GRAPH_LOAD_REVISION, (_event, request: unknown) => handlers.loadRevision(request));
}
