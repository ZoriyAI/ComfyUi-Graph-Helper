/** Checks the fifty practical guides, their targets, result checks and revision-bound confirmation. */
import { verifyGuide } from '../../src/shared/guidance/verification';
import { describe, expect, it, vi } from 'vitest';
import { GUIDE_CATEGORIES, GUIDE_PROBLEMS, guideSource, searchGuides } from '../../src/shared/guidance/catalog';
import { en, ru, catalogLeaves } from '../../src/shared/i18n';

vi.stubGlobal('window', { innerWidth: 1440, innerHeight: 900, matchMedia: () => ({ matches: false }), addEventListener: () => undefined, localStorage: { getItem: () => null, setItem: () => undefined } });
import { guideObjectIsCurrent, guideResultObserved, openGuidance, resumeGuidance, useGuidanceStore } from '../../src/renderer/components/guidance/guidanceState';
import { useProjectionStore } from '../../src/renderer/services/commands/projection';
import { useGraphStore } from '../../src/renderer/state/graphState';

describe('practical guidance', () => {
  it('ships fifty unique source-linked scenarios with actionable text in both languages', () => {
    expect(GUIDE_PROBLEMS).toHaveLength(50);
    expect(new Set(GUIDE_PROBLEMS.map((p) => p.id)).size).toBe(50);
    const labels = new Set(catalogLeaves(en));
    expect(catalogLeaves(ru)).toEqual(catalogLeaves(en));
    for (const p of GUIDE_PROBLEMS) {
      expect(GUIDE_CATEGORIES).toContain(p.category);
      expect(labels.has(`guidance.actions.${p.action}`)).toBe(true);
      expect(new URL(p.source).protocol).toBe('https:');
      for (const lang of ['ru', 'en'] as const) for (const field of ['title', 'why', 'check', 'expected', 'prepare'] as const) expect(p[field][lang].length).toBeGreaterThan(10);
    }
    expect(guideSource('https://example.com')).toBeNull();
    expect(guideSource({ id: 'p01' })).toBeNull();
    expect(guideSource('p01')).toBe(GUIDE_PROBLEMS[0].source);
  });
  it('finds a plain-language symptom and an exact upstream error without an assistant', () => {
    expect(searchGuides('нет описания').map((p) => p.id)).toContain('p15');
    expect(searchGuides('CUDA out of memory').map((p) => p.id)).toContain('p17');
    expect(searchGuides('mat1').map((p) => p.id)).toContain('p08');
    expect(searchGuides('', 'touch')).toHaveLength(3);
    expect(searchGuides('nothing-matches')).toEqual([]);
  });
  it('keeps the selected step during a tool handoff', () => {
    openGuidance(undefined, 'p16');
    useGuidanceStore.getState().update({ step: 2, query: 'синхронизация' });
    useGuidanceStore.getState().close(); resumeGuidance();
    expect(useGuidanceStore.getState()).toMatchObject({ open: true, request: { problemId: 'p16', step: 2, query: 'синхронизация' } });
  });
  it('refuses a removed node or a reused id in a different graph/level', () => {
    useProjectionStore.setState({ projectId: 'desktop', graphKey: 'original' });
    useGraphStore.setState({ activeSubgraphId: null, nodes: [{ id: '1', type: 'comfy', position: { x: 0, y: 0 }, data: { label: 'Test', comfyType: 'LoadImage', inputs: [], outputs: [], parameters: {} } }] });
    openGuidance({ kind: 'node', id: '1', classType: 'LoadImage' }, 'p40');
    const request = useGuidanceStore.getState().request!;
    expect(guideObjectIsCurrent(request)).toBe(true);
    useProjectionStore.setState({ graphKey: 'another' });
    expect(guideObjectIsCurrent(request)).toBe(false);
    useProjectionStore.setState({ graphKey: 'original' });
    useGraphStore.setState({ activeSubgraphId: 'nested' });
    expect(guideObjectIsCurrent(request)).toBe(false);
    useGraphStore.setState({ activeSubgraphId: null, nodes: [] });
    expect(guideObjectIsCurrent(request)).toBe(false);
  });
});

it('requires a fresh result acknowledgement after a graph change', () => {
  useProjectionStore.setState({ currentRevisionId: 'checked' });
  openGuidance(undefined, 'p16'); useGuidanceStore.getState().update({ observed: true });
  const request = useGuidanceStore.getState().request!;
  expect(guideResultObserved(request, 'checked')).toBe(true);
  expect(guideResultObserved(request, 'edited')).toBe(false);
  useGuidanceStore.getState().update({ problemId: 'p17' });
  expect(guideResultObserved(useGuidanceStore.getState().request!, 'checked')).toBe(false);
});

it('never calls an empty graph, unavailable check or partial synchronization solved', () => {
  const graphGuide = GUIDE_PROBLEMS.find(p => p.verify.kind === 'graph')!;
  const fields = graphGuide.verify.kind === 'graph' ? graphGuide.verify.fields : [];
  const report: Record<string, unknown[]> = Object.fromEntries(fields.map(key => [key, []]));
  expect(verifyGuide(graphGuide, { graph: report as any, nodes: 0 }).state).toBe('unavailable');
  expect(verifyGuide(graphGuide, { graph: {} as any, nodes: 1 }).state).toBe('unavailable');
  expect(verifyGuide(graphGuide, { graph: report as any, nodes: 1 }).state).toBe('clear');
  report[fields[0]] = ['problem'];
  expect(verifyGuide(graphGuide, { graph: report as any, nodes: 1 }).state).toBe('attention');
  const syncGuide = GUIDE_PROBLEMS.find(p => p.verify.kind === 'sync')!;
  const status = { state: 'idle', metadataReport: { pending: 142, failed: 0, skipped: 2 } };
  expect(verifyGuide(syncGuide, { sync: status as any })).toEqual({ state: 'attention', count: 144 });
  status.metadataReport = { pending: 0, failed: 0, skipped: 0 };
  expect(verifyGuide(syncGuide, { sync: status as any }).state).toBe('clear');
  expect(verifyGuide(GUIDE_PROBLEMS.find(p => p.verify.kind === 'observed')!, {}).state).toBe('observed');
});
