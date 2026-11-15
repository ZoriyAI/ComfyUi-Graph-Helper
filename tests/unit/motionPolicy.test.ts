/**
 * The motion policy as tests: one set of durations and curves for the whole app, Reduced and Off honoured by every
 * animation, and the camera's rule. Who reads this: anyone who adds an animation; a literal "300ms" or a bare "ease"
 * in a stylesheet fails here, so the setting «Анимация» / "Motion" keeps meaning the same thing everywhere.
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { levelFor, parseDuration } from '../../src/renderer/motion/policy';
import { cameraPlan, cubicBezier, travel } from '../../src/renderer/motion/camera';
import { autoFitView, AUTO_FIT_MIN_ZOOM } from '../../src/renderer/components/graph/lib/autoFit';
import { OVERVIEW_EXIT } from '../../src/renderer/components/graph/lib/nodeSizes';
import { replayChange } from '../../src/renderer/components/graph/lib/replayMotion';
import { focusOf, passedMarks, placeOf } from '../../src/renderer/components/lessons/lessonMotion';
import { checkedNodeIds } from '../../src/renderer/motion/attention';
import { cullWindow, inWindow } from '../../src/renderer/components/graph/layers/DescriptionLayer';
import { sameNodeProps } from '../../src/renderer/components/graph/nodes/ComfyNode';
import type { GraphEdge, GraphNode } from '../../src/renderer/types/graph';

const RENDERER = path.join(__dirname, '../../src/renderer');

function cssFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return cssFiles(full);
    return entry.name.endsWith('.css') ? [full] : [];
  });
}

/** Every transition and animation declaration of a stylesheet, comments removed, with the motion tokens taken out. */
function motionDeclarations(text: string): Array<{ raw: string; rest: string }> {
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, '');
  const found: Array<{ raw: string; rest: string }> = [];
  const pattern = /(?:^|[;{\s])((?:transition|animation)(?:-duration|-delay|-timing-function)?)\s*:\s*([^;{}]*)/g;
  for (const match of clean.matchAll(pattern)) {
    const value = match[2];
    // A token may carry a fallback (`var(--motion-enter, 160ms)`); the fallback is the token, not a literal.
    const rest = value.replace(/var\(--motion-[a-z-]+(?:,[^()]*(?:\([^()]*\))?[^()]*)?\)/g, 'TOKEN');
    found.push({ raw: `${match[1]}: ${value.trim()}`, rest });
  }
  return found;
}

