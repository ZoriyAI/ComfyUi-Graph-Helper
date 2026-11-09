import { describe, expect, it } from 'vitest';
import type { ModelSummary, NodeClassSummary, SubgraphDefinition } from '../../src/shared/contracts';
import {
  filterModels,
  flattenGroups,
  formatBytes,
  groupByCategory,
  insertableSubgraphs,
  modelFacets,
  moveActive,
  placementFor,
  scrollIntoRow,
  windowRange,
} from '../../src/renderer/components/library/libraryModel';
import { clampInterval, syncSummary, syncTransition, syncView } from '../../src/renderer/components/sync/syncView';
import { createTranslator } from '../../src/shared/i18n';
import { MAX_TOASTS, queueToast, type ToastItem } from '../../src/renderer/ui/toastStore';
import { dockRange, normalizeDockTab, TAB_DEFAULT, TAB_MAX, TAB_MIN } from '../../src/renderer/state/dockState';
import { isDirty } from '../../src/renderer/state/uiState';
import { clampSize } from '../../src/renderer/ui/Splitter';
import type { SyncStatus } from '../../src/shared/contracts';

function node(classType: string, category: string, displayName = classType): NodeClassSummary {
  return { classType, displayName, category, pack: '', detailed: true };
}

function model(directory: string, name: string, extra: Partial<ModelSummary> = {}): ModelSummary {
  return { directory, name, kind: 'checkpoint', baseModel: 'sdxl', sizeBytes: 1, enriched: false, ...extra };
}

describe('node library grouping', () => {
  const nodes = [
    node('KSampler', 'sampling'),
    node('VAEDecode', 'latent', 'VAE Decode'),
    node('CheckpointLoaderSimple', 'loaders', 'Load Checkpoint'),
    node('LoraLoader', 'loaders/lora', 'Load LoRA'),
    node('Mystery', ''),
  ];

  it('groups by top-level category, alphabetical without a query, uncategorised last', () => {
    const groups = groupByCategory(nodes, { ranked: false, uncategorized: 'Other' });
    expect(groups.map((group) => group.category)).toEqual(['latent', 'loaders', 'sampling', 'Other']);
    expect(groups[1].items.map((item) => item.classType)).toEqual(['CheckpointLoaderSimple', 'LoraLoader']);
  });

  it('keeps the search rank order when ranked', () => {
    const groups = groupByCategory([nodes[3], nodes[0], nodes[2]], { ranked: true, uncategorized: 'Other' });
    expect(groups.map((group) => group.category)).toEqual(['loaders', 'sampling']);
    expect(groups[0].items.map((item) => item.classType)).toEqual(['LoraLoader', 'CheckpointLoaderSimple']);
  });

  it('flattens to header and node rows and hides collapsed groups', () => {
    const groups = groupByCategory(nodes, { ranked: false, uncategorized: 'Other' });
    const open = flattenGroups(groups, new Set());
    expect(open).toHaveLength(groups.length + nodes.length);
    expect(open[0]).toMatchObject({ kind: 'header', category: 'latent', count: 1, collapsed: false });
    const closed = flattenGroups(groups, new Set(['loaders']));
    expect(closed).toHaveLength(open.length - 2);
    expect(closed.find((row) => row.kind === 'header' && row.category === 'loaders')).toMatchObject({ collapsed: true, count: 2 });
  });

  it('handles 3000+ classes in one pass', () => {
    const many = Array.from({ length: 3300 }, (_, index) => node(`Node${index}`, `cat${index % 40}`));
    const rows = flattenGroups(groupByCategory(many, { ranked: false, uncategorized: 'Other' }), new Set());
    expect(rows).toHaveLength(3340);
  });
});

describe('windowing', () => {
  it('renders only the visible rows plus overscan', () => {
    expect(windowRange(0, 400, 40, 3000, 6)).toEqual({ start: 0, end: 17, offset: 0, total: 120000 });
    const middle = windowRange(4000, 400, 40, 3000, 6);
    expect(middle.start).toBe(94);
    expect(middle.end).toBe(117);
    expect(middle.offset).toBe(94 * 40);
    expect(windowRange(119800, 400, 40, 3000).end).toBe(3000);
    expect(windowRange(0, 400, 40, 0)).toEqual({ start: 0, end: 0, offset: 0, total: 0 });
  });

  it('scrolls the active row into view only when needed', () => {
    expect(scrollIntoRow(5, 0, 400, 40)).toBeNull();
    expect(scrollIntoRow(20, 0, 400, 40)).toBe(840 - 400);
    expect(scrollIntoRow(2, 200, 400, 40)).toBe(80);
  });

  it('moves the active row with the keyboard and clamps', () => {
    const rows = Array.from({ length: 5 }, () => ({ kind: 'node' }));
    expect(moveActive(rows, -1, 'ArrowDown')).toBe(0);
    expect(moveActive(rows, -1, 'ArrowUp')).toBe(4);
    expect(moveActive(rows, 4, 'ArrowDown')).toBe(4);
    expect(moveActive(rows, 2, 'Home')).toBe(0);
    expect(moveActive(rows, 2, 'End')).toBe(4);
    expect(moveActive(rows, 1, 'PageDown', 10)).toBe(4);
    expect(moveActive([], 0, 'ArrowDown')).toBe(-1);
  });
});

