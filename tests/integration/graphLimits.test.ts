/**
 * Protects the graph size limits (src/shared/workflow/graphLimits.ts) at the points where a graph comes in: importing a
 * workflow and opening a project file. A real-sized workflow opens; one over the node or link limit (subgraph nodes
 * counted too) is refused, the graph on screen stays, and the reason reads plainly in both languages. Without the
 * limit a file with tens of thousands of nodes made the window unusable at every later start.
 */
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { commitCommand, ensureWorkspace, readProjection } from '../../src/main/commands/commit';
import { nativeProjectFile, openNativeFile } from '../../src/main/ipc/projectFile';
import { migrate } from '../../src/main/settings/migrate';
import { createTranslator, explainError } from '../../src/shared/i18n';
import { DESKTOP_PROJECT_ID } from '../../src/shared/project';
import { GRAPH_LINK_LIMIT, GRAPH_NODE_LIMIT, graphLimitError, graphSize } from '../../src/shared/workflow/graphLimits';

const P = DESKTOP_PROJECT_ID;

function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  return db;
}

function workflow(nodeCount: number, linkCount = 0) {
  const nodes = Array.from({ length: nodeCount }, (_, index) => ({
    id: index + 1, type: 'KSampler', pos: [index * 10, 0], size: [200, 100], flags: {}, order: index, mode: 0,
    inputs: [], outputs: [], properties: {}, widgets_values: [1, 'fixed', 20, 8, 'euler', 'normal', 1],
  }));
  const links = Array.from({ length: linkCount }, (_, index) => [index + 1, 1, 0, 2, 0, 'LATENT']);
  return { version: 0.4, last_node_id: nodeCount, last_link_id: linkCount, nodes, links, groups: [], config: {}, extra: {} };
}

function importDocument(db: Database.Database, document: unknown, action = 'import') {
  return commitCommand(db, {
    projectId: P,
    actionId: `${action}-${Math.random()}`,
    expectedRevisionId: readProjection(db, P)!.currentRevisionId,
    actor: 'manual',
    runId: null,
    payload: { type: 'import-workflow', document },
  });
}

describe('the size of a graph a file may open', () => {
  it('opens a large real-sized workflow', () => {
    const db = openDb();
    expect(importDocument(db, workflow(600, 1)).status).toBe('applied');
  });

  it('refuses a workflow with more nodes than the limit, and the graph on screen stays', () => {
    const db = openDb();
    importDocument(db, workflow(3));
    const before = readProjection(db, P)!.currentRevisionId;
    const response = importDocument(db, workflow(GRAPH_NODE_LIMIT + 1));
    expect(response.status).toBe('rejected');
    expect((response.result as { error: string }).error).toBe(`The graph is too large to open: ${GRAPH_NODE_LIMIT + 1} nodes, 0 links.`);
    expect(readProjection(db, P)!.currentRevisionId).toBe(before);
  });

  it('refuses a workflow with more links than the limit', () => {
    const db = openDb();
    const response = importDocument(db, workflow(2, GRAPH_LINK_LIMIT + 1));
    expect(response.status).toBe('rejected');
  });

  it('counts the nodes inside subgraph definitions too', () => {
    const inner = Array.from({ length: GRAPH_NODE_LIMIT }, (_, index) => ({ id: index + 1 }));
    expect(graphSize({ nodes: [{}], edges: [], subgraphs: [{ nodes: inner, edges: [] }] }).nodes).toBe(GRAPH_NODE_LIMIT + 1);
    expect(graphLimitError({ nodes: [{}], edges: [], subgraphs: [{ nodes: inner, edges: [] }] })).not.toBeNull();
    // A definition kept verbatim counts by its raw nodes.
    expect(graphSize({ nodes: [], subgraphs: [{ opaque: true, nodes: [], edges: [], raw: { nodes: inner, links: [] } }] }).nodes).toBe(GRAPH_NODE_LIMIT);
  });

  it('refuses a project file over the limit', () => {
    const db = openDb();
    importDocument(db, workflow(2));
    const saved = nativeProjectFile(db, P);
    expect(saved.ok).toBe(true);
    const project = structuredClone((saved as { project: Record<string, any> }).project);
    const node = project.graph.nodes[0];
    project.graph.nodes = Array.from({ length: GRAPH_NODE_LIMIT + 5 }, (_, index) => ({ ...node, id: String(index + 1) }));
    const response = openNativeFile(db, P, project);
    expect(response.status).toBe('rejected');
    expect((response.result as { error: string }).error).toMatch(/too large to open/);
  });

  it('says it in plain words in both languages', () => {
    const code = `The graph is too large to open: ${GRAPH_NODE_LIMIT + 1} nodes, 7 links.`;
    expect(explainError(createTranslator('en'), code).summary).toContain(`${GRAPH_NODE_LIMIT} nodes`);
    expect(explainError(createTranslator('ru'), code).summary).toContain('слишком большой');
    expect(explainError(createTranslator('ru'), code).diagnostic).toBeNull();
  });
});
