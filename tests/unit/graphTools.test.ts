import { describe, expect, it } from 'vitest';
import { AGENT_BUILD_TOOLS, AGENT_PROPOSAL_TOOLS } from '../../src/shared/contracts/agentTools';
import { mutationFromTool, proposalFromTool } from '../../src/shared/commands/tools';
import { BUILD_TOOL_SPECS, GRAPH_TOOL_SPECS, PROPOSAL_TOOL_SPECS } from '../../src/shared/commands/toolSpecs';
import { mutationSchema } from '../../src/shared/commands/types';
import { projectWorkflow } from '../../src/shared/workflow/codec';
import { typedWorkflow } from '../e2e/fixtures/typedWorkflow';

const SAMPLE_ARGS: Record<string, Record<string, unknown>> = {
  addNode: { nodeType: 'KSampler', title: 'Sampler', x: 1, y: 2 },
  connectNodes: { sourceNodeId: '1', targetNodeId: '2', sourceHandle: 'out-1', targetHandle: 'in-0' },
  setParameter: { nodeId: '2', key: 'text', value: 'a cat', widgetIndex: 0 },
  removeNode: { nodeId: '3' },
  createSubgraph: { name: 'Block', nodeIds: ['2', '3'], inputs: [{ name: 'clip', type: 'CLIP', nodeId: '2', handle: 'in-0' }] },
  insertSubgraph: { definitionId: 'aaaaaaaa-0000-4000-8000-000000000001', x: 5, y: 6, title: 'Copy' },
  annotateNode: { nodeId: '1', annotation: 'note' },
  setComponentDocumentation: { ownerKind: 'node', ownerId: '1', purpose: 'p', usage: 'u' },
  setProcess: { title: 't', notes: 'n' },
};

function context() {
  const projected = projectWorkflow(structuredClone(typedWorkflow));
  if ('error' in projected) throw new Error(projected.error);
  return { snapshot: projected.snapshot };
}

describe('tool to mutation mapping', () => {
  it('maps every build tool to a valid mutation', () => {
    for (const name of AGENT_BUILD_TOOLS) {
      const mutation = mutationFromTool(name, SAMPLE_ARGS[name]);
      expect(mutation, name).not.toBeNull();
      expect(mutationSchema.safeParse(mutation).success, name).toBe(true);
    }
  });

  it('accepts both connect shapes and resolves indices and names through the snapshot', () => {
    const expected = { type: 'connect', source: '1', target: '2', sourceHandle: 'out-1', targetHandle: 'in-0' };
    expect(mutationFromTool('connectNodes', { source: '1', target: '2', sourceHandle: 'out-1', targetHandle: 'in-0' })).toEqual(expected);
    expect(mutationFromTool('connectNodes', { sourceNodeId: '1', targetNodeId: '2', sourceOutputIndex: 1, targetInputIndex: 0 })).toEqual(expected);
    expect(mutationFromTool('connectNodes', { sourceNodeId: '1', targetNodeId: '2', sourceHandle: 'CLIP', targetHandle: 'clip' }, context())).toEqual(expected);
    expect(mutationFromTool('connectNodes', { sourceNodeId: 1, targetNodeId: 2, sourceOutputIndex: 1, targetInputIndex: 0 }, context())).toEqual(expected);
    expect(mutationFromTool('connectNodes', { sourceNodeId: '1', targetNodeId: '2' })).toBeNull();
    expect(mutationFromTool('connectNodes', { sourceNodeId: '1', targetNodeId: '2', sourceOutputIndex: -1, targetInputIndex: 0 })).toBeNull();
  });

  it('maps setParameter, removeNode, createSubgraph and insertSubgraph with tolerant shapes', () => {
    expect(mutationFromTool('setParameter', { nodeId: '2', key: 'text', value: 'x' })).toEqual({ type: 'set-parameter', nodeId: '2', key: 'text', value: 'x' });
    expect(mutationFromTool('setParameter', { nodeId: '2', key: 'text' })).toBeNull();
    expect(mutationFromTool('removeNode', {})).toBeNull();
    expect(mutationFromTool('createSubgraph', { name: 'B', nodeIds: ['2'] })).toEqual({ type: 'create-subgraph', name: 'B', nodeIds: ['2'], inputs: [], outputs: [] });
    expect(mutationFromTool('createSubgraph', { name: 'B', nodeIds: [] })).toBeNull();
    // A slot given by index and without name/type takes them from the inner port.
    expect(mutationFromTool('createSubgraph', { name: 'B', nodeIds: ['3'], inputs: [{ nodeId: '3', index: 1 }] }, context())).toMatchObject({
      inputs: [{ name: 'vae', type: 'VAE', nodeId: '3', handle: 'in-1' }],
    });
    expect(mutationFromTool('insertSubgraph', { definitionId: 'd' })).toEqual({ type: 'insert-subgraph', definitionId: 'd', x: 300, y: 200 });
    expect(mutationFromTool('insertSubgraph', {})).toBeNull();
    expect(mutationFromTool('unknownTool', {})).toBeNull();
  });

  it('turns proposal tools into ghost drafts without projectId, runId or revisionId', () => {
    const node = proposalFromTool('proposeNode', { nodeType: 'KSampler', note: 'You need a sampler' });
    expect(node).toEqual({ kind: 'add-node', payload: { type: 'add-node', nodeType: 'KSampler' }, note: 'You need a sampler' });
    expect(proposalFromTool('proposeConnection', { ...SAMPLE_ARGS.connectNodes, note: 'x' })).toMatchObject({ kind: 'connect', payload: { type: 'connect', source: '1' } });
    expect(proposalFromTool('proposeParameter', SAMPLE_ARGS.setParameter)).toMatchObject({ kind: 'set-parameter', note: '' });
    expect(proposalFromTool('proposeSubgraph', SAMPLE_ARGS.createSubgraph)).toMatchObject({ kind: 'create-subgraph' });
    expect(proposalFromTool('proposeNode', { note: 'missing type' })).toBeNull();
    expect(proposalFromTool('addNode', SAMPLE_ARGS.addNode)).toBeNull();
    expect(proposalFromTool('proposeNode', { nodeType: 'X', note: 'n'.repeat(5000) })!.note).toHaveLength(2000);
  });
});

