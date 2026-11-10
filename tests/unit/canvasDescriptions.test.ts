import Database from 'better-sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { commitCommand, ensureWorkspace, readProjection } from '../../src/main/commands/commit';
import { listExplanations, saveExplanation } from '../../src/main/knowledge/repository';
import { migrate } from '../../src/main/settings/migrate';
import {
  CARD_MAX_SCALE,
  CARD_MIN_SCALE,
  CARD_READABLE_SCALE,
  cardRect,
  cardScale,
  descriptionVisibility,
  descriptionsModeOf,
  firstLine,
  neighbourBoxes,
  nextDescriptionsMode,
  placeCard,
  selectDescription,
  type Box,
} from '../../src/renderer/components/graph/lib/description';
import { parsePreferences, preferencesSchema } from '../../src/shared/config/preferences';
import { setCanvasPersist, useCanvasStore } from '../../src/renderer/components/graph/canvasStore';
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

describe('description modes', () => {
  it('reads the mode, migrating the old boolean (on = own, off = off) and keeping the old key readable', () => {
    expect(descriptionsModeOf({ showDescriptions: true })).toBe('own');
    expect(descriptionsModeOf({ showDescriptions: false })).toBe('off');
    expect(descriptionsModeOf({})).toBe('own');
    expect(descriptionsModeOf(null)).toBe('own');
    expect(descriptionsModeOf({ showDescriptions: false, descriptions: 'all' })).toBe('all');
    expect(descriptionsModeOf({ showDescriptions: true, descriptions: 'off' })).toBe('off');
    // A row saved before the mode existed parses without it, and the old switch still decides.
    expect(descriptionsModeOf(parsePreferences({ canvas: { showDescriptions: false } }).canvas)).toBe('off');
    expect(descriptionsModeOf(parsePreferences({}).canvas)).toBe('own');
    expect(parsePreferences({ canvas: { descriptions: 'all' } }).canvas.descriptions).toBe('all');
    // A bad mode falls back on its own, the rest of the row stays.
    const mixed = parsePreferences({ canvas: { descriptions: 'loud', showDescriptions: false, gridSize: 24 } }).canvas;
    expect(mixed).toMatchObject({ showDescriptions: false, gridSize: 24 });
    expect(mixed.descriptions).toBeUndefined();
    expect(descriptionsModeOf(mixed)).toBe('off');
    expect(preferencesSchema.safeParse({ canvas: { descriptions: 'own' } }).success).toBe(true);
  });

  it('cycles own, all, off', () => {
    expect(nextDescriptionsMode('own')).toBe('all');
    expect(nextDescriptionsMode('all')).toBe('off');
    expect(nextDescriptionsMode('off')).toBe('own');
  });
});

