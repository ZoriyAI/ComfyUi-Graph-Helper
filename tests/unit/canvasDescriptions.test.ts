import Database from 'better-sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { commitCommand, ensureWorkspace, readProjection } from '../../src/main/commands/commit';
import { listExplanations, saveExplanation } from '../../src/main/knowledge/repository';
import { migrate } from '../../src/main/settings/migrate';
import { firstLine, selectDescription } from '../../src/renderer/components/graph/lib/description';
import { DESCRIPTIONS_KEY, useCanvasStore } from '../../src/renderer/components/graph/canvasStore';
import type { Explanation } from '../../src/shared/contracts/knowledge';
import { DESKTOP_PROJECT_ID } from '../../src/shared/project';
import { exportWorkflow, type GraphSnapshot } from '../../src/shared/workflow/codec';

let seq = 0;
function explanation(partial: Partial<Explanation> & Pick<Explanation, 'aspect' | 'text'>): Explanation {
  seq += 1;
  return {
    id: `e${seq}`,
    projectId: DESKTOP_PROJECT_ID,
    owner: { kind: 'node', id: '3', classType: 'KSampler' },
    provenance: 'inference',
    sourceUrl: null,
    revisionId: null,
    createdBy: 'ai',
    createdAt: seq,
    ...partial,
  };
}

describe('description card content priority', () => {
  it('prefers the node explanation, newest "what" first, with the "why" beside it', () => {
    const own = [
      explanation({ aspect: 'what', text: 'old what' }),
      explanation({ aspect: 'why', text: 'why it is here', provenance: 'user' }),
      explanation({ aspect: 'what', text: 'new what\nsecond line', provenance: 'web' }),
      explanation({ aspect: 'risk', text: 'a risk' }),
    ];
    const content = selectDescription({
      own,
      shared: [explanation({ aspect: 'what', text: 'class text' })],
      catalog: 'catalog text',
      purpose: 'purpose',
    });
    expect(content).toMatchObject({ scope: 'node', explained: true, primary: { text: 'new what\nsecond line', provenance: 'web', aspect: 'what' }, why: { text: 'why it is here', provenance: 'user' } });
    expect(firstLine(content!.primary.text)).toBe('new what');
  });

  it('uses a lone "why" as the primary text', () => {
    const content = selectDescription({ own: [explanation({ aspect: 'why', text: 'only why' })] });
    expect(content).toMatchObject({ scope: 'node', primary: { text: 'only why', aspect: 'why' }, why: null });
  });

  it('falls back to the class explanation, then the catalog, then the component purpose', () => {
    const otherAspects = [explanation({ aspect: 'next', text: 'next step' })];
    expect(selectDescription({ own: otherAspects, shared: [explanation({ aspect: 'what', text: 'class text', provenance: 'fact' })], catalog: 'catalog' }))
      .toMatchObject({ scope: 'nodeClass', primary: { text: 'class text', provenance: 'fact' } });
    expect(selectDescription({ own: [], shared: [], catalog: '  Samples a latent.  ', purpose: 'purpose' }))
      .toMatchObject({ scope: 'catalog', explained: false, primary: { text: 'Samples a latent.', provenance: 'fact' } });
    expect(selectDescription({ catalog: '', purpose: 'Makes the portrait' }))
      .toMatchObject({ scope: 'component', explained: false, primary: { text: 'Makes the portrait', provenance: 'inference' } });
    expect(selectDescription({ own: [explanation({ aspect: 'what', text: '   ' })], catalog: ' ', purpose: '' })).toBeNull();
  });
});

