/**
 * Protects that File > New project starts from the same empty workflow as a fresh profile (format 1), so "Make a
 * subgraph from selection" works there. A workflow imported in the old 0.4 format still refuses, in words that say
 * what to do. A person who starts a new project expects every editing command to work on it.
 */
import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/main/settings/migrate';
import { commitCommand, ensureWorkspace, readProjection } from '../../src/main/commands/commit';
import { blankDocument } from '../../src/main/commands/graphOps';
import { upsertObjectInfo } from '../../src/main/catalog/repository';
import { parseObjectInfo } from '../../src/shared/catalog/objectInfo';
import { DESKTOP_PROJECT_ID } from '../../src/shared/project';
import { classifyWorkflow, emptyWorkflow, WORKFLOW_FORMAT_V1 } from '../../src/shared/workflow/codec';
import { createTranslator, translateKnownError } from '../../src/shared/i18n';
import { CLASSES, objectInfoDocument } from '../fixtures/mcp/fakeMcpServer';

function open(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  upsertObjectInfo(db, parseObjectInfo(objectInfoDocument(CLASSES)), 1000);
  return db;
}

let action = 0;
function commit(db: Database.Database, payload: Record<string, unknown>) {
  const current = readProjection(db, DESKTOP_PROJECT_ID)!;
  action += 1;
  return commitCommand(db, { projectId: DESKTOP_PROJECT_ID, actionId: `np-${action}`, expectedRevisionId: current.currentRevisionId, actor: 'manual', runId: null, payload: payload as never });
}

function addTwo(db: Database.Database) {
  commit(db, { type: 'add-node', nodeType: 'CheckpointLoaderSimple', x: 0, y: 0 });
  commit(db, { type: 'add-node', nodeType: 'CLIPTextEncode', x: 400, y: 0 });
  commit(db, { type: 'connect', source: '1', sourceHandle: 'out-1', target: '2', targetHandle: 'in-0' });
}

function subgraphFromSelection(db: Database.Database) {
  return commit(db, { type: 'create-subgraph', name: 'Block', nodeIds: ['1', '2'], inputs: [], outputs: [] });
}

describe('a new project and subgraphs', () => {
  it('starts in the same format as a fresh profile', () => {
    expect(classifyWorkflow(emptyWorkflow())).toBe('ui-v1');
    expect(blankDocument()).toEqual({ formatVersion: WORKFLOW_FORMAT_V1, raw: { state: emptyWorkflow().state } });
  });

  it('accepts "Make a subgraph from selection" after File > New project', () => {
    const db = open();
    expect(commit(db, { type: 'import-workflow', document: emptyWorkflow() }).status).toBe('applied');
    addTwo(db);
    const made = subgraphFromSelection(db);
    expect(made.status).toBe('applied');
    const snapshot = readProjection(db, DESKTOP_PROJECT_ID)!.snapshot as { subgraphs?: unknown[]; nodes: unknown[] };
    expect(snapshot.subgraphs).toHaveLength(1);
    expect(snapshot.nodes).toHaveLength(1);
  });

  it('refuses it on an old 0.4 workflow and says in plain words what to do', () => {
    const db = open();
    const old = { last_node_id: 0, last_link_id: 0, nodes: [], links: [], groups: [], config: {}, extra: {}, version: 0.4 };
    expect(commit(db, { type: 'import-workflow', document: old }).status).toBe('applied');
    addTwo(db);
    let message = '';
    try {
      const refused = subgraphFromSelection(db);
      message = String((refused.result as { error?: string } | null)?.error ?? '');
      expect(refused.status).not.toBe('applied');
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toBe('Subgraphs need workflow format 1.');
    for (const language of ['ru', 'en'] as const) {
      const said = translateKnownError(createTranslator(language), message) ?? '';
      expect(said).not.toMatch(/format 1|версия 1/);
      expect(said).toMatch(language === 'ru' ? /новый проект/i : /new project/i);
      expect(said).toMatch(/Ctrl\+V/);
    }
  });
});
