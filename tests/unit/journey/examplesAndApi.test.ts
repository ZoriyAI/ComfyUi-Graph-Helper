/**
 * Ready examples built from lessons (shared/lessons/example.ts) and API-format workflows turned into canvas workflows
 * (shared/workflow/apiPrompt.ts); main/ipc/openIpc.ts uses both to open an example or an API-format file. A person
 * who opens an example must get a complete, linked graph that fits their ComfyUI, and an API file must open with its
 * node numbers, values and links, laid out to read left to right.
 */
import { describe, expect, it } from 'vitest';
import { parseObjectInfo } from '../../../src/shared/catalog/objectInfo';
import type { CatalogView } from '../../../src/shared/catalog/types';
import { exampleFromLesson } from '../../../src/shared/lessons/example';
import { lessonById, LESSONS } from '../../../src/shared/lessons/lessons';
import { apiPromptToWorkflow, isApiPromptDocument } from '../../../src/shared/workflow/apiPrompt';
import { classifyWorkflow, projectWorkflow } from '../../../src/shared/workflow/codec';
import { objectInfoDocument, CLASSES, VIDEO_CLASSES } from '../../fixtures/mcp/fakeMcpServer';

/** The node list of the test ComfyUI (the fake MCP server's), as main reads it from the database. */
function catalogOf(video = false): CatalogView {
  const parsed = parseObjectInfo(objectInfoDocument(video ? [...CLASSES, ...VIDEO_CLASSES] : CLASSES));
  return { nodeTypes: parsed.nodes.map((node) => node.classType), nodes: parsed.nodes, models: parsed.models };
}

describe('examples built from lessons', () => {
  it('the first picture lesson becomes a graph of its seven nodes, fully linked, with a model file and a prompt', () => {
    const catalog = catalogOf();
    const example = exampleFromLesson(lessonById('image')!, catalog);
    expect(example).not.toBeNull();
    const nodes = Object.values(example!);
    expect(nodes.map((node) => node.class_type).sort()).toEqual(['CLIPTextEncode', 'CLIPTextEncode', 'CheckpointLoaderSimple', 'EmptyLatentImage', 'KSampler', 'SaveImage', 'VAEDecode']);
    const sampler = nodes.find((node) => node.class_type === 'KSampler')!;
    for (const input of ['model', 'positive', 'negative', 'latent_image']) expect(Array.isArray(sampler.inputs[input])).toBe(true);
    const loader = nodes.find((node) => node.class_type === 'CheckpointLoaderSimple')!;
    expect(typeof loader.inputs.ckpt_name).toBe('string');
    expect(nodes.some((node) => node.class_type === 'CLIPTextEncode' && typeof node.inputs.text === 'string' && (node.inputs.text as string).length > 10)).toBe(true);
  });

  it('opens as a canvas workflow with every link drawn', () => {
    const catalog = catalogOf();
    const workflow = apiPromptToWorkflow(exampleFromLesson(lessonById('image')!, catalog) as never, catalog);
    expect(classifyWorkflow(workflow)).toBe('ui-v0.4');
    const projected = projectWorkflow(workflow);
    expect('snapshot' in projected).toBe(true);
    if ('snapshot' in projected) {
      expect(projected.snapshot.nodes).toHaveLength(7);
      expect(projected.snapshot.edges.length).toBeGreaterThanOrEqual(9);
    }
  });

  it('no example for adult lessons, and none when a class is missing', () => {
    const catalog = catalogOf();
    for (const lesson of LESSONS.filter((item) => item.id.startsWith('adult'))) expect(exampleFromLesson(lesson, catalog)).toBeNull();
    const without: CatalogView = { ...catalog, nodes: catalog.nodes.filter((node) => node.classType !== 'KSampler'), nodeTypes: catalog.nodeTypes.filter((type) => type !== 'KSampler') };
    expect(exampleFromLesson(lessonById('image')!, without)).toBeNull();
  });

  it('builds a video example on a ComfyUI with the video nodes', () => {
    expect(exampleFromLesson(lessonById('video-text')!, catalogOf(true))).not.toBeNull();
  });
});

describe('API-format workflows', () => {
  const prompt = {
    '3': { class_type: 'KSampler', inputs: { seed: 7, steps: 20, cfg: 7, sampler_name: 'euler', scheduler: 'normal', denoise: 1, model: ['4', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['5', 0] } },
    '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'sd_xl_base_1.0.safetensors' } },
    '5': { class_type: 'EmptyLatentImage', inputs: { width: 512, height: 512, batch_size: 1 } },
    '6': { class_type: 'CLIPTextEncode', inputs: { text: 'a lake', clip: ['4', 1] }, _meta: { title: 'Positive' } },
    '7': { class_type: 'CLIPTextEncode', inputs: { text: '', clip: ['4', 1] } },
  };

  it('is recognised and keeps node numbers, links, values and titles', () => {
    expect(isApiPromptDocument(prompt)).toBe(true);
    expect(isApiPromptDocument({ nodes: [], links: [] })).toBe(false);
    const workflow = apiPromptToWorkflow(prompt, catalogOf()) as { nodes: Array<Record<string, any>>; links: unknown[][] };
    expect(workflow.nodes.map((node) => node.id).sort()).toEqual([3, 4, 5, 6, 7]);
    expect(workflow.links).toHaveLength(6);
    const sampler = workflow.nodes.find((node) => node.id === 3)!;
    expect(sampler.widgets_values[0]).toBe(7);
    expect(sampler.widgets_values).toContain('euler');
    expect(workflow.nodes.find((node) => node.id === 6)!.title).toBe('Positive');
    // Read left to right: the loader before the texts, the texts before the sampler.
    const x = (id: number) => workflow.nodes.find((node) => node.id === id)!.pos[0];
    expect(x(4)).toBeLessThan(x(6));
    expect(x(6)).toBeLessThan(x(3));
    expect('snapshot' in projectWorkflow(workflow)).toBe(true);
  });

  it('opens without a node list: values kept in the file order, links still drawn', () => {
    const workflow = apiPromptToWorkflow(prompt, null) as { nodes: Array<Record<string, any>>; links: unknown[][] };
    expect(workflow.links).toHaveLength(6);
    expect(workflow.nodes.find((node) => node.id === 5)!.widgets_values).toEqual([512, 512, 1]);
    expect('snapshot' in projectWorkflow(workflow)).toBe(true);
  });
});
