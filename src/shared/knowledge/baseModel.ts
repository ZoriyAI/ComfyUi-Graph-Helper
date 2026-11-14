import type { BaseModelFamily, Evidence } from '../contracts/knowledge';

export interface BaseModelGuess {
  family: BaseModelFamily;
  evidence: Evidence;
}

export interface BaseModelSources {
  /** Embedded safetensors header fields, strings only. */
  metadata?: Record<string, string> | null;
  /** Civitai sidecar `baseModel`, e.g. "SDXL 1.0", "Pony", "Flux.1 D". */
  sidecarBaseModel?: string | null;
  /** File name as the server lists it; a subfolder prefix is fine. */
  filename?: string | null;
}

const SEP = '[\\s_.\\-/]*';
/** No letter right before / after: keeps short tokens like "ill" or "pony" from matching inside words. */
const L = '(?<![a-z])';
const R = '(?![a-z])';

/**
 * Ordered most specific first. The first rule that matches wins, so e.g. "Flux.1 Krea" is krea, not flux1,
 * and "stable-diffusion-xl-v1" is sdxl, not sd15.
 */
const RULES: ReadonlyArray<readonly [BaseModelFamily, RegExp]> = [
  ['wan2.2', new RegExp(`${L}wan${SEP}(?:video${SEP})?2${SEP}2(?!\\d)`)],
  ['wan2.1', new RegExp(`${L}wan${SEP}(?:video${SEP})?2${SEP}1(?!\\d)`)],
  // Civitai labelled the first 14B/1.3B Wan releases "Wan Video" with no version; those are 2.1.
  ['wan2.1', new RegExp(`${L}wan${SEP}video(?!${SEP}2${SEP}\\d)`)],
  // "ltx-2", "ltx-2.5", "LTXV2"; not "ltxv-2b" (parameter count of the 0.9 line).
  ['ltx2', new RegExp(`${L}ltx${SEP}(?:v|video)?${SEP}2(?:${SEP}\\d+)?(?!\\d|\\s*b${R})`)],
  ['qwen-image', new RegExp(`${L}qwen${SEP}image`)],
  ['zimage', new RegExp(`${L}z${SEP}image`)],
  ['hunyuan', /hunyuan/],
  // Civitai "Flux.1 Krea" is a Flux.1 dev fine-tune; plain "krea"/"krea2" is Krea 2, its own architecture.
  ['flux1', new RegExp(`${L}flux${SEP}1${SEP}krea`)],
  // A file naming both Krea and Flux ("krea-flux-lora") is the Flux.1 Krea fine-tune, not Krea 2.
  ['flux1', new RegExp(`^(?=.*${L}flux(?!${SEP}2(?!\\d)))(?=.*${L}krea${R})`)],
  ['krea', new RegExp(`${L}krea${R}`)],
  ['chroma', new RegExp(`${L}(?:chroma|kroma)${R}`)],
  ['flux2', new RegExp(`${L}flux${SEP}2(?!\\d)`)],
  ['flux1', new RegExp(`${L}flux`)],
  ['sd3', new RegExp(`${L}(?:sd${SEP}3(?!\\d)|stable${SEP}diffusion${SEP}(?:v${SEP})?3(?!\\d))`)],
  ['pony', new RegExp(`${L}pony${R}`)],
  ['illustrious', new RegExp(`${L}(?:illustrious|noob${SEP}ai|noobai|ill|ilxl)${R}`)],
  ['kolors', new RegExp(`${L}kolors${R}`)],
  ['pixart', new RegExp(`${L}pix${SEP}art`)],
  ['auraflow', new RegExp(`${L}aura${SEP}flow`)],
  ['cascade', new RegExp(`${L}(?:stable${SEP})?cascade${R}`)],
  ['sdxl', new RegExp(`${L}(?:sd${SEP}xl|stable${SEP}diffusion${SEP}xl)${R}`)],
  // A bare "XL" word ("juggernautXL", "RealVisXL_V5", "animagine-xl"): after Pony and Illustrious, which are XL too.
  ['sdxl', new RegExp(`${L}xl${R}`)],
  ['sd2', new RegExp(`${L}(?:sd${SEP}v?${SEP}2(?:${SEP}[01])?(?!\\d)|stable${SEP}diffusion${SEP}v?${SEP}2(?!\\d))`)],
  // The SD 2.x release names: "v2-1_768-ema-pruned", "768-v-ema".
  ['sd2', new RegExp(`${L}(?:v${SEP}2-[01](?!\\d)|768${SEP}v${R})`)],
  ['sd15', new RegExp(`${L}(?:sd${SEP}v?${SEP}1(?:${SEP}5)?(?!\\d)|stable${SEP}diffusion${SEP}v?${SEP}1(?!\\d))`)],
  // The SD 1.5 release names: "v1-5-pruned-emaonly"; "v1.5" only next to a release word, since it is also a plain version.
  ['sd15', new RegExp(`${L}v${SEP}1(?:-5(?!\\d)|\\.5${SEP}(?:pruned|ema|inpainting|base)${R})`)],
];

/** Sidecar labels Civitai uses that carry no version text the rules above can read. */
const SIDECAR_ALIASES: Record<string, BaseModelFamily> = {
  qwen: 'qwen-image',
  'zimageturbo': 'zimage',
};

