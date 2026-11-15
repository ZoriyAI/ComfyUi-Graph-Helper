/** Marks of check findings on nodes: which nodes, how many findings, the worst level; advice leaves no mark. */
import { describe, expect, it } from 'vitest';
import type { GraphCheckReport } from '../../src/shared/contracts';
import { checkMarks } from '../../src/renderer/components/graph/lib/checkMarks';

const empty: GraphCheckReport = { ok: true, missingNodes: [], missingModels: [], typeMismatches: [], baseModelMismatches: [], unconnectedRequiredInputs: [], unknownNodeTypes: [] };

describe('check marks on nodes', () => {
  it('no report or no findings: no marks', () => {
    expect(checkMarks(null).size).toBe(0);
    expect(checkMarks(empty).size).toBe(0);
  });

  it('counts findings per node and keeps the worst level', () => {
    const marks = checkMarks({
      ...empty,
      ok: false,
      unconnectedRequiredInputs: [{ nodeId: '4', input: 'model', type: 'MODEL' }, { nodeId: '4', input: 'positive', type: 'CONDITIONING' }],
      missingModels: [{ nodeId: '1', directory: 'checkpoints', name: 'x.safetensors' }],
      unsetWidgets: [{ nodeId: '1', classType: 'CheckpointLoaderSimple', name: 'ckpt_name' }],
    });
    expect(marks.get('4')).toEqual({ count: 2, level: 'warn' });
    expect(marks.get('1')).toEqual({ count: 2, level: 'error' });
  });

  it('a link of wrong types marks both of its ends; a family mismatch only its own node', () => {
    const marks = checkMarks({
      ...empty,
      typeMismatches: [{ edgeId: 'e1', source: '2', target: '3', sourceType: 'IMAGE', targetType: 'LATENT' }],
      baseModelMismatches: [{ nodeId: '5', model: 'a', modelBase: 'sdxl', otherNodeId: '6', otherModel: 'b', otherBase: 'sd15' }],
    });
    expect(marks.get('2')?.level).toBe('error');
    expect(marks.get('3')?.level).toBe('error');
    expect(marks.get('5')).toEqual({ count: 1, level: 'warn' });
    expect(marks.has('6')).toBe(false);
  });

  it('advice about a description leaves no mark', () => {
    const marks = checkMarks({ ...empty, promptNotes: [{ kind: 'negation', nodeId: '7', classType: 'CLIPTextEncode', found: 'no' } as never] });
    expect(marks.size).toBe(0);
  });
});
