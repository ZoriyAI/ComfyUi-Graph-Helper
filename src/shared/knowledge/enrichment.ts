/**
 * Pure parsing of `model_metadata {action:'read'}` results. The server returns the raw safetensors header as
 * `embedded_metadata` and a Civitai download sidecar as `civitai_sidecar` (null when absent).
 */

/** Header values such as ss_tag_frequency can be large; the app keeps enough to explain, not the whole blob. */
export const MAX_METADATA_VALUE = 4000;
export const MAX_METADATA_KEYS = 200;
const MAX_DESCRIPTION = 4000;
const MAX_TRIGGER_WORDS = 50;

export interface SidecarFacts {
  baseModel: string | null;
  trainedWords: string[];
  description: string;
  modelId: string | null;
  modelVersionId: string | null;
}

export interface ParsedModelMetadata {
  metadata: Record<string, string>;
  sidecar: SidecarFacts | null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function clip(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) : text;
}

/** Strings stay as they are; anything else is JSON text, so the stored map is always string to string. */
export function stringifyMetadata(value: unknown): Record<string, string> {
  const source = record(value) ?? {};
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(source).slice(0, MAX_METADATA_KEYS)) {
    if (item === undefined || item === null) continue;
    let text: string;
    if (typeof item === 'string') text = item;
    else {
      try {
        text = JSON.stringify(item) ?? '';
      } catch {
        continue;
      }
    }
    out[key] = clip(text, MAX_METADATA_VALUE);
  }
  return out;
}

function idText(value: unknown): string | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return String(value);
  if (typeof value === 'string' && /^\d{1,12}$/.test(value)) return value;
  return null;
}

function words(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string') continue;
    for (const part of item.split(',')) {
      const word = part.trim();
      if (word) seen.add(clip(word, 200));
    }
  }
  return [...seen].slice(0, MAX_TRIGGER_WORDS);
}

/**
 * Civitai descriptions are HTML. Scripts and styles go with what is in them, the other tags go alone, a block
 * ends its line, a list item starts with a dot; entities for the common few are decoded, whitespace collapses.
 */
export function plainText(html: string): string {
  const text = html
    .replace(/<\s*(script|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*li\b[^>]*>/gi, '• ')
    .replace(/<\s*\/\s*(p|div|li|h[1-6]|ul|ol|tr|blockquote)\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
  return clip(text, MAX_DESCRIPTION);
}

/**
 * Sidecars come as a Civitai model-version record (id = version id, modelId, trainedWords, baseModel,
 * model.description) or a flattened variant. Both are read.
 */
export function parseSidecar(value: unknown): SidecarFacts | null {
  const row = record(value);
  if (!row) return null;
  const model = record(row.model);
  const version = record(row.modelVersion) ?? record(row.version);
  const baseModel = [row.baseModel, version?.baseModel].find((item) => typeof item === 'string' && item.trim() !== '') as string | undefined;
  const description = [row.description, model?.description, version?.description].find((item) => typeof item === 'string') as string | undefined;
  const modelId = idText(row.modelId) ?? idText(model?.id) ?? idText(version?.modelId);
  // A bare `id` is the version id only in a model-version record, which is the one that also carries modelId.
  const modelVersionId = idText(row.modelVersionId) ?? idText(version?.id) ?? (idText(row.modelId) ? idText(row.id) : null);
  return {
    baseModel: baseModel?.trim() ?? null,
    trainedWords: words(row.trainedWords ?? version?.trainedWords),
    description: description ? plainText(description) : '',
    modelId,
    modelVersionId,
  };
}

export function civitaiUrl(sidecar: SidecarFacts | null): string | null {
  if (!sidecar?.modelId) return null;
  const base = `https://civitai.com/models/${sidecar.modelId}`;
  return sidecar.modelVersionId ? `${base}?modelVersionId=${sidecar.modelVersionId}` : base;
}

export function parseModelMetadata(payload: unknown): ParsedModelMetadata | null {
  const row = record(payload);
  if (!row) return null;
  if (!('embedded_metadata' in row) && !('civitai_sidecar' in row)) return null;
  return { metadata: stringifyMetadata(row.embedded_metadata), sidecar: parseSidecar(row.civitai_sidecar) };
}

/** Trigger words from the sidecar, else from the modelspec trigger phrase some trainers write. */
export function triggerWordsOf(parsed: ParsedModelMetadata): string[] {
  if (parsed.sidecar && parsed.sidecar.trainedWords.length > 0) return parsed.sidecar.trainedWords;
  const phrase = parsed.metadata['modelspec.trigger_phrase'];
  return phrase ? words([phrase]) : [];
}
