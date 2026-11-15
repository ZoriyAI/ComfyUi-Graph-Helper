import { describe, expect, it } from 'vitest';
import i18next from 'i18next';
import { en } from '../../src/shared/i18n/catalog';
import { lackLines, nodeLabel, type LackContext } from '../../src/renderer/components/lessons/lackText';
import { lessonProgress, type LessonGraph, type LessonNode } from '../../src/shared/lessons/engine';
import { lessonById } from '../../src/shared/lessons/lessons';
import { useGraphStore } from '../../src/renderer/state/graphState';

/**
 * "Still to do" as a person reads it: which of two alike nodes a sentence is about, two prompts that are swapped,
 * a node of a similar class, and the reason a number is asked for. The panel shows these sentences as they are.
 */

const t = i18next.createInstance();
void t.init({ lng: 'en', resources: { en: { translation: en } }, interpolation: { escapeValue: false } });
const tr = t.t.bind(t) as never;

const port = (prefix: string, names: string[]) => names.map((name, index) => ({ id: `${prefix}-${index}`, name, type: name.toUpperCase() }));
function make(id: string, classType: string, inputs: string[], outputs: string[], values: Record<string, unknown> = {}): LessonNode {
  return { id, classType, inputs: port('in', inputs), outputs: port('out', outputs), values };
}

function picture(swap: boolean): LessonGraph {
  const nodes = [
    make('ck', 'CheckpointLoaderSimple', ['ckpt_name'], ['MODEL', 'CLIP', 'VAE'], { ckpt_name: 'juggernautXL_v9.safetensors' }),
    make('a', 'CLIPTextEncode', ['clip', 'text'], ['CONDITIONING'], { text: 'a quiet lake at dawn, mist' }),
    make('b', 'CLIPTextEncode', ['clip', 'text'], ['CONDITIONING'], { text: '' }),
    make('lat', 'EmptyLatentImage', ['width', 'height'], ['LATENT'], { width: 1024, height: 1024 }),
    make('ks', 'KSampler', ['model', 'positive', 'negative', 'latent_image'], ['LATENT']),
  ];
  const link = (from: string, fromPort: string, to: string, toPort: string) => ({ from, fromPort, to, toPort });
  return {
    nodes,
    links: [
      link('ck', 'out-1', 'a', 'in-0'), link('ck', 'out-1', 'b', 'in-0'), link('ck', 'out-0', 'ks', 'in-0'),
      link(swap ? 'b' : 'a', 'out-0', 'ks', 'in-1'), link(swap ? 'a' : 'b', 'out-0', 'ks', 'in-2'), link('lat', 'out-0', 'ks', 'in-3'),
    ],
  };
}

function context(graph: LessonGraph, roles: Record<string, string>): LackContext {
  useGraphStore.setState({ nodes: graph.nodes.map((node) => ({ id: node.id, type: 'comfy', position: { x: 0, y: 0 }, data: { comfyType: node.classType, title: node.classType === 'CLIPTextEncode' ? 'CLIP Text Encode (Prompt)' : node.classType, inputs: [], outputs: [], parameters: {} } })) } as never);
  return { details: {}, graph, facts: {}, roles, language: 'en' };
}

describe('what a lesson says is still to do', () => {
  it('names two prompts that are swapped as one mistake', () => {
    const lesson = lessonById('image')!;
    const graph = picture(true);
    const progress = lessonProgress(lesson, graph, {}, new Set(['intro']));
    const lines = lackLines(tr, progress.missing, lesson, context(graph, progress.roles)).map((line) => line.text);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^The two prompts are swapped: the input (positive|negative) of “KSampler” gets “CLIP Text Encode \(Prompt\)/);
  });

  it('tells two alike nodes apart by their part in the lesson, and leaves a single node as it is', () => {
    const graph = picture(false);
    const ctx = context(graph, { positive: 'a', negative: 'b', sampler: 'ks' });
    expect(nodeLabel(tr, 'a', ctx)).toBe('CLIP Text Encode (Prompt) (prompt)');
    expect(nodeLabel(tr, 'b', ctx)).toBe('CLIP Text Encode (Prompt) (negative prompt)');
    expect(nodeLabel(tr, 'ks', ctx)).toBe('KSampler');
  });

  it('says what differs when a similar node stands where another is asked for', () => {
    const lesson = lessonById('image')!;
    const graph = picture(false);
    graph.nodes[4] = { ...graph.nodes[4], classType: 'KSamplerAdvanced' };
    const progress = lessonProgress(lesson, graph, {}, new Set(['intro']));
    const lines = lackLines(tr, progress.missing, lesson, context(graph, progress.roles)).map((line) => line.text);
    expect(lines[0]).toContain('The canvas has “KSamplerAdvanced”, but this step needs “KSampler”.');
  });

  it('gives the reason of a number, and says a fresh node\'s own number is not a choice', () => {
    const lesson = lessonById('refine')!;
    const missing = [{ kind: 'field' as const, role: 'samplerB', nodeId: 'ks', field: 'denoise', test: { kind: 'between' as const, min: 0.2, max: 0.5, prefer: 0.5 }, value: 1, absent: false, other: null, reason: 'denoise' }];
    const graph = picture(false);
    const [line] = lackLines(tr, missing, lesson, context(graph, {}));
    expect(line.text).toBe('The field denoise of “KSampler” is 1. Set it from 0.2 to 0.5. The step says 0.5. This is how much of the picture the second model redraws. At 0.5 the composition stays and the texture changes.');
    const [fresh] = lackLines(tr, [{ ...missing[0], value: 0.2, untouched: true }], lesson, context(graph, {}));
    expect(fresh.text).toContain('still holds 0.2, the number a new node starts with. Set 0.5.');
  });
});