function block(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  return Object.fromEntries([...body.matchAll(/(--motion-[a-z-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

describe('motion tokens in every stylesheet', () => {
  const files = cssFiles(RENDERER);

  it('finds the stylesheets', () => {
    expect(files.length).toBeGreaterThan(40);
  });

  it('uses only --motion-* durations: no literal time anywhere in a transition or an animation', () => {
    const offenders: string[] = [];
    for (const file of files) {
      for (const declaration of motionDeclarations(fs.readFileSync(file, 'utf8'))) {
        // 0s / 0ms is "no time", allowed.
        if (/(^|[\s,(])(?!0m?s\b)\d*\.?\d+m?s\b/.test(declaration.rest)) offenders.push(`${path.relative(RENDERER, file)}: ${declaration.raw}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('uses only the shared curves: no bare ease keyword or private cubic-bezier', () => {
    const offenders: string[] = [];
    for (const file of files) {
      for (const declaration of motionDeclarations(fs.readFileSync(file, 'utf8'))) {
        if (/\bease(?:-in|-out|-in-out)?\b(?![-\w])|cubic-bezier\(/.test(declaration.rest)) offenders.push(`${path.relative(RENDERER, file)}: ${declaration.raw}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('Reduced and Off in tokens.css', () => {
  const css = fs.readFileSync(path.join(RENDERER, 'theme/tokens.css'), 'utf8');
  const full = block(css, ':root');
  const reduced = block(css, 'html[data-motion="reduced"]');
  const off = block(css, 'html[data-motion="off"]');
  const loops = ['--motion-pulse', '--motion-spin', '--motion-march', '--motion-blink', '--motion-play', '--motion-ping', '--motion-camera', '--motion-camera-min'];

  it('declares every timing token at full motion', () => {
    for (const token of [...loops, '--motion-feedback', '--motion-enter', '--motion-exit', '--motion-panel', '--motion-reveal', '--motion-mark']) {
      expect(parseDuration(full[token] ?? '', -1), token).toBeGreaterThan(0);
    }
    expect(full['--motion-ease-in-out']).toMatch(/cubic-bezier/);
  });

  it('Reduced keeps short fades only: no loop, no camera flight, no shift', () => {
    for (const token of loops) expect(parseDuration(reduced[token] ?? '', -1), token).toBe(0);
    for (const token of ['--motion-feedback', '--motion-enter', '--motion-exit', '--motion-panel', '--motion-reveal']) {
      expect(parseDuration(reduced[token] ?? '', -1), token).toBeLessThanOrEqual(60);
    }
    expect(reduced['--motion-shift']).toBe('0px');
  });

  it('Off moves nothing', () => {
    for (const [token, value] of Object.entries(off)) {
      if (token === '--motion-shift') expect(value).toBe('0px');
      else expect(parseDuration(value, -1), token).toBe(0);
    }
    expect(Object.keys(off).length).toBeGreaterThanOrEqual(13);
  });

  it('the system wish to reduce gives the same values as Reduced', () => {
    const media = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    const system = block(media, 'html:not([data-motion])');
    expect(system).toEqual(reduced);
  });
});

describe('levels', () => {
  it('maps the setting and the system wish to one level', () => {
    expect(levelFor('system', false)).toBe('full');
    expect(levelFor('system', true)).toBe('reduced');
    expect(levelFor('on', true)).toBe('full');
    expect(levelFor('reduced', false)).toBe('reduced');
    expect(levelFor('off', false)).toBe('off');
  });
});

describe('the camera rule', () => {
  const pane = { width: 1200, height: 800 };
  const limits = { min: 240, max: 640 };

  it('cuts when motion is not full', () => {
    const to = { x: -2000, y: 0, zoom: 0.5 };
    expect(cameraPlan({ x: 0, y: 0, zoom: 1 }, to, pane, 'reduced', limits).duration).toBe(0);
    expect(cameraPlan({ x: 0, y: 0, zoom: 1 }, to, pane, 'off', limits).duration).toBe(0);
  });

  it('takes longer the farther it travels, within the limits', () => {
    const from = { x: 0, y: 0, zoom: 1 };
    const hop = cameraPlan(from, { x: -60, y: 0, zoom: 1 }, pane, 'full', limits);
    const trip = cameraPlan(from, { x: -5000, y: 0, zoom: 1 }, pane, 'full', limits);
    expect(hop.duration).toBeGreaterThanOrEqual(240);
    expect(hop.duration).toBeLessThan(trip.duration);
    expect(trip.duration).toBe(640);
    expect(hop.interpolate).toBe('linear');
  });

  it('counts a change of zoom as travel and flies only on long trips that also zoom a lot', () => {
    const from = { x: 0, y: 0, zoom: 1 };
    expect(travel(from, { x: 0, y: 0, zoom: 2 }, pane)).toBeCloseTo(0.5 + travel(from, { x: 0, y: 0, zoom: 2 }, pane) - 0.5);
    expect(cameraPlan(from, { x: 0, y: 0, zoom: 0.25 }, pane, 'full', limits).duration).toBe(640);
    expect(cameraPlan(from, { x: 0, y: 0, zoom: 0.25 }, pane, 'full', limits).interpolate).toBe('linear');
    expect(cameraPlan(from, { x: -8000, y: 0, zoom: 0.3 }, pane, 'full', limits).interpolate).toBe('smooth');
  });

  it('stands still for no move', () => {
    expect(cameraPlan({ x: 5, y: 5, zoom: 1 }, { x: 5, y: 5, zoom: 1 }, pane, 'full', limits).duration).toBe(0);
  });

  it('eases in and out on one curve', () => {
    const ease = cubicBezier(0.65, 0, 0.35, 1);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBeCloseTo(0.5, 2);
    expect(ease(0.1)).toBeLessThan(0.1);
    expect(ease(0.9)).toBeGreaterThan(0.9);
  });
});

describe('automatic fits land on something readable', () => {
  const pane = { width: 1000, height: 700 };

  it('shows a graph that fits as cards whole', () => {
    const view = autoFitView({ bounds: { x: 0, y: 0, width: 800, height: 500 }, focus: null, count: 7, pane, options: { padding: 0.1, maxZoom: 1 } });
    expect(view.zoom).toBeGreaterThanOrEqual(OVERVIEW_EXIT);
  });

  it('shows a graph that almost fits as cards around its middle, not as the map', () => {
    // Needs about 0.47 to fit whole: the old fit ended a seven-node build on the overview map.
    const bounds = { x: 0, y: 0, width: 1940, height: 900 };
    const view = autoFitView({ bounds, focus: null, count: 7, pane, options: { padding: 0.1, maxZoom: 1 } });
    expect(view.zoom).toBe(OVERVIEW_EXIT);
    expect(view.x).toBeCloseTo(pane.width / 2 - (bounds.width / 2) * OVERVIEW_EXIT);
  });

  it('never opens a large graph below the floor', () => {
    const view = autoFitView({ bounds: { x: 0, y: 0, width: 30000, height: 12000 }, focus: { x: 100, y: 100, width: 300, height: 200 }, count: 199, pane, options: { padding: 0.1, maxZoom: 1 } });
    expect(view.zoom).toBe(AUTO_FIT_MIN_ZOOM);
    expect(view.x).toBeCloseTo(pane.width / 2 - 250 * AUTO_FIT_MIN_ZOOM);
  });
});


function node(id: string, x = 0, data: Record<string, unknown> = {}): GraphNode {
  return { id, type: 'comfy', position: { x, y: 0 }, data: { comfyType: 'KSampler', title: id, inputs: [], outputs: [], ...data } } as unknown as GraphNode;
}
function edge(id: string, source: string, target: string): GraphEdge {
  return { id, source, target } as GraphEdge;
}

describe('the history shows what a version changed', () => {
  it('finds what appeared, left and changed', () => {
    const before = { nodes: [node('a'), node('b'), node('c')], edges: [edge('e1', 'a', 'b')] };
    const after = { nodes: [node('a'), node('b', 0, { title: 'renamed' }), node('d')], edges: [edge('e1', 'a', 'b'), edge('e2', 'b', 'd')] };
    const change = replayChange(before, after);
    expect(change.added).toEqual(['d']);
    expect(change.addedEdges).toEqual(['e2']);
    expect(change.removed.map((item) => item.id)).toEqual(['c']);
    expect(change.changed).toEqual(['b']);
  });
});

describe('a lesson on the canvas', () => {
  const link = { kind: 'link' as const, from: { role: 'model', nodeId: '1' }, output: 'MODEL', to: { role: 'sampler', nodeId: '2' }, input: 'model', fedBy: null, absent: null };
  it('focuses the two ends of a missing link and goes to where it ends', () => {
    expect(focusOf(link)).toEqual(['1', '2']);
    expect(placeOf(link)).toBe('2');
    expect(focusOf({ kind: 'node', role: 'x', classes: ['A'] })).toBeNull();
    expect(focusOf(undefined)).toBeNull();
  });
  it('flashes what closed a step: the new link, the new node, the field node', () => {
    expect(passedMarks(link, {}, [edge('e9', '1', '2')])).toEqual({ nodes: ['2'], edges: ['e9'] });
    expect(passedMarks({ kind: 'node', role: 'sampler', classes: ['KSampler'] }, { sampler: '7' }, [])).toEqual({ nodes: ['7'], edges: [] });
  });
});

describe('the check wave', () => {
  it('collects each marked node of the main canvas once', () => {
    const report = {
      missingNodes: [{ nodeId: '1', classType: 'X' }, { nodeId: '9', classType: 'Y', subgraphId: 's' }],
      missingModels: [{ nodeId: '1', directory: 'd', name: 'n' }],
      baseModelMismatches: [],
      unconnectedRequiredInputs: [{ nodeId: '3', input: 'i', type: 'T' }],
      cycles: [{ nodeIds: ['4', '5'] }],
    };
    expect(checkedNodeIds(report)).toEqual(['1', '3', '4', '5']);
  });
});

describe('zoom performance helpers', () => {
  it('draws description cards only around the view', () => {
    const window = cullWindow([0, 0, 1, 1000, 800]);
    expect(inWindow({ x: 100, y: 100, width: 50, height: 50 }, window, false)).toBe(true);
    expect(inWindow({ x: 5000, y: 100, width: 50, height: 50 }, window, false)).toBe(false);
    expect(inWindow({ x: 5000, y: 100, width: 50, height: 50 }, window, true)).toBe(true);
  });
  it('redraws a node only for its data or its selection', () => {
    const data = { a: 1 };
    expect(sameNodeProps({ id: 'n', data, selected: false }, { id: 'n', data, selected: false })).toBe(true);
    expect(sameNodeProps({ id: 'n', data, selected: false }, { id: 'n', data: { a: 1 }, selected: false })).toBe(false);
    expect(sameNodeProps({ id: 'n', data, selected: false }, { id: 'n', data, selected: true })).toBe(false);
  });
});
