/**
 * The pure model behind every field a person edits on a node (fields/fieldModel.ts, used by FieldControl, FieldRow,
 * the node cards and the Inspector): which control a field gets, how a typed number is clamped and snapped, how a
 * seed is drawn, how a model list is filtered, and how a node is split into ports and fields. A mistake here shows a
 * wrong control or quietly sends ComfyUI a value outside its range.
 */
import { describe, expect, it } from 'vitest';
import {
  baseName,
  clampToSpec,
  controlKind,
  fieldValue,
  filterOptions,
  folderOf,
  isSeedField,
  nodeLayout,
  randomSeed,
  stepValue,
} from '../../src/renderer/components/fields/fieldModel';
import type { NodeClassDetail } from '../../src/shared/contracts/knowledge';
import type { ComfyNodeData } from '../../src/renderer/types/graph';

describe('field control kind', () => {
  it('follows the spec, and the JS type of the value when a row has no spec', () => {
    expect(controlKind({ kind: 'combo', options: ['a'] }, 'a')).toBe('combo');
    expect(controlKind({ kind: 'int' }, 3)).toBe('int');
    expect(controlKind({ kind: 'string', multiline: true }, '')).toBe('string');
    expect(controlKind(undefined, 3.5)).toBe('float');
    expect(controlKind(undefined, true)).toBe('boolean');
    expect(controlKind(undefined, 'euler')).toBe('string');
    expect(controlKind(undefined, undefined)).toBe('string');
    expect(controlKind(undefined, [1, 2])).toBe('json');
  });

  it('knows a seed by its name or by a randomizing integer', () => {
    expect(isSeedField('seed', { kind: 'int' })).toBe(true);
    expect(isSeedField('noise_seed', undefined)).toBe(true);
    expect(isSeedField('steps', { kind: 'int', control: 'fixed' })).toBe(false);
    expect(isSeedField('variation', { kind: 'int', control: 'randomize' })).toBe(true);
    expect(isSeedField('seedling_count', { kind: 'int' })).toBe(false);
  });
});

describe('number clamping', () => {
  it('rounds integers and keeps them inside the range', () => {
    expect(clampToSpec(20.6, { kind: 'int', min: 1, max: 10000 }, 'int')).toBe(21);
    expect(clampToSpec(0, { kind: 'int', min: 1, max: 10000 }, 'int')).toBe(1);
    expect(clampToSpec(99999, { kind: 'int', min: 1, max: 10000 }, 'int')).toBe(10000);
    expect(clampToSpec(Number.NaN, { kind: 'int' }, 'int')).toBeNull();
  });

  it('snaps floats to the step grid from min without float noise', () => {
    expect(clampToSpec(7.26, { kind: 'float', min: 0, max: 100, step: 0.1 }, 'float')).toBe(7.3);
    expect(clampToSpec(0.1 + 0.2, { kind: 'float', min: 0, max: 1, step: 0.01 }, 'float')).toBe(0.3);
    expect(clampToSpec(-3, { kind: 'float', min: 0, max: 1, step: 0.01 }, 'float')).toBe(0);
    // No spec: the typed value stands.
    expect(clampToSpec(1.2345, undefined, 'float')).toBe(1.2345);
  });

  it('steps from the value, or from the default when nothing is set', () => {
    expect(stepValue(20, 1, { kind: 'int', min: 1, max: 10000 }, 'int')).toBe(21);
    expect(stepValue(1, -1, { kind: 'int', min: 1, max: 10000 }, 'int')).toBe(1);
    expect(stepValue(8, 1, { kind: 'float', min: 0, max: 100, step: 0.1 }, 'float')).toBe(8.1);
    expect(stepValue(undefined, 1, { kind: 'int', default: 20 }, 'int')).toBe(21);
  });

  it('draws a random seed inside the range', () => {
    expect(randomSeed({ kind: 'int', min: 0, max: 10 }, () => 0.999)).toBe(10);
    expect(randomSeed({ kind: 'int', min: 5, max: 10 }, () => 0)).toBe(5);
    const big = randomSeed({ kind: 'int', min: 0, max: 0xffffffffffffffff });
    expect(Number.isSafeInteger(big)).toBe(true);
  });
});

describe('lists and files', () => {
  it('filters options by every typed word', () => {
    const options = ['sdxl/pixel-art-xl.safetensors', 'add-detail-xl.safetensors', 'flux_realism_lora.safetensors'];
    expect(filterOptions(options, 'XL')).toEqual(options.slice(0, 2));
    expect(filterOptions(options, 'pixel xl')).toEqual(['sdxl/pixel-art-xl.safetensors']);
    expect(filterOptions(options, '  ')).toEqual(options);
  });

  it('splits file names from folders', () => {
    expect(baseName('sdxl\\styles\\pixel.safetensors')).toBe('pixel.safetensors');
    expect(folderOf('sdxl/styles/pixel.safetensors')).toBe('sdxl/styles');
    expect(folderOf('pixel.safetensors')).toBe('');
  });
});

