import { civitaiFileHash, plainText, sha256Text, type SidecarFacts } from './enrichment';

/**
 * The files a model manager keeps next to a model file: what its author said about it, and a picture.
 *
 * Two conventions are read. ComfyUI-Lora-Manager writes `<name>.metadata.json` (its own record with the Civitai
 * model-version record inside, the person's notes and usage tips) and a preview `<name>.webp` or `<name>.mp4`.
 * The Civitai helpers write `<name>.civitai.info` (the model-version record itself) and `<name>.preview.png`.
 * The app only reads these files and never writes one. It asks Civitai or Hugging Face about a file only when
 * the person says so (see shared/knowledge/webLookup.ts), and then with what these files give: the fingerprint.
 */

const MODEL_EXTENSION = /\.(safetensors|sft|ckpt|pt|pth|bin|gguf)$/i;
/** Sidecars, the one a model manager keeps up to date first. */
const SIDECAR_SUFFIXES = ['.metadata.json', '.civitai.info'] as const;
/** Pictures first: a still says what a model does at a glance, and loads at once. */
const PREVIEW_EXTENSIONS = ['webp', 'png', 'jpg', 'jpeg', 'gif', 'mp4', 'webm'] as const;

const MAX_TITLE = 200;
const MAX_NOTES = 2000;
const MAX_TAGS = 24;
const MAX_EXAMPLES = 5;
const MAX_PROMPT = 1500;
/** Civitai rates pictures 1 (for everyone), 2, 4, 8, 16. Anything above 1 is not shown without being asked for. */
export const RATING_FOR_EVERYONE = 1;

/** `sub/dir/name.safetensors` without its model extension; null for a file that is not a model. */
export function modelBase(filename: string): string | null {
  return MODEL_EXTENSION.test(filename) ? filename.replace(MODEL_EXTENSION, '') : null;
}

export type SideRole = 'sidecar' | 'preview';

/** What a file next to a model is, the base name it belongs to, and how it ranks among files of its role. */
export function sideFileOf(filename: string): { base: string; role: SideRole; rank: number } | null {
  if (filename === '' || filename.startsWith('.') || filename.includes('/.')) return null;
  const lower = filename.toLowerCase();
  for (const [rank, suffix] of SIDECAR_SUFFIXES.entries()) {
    if (lower.endsWith(suffix) && filename.length > suffix.length) return { base: filename.slice(0, -suffix.length), role: 'sidecar', rank };
  }
  for (const [rank, extension] of PREVIEW_EXTENSIONS.entries()) {
    const marked = `.preview.${extension}`;
    if (lower.endsWith(marked) && filename.length > marked.length) return { base: filename.slice(0, -marked.length), role: 'preview', rank };
    const plain = `.${extension}`;
    if (lower.endsWith(plain) && filename.length > plain.length) return { base: filename.slice(0, -plain.length), role: 'preview', rank };
  }
  return null;
}

export interface SideFiles {
  sidecar: string | null;
  preview: string | null;
}

/** Collects the side files of a folder listing and hands each model the ones that carry its name. */
export class SideFileIndex {
  private readonly byBase = new Map<string, { sidecar?: { name: string; rank: number }; preview?: { name: string; rank: number } }>();

  add(filename: string): void {
    const side = sideFileOf(filename);
    if (!side) return;
    const entry = this.byBase.get(side.base) ?? {};
    const held = entry[side.role];
    if (!held || side.rank < held.rank) entry[side.role] = { name: filename, rank: side.rank };
    this.byBase.set(side.base, entry);
  }

  for(modelFilename: string): SideFiles {
    const base = modelBase(modelFilename);
    const entry = base === null ? undefined : this.byBase.get(base);
    return { sidecar: entry?.sidecar?.name ?? null, preview: entry?.preview?.name ?? null };
  }
}

export function previewKind(filename: string): 'image' | 'video' {
  return /\.(mp4|webm)$/i.test(filename) ? 'video' : 'image';
}

export function previewMime(filename: string): string {
  const extension = /\.([a-z0-9]+)$/i.exec(filename)?.[1].toLowerCase() ?? '';
  switch (extension) {
    case 'webp': return 'image/webp';
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'mp4': return 'video/mp4';
    case 'webm': return 'video/webm';
    default: return 'application/octet-stream';
  }
}

