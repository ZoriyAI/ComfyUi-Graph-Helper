/**
 * The model's context window in tokens, for the history budget. A known model id maps to its published window;
 * an unknown one gets 32k; Preferences ▸ Assistant ▸ Context window overrides both (0 = auto).
 * Matching is by prefix of the lowercased id after any "provider/" part, longest prefix first, so
 * "llama3.1:8b", "models/gemini-2.5-pro" and "claude-sonnet-4-5-20250929" all resolve.
 */

export const DEFAULT_CONTEXT_TOKENS = 32_000;

/**
 * A model on the person's own server works inside the window the server loaded it with (see
 * main/llm/localContext.ts). Below MIN_WORKING_WINDOW the helper's smallest request does not fit; below
 * COMPACT_WINDOW the helper offers fewer tools so a build has room for its steps; RECOMMENDED_WINDOW is what to
 * suggest when the window is too small.
 */
export const MIN_WORKING_WINDOW = 6_000;
export const COMPACT_WINDOW = 16_000;
export const RECOMMENDED_WINDOW = 16_384;
/** Share of the window the system prompt plus the kept history may use; the rest is left for the answer and tools. */
export const HISTORY_SHARE = 0.7;
/** Characters per token when nothing better is known. */
export const CHARS_PER_TOKEN = 4;

const KNOWN: Record<string, number> = {
  // Anthropic
  claude: 200_000,
  // OpenAI
  'gpt-5': 400_000,
  'gpt-4.1': 1_047_576,
  'gpt-4o': 128_000,
  'chatgpt-4o': 128_000,
  'gpt-4-turbo': 128_000,
  'gpt-4': 8_192,
  'gpt-3.5-turbo': 16_385,
  'gpt-oss': 131_072,
  o1: 200_000,
  o3: 200_000,
  'o4-mini': 200_000,
  // Google
  'gemini-1.5-pro': 2_097_152,
  'gemini-1.5-flash': 1_048_576,
  'gemini-2': 1_048_576,
  'gemini-3': 1_048_576,
  // Common Ollama / local models (the model's own window; Ollama's num_ctx may be set lower on the server)
  'llama3.1': 131_072,
  'llama3.2': 131_072,
  'llama3.3': 131_072,
  'llama4': 1_048_576,
  llama3: 8_192,
  llama2: 4_096,
  'qwen2.5': 32_768,
  qwen3: 40_960,
  qwq: 131_072,
  'mistral-nemo': 128_000,
  'mistral-small': 32_768,
  mistral: 32_768,
  mixtral: 32_768,
  gemma3: 131_072,
  gemma2: 8_192,
  phi4: 16_384,
  phi3: 4_096,
  'deepseek-r1': 131_072,
  'deepseek-v3': 131_072,
  'deepseek-coder-v2': 163_840,
  codellama: 16_384,
  'command-r': 131_072,
};

const PREFIXES = Object.keys(KNOWN).sort((a, b) => b.length - a.length);

/** The published window of a known model id, or null. */
export function knownContextTokens(model: string): number | null {
  const id = model.trim().toLowerCase().split('/').pop() ?? '';
  if (id === '') return null;
  const prefix = PREFIXES.find((key) => id.startsWith(key));
  return prefix ? KNOWN[prefix] : null;
}

export interface ContextWindow {
  tokens: number;
  source: 'override' | 'known' | 'default' | 'server';
}

/**
 * The window the helper really works with. The person's setting wins, except that a server which loaded the model
 * with less is believed (the rest would be dropped silently). With "auto" the number the server reported IS the
 * window, larger or smaller than the published one; without a report, the published window, else 32k. Settings ▸
 * Assistant shows this same number as the "auto" value, so the page and the turn never disagree.
 */
export function effectiveContextWindow(model: string, override = 0, serverTokens: number | null = null): ContextWindow {
  const chosen = contextWindowFor(model, override);
  const server = serverTokens !== null && Number.isFinite(serverTokens) && serverTokens >= 256 ? Math.floor(serverTokens) : null;
  if (server === null) return chosen;
  if (chosen.source === 'override' && chosen.tokens <= server) return chosen;
  return { tokens: server, source: 'server' };
}

/** The window the history budget uses: the override when set, else the known window, else 32k. */
export function contextWindowFor(model: string, override = 0): ContextWindow {
  if (Number.isFinite(override) && override > 0) return { tokens: Math.floor(override), source: 'override' };
  const known = knownContextTokens(model);
  return known ? { tokens: known, source: 'known' } : { tokens: DEFAULT_CONTEXT_TOKENS, source: 'default' };
}

/** Rough token count of a text: characters / charsPerToken, rounded up. */
export function estimateTokens(chars: number, charsPerToken = CHARS_PER_TOKEN): number {
  return Math.ceil(chars / (charsPerToken > 0 ? charsPerToken : CHARS_PER_TOKEN));
}

/** Tokens left for the dialog: 70 % of the window minus the system prompt. Never negative. */
export function historyBudgetTokens(windowTokens: number, systemChars: number, charsPerToken = CHARS_PER_TOKEN): number {
  return Math.max(0, Math.floor(windowTokens * HISTORY_SHARE) - estimateTokens(systemChars, charsPerToken));
}
