/**
 * What the internet says about a model file, when the person asks for it. Pure: the main process fetches, these
 * functions read what came back (shared/knowledge stays free of network code).
 *
 * Two sources, never mixed up. Civitai is asked by the file's fingerprint (its SHA-256): an answer there is this very
 * file, the same record a `.civitai.info` next to it would hold. Hugging Face is asked by the file's name when Civitai
 * does not know the file: that is a guess, and it is always shown as one. What either says is outside text: it comes
 * out plain and bounded, and nothing in it is trusted as markup.
 *
 * Who uses it: main/knowledge/webLookup.ts (the client that fetches, run from the knowledge IPC and the model sync),
 * main/knowledge/repository.ts and preview.ts (the stored answer and its sample picture).
 */
import { plainText, type SidecarFacts } from './enrichment';
import { EMPTY_NOTES, notesFromJson, parseSidecarFile, RATING_FOR_EVERYONE, type ModelNotes } from './sidecar';

/** The site an answer came from. */
export type WebSource = 'civitai' | 'huggingface';

/** How a lookup ended. 'error' is retried when the person asks again or at a later sync; the others are kept. */
export type WebStatus = 'found' | 'not-found' | 'error';

/**
 * Why a lookup did not come through, as a short code the window turns into a sentence:
 * unreachable (no answer at all), timeout, rate-limited (the site asked to wait), server (it answered with an
 * error), bad-answer (the answer was not what the site gives), no-hash (the fingerprint could not be made),
 * no-server (there is no MCP server to make it on).
 */
export const WEB_ERRORS = ['unreachable', 'timeout', 'rate-limited', 'server', 'bad-answer', 'no-hash', 'no-server'] as const;
/** One code of WEB_ERRORS. */
export type WebError = typeof WEB_ERRORS[number];

/** What was found, as the card shows it and as it is kept in `model_catalog.web_notes_json`. */
export interface WebFound {
  source: WebSource;
  /** The page of the model on the site. */
  url: string;
  /** Found by the file name only (Hugging Face): it may be another model. */
  byName: boolean;
  /** Title, version, author, base model in the site's words, tags, example prompts, rating, adult mark. */
  notes: ModelNotes;
  triggerWords: string[];
  /** The start of the description, plain text. */
  summary: string;
  /**
   * A sample picture or clip, fetched only when shown (and not at all while it is marked and closed). `more` are
   * the next places to try when the first is not a picture after all; only a marked Hugging Face sample has them,
   * since that one is not downloaded at lookup to be checked.
   */
  preview: WebPreview | null;
}

/** A sample to show: where it is, whether it is a picture or a clip, and the next places to try. */
export interface WebPreview {
  url: string;
  kind: 'image' | 'video';
  more?: string[];
}

/** A description cut to this many characters in a card. */
export const SUMMARY_MAX = 700;
const MAX_TITLE = 200;
const MAX_TAGS = 24;

/** The Civitai page of a model version. */
export function civitaiPageUrl(modelId: string, versionId: string | null): string {
  const base = `https://civitai.com/models/${modelId}`;
  return versionId ? `${base}?modelVersionId=${versionId}` : base;
}

