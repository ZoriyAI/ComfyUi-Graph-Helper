/**
 * The prompt notes of the graph check (promptNotes in src/main/knowledge/promptCheck): the descriptions of a graph
 * read as ComfyUI will read them: which texts reach which sampler, through what, how the model that takes them
 * reads text, and what follows for each text (LoRA tags, weights, negations, cfg 1, missing trigger words).
 * Why: a learner's prompt often fails for reasons ComfyUI never reports; the tutor points at the exact text node.
 */
import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/main/settings/migrate';
import { readCatalog, upsertModelFiles, writeModelEnrichment } from '../../src/main/catalog/repository';
import { promptNotes } from '../../src/main/knowledge/promptCheck';

type Port = { id: string; name: string; dataType: string };
type Node = { id: string; data: { comfyType: string; parameters: Record<string, unknown>; inputs: Port[]; outputs: Port[] } };
type Edge = { source: string; sourceHandle: string; target: string; targetHandle: string };

/** Port and class specs for the nodes these tests use; widget inputs get no socket. */
const port = (name: string, dataType: string): Port => ({ id: name, name, dataType });
const SPECS = new Map([
  ['CheckpointLoaderSimple', { inputs: [{ name: 'ckpt_name', type: 'COMBO', widget: true }], outputs: [{ name: 'MODEL', type: 'MODEL' }, { name: 'CLIP', type: 'CLIP' }, { name: 'VAE', type: 'VAE' }] }],
  ['CLIPLoader', { inputs: [{ name: 'clip_name', type: 'COMBO', widget: true }, { name: 'type', type: 'COMBO', widget: true }], outputs: [{ name: 'CLIP', type: 'CLIP' }] }],
  ['CLIPTextEncode', { inputs: [{ name: 'text', type: 'STRING', widget: true }, { name: 'clip', type: 'CLIP', widget: false }], outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING' }] }],
  ['KSampler', { inputs: [{ name: 'model', type: 'MODEL', widget: false }, { name: 'positive', type: 'CONDITIONING', widget: false }, { name: 'negative', type: 'CONDITIONING', widget: false }, { name: 'latent_image', type: 'LATENT', widget: false }, { name: 'cfg', type: 'FLOAT', widget: true }], outputs: [{ name: 'LATENT', type: 'LATENT' }] }],
  ['LoraLoader', { inputs: [{ name: 'model', type: 'MODEL', widget: false }, { name: 'clip', type: 'CLIP', widget: false }, { name: 'lora_name', type: 'COMBO', widget: true }], outputs: [{ name: 'MODEL', type: 'MODEL' }, { name: 'CLIP', type: 'CLIP' }] }],
  ['WanImageToVideo', { inputs: [{ name: 'positive', type: 'CONDITIONING', widget: false }, { name: 'negative', type: 'CONDITIONING', widget: false }, { name: 'vae', type: 'VAE', widget: false }], outputs: [{ name: 'positive', type: 'CONDITIONING' }, { name: 'negative', type: 'CONDITIONING' }, { name: 'latent', type: 'LATENT' }] }],
  ['LoadWanVideoT5TextEncoder', { inputs: [{ name: 'model_name', type: 'COMBO', widget: true }], outputs: [{ name: 'wan_t5_model', type: 'WANTEXTENCODER' }] }],
  ['WanVideoTextEncode', { inputs: [{ name: 'positive_prompt', type: 'STRING', widget: true }, { name: 'negative_prompt', type: 'STRING', widget: true }, { name: 't5', type: 'WANTEXTENCODER', widget: false }], outputs: [{ name: 'text_embeds', type: 'WANVIDEOTEXTEMBEDS' }] }],
  ['WanVideoLoraSelect', { inputs: [{ name: 'lora', type: 'COMBO', widget: true }, { name: 'prev_lora', type: 'WANVIDLORA', widget: false }], outputs: [{ name: 'lora', type: 'WANVIDLORA' }] }],
  ['WanVideoModelLoader', { inputs: [{ name: 'model', type: 'COMBO', widget: true }, { name: 'lora', type: 'WANVIDLORA', widget: false }], outputs: [{ name: 'model', type: 'WANVIDEOMODEL' }] }],
  ['WanVideoSampler', { inputs: [{ name: 'model', type: 'WANVIDEOMODEL', widget: false }, { name: 'image_embeds', type: 'WANVIDIMAGE_EMBEDS', widget: false }, { name: 'text_embeds', type: 'WANVIDEOTEXTEMBEDS', widget: false }, { name: 'cfg', type: 'FLOAT', widget: true }], outputs: [{ name: 'samples', type: 'LATENT' }] }],
  ['ConditioningCombine', { inputs: [{ name: 'conditioning_1', type: 'CONDITIONING', widget: false }, { name: 'conditioning_2', type: 'CONDITIONING', widget: false }], outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING' }] }],
]);

/** A graph node of a class from SPECS with the given field values. */
function node(id: string, comfyType: string, parameters: Record<string, unknown> = {}): Node {
  const spec = SPECS.get(comfyType)!;
  return {
    id,
    data: {
      comfyType,
      parameters,
      inputs: spec.inputs.filter((input) => !input.widget).map((input) => port(input.name, input.type)),
      outputs: spec.outputs.map((output) => port(output.name, output.type)),
    },
  };
}
const link = (source: string, sourceHandle: string, target: string, targetHandle: string): Edge => ({ source, sourceHandle, target, targetHandle });

/** A catalog with an SDXL and a Flux checkpoint, an SDXL LoRA with trigger words and one without. */
function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  upsertModelFiles(db, [
    { directory: 'checkpoints', name: 'base_sdxl.safetensors', sizeBytes: 1 },
    { directory: 'checkpoints', name: 'base_flux.safetensors', sizeBytes: 1 },
    { directory: 'loras', name: 'neon.safetensors', sizeBytes: 1 },
    { directory: 'loras', name: 'quiet.safetensors', sizeBytes: 1 },
  ], 1);
  const enrich = (directory: string, name: string, kind: string, baseModel: string, triggerWords: string[]) => writeModelEnrichment(db, directory, name, {
    kind, baseModel, baseModelEvidence: 'metadata', triggerWords, description: '', sourceUrl: null, metadata: {}, enrichedAt: 2,
  });
  enrich('checkpoints', 'base_sdxl.safetensors', 'checkpoint', 'sdxl', []);
  enrich('checkpoints', 'base_flux.safetensors', 'checkpoint', 'flux1', []);
  enrich('loras', 'neon.safetensors', 'lora', 'sdxl', ['neon rain', 'wet glass']);
  enrich('loras', 'quiet.safetensors', 'lora', 'sdxl', []);
  return db;
}

/** A picture graph: checkpoint → two texts → sampler. */
function pictureGraph(texts: { positive: string; negative: string }, options: { cfg?: number; checkpoint?: string } = {}) {
  const nodes = [
    node('1', 'CheckpointLoaderSimple', { ckpt_name: options.checkpoint ?? 'base_sdxl.safetensors' }),
    node('2', 'CLIPTextEncode', { text: texts.positive }),
    node('3', 'CLIPTextEncode', { text: texts.negative }),
    node('4', 'KSampler', { cfg: options.cfg ?? 7 }),
  ];
  const edges = [
    link('1', 'CLIP', '2', 'clip'),
    link('1', 'CLIP', '3', 'clip'),
    link('1', 'MODEL', '4', 'model'),
    link('2', 'CONDITIONING', '4', 'positive'),
    link('3', 'CONDITIONING', '4', 'negative'),
  ];
  return { nodes, edges };
}

/** Runs the check on a graph; `brief` shortens each note to kind@node. */
const run = (db: Database.Database, graph: { nodes: Node[]; edges: Edge[] }) => promptNotes(db, graph.nodes, graph.edges, SPECS, readCatalog(db));
const brief = (notes: ReturnType<typeof promptNotes>) => notes.map((note) => `${note.kind}@${note.nodeId}`);

describe('the descriptions of a graph', () => {
  it('finds nothing to say about a sound picture graph', () => {
    const db = openDb();
    expect(run(db, pictureGraph({ positive: 'a quiet lake at dawn, (mist:1.2), soft light', negative: 'blurry, distorted' }))).toEqual([]);
    // A graph without a sampler has no description to read.
    expect(promptNotes(db, [node('2', 'CLIPTextEncode', { text: '<lora:x:1>' })], [], SPECS, readCatalog(db))).toEqual([]);
    db.close();
  });

  it('reads each text in its place: what is wanted, what is not, and who reads it', () => {
    const db = openDb();
    const notes = run(db, pictureGraph({ positive: 'a street with no cars, <lora:neon:0.8>, (rain:1.9)', negative: 'no people, BREAK blurry' }));
    expect(brief(notes)).toEqual(['lora-tag@2', 'weight-high@2', 'negation@2', 'foreign-syntax@3']);
    expect(notes[0]).toMatchObject({ classType: 'CLIPTextEncode', found: '<lora:neon:0.8>' });
    // The same weights on a model that reads sentences are said to do little.
    const flux = run(db, pictureGraph({ positive: 'A (castle:1.2) on a hill.', negative: '' }, { checkpoint: 'base_flux.safetensors' }));
    expect(brief(flux)).toEqual(['weight-ignored@2']);
    // And on a model whose family is not known, nothing is claimed.
    const unknown = run(db, pictureGraph({ positive: 'A (castle:1.2) on a hill.', negative: '' }, { checkpoint: 'never_seen.safetensors' }));
    expect(unknown).toEqual([]);
    db.close();
  });

  it('says a negative description does nothing at cfg 1, and an empty description draws at random', () => {
    const db = openDb();
    const silent = run(db, pictureGraph({ positive: 'a lake', negative: 'blurry' }, { cfg: 1 }));
    expect(silent).toEqual([{ kind: 'negative-ignored', nodeId: '3', classType: 'CLIPTextEncode', found: '', numbers: { cfg: 1 }, samplerId: '4' }]);
    expect(run(db, pictureGraph({ positive: 'a lake', negative: '' }, { cfg: 1 }))).toEqual([]);
    expect(run(db, pictureGraph({ positive: 'a lake', negative: 'blurry' }, { cfg: 1.5 }))).toEqual([]);
    const empty = run(db, pictureGraph({ positive: '  ', negative: 'blurry' }));
    expect(brief(empty)).toEqual(['empty-positive@2']);
    db.close();
  });

  it('finds the same thing wanted and forbidden', () => {
    const db = openDb();
    const notes = run(db, pictureGraph({ positive: 'a portrait, soft light, film grain', negative: 'blurry, Film Grain' }));
    expect(notes).toEqual([{ kind: 'contradiction', nodeId: '2', classType: 'CLIPTextEncode', found: 'film grain' }]);
    db.close();
  });

  it('asks for the words of a LoRA that stands on the way to the sampler', () => {
    const db = openDb();
    const graph = pictureGraph({ positive: 'a street at night', negative: '' });
    graph.nodes.push(node('5', 'LoraLoader', { lora_name: 'neon.safetensors' }), node('6', 'LoraLoader', { lora_name: 'quiet.safetensors' }), node('7', 'LoraLoader', { lora_name: 'neon.safetensors' }));
    // checkpoint → 5 → 6 → sampler; 7 hangs unconnected and is nobody's business.
    graph.edges = graph.edges.filter((edge) => !(edge.target === '4' && edge.targetHandle === 'model'));
    graph.edges.push(link('1', 'MODEL', '5', 'model'), link('5', 'MODEL', '6', 'model'), link('6', 'MODEL', '4', 'model'));
    expect(run(db, graph)).toEqual([{ kind: 'missing-trigger', nodeId: '5', classType: 'LoraLoader', found: '', model: 'neon.safetensors', words: ['neon rain', 'wet glass'] }]);
    graph.nodes[1].data.parameters.text = 'a street at night, Wet Glass';
    expect(run(db, graph)).toEqual([]);
    db.close();
  });

  it('follows a description through the nodes that pass it on, keeping wanted and unwanted apart', () => {
    const db = openDb();
    // Video from a picture: both texts go through one node, and the sampler takes them from its outputs.
    const nodes = [
      node('1', 'CLIPLoader', { clip_name: 'umt5.safetensors', type: 'wan' }),
      node('2', 'CLIPTextEncode', { text: 'The (camera:1.3) moves slowly to the left.' }),
      node('3', 'CLIPTextEncode', { text: 'blurry [bad]' }),
      node('8', 'WanImageToVideo'),
      node('4', 'KSampler', { cfg: 1 }),
      node('9', 'KSampler', { cfg: 1 }),
    ];
    const edges = [
      link('1', 'CLIP', '2', 'clip'), link('1', 'CLIP', '3', 'clip'),
      link('2', 'CONDITIONING', '8', 'positive'), link('3', 'CONDITIONING', '8', 'negative'),
      link('8', 'positive', '4', 'positive'), link('8', 'negative', '4', 'negative'),
      link('8', 'positive', '9', 'positive'), link('8', 'negative', '9', 'negative'),
    ];
    const notes = promptNotes(db, nodes, edges, SPECS, readCatalog(db));
    // Two samplers share the texts: each thing is said once. The two passes of a video at cfg 1 make one sentence
    // about the second text, not the same sentence twice; it names the first sampler.
    expect(brief(notes)).toEqual(['weight-ignored@2', 'foreign-syntax@3', 'negative-ignored@3']);
    expect(notes.filter((note) => note.kind === 'negative-ignored').map((note) => note.samplerId)).toEqual(['4']);
    db.close();
  });

  it('reads every text that is combined into one description', () => {
    const db = openDb();
    const graph = pictureGraph({ positive: 'a lake', negative: '' });
    graph.nodes.push(node('5', 'CLIPTextEncode', { text: 'озеро без лодок' }), node('6', 'ConditioningCombine'));
    graph.edges = graph.edges.filter((edge) => !(edge.target === '4' && edge.targetHandle === 'positive'));
    graph.edges.push(link('1', 'CLIP', '5', 'clip'), link('2', 'CONDITIONING', '6', 'conditioning_1'), link('5', 'CONDITIONING', '6', 'conditioning_2'), link('6', 'CONDITIONING', '4', 'positive'));
    expect(brief(run(db, graph))).toEqual(['negation@5', 'not-english@5']);
    db.close();
  });

  it('reads the two descriptions of a WanVideoWrapper text node, the way a T5 model reads them', () => {
    const db = openDb();
    const wrapper = (texts: { positive: string; negative: string }, cfg = 3.5, lora?: string) => {
      const nodes = [
        node('1', 'LoadWanVideoT5TextEncoder', { model_name: 'umt5.safetensors' }),
        node('2', 'WanVideoTextEncode', { positive_prompt: texts.positive, negative_prompt: texts.negative }),
        node('3', 'WanVideoModelLoader', { model: 'wan_high.safetensors' }),
        node('4', 'WanVideoSampler', { cfg }),
      ];
      const edges = [link('1', 'wan_t5_model', '2', 't5'), link('2', 'text_embeds', '4', 'text_embeds'), link('3', 'model', '4', 'model')];
      if (lora) {
        nodes.push(node('5', 'WanVideoLoraSelect', { lora }));
        edges.push(link('5', 'lora', '3', 'lora'));
      }
      return { nodes, edges };
    };
    expect(run(db, wrapper({ positive: 'A woman walks along a wet street at night. The camera follows her.', negative: 'blurry, static' }))).toEqual([]);
    // Weights do little on a T5 reader; a LoRA written into the text does nothing; "no" in what is wanted works the other way.
    expect(brief(run(db, wrapper({ positive: 'A street with no cars, <lora:neon:1>, (rain:1.2).', negative: '' })))).toEqual(['lora-tag@2', 'weight-ignored@2', 'negation@2']);
    // The negative text at cfg 1, an empty description, the same thing in both.
    expect(run(db, wrapper({ positive: 'A lake at dawn.', negative: 'blurry' }, 1))).toEqual([{ kind: 'negative-ignored', nodeId: '2', classType: 'WanVideoTextEncode', found: '', numbers: { cfg: 1 }, samplerId: '4' }]);
    // Two passes at cfg 1 that take the same text: it is said once.
    const twoPasses = wrapper({ positive: 'A lake at dawn.', negative: 'blurry' }, 1);
    twoPasses.nodes.push(node('6', 'WanVideoSampler', { cfg: 1 }));
    twoPasses.edges.push(link('2', 'text_embeds', '6', 'text_embeds'));
    expect(brief(run(db, twoPasses))).toEqual(['negative-ignored@2']);
    expect(brief(run(db, wrapper({ positive: ' ', negative: '' })))).toEqual(['empty-positive@2']);
    expect(brief(run(db, wrapper({ positive: 'a portrait, film grain', negative: 'film grain' })))).toEqual(['contradiction@2']);
    // A LoRA chosen for the wrapper's model loader is held to its words.
    expect(run(db, wrapper({ positive: 'A street at night.', negative: '' }, 3.5, 'neon.safetensors'))).toEqual([{ kind: 'missing-trigger', nodeId: '5', classType: 'WanVideoLoraSelect', found: '', model: 'neon.safetensors', words: ['neon rain', 'wet glass'] }]);
    expect(run(db, wrapper({ positive: 'A street at night, neon rain.', negative: '' }, 3.5, 'neon.safetensors'))).toEqual([]);
    db.close();
  });

  it('survives a graph that loops or is half built', () => {
    const db = openDb();
    const graph = pictureGraph({ positive: 'a lake', negative: 'blurry' });
    graph.nodes.push(node('6', 'ConditioningCombine'));
    graph.edges = graph.edges.filter((edge) => !(edge.target === '4' && edge.targetHandle === 'positive'));
    // The combine node feeds the sampler and itself.
    graph.edges.push(link('6', 'CONDITIONING', '4', 'positive'), link('6', 'CONDITIONING', '6', 'conditioning_1'));
    expect(run(db, graph)).toEqual([]);
    expect(promptNotes(db, [node('4', 'KSampler', { cfg: 7 })], [], SPECS, readCatalog(db))).toEqual([]);
    expect(promptNotes(db, [], [], SPECS, readCatalog(db))).toEqual([]);
    db.close();
  });
});
