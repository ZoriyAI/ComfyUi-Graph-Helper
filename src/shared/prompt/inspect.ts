/**
 * Reading a description (a prompt) the way ComfyUI will: what in it does nothing here, what is likely to work
 * against the person, and how long it is for the model that reads it. Pure text rules; which text goes where in
 * a graph is worked out by the caller.
 *
 * What the rules stand on:
 * - ComfyUI's text encoders understand one weight form, `(words:1.2)`, and `(words)` for 1.1. `<lora:name:1>`,
 *   `BREAK`, `AND` and square brackets belong to other programs: here they are ordinary characters, read by the
 *   model as words.
 * - A CLIP reader (SD 1.5, SDXL and the models built on them) takes tags and short phrases, 75 tokens a chunk.
 *   A language-model reader (T5 and its kin: Flux, SD3, Wan, Qwen and others) takes sentences, up to 512 tokens.
 * - At cfg 1 a sampler does not run the negative description at all.
 *
 * Used by the prompt check (main/knowledge/promptCheck.ts), the lesson engine (lessons/engine.ts) and the lesson
 * hints (renderer/components/lessons/lackText.ts).
 */

/** How the model the text goes to reads it. */
export type PromptReader = 'clip' | 't5' | 'unknown';

/** What a note about a description says; each kind has its own sentence in the catalog. */
export type PromptNoteKind =
  | 'lora-tag'
  | 'foreign-syntax'
  | 'unbalanced'
  | 'weight-high'
  | 'weight-ignored'
  | 'negative-ignored'
  | 'empty-positive'
  | 'contradiction'
  | 'negation'
  | 'not-english'
  | 'too-long'
  | 'missing-trigger';

export interface TextFinding {
  kind: PromptNoteKind;
  /** The piece of the text the finding is about, short enough to show. */
  found: string;
  /** Numbers a sentence needs: counts of parentheses, the token estimate. */
  numbers?: Record<string, number>;
}

/** A weight above this usually breaks a picture. */
export const WEIGHT_HIGH = 1.5;
/** Tokens after which a CLIP reader has cut the text into more than two chunks. */
export const CLIP_LONG_TOKENS = 150;
/** Tokens near the end of what a T5 reader takes. */
export const T5_LONG_TOKENS = 450;

/** Longest piece of the person's text quoted back in a note, in characters. */
const SHOWN = 48;
const show = (text: string) => {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > SHOWN ? `${flat.slice(0, SHOWN)}…` : flat;
};

/**
 * A rough count of tokens: words and punctuation marks, long words counted as the pieces a tokenizer cuts them
 * into. Close enough to say "this is three chunks long"; not a tokenizer.
 */