describe('description visibility', () => {
  const seeded = selectDescription({ shared: [explanation({ owner: { kind: 'nodeClass', id: 'KSampler', classType: 'KSampler' }, aspect: 'what', text: 'The main sampler', provenance: 'fact', createdBy: 'seed' })] });
  const catalog = selectDescription({ catalog: 'Samples a latent.' });
  const owned = selectDescription({ own: [explanation({ aspect: 'what', text: 'Makes portrait A', provenance: 'inference' })] });
  const purpose = selectDescription({ catalog: 'Samples a latent.', purpose: 'Portrait pass' }, { preferOwn: true });

  it('own mode: a card for the node\'s own text, a dot for class knowledge until someone looks', () => {
    expect(descriptionVisibility({ mode: 'own', content: owned, demand: {} })).toBe('card');
    expect(descriptionVisibility({ mode: 'own', content: purpose, demand: {} })).toBe('card');
    expect(descriptionVisibility({ mode: 'own', content: seeded, demand: {} })).toBe('dot');
    expect(descriptionVisibility({ mode: 'own', content: catalog, demand: {} })).toBe('dot');
    for (const demand of [{ hovered: true }, { selected: true }, { focused: true }, { tour: true }, { revealed: true }, { pinned: true }, { editing: true }]) {
      expect(descriptionVisibility({ mode: 'own', content: seeded, demand }), JSON.stringify(demand)).toBe('card');
    }
    expect(descriptionVisibility({ mode: 'own', content: null, demand: { hovered: true } })).toBe('none');
    // A tour step with nothing stored still gets its card for the tour text.
    expect(descriptionVisibility({ mode: 'own', content: null, demand: { tour: true }, fallback: true })).toBe('card');
  });

  it('all mode shows every card; off shows dots (a card only when opened from its dot or edited)', () => {
    expect(descriptionVisibility({ mode: 'all', content: seeded, demand: {} })).toBe('card');
    expect(descriptionVisibility({ mode: 'all', content: catalog, demand: {} })).toBe('card');
    expect(descriptionVisibility({ mode: 'off', content: owned, demand: {} })).toBe('dot');
    expect(descriptionVisibility({ mode: 'off', content: seeded, demand: { hovered: true, selected: true, tour: true } })).toBe('dot');
    expect(descriptionVisibility({ mode: 'off', content: seeded, demand: { pinned: true } })).toBe('card');
    expect(descriptionVisibility({ mode: 'off', content: null, demand: { tour: true }, fallback: true })).toBe('none');
  });

  it('own mode puts the component purpose before class knowledge; the default priority keeps it last', () => {
    expect(purpose).toMatchObject({ scope: 'component', primary: { text: 'Portrait pass' } });
    expect(selectDescription({ catalog: 'Samples a latent.', purpose: 'Portrait pass' })).toMatchObject({ scope: 'catalog' });
    expect(selectDescription({ own: [explanation({ aspect: 'what', text: 'node text' })], purpose: 'p' }, { preferOwn: true })).toMatchObject({ scope: 'node' });
  });
});