/** A refinement narrows a family to one of its fine-tunes (Pony and Illustrious are SDXL fine-tunes). */
const REFINES: Partial<Record<BaseModelFamily, BaseModelFamily[]>> = {
  sdxl: ['pony', 'illustrious'],
};

/**
 * Splits camelCase and letter/digit runs so that "PastelDetailPonyV2" reads as "pastel detail pony v 2"
 * and "Wan21" as "wan 21". Dots inside versions ("2.2") are kept.
 */
function normalize(text: string): string {
  return text
    .replace(/\.(safetensors|sft|ckpt|pt|pth|bin|gguf|onnx)$/i, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-zA-Z])/g, '$1 $2')
    .toLowerCase();
}

/** The family named by a free-text label or filename, or 'unknown'. Never defaults to sd15. */
export function familyFromText(text: string | null | undefined): BaseModelFamily {
  if (!text) return 'unknown';
  const value = normalize(text);
  for (const [family, pattern] of RULES) if (pattern.test(value)) return family;
  return 'unknown';
}

function familyFromSidecar(label: string | null | undefined): BaseModelFamily {
  if (!label) return 'unknown';
  const alias = SIDECAR_ALIASES[label.toLowerCase().replace(/[\s_.-]+/g, '')];
  return alias ?? familyFromText(label);
}

/**
 * Header fields in the order they are trusted. ss_base_model_version and modelspec.architecture name the base
 * a LoRA was trained against; ss_sd_model_name and modelspec.title often name the exact fine-tune (Pony, Illustrious).
 */
function familyFromMetadata(metadata: Record<string, string> | null | undefined): BaseModelFamily {
  if (!metadata) return 'unknown';
  const primary = [metadata.ss_base_model_version, metadata['modelspec.architecture']]
    .map((value) => familyFromText(value))
    .find((family) => family !== 'unknown') ?? 'unknown';
  const named = [metadata.ss_sd_model_name, metadata['modelspec.title']]
    .map((value) => familyFromText(value))
    .find((family) => family !== 'unknown') ?? 'unknown';
  if (primary === 'unknown') return named;
  return refines(primary, named) ? named : primary;
}

function refines(base: BaseModelFamily, candidate: BaseModelFamily): boolean {
  return (REFINES[base] ?? []).includes(candidate);
}

/**
 * Picks the most trusted source that names a family (metadata, then sidecar, then filename), then lets a less
 * trusted source narrow it within the same lineage: an SDXL header plus a "Pony" sidecar is pony.
 */
export function inferBaseModel(sources: BaseModelSources): BaseModelGuess {
  const candidates: BaseModelGuess[] = [
    { family: familyFromMetadata(sources.metadata), evidence: 'metadata' },
    { family: familyFromSidecar(sources.sidecarBaseModel), evidence: 'sidecar' },
    { family: familyFromText(baseName(sources.filename)), evidence: 'filename' },
  ];
  const known = candidates.filter((candidate) => candidate.family !== 'unknown');
  if (known.length === 0) return { family: 'unknown', evidence: 'none' };
  const first = known[0];
  const narrower = known.slice(1).find((candidate) => refines(first.family, candidate.family));
  return narrower ?? first;
}

function baseName(filename: string | null | undefined): string {
  if (!filename) return '';
  const parts = filename.split(/[\\/]/);
  return parts[parts.length - 1];
}

/**
 * Families whose LoRAs load on each other's base models. Kept narrow on purpose: a missing pair only means
 * no warning is shown, while a wrong pair would hide a real mismatch.
 */
const COMPATIBLE_GROUPS: BaseModelFamily[][] = [
  ['sdxl', 'pony', 'illustrious'],
  ['wan2.1', 'wan2.2'],
];

/** Families whose models come in parameter sizes that do not share LoRAs (Wan 1.3B / 5B / 14B). */
const SIZED_FAMILIES = new Set<BaseModelFamily>(['wan2.1', 'wan2.2']);

/** The parameter size a file name states ("wan2.2_ti2v_5B", "Wan2_1-T2V-14B"), or null. */
export function parameterSizeOf(filename: string | null | undefined): string | null {
  if (!filename) return null;
  const match = /(?<![a-z0-9.])(1[._]3|5|14)\s*b(?![a-z])/.exec(normalize(baseName(filename)));
  return match ? match[1].replace('_', '.') : null;
}

/**
 * True when either side is unknown or both sit in one lineage. For sized families, file names that state
 * different parameter sizes (a 5B LoRA on a 14B model) are not compatible.
 */
export function familiesCompatible(
  left: BaseModelFamily,
  right: BaseModelFamily,
  names?: { left?: string | null; right?: string | null },
): boolean {
  if (left === 'unknown' || right === 'unknown') return true;
  const sameLineage = left === right || COMPATIBLE_GROUPS.some((group) => group.includes(left) && group.includes(right));
  if (!sameLineage) return false;
  if (names && SIZED_FAMILIES.has(left) && SIZED_FAMILIES.has(right)) {
    const leftSize = parameterSizeOf(names.left);
    const rightSize = parameterSizeOf(names.right);
    if (leftSize && rightSize && leftSize !== rightSize) return false;
  }
  return true;
}
