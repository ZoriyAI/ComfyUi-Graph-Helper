/**
 * The files a model manager keeps next to a model file (src/shared/knowledge/sidecar): which file is a
 * description or a preview and whose, and what a Lora Manager or bare Civitai record says (base, trigger words,
 * description, usage, examples, adult flag, fingerprint), with markup removed and sizes bounded.
 * Why: these records fill the model card the person reads; a wrong match would describe another model, and raw
 * HTML from the internet must never reach the screen.
 */
import { describe, expect, it } from 'vitest';
import {
  EMPTY_NOTES,
  SideFileIndex,
  modelBase,
  notesFromJson,
  notesSaySomething,
  parseSidecarFile,
  previewKind,
  previewMime,
  sideFileOf,
} from '../../src/shared/knowledge/sidecar';

/** A Lora Manager record, shaped like the ones it writes next to a file (the Civitai record sits under `civitai`). */
const MANAGER = {
  file_name: 'film_grain_v1',
  model_name: 'Film Grain - analog look',
  file_path: '/srv/comfyui/models/loras/film_grain_v1.safetensors',
  size: 85_094_896,
  sha256: '9e76948abf9163e9d31bd86a5c12a2ef2e0161589f25dc6b2fa11ca2f620502c',
  base_model: 'ZImageTurbo',
  preview_url: '/srv/comfyui/models/loras/film_grain_v1.webp',
  preview_nsfw_level: 1,
  notes: 'Works best on portraits.\nKeep it under 0.9.',
  from_civitai: true,
  civitai: {
    id: 2720926,
    modelId: 233140,
    name: 'v1.0 - Z IMAGE',
    trainedWords: ['FILMGRAIN', 'analog film, grain'],
    baseModel: 'ZImageTurbo',
    description: '<p>Retrained on a larger set.</p>',
    model: {
      name: 'Film Grain - analog look',
      type: 'LORA',
      nsfw: false,
      description: '<h3>What it does</h3><p>Adds <b>film grain</b> &amp; soft halation.</p><script>alert(1)</script><ul><li>portraits</li><li>streets</li></ul>',
      tags: ['style', 'film', 'photography'],
    },
    images: [
      { url: 'https://example.invalid/1.jpeg', nsfwLevel: 1, type: 'image', meta: { prompt: 'FILMGRAIN, a street at dusk, wet asphalt', negativePrompt: 'blurry', steps: 8, cfgScale: 1, sampler: 'euler' } },
      { url: 'https://example.invalid/2.jpeg', nsfwLevel: 1, type: 'image', meta: { prompt: 'FILMGRAIN, a street at dusk, wet asphalt' } },
      { url: 'https://example.invalid/3.jpeg', nsfwLevel: 8, type: 'image', meta: { prompt: 'FILMGRAIN, a portrait by a window', steps: 'many' } },
      { url: 'https://example.invalid/4.jpeg', nsfwLevel: 1, type: 'image', meta: null },
    ],
    creator: { username: 'someone' },
  },
  tags: ['style'],
  modelDescription: '<p>Fallback text.</p>',
  usage_tips: '{"strength": 0.8, "strength_min": 0.6, "strength_max": 1, "clip_skip": 2}',
};

describe('the files next to a model', () => {
  it('knows which file is a description and which a picture, and whose', () => {
    expect(modelBase('sub/film_grain_v1.safetensors')).toBe('sub/film_grain_v1');
    expect(modelBase('readme.txt')).toBeNull();
    expect(sideFileOf('film_grain_v1.metadata.json')).toEqual({ base: 'film_grain_v1', role: 'sidecar', rank: 0 });
    expect(sideFileOf('film_grain_v1.civitai.info')).toEqual({ base: 'film_grain_v1', role: 'sidecar', rank: 1 });
    expect(sideFileOf('film_grain_v1.preview.png')).toMatchObject({ base: 'film_grain_v1', role: 'preview' });
    expect(sideFileOf('sub/Film Grain.WEBP')).toMatchObject({ base: 'sub/Film Grain', role: 'preview' });
    expect(sideFileOf('film_grain_v1.mp4')).toMatchObject({ base: 'film_grain_v1', role: 'preview' });
    // Not side files: the model itself, hidden files, a bare suffix, other documents.
    for (const name of ['film_grain_v1.safetensors', '.cache/x.webp', '.metadata.json', 'notes.txt', 'config.yaml', '']) expect(sideFileOf(name), name).toBeNull();
    expect(previewKind('a.mp4')).toBe('video');
    expect(previewKind('a.webp')).toBe('image');
    expect(previewMime('a.JPG')).toBe('image/jpeg');
    expect(previewMime('a.webm')).toBe('video/webm');
  });

  it('hands each model the files that carry its name, a still before a video', () => {
    const index = new SideFileIndex();
    for (const name of ['a.safetensors', 'a.mp4', 'a.webp', 'a.civitai.info', 'a.metadata.json', 'b.preview.jpeg', 'sub/c.png', 'c.png', 'readme.md']) index.add(name);
    expect(index.for('a.safetensors')).toEqual({ sidecar: 'a.metadata.json', preview: 'a.webp' });
    expect(index.for('a.gguf')).toEqual({ sidecar: 'a.metadata.json', preview: 'a.webp' });
    expect(index.for('b.safetensors')).toEqual({ sidecar: null, preview: 'b.preview.jpeg' });
    // A file of the same name in another folder is another model's.
    expect(index.for('sub/c.safetensors')).toEqual({ sidecar: null, preview: 'sub/c.png' });
    expect(index.for('d.safetensors')).toEqual({ sidecar: null, preview: null });
    expect(index.for('readme.md')).toEqual({ sidecar: null, preview: null });
  });
});