describe('card placement avoids other nodes and their ports', () => {
  const node: Box = { x: 0, y: 0, width: 200, height: 100 };
  const size = { width: 220, height: 34 };
  const compact = { width: 200, height: 30 };

  it('lays rectangles out the way NodeToolbar does', () => {
    expect(cardRect(node, 'bottom', size, 1)).toEqual({ x: -10, y: 108, width: 220, height: 34 });
    expect(cardRect(node, 'top', size, 2)).toEqual({ x: 45, y: -21, width: 110, height: 17 });
    expect(cardRect(node, 'right', size, 1)).toEqual({ x: 214, y: 0, width: 220, height: 34 });
    expect(cardRect(node, 'left', size, 1)).toEqual({ x: -234, y: 0, width: 220, height: 34 });
  });

  // A card used to keep its size on screen while its node shrank with the canvas: at 60 % the room the layout left
  // under a node no longer held the card, and it sat on the node below. Drawn at the canvas zoom it covers the
  // same part of the graph at every zoom.
  it('draws a card at the canvas zoom, and never an asked-for one smaller than readable', () => {
    expect(cardScale(1, false)).toBe(1);
    expect(cardScale(0.6, false)).toBe(0.6);
    expect(cardScale(2, false)).toBe(CARD_MAX_SCALE);
    expect(cardScale(0.2, false)).toBe(CARD_MIN_SCALE);
    expect(cardScale(0.6, true)).toBe(CARD_READABLE_SCALE);
    expect(cardScale(1.1, true)).toBe(1.1);
    expect(cardScale(0, false)).toBe(1);
  });

  it('covers the same part of the graph at every zoom between the limits', () => {
    const own = { width: 200, height: 34 };
    const at = (zoom: number) => {
      const scale = cardScale(zoom, false);
      return cardRect(node, 'bottom', { width: own.width * scale, height: own.height * scale }, zoom, scale);
    };
    const full = at(1);
    expect(full).toEqual({ x: 0, y: 108, width: 200, height: 34 });
    for (const zoom of [0.6, 0.75, 0.9, 1.2]) {
      const rect = at(zoom);
      expect(rect.x).toBeCloseTo(full.x, 6);
      expect(rect.y).toBeCloseTo(full.y, 6);
      expect(rect.width).toBeCloseTo(full.width, 6);
      expect(rect.height).toBeCloseTo(full.height, 6);
    }
    // A node 60 flow units under this one leaves room for the card at 100 %, so it does at 60 % too.
    const below = { x: 0, y: 160, width: 200, height: 100 };
    for (const zoom of [0.6, 1]) {
      const scale = cardScale(zoom, false);
      expect(placeCard({ node, others: [below], zoom, scale, size: { width: own.width * scale, height: own.height * scale }, compactSize: null, required: false }))
        .toEqual({ side: 'bottom', compact: false });
    }
    // A card that keeps its screen size at 60 % (the old way) needs 57 flow units of height there and does not fit.
    expect(placeCard({ node, others: [below], zoom: 0.6, size: own, compactSize: null, required: false })).not.toEqual({ side: 'bottom', compact: false });
  });

  it('stays under the node when nothing is there', () => {
    expect(placeCard({ node, others: [], zoom: 1, size, compactSize: compact, required: false })).toEqual({ side: 'bottom', compact: false });
  });

  it('moves right, then left, then above when the room under the node is taken', () => {
    const below: Box = { x: 0, y: 130, width: 200, height: 100 };
    expect(placeCard({ node, others: [below], zoom: 1, size, compactSize: compact, required: false })).toEqual({ side: 'right', compact: false });
    const right: Box = { x: 240, y: 0, width: 200, height: 100 };
    expect(placeCard({ node, others: [below, right], zoom: 1, size, compactSize: compact, required: false })).toEqual({ side: 'left', compact: false });
    const left: Box = { x: -260, y: 0, width: 200, height: 100 };
    expect(placeCard({ node, others: [below, right, left], zoom: 1, size, compactSize: compact, required: false })).toEqual({ side: 'top', compact: false });
  });

  it('counts the port handles sticking out of a neighbour as covered', () => {
    // A neighbour whose box starts 4 units right of where the card ends: its input handles reach into the card.
    const card = cardRect(node, 'bottom', size, 1);
    const handles: Box = { x: card.x + card.width + 4, y: 100, width: 200, height: 100 };
    expect(placeCard({ node, others: [handles], zoom: 1, size, compactSize: compact, required: false })?.side).not.toBe('bottom');
  });

  it('falls back to a one-line compact card, then to a dot when nobody asked for the card', () => {
    const tight = { width: 220, height: 120 };
    const others: Box[] = [
      { x: -40, y: 145, width: 280, height: 100 }, // under, 45 below the node: room for one line only
      { x: 230, y: -200, width: 200, height: 400 },
      { x: -230, y: -200, width: 200, height: 400 },
      { x: -40, y: -160, width: 280, height: 140 },
    ];
    expect(placeCard({ node, others, zoom: 1, size: tight, compactSize: compact, required: false })).toEqual({ side: 'bottom', compact: true });
    const closer = others.map((box, index) => (index === 0 ? { ...box, y: 112 } : box));
    expect(placeCard({ node, others: closer, zoom: 1, size: tight, compactSize: compact, required: false })).toBeNull();
    // One line of room above (but not under): the compact card goes on top.
    const roomAbove = closer.map((box, index) => (index === 3 ? { ...box, y: -200 } : box));
    expect(placeCard({ node, others: roomAbove, zoom: 1, size: tight, compactSize: compact, required: false })).toEqual({ side: 'top', compact: true });
    // Asked for (selected, hovered): it always gets the least covered place.
    expect(placeCard({ node, others: closer, zoom: 1, size: tight, compactSize: null, required: true })).toMatchObject({ covers: true });
    // An expanded card cannot shrink.
    expect(placeCard({ node, others, zoom: 1, size: tight, compactSize: null, required: false })).toBeNull();
  });

  it('scales with zoom: a card that covers at full zoom fits when zoomed in', () => {
    const below: Box = { x: 0, y: 125, width: 200, height: 100 };
    expect(placeCard({ node, others: [below], zoom: 1, size, compactSize: null, required: false, sides: ['bottom'] })).toBeNull();
    expect(placeCard({ node, others: [below], zoom: 4, size, compactSize: null, required: false, sides: ['bottom'] })).toEqual({ side: 'bottom', compact: false });
  });

  it('keeps a card someone asked for inside the visible canvas', () => {
    // The node sits at the bottom edge of the view: under it is off screen, to the right is free.
    const bounds: Box = { x: -500, y: -500, width: 1000, height: 610 };
    expect(placeCard({ node, others: [], zoom: 1, size, compactSize: null, required: true, bounds })).toEqual({ side: 'right', compact: false });
    expect(placeCard({ node, others: [], zoom: 1, size, compactSize: null, required: true })).toEqual({ side: 'bottom', compact: false });
  });

  it('only looks at neighbours a card could reach', () => {
    const near: Box = { x: 250, y: 0, width: 100, height: 100 };
    const far: Box = { x: 2000, y: 0, width: 100, height: 100 };
    expect(neighbourBoxes(node, [node, near, far], 460)).toEqual([near]);
  });
});

