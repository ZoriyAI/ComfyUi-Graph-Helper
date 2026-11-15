/**
 * The node search (main/knowledge/nodeSearch.ts through repository.searchNodeClasses): a person finds a node by
 * what it does, small words do not count, one unknown word does not hide everything, type filters keep only nodes
 * that fit a link, editor nodes (Note, Reroute, Primitive) are found, and each result carries one line on what it does.
 * Why: a learner rarely knows a class name; they search for what they want done, in English or Russian.
 */
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { upsertObjectInfo } from '../../src/main/catalog/repository';
import { nodeClassDetail, searchNodeClasses } from '../../src/main/knowledge/repository';
import { parseNodeQuery, rankText, shortDescription } from '../../src/main/knowledge/nodeSearch';
import { validateNodeClass } from '../../src/main/knowledge/nodeClassGuard';
import { migrate } from '../../src/main/settings/migrate';
import { parseObjectInfo } from '../../src/shared/catalog/objectInfo';

/** An object_info entry with the given ports and description. */
const node = (name: string, display: string, category: string, required: Record<string, unknown>, output: string[], description = '') => ({
  input: { required }, output, output_name: output, name, display_name: display, category, python_module: 'nodes', description,
});

const INFO = {
  ImageRemoveBackground: node('ImageRemoveBackground', 'Image Rembg', 'image', { image: ['IMAGE'] }, ['IMAGE', 'MASK'], 'Removes the background of a picture and gives a mask.'),
  ImageScale: node('ImageScale', 'Upscale Image', 'image/upscaling', { image: ['IMAGE'], width: ['INT', { default: 512 }] }, ['IMAGE']),
  ImageUpscaleWithModel: node('ImageUpscaleWithModel', 'Upscale Image (using Model)', 'image/upscaling', { upscale_model: ['UPSCALE_MODEL'], image: ['IMAGE'] }, ['IMAGE']),
  KSampler: node('KSampler', 'KSampler', 'sampling', { model: ['MODEL'], latent_image: ['LATENT'] }, ['LATENT']),
  VAEDecode: node('VAEDecode', 'VAE Decode', 'latent', { samples: ['LATENT'], vae: ['VAE'] }, ['IMAGE']),
  CheckpointLoaderSimple: node('CheckpointLoaderSimple', 'Load Checkpoint', 'loaders', { ckpt_name: [['a.safetensors']] }, ['MODEL', 'CLIP', 'VAE']),
};

function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  upsertObjectInfo(db, parseObjectInfo(INFO), Date.now());
  return db;
}

/** The class names a search returns, in order. */
const names = (db: Database.Database, query: string, extra: Record<string, unknown> = {}) =>
  searchNodeClasses(db, { query, limit: 20, ...extra }).map((item) => item.classType);

describe('node search', () => {
  it('finds a node by what its description says, after the matches in names', () => {
    const db = openDb();
    expect(names(db, 'remove background')[0]).toBe('ImageRemoveBackground');
    expect(names(db, 'background')).toEqual(['ImageRemoveBackground']);
    // A name match still comes first.
    expect(names(db, 'upscale')[0]).toBe('ImageScale');
    db.close();
  });

  it('reads the built-in explanation, also in Russian', () => {
    const db = openDb();
    // KSampler's built-in explanation speaks of noise and steps; VAE Decode of turning the result into pixels.
    expect(names(db, 'шум')).toContain('KSampler');
    expect(names(db, 'pixels')).toContain('VAEDecode');
    db.close();
  });

  it('skips small words and lets one word of a longer query miss', () => {
    const db = openDb();
    expect(parseNodeQuery('upscale the image').words).toEqual(['upscale', 'image']);
    expect(names(db, 'upscale image please')[0]).toBe('ImageScale');
    expect(names(db, 'zzzz')).toEqual([]);
    db.close();
  });

  it('keeps only nodes with an input or output of a type', () => {
    const db = openDb();
    // Reroute takes any type, so it fits every link.
    expect(names(db, '', { inputType: 'LATENT' }).sort()).toEqual(['KSampler', 'Reroute', 'VAEDecode']);
    expect(names(db, 'in:LATENT out:IMAGE')).toContain('VAEDecode');
    expect(names(db, 'in:LATENT out:IMAGE')).not.toContain('KSampler');
    expect(names(db, 'выход:VAE')).toContain('CheckpointLoaderSimple');
    expect(names(db, 'out:VAE')).not.toContain('KSampler');
    db.close();
  });

  it('finds the editor nodes by name and by Russian words, and the guard lets them in', () => {
    const db = openDb();
    expect(names(db, 'note')).toEqual(expect.arrayContaining(['Note', 'MarkdownNote']));
    expect(names(db, 'заметка')[0]).toMatch(/Note/);
    expect(names(db, 'reroute')).toEqual(['Reroute']);
    expect(names(db, 'primitive')).toEqual(['PrimitiveNode']);
    expect(validateNodeClass(db, 'Reroute')).toMatchObject({ ok: true, known: true });
    expect(nodeClassDetail(db, 'PrimitiveNode')).toMatchObject({ displayName: 'Primitive', editor: true });
    db.close();
  });

  it('gives each result one line in the person\'s language', () => {
    const db = openDb();
    const [sampler] = searchNodeClasses(db, { query: 'ksampler', limit: 1, language: 'ru' });
    expect(sampler.description).toMatch(/[а-я]/);
    const [rembg] = searchNodeClasses(db, { query: 'rembg', limit: 1 });
    expect(rembg.description).toBe('Removes the background of a picture and gives a mask.');
    expect(shortDescription('First. Second.')).toBe('First.');
    expect(rankText('Removes noise step by step', 'ois')).toBe(Infinity);
    expect(rankText('Removes noise step by step', 'noise')).toBeLessThan(Infinity);
    db.close();
  });
});
