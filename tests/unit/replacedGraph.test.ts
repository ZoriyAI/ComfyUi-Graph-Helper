import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/main/settings/migrate';
import { listExplanations, saveExplanation } from '../../src/main/knowledge/repository';
import { forgetExplanationsOfReplacedGraph, survivors } from '../../src/main/knowledge/replacedGraph';
import type { ObjectRef } from '../../src/shared/contracts/objects';

/**
 * A person built a graph with the helper, started a new project and opened a workflow of their own: its node 1, a
 * sampler, wore the old graph's "everything starts with a checkpoint". Explanations are kept by object id and ids
 * start from 1 in every graph, so a replaced graph takes the explanations of its objects with it.
 */
const PROJECT = 'desktop';

function node(id: string, comfyType: string) {
  return { id, data: { comfyType } };
}

function explain(db: Database.Database, owner: ObjectRef, text: string, projectId: string | null = PROJECT) {
  return saveExplanation(db, { projectId, owner, aspect: 'why', text, provenance: 'inference', sourceUrl: null, revisionId: null, createdBy: 'ai' });
}

const built = {
  nodes: [node('1', 'CheckpointLoaderSimple'), node('2', 'CLIPTextEncode'), node('3', 'KSampler')],
  edges: [{ id: 'link-1', source: '1', target: '3' }, { id: 'link-2', source: '2', target: '3' }],
  groups: [{ id: 'g1', title: 'Generation' }],
};

describe('explanations of a graph that was replaced', () => {
  it('knows which objects are still the same ones', () => {
    const opened = {
      nodes: [node('1', 'KSampler'), node('2', 'CLIPTextEncode'), node('3', 'KSampler'), node('4', 'VAEDecode')],
      edges: [{ id: 'link-1', source: '1', target: '3' }, { id: 'link-2', source: '2', target: '3' }, { id: 'link-3', source: '3', target: '4' }],
      groups: [{ id: 'g1', title: 'Decode' }],
    };
    const kept = survivors(built, opened);
    expect([...kept.nodes]).toEqual(['2', '3']);
    // link-1 keeps its id and its ends, but its source is another node now.
    expect([...kept.edges]).toEqual(['link-2']);
    expect([...kept.groups]).toEqual([]);
  });

  it('forgets what belonged to the old graph and keeps what is not tied to a graph', () => {
    const db = new Database(':memory:');
    migrate(db);
    explain(db, { kind: 'node', id: '1' }, 'Everything starts with a checkpoint.');
    explain(db, { kind: 'node', id: '2' }, 'The positive prompt.');
    explain(db, { kind: 'port', id: '1:out-0', nodeId: '1', portName: 'MODEL', direction: 'output' }, 'The model goes to the sampler.');
    explain(db, { kind: 'port', id: '2:out-0', nodeId: '2', portName: 'CONDITIONING', direction: 'output' }, 'The prompt as conditioning.');
    explain(db, { kind: 'edge', id: 'link-1' }, 'The sampler needs the model weights.');
    explain(db, { kind: 'edge', id: 'link-2' }, 'What you want goes into positive.');
    explain(db, { kind: 'group', id: 'g1' }, 'These three make the picture.');
    explain(db, { kind: 'nodeClass', id: 'KSampler', classType: 'KSampler' }, 'KSampler removes noise step by step.', null);
    explain(db, { kind: 'node', id: '1' }, 'Another project keeps its own.', 'another');

    const opened = { nodes: [node('1', 'KSampler'), node('2', 'CLIPTextEncode'), node('3', 'KSampler')], edges: built.edges, groups: [] };
    expect(forgetExplanationsOfReplacedGraph(db, PROJECT, built, opened)).toBe(4);

    const texts = (owner: ObjectRef, projectId: string | null = PROJECT) => listExplanations(db, { projectId, owner }).map((item) => item.text);
    expect(texts({ kind: 'node', id: '1' })).toEqual([]);
    expect(texts({ kind: 'node', id: '2' })).toEqual(['The positive prompt.']);
    expect(texts({ kind: 'port', id: '1:out-0', nodeId: '1', portName: 'MODEL', direction: 'output' })).toEqual([]);
    expect(texts({ kind: 'port', id: '2:out-0', nodeId: '2', portName: 'CONDITIONING', direction: 'output' })).toEqual(['The prompt as conditioning.']);
    expect(texts({ kind: 'edge', id: 'link-1' })).toEqual([]);
    expect(texts({ kind: 'edge', id: 'link-2' })).toEqual(['What you want goes into positive.']);
    expect(texts({ kind: 'group', id: 'g1' })).toEqual([]);
    expect(texts({ kind: 'nodeClass', id: 'KSampler', classType: 'KSampler' }, null)).toEqual(['KSampler removes noise step by step.']);
    expect(texts({ kind: 'node', id: '1' }, 'another')).toEqual(['Another project keeps its own.']);
  });

  it('keeps everything when the same graph is opened again, and forgets everything for a new project', () => {
    const db = new Database(':memory:');
    migrate(db);
    explain(db, { kind: 'node', id: '1' }, 'Everything starts with a checkpoint.');
    explain(db, { kind: 'edge', id: 'link-1' }, 'The sampler needs the model weights.');
    explain(db, { kind: 'group', id: 'g1' }, 'These three make the picture.');
    expect(forgetExplanationsOfReplacedGraph(db, PROJECT, built, built)).toBe(0);
    expect(listExplanations(db, { projectId: PROJECT })).toHaveLength(3);
    expect(forgetExplanationsOfReplacedGraph(db, PROJECT, built, { nodes: [], edges: [], groups: [] })).toBe(3);
    expect(listExplanations(db, { projectId: PROJECT })).toHaveLength(0);
  });
});