/** KSampler as the knowledge layer returns it; widgetOrder carries ComfyUI's hidden seed control slot. */
const KSAMPLER: NodeClassDetail = {
  classType: 'KSampler',
  displayName: 'KSampler',
  category: 'sampling',
  pack: 'core',
  detailed: true,
  description: '',
  inputs: [
    { name: 'model', type: 'MODEL', widget: false, required: true },
    { name: 'seed', type: 'INT', widget: true, required: true, spec: { kind: 'int', min: 0 } },
    { name: 'steps', type: 'INT', widget: true, required: true, spec: { kind: 'int', min: 1, max: 10000, tooltip: 'How many steps.' } },
    { name: 'sampler_name', type: 'COMBO', widget: true, required: true, spec: { kind: 'combo', options: ['euler', 'dpmpp_2m'] } },
  ],
  outputs: [{ name: 'LATENT', type: 'LATENT' }],
  widgetOrder: ['seed', 'seed::control_after_generate', 'steps', 'sampler_name'],
  widgetOrderReliable: true,
  outputNode: false,
  syncedAt: null,
};

function sampler(extra: Partial<ComfyNodeData> = {}): ComfyNodeData {
  return {
    comfyType: 'KSampler',
    inputs: [
      { id: 'in-0', name: 'model', dataType: 'MODEL', optional: false },
      { id: 'in-1', name: 'seed', dataType: 'INT', optional: false },
      { id: 'in-2', name: 'steps', dataType: 'INT', optional: false },
      { id: 'in-3', name: 'sampler_name', dataType: 'COMBO', optional: false },
    ],
    outputs: [{ id: 'out-0', name: 'LATENT', dataType: 'LATENT', optional: false }],
    parameters: { seed: 5, steps: 20, sampler_name: 'euler' },
    ...extra,
  };
}

describe('node layout', () => {
  it('keeps link inputs as ports and turns widget inputs into fields with their spec', () => {
    const layout = nodeLayout(sampler(), KSAMPLER);
    expect(layout.linkInputs.map((port) => port.name)).toEqual(['model']);
    expect(layout.fields.map((field) => [field.name, field.value, field.port?.id])).toEqual([
      ['seed', 5, 'in-1'],
      ['steps', 20, 'in-2'],
      ['sampler_name', 'euler', 'in-3'],
    ]);
    expect(layout.fields[1].tooltip).toBe('How many steps.');
  });

  it('without catalog detail, an input with a stored value of a widget type is a field', () => {
    const layout = nodeLayout(sampler(), null);
    expect(layout.linkInputs.map((port) => port.name)).toEqual(['model']);
    expect(layout.fields.map((field) => field.name)).toEqual(['seed', 'steps', 'sampler_name']);
    expect(layout.fields[0].spec).toBeUndefined();
  });

  it('reads an imported node\'s widgets_values by the catalog order, and keeps stray parameters', () => {
    // 'fixed' is the seed's control_after_generate slot: it has a place in widgets_values but is not a field.
    const data = sampler({ parameters: { note: 'kept' } });
    (data as Record<string, unknown>).comfy = { widgets_values: [42, 'fixed', 30, 'dpmpp_2m'] };
    const layout = nodeLayout(data, KSAMPLER);
    expect(layout.fields.map((field) => [field.name, field.value])).toEqual([
      ['seed', 42],
      ['steps', 30],
      ['sampler_name', 'dpmpp_2m'],
      ['note', 'kept'],
    ]);
    expect(fieldValue({ parameters: { steps: 4 }, comfy: { widgets_values: [1, 'fixed', 30] } }, 'steps', KSAMPLER.widgetOrder)).toBe(4);
  });

  it.each([null, { ...KSAMPLER, inputs: [], widgetOrder: [] }, { ...KSAMPLER, widgetOrderReliable: false }, { ...KSAMPLER, widgetOrder: ['steps'] }])(
    'exposes positional settings when the class layout is absent, empty, opaque or mismatched', (detail) => {
      const values = [0, 'fixed', 31, 'dpmpp_2m', false, 'line one\nline two', { ownState: true }, null];
      const data = sampler({ parameters: {}, comfy: { widgets_values: values } } as never);
      const layout = nodeLayout(data, detail);
      expect(layout.fields.map((field) => field.value)).toEqual(values);
      expect(layout.fields.map((field) => field.widgetIndex)).toEqual(values.map((_, i) => i));
      expect(layout.fields.map((field) => field.name)).toEqual(values.map((_, i) => `widgets::${i}`));
      expect(layout.fields[5].spec).toEqual({ kind: 'string', multiline: true });
    },
  );

  it('uses named fields again after catalog refresh without stale positional aliases or defaults', () => {
    const data = sampler({ parameters: { 'widgets::2': 37 }, comfy: { widgets_values: [42, 'fixed', 37, 'dpmpp_2m'] } } as never);
    const fields = nodeLayout(data, KSAMPLER).fields;
    expect(fields.map((field) => [field.name, field.value, field.widgetIndex])).toEqual([
      ['seed', 42, 0], ['steps', 37, 2], ['sampler_name', 'dpmpp_2m', 3],
    ]);
    expect(fieldValue(data, 'steps', ['steps'])).toBeUndefined();
  });
});
