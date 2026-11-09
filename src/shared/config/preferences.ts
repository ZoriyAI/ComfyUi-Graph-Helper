import { z } from 'zod';
import { carriesSecret } from './draft';

/**
 * Application preferences: one validated model stored as JSON on the settings row (`preferences_json`, v10).
 * Every field has a default, so an older or partial row reads as a whole object. Secrets are never part of it:
 * keys and tokens live in memory or OS storage, and a secret-shaped value anywhere here blocks the save.
 */

function httpOriginOrEmpty(value: string): boolean {
  if (value === '') return true;
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.username === '' && url.password === '';
  } catch {
    return false;
  }
}

export const PREFERENCE_PROVIDERS = ['openai', 'anthropic', 'google', 'local'] as const;
export type PreferenceProvider = typeof PREFERENCE_PROVIDERS[number];

/**
 * Model steps per turn before the helper pauses at a checkpoint (each tool round trip is one step). Reaching it
 * never ends the work: the chat shows "paused — Continue / Stop" and Continue resumes the same run.
 */
export const STEP_LIMIT = { min: 4, max: 200, default: 60 } as const;
/** Context window override in tokens; 0 means auto (from the model id, 32k when unknown). */
export const CONTEXT_TOKENS = { min: 0, max: 10_000_000, default: 0, step: 1000 } as const;
/** Model files whose metadata is read in one batch. Pacing only: batches continue until every file is read. */
export const ENRICH_PER_RUN = { min: 10, max: 1000, default: 50 } as const;
/** Pause between two metadata batches, so a large install is read without hammering the MCP server. */
export const ENRICH_PAUSE_MS = { min: 0, max: 10_000, default: 1500, step: 250 } as const;
/** Network timeout of one MCP tool call during a sync (fixed; a stalled server must not hold a sync open). */
export const MCP_CALL_TIMEOUT_MS = 30_000;
export const BUILD_PACE = { min: 300, max: 2000, default: 820, step: 20 } as const;
export const GRID_SIZE = { min: 8, max: 48, default: 18, step: 2 } as const;

/**
 * Description cards on the canvas. own: a card only where the node has its own text (a node explanation or a
 * component purpose); class knowledge waits for hover, selection or focus behind a dot. all: every node that has
 * anything to say. off: dots only. The order is the toolbar cycle.
 */
export const DESCRIPTION_MODES = ['own', 'all', 'off'] as const;
export type DescriptionsMode = typeof DESCRIPTION_MODES[number];

/**
 * The description mode a canvas section stands for. `descriptions` wins; a row written before it existed
 * keeps its old switch: on reads as own, off as off.
 */
export function descriptionsModeOf(canvas: { descriptions?: DescriptionsMode | undefined; showDescriptions?: boolean } | null | undefined): DescriptionsMode {
  if (canvas?.descriptions && (DESCRIPTION_MODES as readonly string[]).includes(canvas.descriptions)) return canvas.descriptions;
  return canvas?.showDescriptions === false ? 'off' : 'own';
}

/** What to save for a mode: the mode itself and the old switch beside it, so an older reader still agrees on/off. */
export function descriptionsPatch(mode: DescriptionsMode): { descriptions: DescriptionsMode; showDescriptions: boolean } {
  return { descriptions: mode, showDescriptions: mode !== 'off' };
}

/** 'Mod+Shift+K', 'F1', 'Shift+1', 'Delete', or '' for "no shortcut". */
const CHORD = /^((Mod|Ctrl|Shift|Alt)\+)*([A-Z0-9]|F([1-9]|1[0-2])|[=\-/,.;']|\+|Delete|Backspace|Enter|Escape|Tab|Space|Home|End|PageUp|PageDown|Insert|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|`|\[|\]|\\)$/;
const COMMAND_ID = /^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9]+)*$/;

export function isChord(value: string): boolean {
  return value === '' || CHORD.test(value);
}

const providerEntry = z.object({
  model: z.string().trim().max(200).default(''),
  baseURL: z.string().trim().max(500).refine(httpOriginOrEmpty).default(''),
});