describe('description toggles in the canvas store', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    useCanvasStore.setState({ descriptionsOn: true, hiddenDescriptions: {}, expandedDescriptions: {} });
  });

  it('remembers the global toggle in localStorage and hides cards per node', () => {
    const storage = new Map<string, string>();
    vi.stubGlobal('window', { localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) } });
    const store = useCanvasStore.getState();
    expect(store.descriptionsOn).toBe(true);
    store.setDescriptionsOn(false);
    expect(useCanvasStore.getState().descriptionsOn).toBe(false);
    expect(storage.get(DESCRIPTIONS_KEY)).toBe('off');
    store.setDescriptionsOn(true);
    expect(storage.get(DESCRIPTIONS_KEY)).toBe('on');

    store.setDescriptionExpanded('3', true);
    expect(useCanvasStore.getState().expandedDescriptions).toEqual({ 3: true });
    store.hideDescription('3');
    expect(useCanvasStore.getState().hiddenDescriptions).toEqual({ 3: true });
    expect(useCanvasStore.getState().expandedDescriptions).toEqual({});
    store.hideDescription('4');
    store.showDescription('3');
    expect(useCanvasStore.getState().hiddenDescriptions).toEqual({ 4: true });
  });

  it('keeps working when storage is unavailable', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } } });
    expect(() => useCanvasStore.getState().setDescriptionsOn(false)).not.toThrow();
    expect(useCanvasStore.getState().descriptionsOn).toBe(false);
  });
});

describe('export stays clean of descriptions', () => {
  const NODE_TEXT = 'DESCRIPTION_NODE_SENTINEL_51a7';
  const CLASS_TEXT = 'DESCRIPTION_CLASS_SENTINEL_51a7';
  const WHY_TEXT = 'DESCRIPTION_WHY_SENTINEL_51a7';

  it('exports workflow JSON without explanation text while the project keeps it', () => {
    const db = new Database(':memory:');
    migrate(db);
    ensureWorkspace(db);
    const current = () => readProjection(db, DESKTOP_PROJECT_ID)!;
    const imported = commitCommand(db, {
      projectId: DESKTOP_PROJECT_ID,
      actionId: 'import-described',
      expectedRevisionId: current().currentRevisionId,
      actor: 'manual',
      runId: null,
      payload: {
        type: 'import-workflow',
        document: {
          version: 1,
          state: { lastNodeId: 3, lastLinkId: 0, lastGroupId: 0, lastRerouteId: 0 },
          nodes: [{ id: 3, type: 'KSampler', pos: [0, 0], size: [240, 120], flags: {}, order: 0, mode: 0, properties: {}, widgets_values: [1, 'fixed', 20, 7, 'euler', 'normal', 1] }],
          links: [],
          groups: [],
          extra: {},
        },
      },
    });
    expect(imported.status).toBe('applied');
    const revisionId = current().currentRevisionId;
    const owner = { kind: 'node' as const, id: '3', classType: 'KSampler' };
    saveExplanation(db, { projectId: DESKTOP_PROJECT_ID, owner, aspect: 'what', text: NODE_TEXT, provenance: 'user', sourceUrl: null, revisionId, createdBy: 'user' });
    saveExplanation(db, { projectId: DESKTOP_PROJECT_ID, owner, aspect: 'why', text: WHY_TEXT, provenance: 'inference', sourceUrl: null, revisionId, createdBy: 'ai' });
    saveExplanation(db, { projectId: null, owner: { kind: 'nodeClass', id: 'KSampler', classType: 'KSampler' }, aspect: 'what', text: CLASS_TEXT, provenance: 'inference', sourceUrl: null, revisionId: null, createdBy: 'ai' });

    const exported = exportWorkflow(current().snapshot as GraphSnapshot, '2026-11-09T00:00:00.000Z');
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    const encoded = JSON.stringify(exported.workflow);
    expect(encoded).toContain('KSampler');
    for (const text of [NODE_TEXT, WHY_TEXT, CLASS_TEXT]) expect(encoded).not.toContain(text);
    expect(encoded).not.toContain('explanation');

    // The internal project keeps them in the explanations table.
    const stored = listExplanations(db, { projectId: DESKTOP_PROJECT_ID, owner });
    expect(stored.map((item) => item.text).sort()).toEqual([NODE_TEXT, WHY_TEXT].sort());
    expect(listExplanations(db, { owner: { kind: 'nodeClass', id: 'KSampler', classType: 'KSampler' } }).some((item) => item.text === CLASS_TEXT)).toBe(true);
    db.close();
  });
});