describe('model library filters', () => {
  const models = [
    model('checkpoints', 'juggernaut.safetensors'),
    model('loras', 'detail.safetensors', { kind: 'lora', baseModel: 'flux1' }),
    model('loras', 'style.safetensors', { kind: 'lora', baseModel: 'sdxl' }),
  ];

  it('derives facets with counts, most common first', () => {
    const facets = modelFacets(models);
    expect(facets.directories).toEqual([{ value: 'loras', count: 2 }, { value: 'checkpoints', count: 1 }]);
    expect(facets.families[0]).toEqual({ value: 'sdxl', count: 2 });
    expect(facets.kinds.map((kind) => kind.value)).toEqual(['lora', 'checkpoint']);
  });

  it('filters by folder, family, kind and name', () => {
    expect(filterModels(models, '', { directory: 'loras', baseModel: '', kind: '' })).toHaveLength(2);
    expect(filterModels(models, '', { directory: '', baseModel: 'sdxl', kind: 'lora' }).map((item) => item.name)).toEqual(['style.safetensors']);
    expect(filterModels(models, 'JUGG', { directory: '', baseModel: '', kind: '' })).toHaveLength(1);
  });

  it('formats sizes per language', () => {
    expect(formatBytes(null, 'en')).toBe('—');
    expect(formatBytes(512, 'en')).toBe('512 B');
    expect(formatBytes(6.5 * 1024 ** 3, 'en')).toBe('6.5 GB');
    expect(formatBytes(6.5 * 1024 ** 3, 'ru').replace(/\s/g, ' ')).toBe('6,5 ГБ');
  });
});

describe('placement and subgraphs', () => {
  it('places at the canvas centre when the viewport is known', () => {
    expect(placementFor([], { x: 0, y: 0, zoom: 1 }, { width: 800, height: 600 })).toEqual({ x: 280, y: 240 });
    expect(placementFor([], { x: 100, y: 50, zoom: 2 }, { width: 800, height: 600 })).toEqual({ x: 30, y: 65 });
  });

  it('falls back to the right of the graph, then the origin, and staggers repeats', () => {
    expect(placementFor([{ position: { x: 100, y: 0 } }, { position: { x: 400, y: 200 } }], null, null)).toEqual({ x: 720, y: 100 });
    expect(placementFor([], null, null, 2)).toEqual({ x: 48, y: 48 });
  });

  it('lists only modelled subgraphs, filtered and sorted', () => {
    const base = { inputs: [], outputs: [], nodes: [], edges: [], nestedIn: null, raw: {} };
    const defs: SubgraphDefinition[] = [
      { ...base, id: 'b', name: 'Upscale' },
      { ...base, id: 'a', name: 'Face fix' },
      { ...base, id: 'c', name: 'Broken', opaque: true },
    ];
    expect(insertableSubgraphs(defs, '').map((item) => item.id)).toEqual(['a', 'b']);
    expect(insertableSubgraphs(defs, 'up').map((item) => item.id)).toEqual(['b']);
  });
});