const int = (range: { min: number; max: number; default: number }) => z.number().int().min(range.min).max(range.max).default(range.default);

export const preferencesSchema = z.object({
  assistant: z.object({
    /** ask: suggestions appear as ghosts first; build: the helper builds directly unless asked to suggest. */
    defaultIntent: z.enum(['ask', 'build']).default('ask'),
    maxStepsPerTurn: int(STEP_LIMIT),
    /** Tokens of the model's context window the history budget is taken from; 0 = auto. */
    contextTokens: int(CONTEXT_TOKENS),
    allowWebSearch: z.boolean().default(true),
    allowFetchPage: z.boolean().default(true),
    /** ui follows the interface language. */
    answerLanguage: z.enum(['ui', 'en', 'ru']).default('ui'),
    verbosity: z.enum(['short', 'normal']).default('short'),
  }).prefault({}),
  providers: z.object({
    openai: providerEntry.prefault({}),
    anthropic: providerEntry.prefault({}),
    google: providerEntry.prefault({}),
    local: providerEntry.prefault({}),
  }).prefault({}),
  sync: z.object({
    /** loaders: only loader folders (checkpoints, loras, …); all: every model folder. */
    enrichmentScope: z.enum(['loaders', 'all']).default('loaders'),
    /** Batch size of the background metadata reading (not a stop). */
    enrichPerRun: int(ENRICH_PER_RUN),
    enrichPauseMs: int(ENRICH_PAUSE_MS),
  }).prefault({}),
  canvas: z.object({
    /** Old on/off switch, still read (and written beside `descriptions`) for rows saved before the mode existed. */
    showDescriptions: z.boolean().default(true),
    /** own / all / off; absent on older rows, where descriptionsModeOf derives it from showDescriptions. */
    descriptions: z.enum(DESCRIPTION_MODES).optional(),
    showMinimap: z.boolean().default(true),
    followAgent: z.boolean().default(false),
    buildPaceMs: int(BUILD_PACE),
    tourAutoplay: z.boolean().default(true),
    gridSize: int(GRID_SIZE),
  }).prefault({}),
  appearance: z.object({
    density: z.enum(['comfortable', 'compact']).default('comfortable'),
    accent: z.enum(['cyan', 'violet', 'mint', 'amber']).default('cyan'),
    reduceGlow: z.boolean().default(false),
  }).prefault({}),
  /** Command id → chord. Only overrides are stored; '' removes the default shortcut. */
  shortcuts: z.record(z.string().regex(COMMAND_ID).max(80), z.string().max(40).refine(isChord)).default({}),
  privacy: z.object({
    /** The agent sees widget values; off omits them from the prompt and from getGraph. */
    sendFieldValues: z.boolean().default(true),
    saveChatHistory: z.boolean().default(true),
  }).prefault({}),
}).strict();

export type Preferences = z.infer<typeof preferencesSchema>;
export type PreferenceSection = keyof Preferences;
export type PreferencesPatch = {
  [K in PreferenceSection]?: K extends 'shortcuts'
    ? Record<string, string>
    : K extends 'providers'
      ? { [P in PreferenceProvider]?: Partial<Preferences['providers'][P]> }
      : Partial<Preferences[K]>;
};

export const preferencesDefaults: Preferences = preferencesSchema.parse({});

