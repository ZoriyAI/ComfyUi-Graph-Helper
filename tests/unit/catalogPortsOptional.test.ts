/**
 * Checks that ports built from the synced catalog (portsForClassType) say which inputs are optional, as object_info
 * lists them, instead of marking every input required.
 */
import { describe, expect, it } from 'vitest';
import { portsForClassType } from '../../src/shared/graph/ports';
import type { CatalogView } from '../../src/shared/catalog/types';

const catalog = {
  nodes: [{
    classType: 'ControlNetApplyAdvanced',
    pack: 'comfy',
    pythonModule: 'nodes',
    inputs: [
      { name: 'positive', type: 'CONDITIONING', widget: false, required: true },
      { name: 'vae', type: 'VAE', widget: false, required: false },
      { name: 'old_row', type: 'IMAGE', widget: false },
      { name: 'strength', type: 'FLOAT', widget: true, required: true },
    ],
    outputs: [{ name: 'positive', type: 'CONDITIONING' }],
  }],
} as unknown as CatalogView;

describe('catalog ports', () => {
  it('mark the inputs object_info lists as optional, and only those', () => {
    const { inputs } = portsForClassType('ControlNetApplyAdvanced', catalog);
    expect(inputs.map((port) => [port.name, port.optional])).toEqual([
      ['positive', false],
      ['vae', true],
      ['old_row', false],
      ['strength', false],
    ]);
  });
});