describe('graph tool specs', () => {
  it('covers every build and proposal tool exactly once', () => {
    expect(BUILD_TOOL_SPECS.map((item) => item.name).sort()).toEqual([...AGENT_BUILD_TOOLS].sort());
    expect(PROPOSAL_TOOL_SPECS.map((item) => item.name).sort()).toEqual([...AGENT_PROPOSAL_TOOLS].sort());
    expect(new Set(GRAPH_TOOL_SPECS.map((item) => item.name)).size).toBe(GRAPH_TOOL_SPECS.length);
  });

  it('are well-formed JSON-schema objects whose descriptions say text is data', () => {
    const walk = (schema: Record<string, unknown>, where: string) => {
      if ('type' in schema) expect(['object', 'string', 'number', 'integer', 'array', 'boolean'], where).toContain(schema.type);
      if (schema.type === 'object') {
        const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
        for (const key of (schema.required ?? []) as string[]) expect(properties, `${where}.${key}`).toHaveProperty(key);
        for (const [key, child] of Object.entries(properties)) walk(child, `${where}.${key}`);
      }
      if (schema.type === 'array') walk(schema.items as Record<string, unknown>, `${where}[]`);
    };
    for (const item of GRAPH_TOOL_SPECS) {
      expect(item.parameters.type).toBe('object');
      expect(item.description).toContain('never executed');
      expect(JSON.parse(JSON.stringify(item))).toEqual(item);
      walk(item.parameters as unknown as Record<string, unknown>, item.name);
    }
    for (const item of PROPOSAL_TOOL_SPECS) {
      expect(item.parameters.properties).toHaveProperty('note');
      expect(item.description).toContain('ghost');
    }
  });

  it('accepts the sample arguments of each spec through the mapping', () => {
    for (const item of BUILD_TOOL_SPECS) {
      const args = SAMPLE_ARGS[item.name];
      for (const key of Object.keys(args)) expect(item.parameters.properties, `${item.name}.${key}`).toHaveProperty(key);
    }
  });
});