describe('sync view', () => {
  const status: SyncStatus = {
    state: 'running',
    lastSyncAt: null,
    lastError: null,
    mcpUrl: 'https://mcp.example/mcp',
    tokenHeld: true,
    auto: { enabled: false, intervalMinutes: 30 },
    counts: { nodeClasses: 0, detailedClasses: 0, packs: 0, models: 0, enrichedModels: 0 },
    progress: { phase: 'catalog', done: 25, total: 100 },
  };

  it('derives state, progress and what blocks a sync', () => {
    expect(syncView(null)).toMatchObject({ state: 'never', fraction: null, blocked: 'noUrl' });
    expect(syncView(status)).toMatchObject({ state: 'running', labelKey: 'sync.state.running', fraction: 0.25, blocked: null });
    // Credentials are the server's call: no token alone blocks nothing; the server has to have asked for a sign-in.
    expect(syncView({ ...status, tokenHeld: false }).blocked).toBeNull();
    expect(syncView({ ...status, tokenHeld: false, state: 'error', lastError: 'MCP server requires sign-in.' }).blocked).toBe('noToken');
    // A browser sign-in counts as auth: the "no token" hint is not shown.
    expect(syncView({ ...status, tokenHeld: false, signedIn: true, state: 'error', lastError: 'MCP server requires sign-in.' }).blocked).toBeNull();
    expect(syncView({ ...status, progress: { phase: 'connect', done: 0, total: 0 } }).fraction).toBeNull();
  });

  it('shows startup, background enrichment, warnings and the sign-in need', () => {
    const idle: SyncStatus = { ...status, state: 'idle', progress: null };
    expect(syncView({ ...idle, startupPending: true })).toMatchObject({ labelKey: 'sync.state.starting', busy: false });
    const enriching = syncView({ ...idle, progress: { phase: 'enrichment', done: 120, total: 316 } });
    expect(enriching).toMatchObject({ state: 'idle', labelKey: 'sync.enriching', labelParams: { done: 120, total: 316 }, enriching: true, busy: true });
    expect(enriching.fraction).toBeCloseTo(120 / 316);
    expect(createTranslator('en')(enriching.labelKey, enriching.labelParams)).toBe('Reading model metadata: 120 / 316');
    expect(createTranslator('ru')(enriching.labelKey, enriching.labelParams)).toBe('Чтение метаданных моделей: 120 / 316');
    expect(syncView({ ...idle, warnings: ['x'] }).warned).toBe(true);
    expect(syncView({ ...idle, state: 'error', lastError: 'MCP sign-in has expired. Sign in through the browser again.' }).needsSignIn).toBe(true);
    expect(syncView({ ...idle, tokenHeld: false }).needsSignIn).toBe(false);
    expect(syncView({ ...idle, tokenHeld: false, state: 'error', lastError: 'MCP server requires sign-in.' }).needsSignIn).toBe(true);
    expect(syncView(idle).needsSignIn).toBe(false);
  });

  it('summarises a run in one toast line', () => {
    const done: SyncStatus = {
      ...status,
      state: 'idle',
      counts: { nodeClasses: 3272, detailedClasses: 3271, packs: 74, models: 1987, enrichedModels: 40 },
      metadata: { done: 40, total: 316 },
      progress: { phase: 'enrichment', done: 40, total: 316 },
    };
    const summary = syncSummary(done);
    expect(createTranslator('en')(summary.key, summary.params))
      .toBe('Synced: 3272 node classes (3271 with ports), 74 packs, 1987 models; metadata 40/316, continuing…');
    const finished = syncSummary({ ...done, progress: null, metadata: { done: 316, total: 316 } });
    expect(createTranslator('ru')(finished.key, finished.params))
      .toBe('Синхронизировано: классов нод 3272 (с портами 3271), паков 74, моделей 1987; метаданные 316/316');
  });

  it('toasts only the end of a run', () => {
    expect(syncTransition('running', 'idle')).toBe('done');
    expect(syncTransition('running', 'error')).toBe('failed');
    expect(syncTransition(null, 'idle')).toBeNull();
    expect(syncTransition('idle', 'error')).toBeNull();
  });

  it('clamps the interval to what main accepts', () => {
    expect(clampInterval('2')).toBe(5);
    expect(clampInterval('abc')).toBe(5);
    expect(clampInterval(45.4)).toBe(45);
    expect(clampInterval(100000)).toBe(1440);
  });
});

describe('toast queue, dock and frame state', () => {
  it('replaces a toast with the same id and caps the queue', () => {
    let queue: ToastItem[] = [];
    queue = queueToast(queue, { id: 'workflow-note', title: 'Saved' });
    queue = queueToast(queue, { id: 'workflow-note', title: 'Exported' });
    expect(queue).toHaveLength(1);
    expect(queue[0].title).toBe('Exported');
    for (let index = 0; index < 8; index += 1) queue = queueToast(queue, { title: `n${index}` });
    expect(queue).toHaveLength(MAX_TOASTS);
    expect(queue[queue.length - 1].title).toBe('n7');
  });

  it('maps chat to the assistant tab id', () => {
    expect(normalizeDockTab('chat')).toBe('assistant');
    expect(normalizeDockTab('assistant')).toBe('assistant');
    expect(normalizeDockTab('check')).toBe('check');
    expect(normalizeDockTab('nope')).toBe('inspector');
  });

  it('keeps the canvas at its minimum beside the rail and the dock', () => {
    expect(dockRange(false, 1400, 300)).toEqual({ min: TAB_MIN, max: 540 });
    expect(dockRange(false, 2400, 300)).toEqual({ min: TAB_MIN, max: TAB_MAX });
    expect(dockRange(false, 1024, 48).max).toBeGreaterThanOrEqual(TAB_DEFAULT);
    expect(dockRange(true, 1280, 48)).toEqual({ min: 560, max: 672 });
    expect(clampSize(900, 320, 540)).toBe(540);
  });

  it('is dirty only after the graph moved past the saved revision', () => {
    expect(isDirty(null, 4)).toBe(false);
    expect(isDirty(4, 4)).toBe(false);
    expect(isDirty(4, 5)).toBe(true);
  });
});