/** Text cut at a sentence or word end before `max` characters, with an ellipsis when it was cut. */
export function summarize(text: string, max = SUMMARY_MAX): string {
  const clean = text.trim();
  if (clean.length <= max) return clean;
  const head = clean.slice(0, max);
  const sentence = Math.max(head.lastIndexOf('. '), head.lastIndexOf('.\n'), head.lastIndexOf('! '), head.lastIndexOf('? '));
  if (sentence > max * 0.5) return head.slice(0, sentence + 1);
  const word = head.lastIndexOf(' ');
  return `${(word > max * 0.5 ? head.slice(0, word) : head).trimEnd()}…`;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function line(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

/** Civitai rates pictures 1 (for everyone) to 32; older records say it in words, like sidecar.ts reads them. */
function ratingOf(image: Record<string, unknown>): number {
  const level = typeof image.nsfwLevel === 'number' && Number.isFinite(image.nsfwLevel) ? image.nsfwLevel : null;
  if (level !== null) return level;
  if (typeof image.nsfw === 'string') return /^(none|false)$/i.test(image.nsfw) ? RATING_FOR_EVERYONE : 8;
  return image.nsfw === true ? 8 : 0;
}

/**
 * Civitai serves its pictures at a size named in the address (`/width=450/`, or `/original=true/`). The card is
 * narrow: the small one is asked for, which also keeps the download far below the preview size cap.
 */
export function smallCivitaiImage(url: string): string {
  return url.replace(/\/(?:width=\d+|original=true)(?=\/)/, '/width=450');
}

/**
 * The sample a card shows: the first picture rated for everyone, else the first clip rated for everyone, else
 * the first sample at all (then marked, and closed until the person opens it). Only http(s) addresses.
 */
function previewOf(images: unknown): { url: string; kind: 'image' | 'video'; rating: number } | null {
  if (!Array.isArray(images)) return null;
  const samples = images.map(record).filter((item): item is Record<string, unknown> => item !== null)
    // Only web addresses; which hosts may be asked is the main process's list, not the record's.
    .filter((item) => typeof item.url === 'string' && /^https?:\/\/[^\s]+$/i.test(item.url) && item.url.length <= 2000)
    .map((item) => {
      const url = String(item.url);
      const kind: 'image' | 'video' = item.type === 'video' || /\.(mp4|webm)(\?|$)/i.test(url) ? 'video' : 'image';
      return { url: kind === 'image' ? smallCivitaiImage(url) : url, kind, rating: ratingOf(item) };
    });
  const open = (kind: 'image' | 'video') => samples.find((item) => item.kind === kind && item.rating <= RATING_FOR_EVERYONE);
  return open('image') ?? open('video') ?? samples[0] ?? null;
}

/**
 * Reads Civitai's answer to `model-versions/by-hash/<sha256>`: the model-version record, the same one a
 * `.civitai.info` holds, so the sidecar reader reads it. Null when it is not such a record.
 */
export function civitaiFound(value: unknown): WebFound | null {
  const row = record(value);
  if (!row) return null;
  const parsed = parseSidecarFile(row);
  if (!parsed) return null;
  const facts: SidecarFacts = parsed.facts;
  if (!facts.modelId) return null;
  const model = record(row.model);
  const preview = previewOf(row.images);
  const rating = preview?.rating ?? 0;
  const notes: ModelNotes = {
    ...parsed.notes,
    // The person's own notes and usage tips are a model manager's; Civitai's record has neither.
    notes: '',
    usage: EMPTY_NOTES.usage,
    previewRating: rating,
    mature: model?.nsfw === true || rating > RATING_FOR_EVERYONE,
  };
  return {
    source: 'civitai',
    url: civitaiPageUrl(facts.modelId, facts.modelVersionId),
    byName: false,
    notes,
    triggerWords: facts.trainedWords,
    summary: summarize(facts.description),
    preview: preview ? { url: preview.url, kind: preview.kind } : null,
  };
}

/**
 * What a model is called without its folder, its extension and the precision or packing it was saved in:
 * `wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors` → `wan2.2_i2v_high_noise_14B`. The same model is published
 * under that name, and the precision is not part of it.
 */
const PRECISION_SUFFIX = /[-_.](?:fp8|e4m3fn(?:uz)?|e5m2|scaled|fp16|fp32|bf16|f16|f32|int8|int4|nf4|pruned|emaonly|ema|q[2-8](?:_k)?(?:_[a-z0-9]{1,2})?|q[2-8]_[01])$/i;

/** The name a model is published under: the rule is in the comment above PRECISION_SUFFIX. */
export function nameStem(filename: string): string {
  let stem = (filename.split(/[\\/]/).pop() ?? filename).replace(/\.(safetensors|sft|ckpt|pt|pth|bin|gguf)$/i, '');
  // Suffixes stack ("_fp8_e4m3fn_scaled"): strip one at a time, with a bound in case a name is all suffixes.
  for (let turn = 0; turn < 8 && PRECISION_SUFFIX.test(stem); turn += 1) stem = stem.replace(PRECISION_SUFFIX, '');
  return stem.trim();
}

/**
 * What Hugging Face is searched for: the stem, then, when that finds nothing, its first two words joined the way
 * repositories are named (`sdxl_lightning_8step_lora` → `sdxl-lightning`). Hugging Face matches names by their
 * letters, so a file saved with underscores is not found under the hyphens of its repository otherwise.
 */
export function nameQueries(filename: string): string[] {
  const stem = nameStem(filename);
  if (stem.length < 3) return [];
  const words = stem.split(/[-_\s]+/).filter((word) => word !== '');
  const short = words.length >= 3 ? words.slice(0, 2).join('-') : '';
  return [...new Set([stem.slice(0, 120), short.length >= 6 ? short : ''].filter((query) => query !== ''))];
}

const REPO_ID = /^[A-Za-z0-9][\w.-]{0,95}\/[\w.-]{1,96}$/;

function letters(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * The repository a search answer most likely means: one named exactly like the stem, then one whose name holds
 * it or is held by it, then the first the site ranked. Null for an empty or odd answer.
 */
export function bestHuggingFaceMatch(value: unknown, filename: string): string | null {
  if (!Array.isArray(value)) return null;
  const stem = letters(nameStem(filename));
  const ids = value.map((item) => record(item)).map((item) => (typeof item?.id === 'string' ? item.id : typeof item?.modelId === 'string' ? item.modelId : ''))
    .filter((id) => REPO_ID.test(id));
  if (ids.length === 0) return null;
  const score = (id: string): number => {
    const name = letters(id.split('/')[1]);
    if (name === stem) return 0;
    if (stem !== '' && (name.includes(stem) || stem.includes(name))) return 1;
    return 2;
  };
  return ids.map((id, index) => ({ id, index, score: score(id) }))
    .sort((left, right) => left.score - right.score || left.index - right.index)[0].id;
}

/**
 * The first paragraphs of a model's README, plain: no front matter, no code, no pictures, no badges, no tables, no
 * headings, no markup; links keep their words. At most `max` characters.
 */
export function readmeSummary(markdown: string, max = SUMMARY_MAX): string {
  let text = markdown.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  if (text.startsWith('---\n')) {
    const end = text.indexOf('\n---', 4);
    text = end === -1 ? '' : text.slice(text.indexOf('\n', end + 1) + 1 || text.length);
  }
  text = text
    .replace(/```[\s\S]*?(```|$)/g, '\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*\[[^\]]+\]:\s*\S+.*$/gm, '');
  // HTML is read as the sidecar's descriptions are: blocks end their line, tags go, entities are decoded.
  text = plainText(text.replace(/\n/g, '\u0000')).replace(/\u0000/g, '\n');
  const paragraphs: string[] = [];
  for (const block of text.split(/\n\s*\n/)) {
    const lines = block.split('\n').map((item) => item.trim()).filter((item) => item !== ''
      && !/^#{1,6}\s/.test(item) && !item.startsWith('|') && !/^[-=*_]{3,}$/.test(item));
    if (lines.length === 0) continue;
    const paragraph = lines
      .map((item) => item.replace(/^>\s?/, '').replace(/^[-*+]\s+/, '• ').replace(/(\*\*|__|`)/g, ''))
      .join('\n')
      .trim();
    if (paragraph !== '') paragraphs.push(paragraph);
    if (paragraphs.join('\n\n').length >= max) break;
  }
  return summarize(paragraphs.join('\n\n'), max);
}

function stringList(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/** Tags Hugging Face sets by itself (`license:mit`, `region:us`, `diffusers:…`) say nothing a person reads. */
function readableTag(tag: string): boolean {
  return !tag.includes(':') && !/^(diffusers|safetensors|endpoints_compatible|transformers|gguf|pytorch|en|lora|template:.*)$/i.test(tag);
}

/** The tag Hugging Face asks repositories with adult content to carry. */
const MATURE_TAG = /^not-for-all-audiences$/i;

/**
 * Whether a Hugging Face repository is marked as adult content: its tags, or the tags of its model card, carry
 * `not-for-all-audiences`, or its card says `nsfw: true`. Hugging Face rates no single picture, so the whole
 * repository counts, the way a Civitai sample rated above "for everyone" does.
 */
export function huggingFaceMature(detail: unknown): boolean {
  const row = record(detail) ?? {};
  const card = record(row.cardData) ?? {};
  return [...stringList(row.tags), ...stringList(card.tags)].some((tag) => MATURE_TAG.test(tag.trim())) || card.nsfw === true;
}

/**
 * Reads Hugging Face's model record (`/api/models/<id>`) and the start of its README into what a card shows.
 * `byName` is always true: the file was matched by its name, not by its content.
 */
export function huggingFaceFound(id: string, detail: unknown, readme: string): WebFound | null {
  if (!REPO_ID.test(id)) return null;
  const row = record(detail) ?? {};
  const card = record(row.cardData) ?? {};
  const tags = stringList(row.tags);
  const pipeline = line(row.pipeline_tag, 60);
  const base = stringList(card.base_model).map((item) => line(item, 80)).find((item) => item !== '') ?? '';
  const instance = stringList(card.instance_prompt).flatMap((item) => item.split(','))
    .map((item) => item.replace(/\s+/g, ' ').trim()).filter((item) => item !== '' && item.length <= 200);
  const shownTags = [...new Set([pipeline, ...tags.filter(readableTag).map((tag) => line(tag, 40))].filter((tag) => tag !== ''))].slice(0, MAX_TAGS);
  const mature = huggingFaceMature(row);
  return {
    source: 'huggingface',
    url: `https://huggingface.co/${id}`,
    byName: true,
    notes: {
      ...EMPTY_NOTES,
      title: line(id, MAX_TITLE),
      creator: line(id.split('/')[0], 80),
      baseModelLabel: base,
      tags: shownTags,
      mature,
    },
    triggerWords: [...new Set(instance)].slice(0, 50),
    summary: readmeSummary(readme),
    preview: null,
  };
}

/**
 * The servers Hugging Face keeps a repository's files on, besides huggingface.co itself: pictures uploaded into a
 * model card, and the stores a `resolve/main/<file>` address sends a download on to. Exact names, no patterns:
 * a picture anywhere else is not asked for.
 */
export const HUGGING_FACE_FILE_HOSTS = [
  'cdn-uploads.huggingface.co', 'cdn-lfs.huggingface.co', 'cdn-lfs-us-1.huggingface.co', 'cdn-lfs.hf.co', 'cdn-lfs-us-1.hf.co',
  'cdn-lfs-eu-1.hf.co', 'cas-bridge.xethub.hf.co', 'us.aws.cdn.hf.co',
] as const;

/** At most this many places are tried for a Hugging Face sample: one too large or not a picture is skipped. */
export const PREVIEW_TRIES = 3;

/** A place a sample may be found, before it is checked. */
export interface PreviewCandidate {
  url: string;
  kind: 'image' | 'video';
}

/** Where to look for a Hugging Face sample; tests point it at a fake. */
export interface PreviewSearchOptions {
  /** Where Hugging Face is: https://huggingface.co in the app, a fake in tests. */
  base?: string;
  /** Other hosts a README picture may be on (HUGGING_FACE_FILE_HOSTS in the app). */
  hosts?: readonly string[];
}

const MEDIA_FILE = /\.(png|jpe?g|webp|gif|avif|mp4|webm)$/i;
/** Logos, icons and badges are pictures of the publisher, not of what the model makes. */
const NOT_A_SAMPLE = /logo|icon|badge|shields/i;
/** Folder and file names that say they hold what the model makes. */
const SAMPLE_NAME = /(?:^|[^a-z])(?:examples?|samples?|previews?|assets?|images?|imgs?|demos?|showcase|gallery|outputs?|results?)(?:[^a-z]|$)/i;
/** A picture drawn smaller than this in the README is an icon. */
const ICON_PX = 64;

function mediaKind(path: string): 'image' | 'video' | null {
  const match = MEDIA_FILE.exec(path);
  if (!match) return null;
  return /^(mp4|webm)$/i.test(match[1]) ? 'video' : 'image';
}

/** A path in a repository, each part encoded once; null when it climbs out or has an empty part. */
function encodedPath(path: string): string | null {
  const parts = path.split('/').map((part) => {
    try {
      return decodeURIComponent(part);
    } catch {
      return part;
    }
  });
  if (parts.some((part) => part === '' || part === '.' || part === '..' || part.includes('/'))) return null;
  return parts.map(encodeURIComponent).join('/');
}

function repoFileUrl(base: string, id: string, file: string): string | null {
  const encoded = encodedPath(file);
  return encoded ? `${base}/${id.split('/').map(encodeURIComponent).join('/')}/resolve/main/${encoded}` : null;
}

function baseOf(options: PreviewSearchOptions): string {
  return (options.base ?? 'https://huggingface.co').replace(/\/+$/, '');
}

/**
 * Where a picture named in a README is, as an address that may be asked: a path in the repository becomes its
 * `resolve/main/` download; an absolute address only on Hugging Face's own hosts (the page of a file, `/blob/`,
 * becomes its download). Null for anything else, and for what is not a picture or clip by its name.
 */
function readmeImageUrl(raw: string, id: string, base: string, hosts: readonly string[]): string | null {
  const text = raw.trim().replace(/^<([^>]*)>$/, '$1').trim();
  if (text === '' || text.length > 2000 || /[\t\n\r]/.test(text)) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(text) || text.startsWith('//')) {
    let url: URL;
    let home: URL;
    try {
      url = new URL(text.startsWith('//') ? `https:${text}` : text);
      home = new URL(base);
    } catch {
      return null;
    }
    if (url.username !== '' || url.password !== '') return null;
    const onSite = url.host === home.host && url.protocol === home.protocol;
    if (!onSite && !(url.protocol === 'https:' && url.port === '' && hosts.includes(url.hostname.toLowerCase()))) return null;
    if (!mediaKind(url.pathname)) return null;
    if (onSite) {
      const prefix = home.pathname.replace(/\/+$/, '');
      if (!url.pathname.startsWith(`${prefix}/`)) return null;
      url.pathname = `${prefix}${url.pathname.slice(prefix.length).replace(/^(\/[^/]+\/[^/]+)\/blob\//, '$1/resolve/')}`;
    }
    url.hash = '';
    return url.toString();
  }
  const path = text.replace(/[?#].*$/, '').replace(/^(\.\/)+/, '');
  if (path.startsWith('/') || !mediaKind(path)) return null;
  return repoFileUrl(base, id, path);
}

/**
 * The pictures and clips a README shows, in the order they are written (`![..](..)`, `<img src>`, `<video src>`,
 * `<source src>`), at most PREVIEW_TRIES. Not those in code or comments, not badges, logos or icons, not one
 * drawn smaller than an icon, not an SVG, and not one on a host that may not be asked.
 */
export function readmeImages(readme: string, id: string, options: PreviewSearchOptions = {}): PreviewCandidate[] {
  if (!REPO_ID.test(id)) return [];
  const base = baseOf(options);
  const hosts = options.hosts ?? HUGGING_FACE_FILE_HOSTS;
  let text = readme.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  if (text.startsWith('---\n')) {
    const end = text.indexOf('\n---', 4);
    text = end === -1 ? '' : text.slice(end + 4);
  }
  text = text.replace(/```[\s\S]*?(```|$)/g, '\n').replace(/<!--[\s\S]*?(-->|$)/g, '');
  const found: PreviewCandidate[] = [];
  const pattern = /!\[([^\]]*)\]\(\s*(<[^>\n]*>|[^)\s]+)(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)|<(img|video|source)\b([^>]*)>/gi;
  for (const match of text.matchAll(pattern)) {
    let raw: string;
    let label: string;
    if (match[3]) {
      const attributes = match[4] ?? '';
      const src = /(?:^|\s)src\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attributes);
      raw = src?.[1] ?? src?.[2] ?? (src?.[3] ?? '').replace(/\/$/, '');
      label = /(?:^|\s)alt\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attributes)?.[1] ?? '';
      const tiny = [...attributes.matchAll(/(?:^|\s)(?:width|height)\s*=\s*["']?(\d+)(?:px)?["']?(?=[\s/>]|$)/gi)].some((size) => Number(size[1]) < ICON_PX);
      if (tiny) continue;
    } else {
      raw = match[2];
      label = match[1];
    }
    if (NOT_A_SAMPLE.test(label) || NOT_A_SAMPLE.test(raw)) continue;
    const url = readmeImageUrl(raw, id, base, hosts);
    const kind = url ? mediaKind(new URL(url).pathname) : null;
    if (url && kind && !found.some((item) => item.url === url)) found.push({ url, kind });
    if (found.length >= PREVIEW_TRIES) break;
  }
  return found;
}

/**
 * Pictures and clips among a repository's files (the `siblings` of its record), the ones named like samples
 * first (examples, samples, previews, assets, images). Nothing deeper than two folders, nothing hidden, no logos,
 * icons or badges.
 */
export function siblingSamples(detail: unknown, id: string, options: PreviewSearchOptions = {}): PreviewCandidate[] {
  if (!REPO_ID.test(id)) return [];
  const base = baseOf(options);
  const siblings = record(detail)?.siblings;
  if (!Array.isArray(siblings)) return [];
  return siblings
    .map((item) => record(item)?.rfilename)
    .filter((name): name is string => typeof name === 'string' && name.length <= 500 && name.split('/').length <= 3)
    .filter((name) => !name.split('/').some((part) => part.startsWith('.')) && !NOT_A_SAMPLE.test(name) && mediaKind(name) !== null)
    .map((name, index) => ({ name, index, rank: SAMPLE_NAME.test(name) ? 0 : 1 }))
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .map((item) => ({ url: repoFileUrl(base, id, item.name), kind: mediaKind(item.name) ?? 'image' }))
    .filter((item): item is PreviewCandidate => item.url !== null);
}

/**
 * Where a Hugging Face repository's own sample may be, best first and at most PREVIEW_TRIES: the README's
 * pictures in order, then the repository's picture files. Only places that may be asked; nothing is fetched here.
 */
export function huggingFacePreviewCandidates(id: string, detail: unknown, readme: string, options: PreviewSearchOptions = {}): PreviewCandidate[] {
  const all = [...readmeImages(readme, id, options), ...siblingSamples(detail, id, options)];
  return all.filter((item, index) => all.findIndex((other) => other.url === item.url) === index).slice(0, PREVIEW_TRIES);
}

/**
 * What a downloaded sample is, by its first bytes and not by its name or what the site says: a PNG, JPEG, GIF,
 * WebP or AVIF picture, or an MP4 or WebM clip. Null for anything else (a page, text, an SVG, a QuickTime or
 * HEIC file the window cannot show).
 */
export function sniffMedia(bytes: Uint8Array): { mime: string; kind: 'image' | 'video' } | null {
  if (bytes.length < 12) return null;
  const ascii = (offset: number, length: number) => String.fromCharCode(...bytes.subarray(offset, offset + length));
  if (bytes[0] === 0x89 && ascii(1, 7) === 'PNG\r\n\u001a\n') return { mime: 'image/png', kind: 'image' };
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: 'image/jpeg', kind: 'image' };
  if (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a') return { mime: 'image/gif', kind: 'image' };
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return { mime: 'image/webp', kind: 'image' };
  if (ascii(4, 4) === 'ftyp') {
    const brand = ascii(8, 4);
    if (brand === 'avif' || brand === 'avis') return { mime: 'image/avif', kind: 'image' };
    return /^(isom|iso[2-9]|mp4[12]|avc1|dash|M4V |mmp4|MSNV)$/.test(brand) ? { mime: 'video/mp4', kind: 'video' } : null;
  }
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3 && ascii(0, 64).includes('webm')) return { mime: 'video/webm', kind: 'video' };
  return null;
}

/** Stored found info read back; null for anything that is not one. Text is bounded again on the way back. */
export function webFoundFromJson(text: string | null | undefined): WebFound | null {
  if (!text) return null;
  let row: Record<string, unknown> | null;
  try {
    row = record(JSON.parse(text));
  } catch {
    row = null;
  }
  if (!row || (row.source !== 'civitai' && row.source !== 'huggingface') || typeof row.url !== 'string' || !/^https:\/\//.test(row.url)) return null;
  const notes = parseNotes(row.notes);
  const preview = record(row.preview);
  return {
    source: row.source,
    url: row.url.slice(0, 2000),
    byName: row.byName === true,
    notes,
    triggerWords: stringList(row.triggerWords).map((item) => item.slice(0, 200)).slice(0, 50),
    summary: typeof row.summary === 'string' ? row.summary.slice(0, SUMMARY_MAX + 1) : '',
    preview: preview && typeof preview.url === 'string' && /^https?:\/\//.test(preview.url) ? previewFromJson(preview, preview.url) : null,
  };
}

function previewFromJson(preview: Record<string, unknown>, url: string): WebPreview {
  const more = stringList(preview.more).filter((item) => /^https?:\/\//.test(item) && item.length <= 2000).slice(0, PREVIEW_TRIES - 1);
  return { url: url.slice(0, 2000), kind: preview.kind === 'video' ? 'video' : 'image', ...(more.length > 0 ? { more } : {}) };
}

function parseNotes(value: unknown): ModelNotes {
  const row = record(value);
  // The sidecar reader's own read-back keeps every bound of stored notes in one place.
  return row ? notesFromJson(JSON.stringify(row)) : EMPTY_NOTES;
}