/** A description the author showed with a sample picture: the words that produced it and the main settings. */
export interface ExamplePrompt {
  prompt: string;
  negative: string;
  steps: number | null;
  cfg: number | null;
  sampler: string;
  /** The sample this prompt belongs to is rated above "for everyone". */
  mature: boolean;
}

/** What the sidecar says beyond the facts every model has: the things that tell a person what a file is for. */
export interface ModelNotes {
  /** The name its author gave the model; empty when the sidecar has none. */
  title: string;
  /** The version of the model this file is, as the author named it. */
  versionName: string;
  creator: string;
  /** The base model in the author's words (the app's own family guess is separate). */
  baseModelLabel: string;
  tags: string[];
  /** The person's own notes in their model manager. */
  notes: string;
  usage: { strength: number | null; strengthMin: number | null; strengthMax: number | null; clipSkip: number | null };
  examples: ExamplePrompt[];
  /** Civitai's rating of the preview picture, 0 when the sidecar gives none. */
  previewRating: number;
  /** The model is marked as adult content, or its preview is rated above "for everyone". */
  mature: boolean;
}

export const EMPTY_NOTES: ModelNotes = {
  title: '',
  versionName: '',
  creator: '',
  baseModelLabel: '',
  tags: [],
  notes: '',
  usage: { strength: null, strengthMin: null, strengthMax: null, clipSkip: null },
  examples: [],
  previewRating: 0,
  mature: false,
};

export interface ParsedSidecar {
  facts: SidecarFacts;
  notes: ModelNotes;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function line(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function number(value: unknown, min: number, max: number): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function idText(value: unknown): string | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return String(value);
  if (typeof value === 'string' && /^\d{1,12}$/.test(value)) return value;
  return null;
}

function wordList(value: unknown, max: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string') continue;
    for (const part of item.split(',')) {
      const word = part.replace(/\s+/g, ' ').trim();
      if (word) seen.add(word.slice(0, maxLength));
    }
  }
  return [...seen].slice(0, max);
}

/** Older sidecars rate a picture in words. */
function ratingOf(image: Record<string, unknown>): number {
  const level = number(image.nsfwLevel, 0, 64);
  if (level !== null) return level;
  if (typeof image.nsfw === 'string') return /^(none|false)$/i.test(image.nsfw) ? RATING_FOR_EVERYONE : 8;
  return image.nsfw === true ? 8 : 0;
}

function examplesOf(images: unknown): ExamplePrompt[] {
  if (!Array.isArray(images)) return [];
  const out: ExamplePrompt[] = [];
  const seen = new Set<string>();
  for (const item of images) {
    const image = record(item);
    const meta = record(image?.meta);
    if (!image || !meta) continue;
    const prompt = typeof meta.prompt === 'string' ? meta.prompt.trim().slice(0, MAX_PROMPT) : '';
    if (!prompt || seen.has(prompt)) continue;
    seen.add(prompt);
    out.push({
      prompt,
      negative: typeof meta.negativePrompt === 'string' ? meta.negativePrompt.trim().slice(0, MAX_PROMPT) : '',
      steps: number(meta.steps, 1, 1000),
      cfg: number(meta.cfgScale ?? meta.cfg, 0, 100),
      sampler: line(meta.sampler, 60),
      mature: ratingOf(image) > RATING_FOR_EVERYONE,
    });
    if (out.length >= MAX_EXAMPLES) break;
  }
  return out;
}

/** Lora Manager keeps its usage tips as JSON text: `{"strength": 0.8, "strength_min": 0.6, "clip_skip": 2}`. */
function usageOf(value: unknown): ModelNotes['usage'] {
  let tips = record(value);
  if (!tips && typeof value === 'string' && value.trim().startsWith('{')) {
    try {
      tips = record(JSON.parse(value));
    } catch {
      tips = null;
    }
  }
  return {
    strength: number(tips?.strength, -10, 10),
    strengthMin: number(tips?.strength_min, -10, 10),
    strengthMax: number(tips?.strength_max, -10, 10),
    clipSkip: number(tips?.clip_skip, 1, 12),
  };
}

/**
 * Reads a sidecar: Lora Manager's record (the Civitai record under `civitai`) or a bare Civitai model-version
 * record. Null for anything else. Text comes out plain and bounded; nothing in it is trusted as markup.
 */
