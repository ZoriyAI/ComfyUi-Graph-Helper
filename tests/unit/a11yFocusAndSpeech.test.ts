/**
 * Accessibility rules that need no browser: the spoken names of canvas nodes and links, which links take focus,
 * the F6 area order, how the focus rescue picks its element, and the shortcuts that work while typing.
 */
import { describe, expect, it } from 'vitest';
import { edgeFocusable, edgeSpeech, linkedInputCounts, nodeSpeech, type Say } from '../../src/renderer/components/graph/lib/spoken';
import { nextRegion, REGIONS } from '../../src/renderer/a11y/regions';
import { nearest, pickRescue } from '../../src/renderer/a11y/focusRescue';
import { shortcutAllowed } from '../../src/renderer/commands/hotkeys';
import { createTranslator } from '../../src/shared/i18n';
import { recordVerdict } from '../../src/renderer/a11y/recordKeys';

const ru = createTranslator('ru') as unknown as Say;
const en = createTranslator('en') as unknown as Say;

const sampler = {
  id: '4',
  type: 'comfy',
  data: {
    comfyType: 'KSampler',
    title: 'Sample',
    inputs: [{ id: 'model', name: 'model', dataType: 'MODEL' }, { id: 'positive', name: 'positive', dataType: 'CONDITIONING' }],
    outputs: [{ id: 'LATENT', name: 'LATENT', dataType: 'LATENT' }],
    comfy: { mode: 4 },
  },
};
const loader = {
  id: '1',
  type: 'comfy',
  selected: true,
  data: { comfyType: 'CheckpointLoaderSimple', title: 'Checkpoint A', inputs: [], outputs: [{ id: 'MODEL', name: 'MODEL', dataType: 'MODEL' }] },
};
const link = { id: 'e1', source: '1', target: '4', sourceHandle: 'MODEL', targetHandle: 'model', data: { dataType: 'MODEL' } };

describe('spoken canvas', () => {
  it('names a node by its title, class, marks and linked inputs, in the interface language', () => {
    const linked = linkedInputCounts([link]);
    expect(nodeSpeech(sampler, ru, { linkedInputs: linked.get('4'), presence: 'missing', error: true }))
      .toBe('Sample, KSampler, В обходе, Не установлена, Требует внимания, входов подключено: 1 из 2, выходов: 1');
    expect(nodeSpeech(sampler, en, { linkedInputs: 1 })).toBe('Sample, KSampler, Bypassed, inputs linked: 1 of 2, outputs: 1');
  });

  it('names a link by its two nodes and ports, never by ids', () => {
    const nodes = new Map([[loader.id, loader], [sampler.id, sampler]]);
    const titles = new Map([['1', 'Checkpoint A'], ['4', 'Sample']]);
    expect(edgeSpeech(link, nodes, ru, titles)).toBe('Связь от Checkpoint A · MODEL к Sample · model, тип MODEL');
    expect(edgeSpeech(link, nodes, en, titles)).toBe('Link from Checkpoint A · MODEL to Sample · model, type MODEL');
  });

  it('makes a link a Tab stop only beside a selection', () => {
    expect(edgeFocusable(link, new Set())).toBe(false);
    expect(edgeFocusable(link, new Set(['1']))).toBe(true);
    expect(edgeFocusable({ ...link, selected: true }, new Set())).toBe(true);
  });
});

describe('F6 areas and the focus rescue', () => {
  it('visits the areas in window order and skips those that cannot take focus', () => {
    expect(REGIONS.map((region) => region.name)).toEqual(['menubar', 'toolbar', 'library', 'canvas', 'dock', 'status']);
    const usable = [true, true, false, true, true, false];
    expect(nextRegion(-1, 1, usable)).toBe(0);
    expect(nextRegion(1, 1, usable)).toBe(3);
    expect(nextRegion(4, 1, usable)).toBe(0);
    expect(nextRegion(0, -1, usable)).toBe(4);
    expect(nextRegion(-1, -1, usable)).toBe(4);
    expect(nextRegion(0, 1, [false, false])).toBe(-1);
  });

  it('goes back to the newest element that can still take focus, else the nearest one', () => {
    expect(pickRescue(['tab', 'field', 'gone'], (item) => item !== 'gone')).toBe('field');
    expect(pickRescue(['gone'], () => false)).toBeNull();
    expect(nearest({ x: 100, y: 100 }, [{ item: 'far', spot: { x: 900, y: 100 } }, { item: 'near', spot: { x: 160, y: 120 } }])).toBe('near');
  });

  it('lets F1 open the shortcuts window while typing, but not over a dialog', () => {
    expect(shortcutAllowed('F1', { editable: true, layerOpen: false })).toBe(true);
    expect(shortcutAllowed('F1', { editable: false, layerOpen: true })).toBe(false);
  });
});

describe('the shortcut recorder', () => {
  const key = (k: string, mods: Partial<{ ctrlKey: boolean; altKey: boolean; metaKey: boolean; shiftKey: boolean }> = {}, code?: string) => ({ key: k, code, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, ...mods });
  it('lets Tab and Shift+Tab leave instead of recording them', () => {
    expect(recordVerdict(key('Tab'))).toBe('leave');
    expect(recordVerdict(key('Tab', { shiftKey: true }))).toBe('leave');
    expect(recordVerdict(key('Tab', { ctrlKey: true }))).toBe('record');
  });
  it('refuses keys that move around the window or type text, unless a modifier is held', () => {
    expect(recordVerdict(key('d'))).toBe('refuse');
    expect(recordVerdict(key('Enter'))).toBe('refuse');
    expect(recordVerdict(key(' ', {}, 'Space'))).toBe('refuse');
    expect(recordVerdict(key('ArrowLeft', { shiftKey: true }))).toBe('refuse');
    expect(recordVerdict(key('!', { shiftKey: true }))).toBe('record');
    expect(recordVerdict(key('d', { ctrlKey: true }))).toBe('record');
    expect(recordVerdict(key('Delete'))).toBe('record');
    expect(recordVerdict(key('F2'))).toBe('record');
  });
});