describe('description toggles in the canvas store', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setCanvasPersist(null);
    useCanvasStore.setState({
      descriptionsMode: 'own', descriptionsOn: true, hiddenDescriptions: {}, expandedDescriptions: {}, collapsedDescriptions: {},
      hoveredDescription: null, focusedDescription: null, revealedDescription: null, callout: null,
    });
  });

  it('starts in own mode, cycles through the modes and remembers each with the old switch beside it', () => {
    const saved: Array<Record<string, unknown>> = [];
    setCanvasPersist((patch) => saved.push(patch));
    const store = useCanvasStore.getState();
    expect(store.descriptionsMode).toBe('own');
    expect(store.descriptionsOn).toBe(true);
    store.cycleDescriptionsMode();
    expect(useCanvasStore.getState().descriptionsMode).toBe('all');
    store.cycleDescriptionsMode();
    expect(useCanvasStore.getState()).toMatchObject({ descriptionsMode: 'off', descriptionsOn: false });
    store.cycleDescriptionsMode();
    expect(useCanvasStore.getState().descriptionsMode).toBe('own');
    expect(saved).toEqual([
      { descriptions: 'all', showDescriptions: true },
      { descriptions: 'off', showDescriptions: false },
      { descriptions: 'own', showDescriptions: true },
    ]);
    // The on/off setter of older callers: off is off, on keeps a mode that is already on.
    store.setDescriptionsMode('all');
    store.setDescriptionsOn(true);
    expect(useCanvasStore.getState().descriptionsMode).toBe('all');
    store.setDescriptionsOn(false);
    store.setDescriptionsOn(true);
    expect(useCanvasStore.getState().descriptionsMode).toBe('own');
    store.setMinimapOn(false);
    expect(saved.at(-1)).toEqual({ showMinimap: false });
  });

  it('expands, collapses, hides cards per node, and Escape collapses all', () => {
    const store = useCanvasStore.getState();
    store.setDescriptionExpanded('3', true);
    expect(useCanvasStore.getState().expandedDescriptions).toEqual({ 3: true });
    store.hideDescription('3');
    expect(useCanvasStore.getState().hiddenDescriptions).toEqual({ 3: true });
    expect(useCanvasStore.getState().expandedDescriptions).toEqual({});
    store.hideDescription('4');
    store.showDescription('3');
    expect(useCanvasStore.getState().hiddenDescriptions).toEqual({ 4: true });

    // Collapsing a card expanded by its selection keeps it collapsed until the selection lets go.
    store.setDescriptionExpanded('5', false);
    expect(useCanvasStore.getState().collapsedDescriptions).toEqual({ 5: true });
    store.keepCollapsed(['5']);
    expect(useCanvasStore.getState().collapsedDescriptions).toEqual({ 5: true });
    store.keepCollapsed([]);
    expect(useCanvasStore.getState().collapsedDescriptions).toEqual({});

    store.setDescriptionExpanded('6', true);
    store.setHoveredDescription('7');
    store.setCallout({ nodeId: '8', title: 'Sampler', text: 'why', kind: 'node' });
    expect(useCanvasStore.getState().revealedDescription).toBe('8');
    store.setCallout(null);
    expect(useCanvasStore.getState().revealedDescription).toBe('8');
    store.collapseDescriptions(['9']);
    expect(useCanvasStore.getState()).toMatchObject({
      expandedDescriptions: {}, collapsedDescriptions: { 9: true }, hoveredDescription: null, revealedDescription: null,
    });
  });

  it('keeps working when the preferences writer fails', () => {
    setCanvasPersist(() => { throw new Error('denied'); });
    expect(() => useCanvasStore.getState().setDescriptionsMode('off')).not.toThrow();
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