export function parseSidecarFile(value: unknown): ParsedSidecar | null {
  const row = record(value);
  if (!row) return null;
  const nested = record(row.civitai);
  const manager = nested !== null || 'model_name' in row || 'base_model' in row || 'preview_nsfw_level' in row;
  const version = nested ?? (manager ? {} : row);
  if (!manager && !('modelId' in version) && !('trainedWords' in version) && !record(version.model)) return null;
  const model = record(version.model);
  const creator = record(version.creator);

  // The model's own description says what it is for; a version's note (what changed) follows it.
  const about = [model?.description, row.modelDescription].find((item) => typeof item === 'string' && item.trim() !== '') as string | undefined;
  const versionNote = typeof version.description === 'string' ? version.description : '';
  const description = plainText([about ?? '', versionNote].filter((part) => part.trim() !== '').join('\n\n'));

  const baseModelLabel = line(version.baseModel, 80) || (line(row.base_model, 80).toLowerCase() === 'unknown' ? '' : line(row.base_model, 80));
  const modelId = idText(version.modelId) ?? idText(model?.id);
  const title = line(model?.name, MAX_TITLE) || line(row.model_name, MAX_TITLE);
  const previewRating = number(row.preview_nsfw_level, 0, 64) ?? 0;
  const examples = examplesOf(version.images);

  return {
    facts: {
      baseModel: baseModelLabel || null,
      trainedWords: wordList(version.trainedWords, 50, 200),
      description,
      modelId,
      modelVersionId: modelId ? idText(version.id) : null,
      // Lora Manager keeps the file's fingerprint at the top; a Civitai record has it in its file list.
      sha256: sha256Text(row.sha256) ?? civitaiFileHash(version.files),
    },
    notes: {
      title,
      versionName: line(version.name, 120),
      creator: line(creator?.username, 80),
      baseModelLabel,
      tags: wordList(Array.isArray(model?.tags) && model.tags.length > 0 ? model.tags : row.tags, MAX_TAGS, 40),
      notes: typeof row.notes === 'string' ? row.notes.trim().slice(0, MAX_NOTES) : '',
      usage: usageOf(row.usage_tips),
      examples,
      previewRating,
      mature: model?.nsfw === true || previewRating > RATING_FOR_EVERYONE,
    },
  };
}

/** Whether the notes say anything a card could show. */
export function notesSaySomething(notes: ModelNotes): boolean {
  return notes.title !== '' || notes.tags.length > 0 || notes.notes !== '' || notes.examples.length > 0
    || notes.usage.strength !== null || notes.usage.strengthMin !== null || notes.usage.strengthMax !== null || notes.usage.clipSkip !== null;
}

/** Stored notes read back; anything missing or of the wrong shape becomes the empty value. */
export function notesFromJson(text: string | null | undefined): ModelNotes {
  if (!text) return EMPTY_NOTES;
  let row: Record<string, unknown> | null;
  try {
    row = record(JSON.parse(text));
  } catch {
    row = null;
  }
  if (!row) return EMPTY_NOTES;
  const usage = record(row.usage);
  const examples = Array.isArray(row.examples) ? row.examples.map(record).filter((item): item is Record<string, unknown> => item !== null) : [];
  return {
    title: line(row.title, MAX_TITLE),
    versionName: line(row.versionName, 120),
    creator: line(row.creator, 80),
    baseModelLabel: line(row.baseModelLabel, 80),
    tags: wordList(row.tags, MAX_TAGS, 40),
    notes: typeof row.notes === 'string' ? row.notes.slice(0, MAX_NOTES) : '',
    usage: {
      strength: number(usage?.strength, -10, 10),
      strengthMin: number(usage?.strengthMin, -10, 10),
      strengthMax: number(usage?.strengthMax, -10, 10),
      clipSkip: number(usage?.clipSkip, 1, 12),
    },
    examples: examples.slice(0, MAX_EXAMPLES).map((item) => ({
      prompt: typeof item.prompt === 'string' ? item.prompt.slice(0, MAX_PROMPT) : '',
      negative: typeof item.negative === 'string' ? item.negative.slice(0, MAX_PROMPT) : '',
      steps: number(item.steps, 1, 1000),
      cfg: number(item.cfg, 0, 100),
      sampler: line(item.sampler, 60),
      mature: item.mature === true,
    })).filter((item) => item.prompt !== ''),
    previewRating: number(row.previewRating, 0, 64) ?? 0,
    mature: row.mature === true,
  };
}