export function approxTokens(text: string): number {
  let count = 0;
  for (const piece of text.match(/[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu) ?? []) {
    count += /^[\p{L}\p{N}]/u.test(piece) ? Math.max(1, Math.ceil(piece.length / 6)) : 1;
  }
  return count;
}

/** The `(words:1.3)` weights of a text, with the words each one is on. */
export function weightsOf(text: string): Array<{ words: string; weight: number; raw: string }> {
  const out: Array<{ words: string; weight: number; raw: string }> = [];
  for (const match of text.matchAll(/\(([^()]*?):\s*(-?\d+(?:\.\d+)?)\s*\)/g)) {
    out.push({ words: match[1].trim(), weight: Number(match[2]), raw: match[0] });
  }
  return out;
}

/** Comma-separated phrases without their weights, lower case: what a person would call "the same thing". */
export function phrasesOf(text: string): string[] {
  return text
    .replace(/\(([^()]*?):\s*-?\d+(?:\.\d+)?\s*\)/g, '$1')
    .replace(/[()]/g, ' ')
    .split(/[,\n.;]+/)
    .map((part) => part.replace(/\s+/g, ' ').trim().toLowerCase())
    .filter((part) => part.length >= 3);
}

// Negation words in English and Russian: "no" in a description makes a model draw the thing, not leave it out.
const NEGATIONS = /(?<![\p{L}\p{N}])(no|not|without|never|don't|doesn't|isn't|без|не|нет)(?![\p{L}\p{N}])/iu;

/** The share of the text's letters that `pattern` matches. */
function share(text: string, pattern: RegExp): number {
  const letters = text.match(/\p{L}/gu) ?? [];
  if (letters.length < 8) return 0;
  return letters.filter((letter) => pattern.test(letter)).length / letters.length;
}

/**
 * What is worth saying about one text. `role` is the input of the sampler it reaches; `reader` is how the model
 * reads it. An empty text says nothing here (whether an empty description is a problem depends on where it goes).
 */
export function inspectText(text: string, role: 'positive' | 'negative', reader: PromptReader): TextFinding[] {
  const out: TextFinding[] = [];
  if (text.trim() === '') return out;

  const loraTag = /<\s*(?:lora|lyco|hypernet)\s*:[^<>]*>/i.exec(text);
  if (loraTag) out.push({ kind: 'lora-tag', found: show(loraTag[0]) });

  // Forms of other programs. Looked for outside of `<...>` (reported above) so one mistake is one finding.
  const plain = text.replace(/<[^<>]*>/g, ' ');
  const foreign = /(?<![\p{L}\p{N}])BREAK(?![\p{L}\p{N}])/u.exec(plain)
    ?? /(?<=\s)AND(?=\s)/.exec(plain)
    ?? /\[[^[\]]*\]/.exec(plain);
  if (foreign) out.push({ kind: 'foreign-syntax', found: show(foreign[0]) });

  const unescaped = plain.replace(/\\[()]/g, '');
  const open = (unescaped.match(/\(/g) ?? []).length;
  const close = (unescaped.match(/\)/g) ?? []).length;
  if (open !== close) out.push({ kind: 'unbalanced', found: '', numbers: { open, close } });

  const weights = weightsOf(plain);
  const high = weights.find((item) => item.weight > WEIGHT_HIGH);
  if (high) out.push({ kind: 'weight-high', found: show(high.raw) });
  if (reader === 't5' && weights.length > 0) out.push({ kind: 'weight-ignored', found: show(weights[0].raw) });

  if (role === 'positive') {
    const negation = NEGATIONS.exec(plain);
    if (negation) out.push({ kind: 'negation', found: negation[0] });
  }

  if (share(plain, /\p{Script=Cyrillic}/u) > 0.3) out.push({ kind: 'not-english', found: '' });

  const tokens = approxTokens(plain);
  if (reader === 'clip' && tokens > CLIP_LONG_TOKENS) out.push({ kind: 'too-long', found: 'clip', numbers: { tokens } });
  if (reader === 't5' && tokens > T5_LONG_TOKENS) out.push({ kind: 'too-long', found: 't5', numbers: { tokens } });
  return out;
}

/** Phrases that stand both in what is wanted and in what is not: two opposite instructions for one thing. */
export function contradictions(positive: string, negative: string): string[] {
  const wanted = new Set(phrasesOf(positive));
  const seen = new Set<string>();
  for (const phrase of phrasesOf(negative)) if (wanted.has(phrase)) seen.add(phrase);
  return [...seen].slice(0, 5);
}

/** Whether a description holds any of a LoRA's words, as a person would look for them: any case, any spacing. */
export function holdsTrigger(text: string, words: string[]): boolean {
  const flat = text.toLowerCase().replace(/\s+/g, ' ');
  return words.some((word) => {
    const wanted = word.toLowerCase().replace(/\s+/g, ' ').trim();
    return wanted !== '' && flat.includes(wanted);
  });
}

/** `type` of Load CLIP and its siblings → how texts encoded with it are read. */
const CLIP_TYPE_READERS: Record<string, PromptReader> = {
  stable_diffusion: 'clip',
  stable_cascade: 'clip',
  sdxl: 'clip',
};

export function readerOfClipType(type: unknown): PromptReader {
  if (typeof type !== 'string' || type.trim() === '') return 'unknown';
  // Every other value Load CLIP offers loads a T5 or a language model: sd3, flux, wan, qwen_image, and so on.
  return CLIP_TYPE_READERS[type.trim().toLowerCase()] ?? 't5';
}

const CLIP_FAMILIES = new Set(['sd15', 'sd2', 'sdxl', 'pony', 'illustrious', 'cascade']);
const UNSURE_FAMILIES = new Set(['unknown', 'kolors']);

/** A base-model family → how its checkpoints read text. */
export function readerOfFamily(family: string): PromptReader {
  if (UNSURE_FAMILIES.has(family)) return 'unknown';
  return CLIP_FAMILIES.has(family) ? 'clip' : 't5';
}