const SECTIONS = Object.keys(preferencesDefaults) as PreferenceSection[];
/** Fields without a default, so they are absent from preferencesDefaults but still kept when they parse. */
const OPTIONAL_FIELDS: Partial<Record<PreferenceSection, string[]>> = { canvas: ['descriptions'] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** True when any string anywhere in the value (keys included) looks like a secret. */
export function preferencesCarrySecret(input: unknown, depth = 0): boolean {
  if (depth > 6) return false;
  if (typeof input === 'string') return carriesSecret({ value: input });
  if (Array.isArray(input)) return input.some((item) => preferencesCarrySecret(item, depth + 1));
  if (!isRecord(input)) return false;
  if (carriesSecret(input)) return true;
  return Object.values(input).some((value) => preferencesCarrySecret(value, depth + 1));
}

/**
 * Read path: whatever is stored becomes a whole, valid object. Each field that does not parse falls back
 * to its default on its own, so one bad value never resets the rest.
 */
export function parsePreferences(input: unknown): Preferences {
  if (typeof input === 'string') {
    try {
      return parsePreferences(JSON.parse(input));
    } catch {
      return clone(preferencesDefaults);
    }
  }
  const whole = preferencesSchema.safeParse(input ?? {});
  if (whole.success && !preferencesCarrySecret(whole.data)) return whole.data;
  const source = isRecord(input) ? input : {};
  const result = clone(preferencesDefaults) as Record<string, unknown>;
  for (const section of SECTIONS) {
    const stored = source[section];
    if (!isRecord(stored)) continue;
    if (section === 'shortcuts') {
      const kept: Record<string, string> = {};
      for (const [id, chord] of Object.entries(stored)) {
        if (COMMAND_ID.test(id) && id.length <= 80 && typeof chord === 'string' && chord.length <= 40 && isChord(chord)) kept[id] = chord;
      }
      result.shortcuts = kept;
      continue;
    }
    const target = result[section] as Record<string, unknown>;
    for (const [field, value] of Object.entries(stored)) {
      if (!(field in target) && !OPTIONAL_FIELDS[section]?.includes(field)) continue;
      const candidate = { ...(result as Preferences), [section]: { ...target, [field]: value } };
      const parsed = preferencesSchema.safeParse(candidate);
      if (parsed.success && !preferencesCarrySecret(value)) target[field] = (parsed.data[section] as Record<string, unknown>)[field];
    }
  }
  return result as Preferences;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Applies a patch section by section. Objects merge field by field (providers by provider); shortcuts
 * replace the whole map, so a reset removes overrides.
 */
export function mergePreferences(base: Preferences, patch: unknown): unknown {
  if (!isRecord(patch)) return base;
  const next = clone(base) as Record<string, unknown>;
  for (const [section, value] of Object.entries(patch)) {
    if (!(section in next)) {
      next[section] = value;
      continue;
    }
    if (section === 'shortcuts') {
      next.shortcuts = value;
      continue;
    }
    if (!isRecord(value)) {
      next[section] = value;
      continue;
    }
    const current = next[section] as Record<string, unknown>;
    if (section === 'providers') {
      for (const [provider, entry] of Object.entries(value)) {
        current[provider] = isRecord(entry) && isRecord(current[provider]) ? { ...(current[provider] as Record<string, unknown>), ...entry } : entry;
      }
      continue;
    }
    next[section] = { ...current, ...value };
  }
  return next;
}

/** Same messages as the settings row: the secret check runs before the schema. */
export function preferencesWriteError(input: unknown): string | null {
  if (preferencesCarrySecret(input)) return 'Settings cannot store a secret';
  if (!preferencesSchema.safeParse(input).success) return 'Settings do not match the schema';
  return null;
}

export function samePreferences(left: Preferences, right: Preferences): boolean {
  return JSON.stringify(sortKeys(left)) === JSON.stringify(sortKeys(right));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]));
}

/** Suggestions only, shown under the Model field. The owner types any id; nothing here is a default. */
export const MODEL_SUGGESTIONS: Record<PreferenceProvider, readonly string[]> = {
  openai: ['gpt-5', 'gpt-5-mini', 'gpt-4.1'],
  anthropic: ['claude-sonnet-4-5', 'claude-opus-4-1', 'claude-haiku-4-5'],
  google: ['gemini-2.5-pro', 'gemini-2.5-flash'],
  local: ['llama3.1', 'qwen2.5', 'mistral'],
};

export function isPreferenceProvider(value: string): value is PreferenceProvider {
  return (PREFERENCE_PROVIDERS as readonly string[]).includes(value);
}