describe('what a sidecar says', () => {
  it('reads a Lora Manager record: name, base, words, description, tags, notes, usage, examples', () => {
    const parsed = parseSidecarFile(MANAGER)!;
    expect(parsed.facts).toEqual({
      baseModel: 'ZImageTurbo',
      trainedWords: ['FILMGRAIN', 'analog film', 'grain'],
      description: 'What it does\nAdds film grain & soft halation.\n• portraits\n• streets\nRetrained on a larger set.',
      modelId: '233140',
      modelVersionId: '2720926',
      // The fingerprint Lora Manager keeps at the top of its record: what Civitai finds the file by.
      sha256: '9e76948abf9163e9d31bd86a5c12a2ef2e0161589f25dc6b2fa11ca2f620502c',
    });
    expect(parsed.notes).toMatchObject({
      title: 'Film Grain - analog look',
      versionName: 'v1.0 - Z IMAGE',
      creator: 'someone',
      baseModelLabel: 'ZImageTurbo',
      tags: ['style', 'film', 'photography'],
      notes: 'Works best on portraits.\nKeep it under 0.9.',
      usage: { strength: 0.8, strengthMin: 0.6, strengthMax: 1, clipSkip: 2 },
      previewRating: 1,
      mature: false,
    });
    // The same words twice are one example; a sample without words is none; a bad number is no number.
    expect(parsed.notes.examples).toEqual([
      { prompt: 'FILMGRAIN, a street at dusk, wet asphalt', negative: 'blurry', steps: 8, cfg: 1, sampler: 'euler', mature: false },
      { prompt: 'FILMGRAIN, a portrait by a window', negative: '', steps: null, cfg: null, sampler: '', mature: true },
    ]);
    expect(notesSaySomething(parsed.notes)).toBe(true);
    // No markup survives into what a card shows.
    expect(JSON.stringify(parsed)).not.toMatch(/<[a-z/]/i);
  });

  it('reads a bare Civitai record, and a manager record that never met Civitai', () => {
    const bare = parseSidecarFile({ ...MANAGER.civitai, images: [{ nsfw: 'Mature', meta: { prompt: 'a lake at dawn' } }] })!;
    expect(bare.facts.modelVersionId).toBe('2720926');
    expect(bare.notes.title).toBe('Film Grain - analog look');
    expect(bare.notes.examples).toEqual([{ prompt: 'a lake at dawn', negative: '', steps: null, cfg: null, sampler: '', mature: true }]);
    expect(bare.notes.usage).toEqual(EMPTY_NOTES.usage);
    // A bare Civitai record names the fingerprint in its file list: the primary file's, written in any case.
    const listed = parseSidecarFile({
      ...MANAGER.civitai,
      files: [
        { name: 'vae.safetensors', type: 'VAE', hashes: { SHA256: 'A'.repeat(64) } },
        { name: 'film.safetensors', type: 'Model', primary: true, hashes: { SHA256: 'B'.repeat(64), AutoV2: 'BBBBBBBBBB' } },
      ],
    })!;
    expect(listed.facts.sha256).toBe('b'.repeat(64));
    expect(parseSidecarFile({ ...MANAGER, sha256: 'not a hash' })!.facts.sha256).toBeNull();

    const local = parseSidecarFile({ file_name: 'wan_high', model_name: 'wan_high', base_model: 'Unknown', preview_nsfw_level: 0, civitai: {}, tags: [], modelDescription: '', notes: '', usage_tips: '{}' })!;
    expect(local.facts).toEqual({ baseModel: null, trainedWords: [], description: '', modelId: null, modelVersionId: null, sha256: null });
    expect(local.notes.title).toBe('wan_high');
    expect(local.notes.mature).toBe(false);
  });

  it('marks adult content from the model flag or from the rating of its preview', () => {
    expect(parseSidecarFile({ ...MANAGER, preview_nsfw_level: 8 })!.notes.mature).toBe(true);
    expect(parseSidecarFile({ ...MANAGER, civitai: { ...MANAGER.civitai, model: { ...MANAGER.civitai.model, nsfw: true } } })!.notes.mature).toBe(true);
    expect(parseSidecarFile({ ...MANAGER, preview_nsfw_level: 2 })!.notes).toMatchObject({ previewRating: 2, mature: true });
  });

  it('is not fooled by other JSON, and survives being stored and read back', () => {
    for (const value of [null, 'text', 7, [], {}, { name: 'config', steps: 20 }]) expect(parseSidecarFile(value), JSON.stringify(value)).toBeNull();
    const parsed = parseSidecarFile(MANAGER)!;
    expect(notesFromJson(JSON.stringify(parsed.notes))).toEqual(parsed.notes);
    for (const text of ['', null, undefined, 'not json', '[]', '{"usage": 5, "examples": "x", "tags": 3}']) {
      const read = notesFromJson(text as string | null | undefined);
      expect(read.examples).toEqual([]);
      expect(read.usage).toEqual(EMPTY_NOTES.usage);
      expect(notesSaySomething(read)).toBe(false);
    }
    // Sizes are bounded whatever the file holds.
    const long = parseSidecarFile({ ...MANAGER, notes: 'n'.repeat(9000), civitai: { ...MANAGER.civitai, images: Array.from({ length: 40 }, (_, index) => ({ nsfwLevel: 1, meta: { prompt: `${'p'.repeat(4000)}${index}` } })) } })!;
    expect(long.notes.notes.length).toBe(2000);
    expect(long.notes.examples.length).toBeLessThanOrEqual(5);
    expect(long.notes.examples[0].prompt.length).toBe(1500);
  });
});
