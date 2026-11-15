/**
 * Which model to take, where to get a key, where the provider's data rules are, and what a request costs: one dated
 * list in one file. Prices and names change; the live model list from the provider always wins in the picker, and
 * this list is only the fallback and the advice. Update ADVICE_DATE with every change.
 *
 * Prices are US dollars per million tokens (standard tier, short prompts), read from the providers' own pricing
 * pages on ADVICE_DATE. A price is an estimate for the person: the provider's bill is the truth.
 * Shown in Settings ▸ Assistant (AssistantSection.tsx, ProviderAdvice.tsx); main uses the prices for the cost of a
 * turn (main/llmService.ts), and the chat names LOCAL_ADVICE models when a local model cannot call tools.
 */

/** The day the advice and prices below were last checked against the providers' pages. */
export const ADVICE_DATE = '2026-11-15';

/** The cloud providers the advice covers. */
export type AdviceProvider = 'openai' | 'anthropic' | 'google';

/** What Settings tells a person about one cloud provider. */
export interface ProviderAdvice {
  /** A model that answers well enough for little money. */
  cheap: string;
  /** A stronger model for long builds. */
  strong: string;
  /** Where a person makes a key. */
  keyPage: string;
  /** The provider's own words on what it does with API data. */
  dataPolicy: string;
  /** What the provider's own web search costs, per 1000 searches, in dollars. */
  searchPer1000: number;
}

/** The advice for each cloud provider. */
export const CLOUD_ADVICE: Record<AdviceProvider, ProviderAdvice> = {
  openai: {
    cheap: 'gpt-6-luna',
    strong: 'gpt-6.1-sol',
    keyPage: 'https://platform.openai.com/api-keys',
    dataPolicy: 'https://developers.openai.com/api/docs/guides/your-data',
    searchPer1000: 10,
  },
  anthropic: {
    cheap: 'claude-haiku-5-5',
    strong: 'claude-sonnet-5-5',
    keyPage: 'https://platform.claude.com/settings/keys',
    dataPolicy: 'https://privacy.claude.com',
    searchPer1000: 10,
  },
  google: {
    cheap: 'gemini-3.5-flash-lite',
    strong: 'gemini-4-hydrogen',
    keyPage: 'https://aistudio.google.com/apikey',
    dataPolicy: 'https://aistudio.google.com/docs/terms',
    searchPer1000: 14,
  },
};

/**
 * Models on your own server that call tools well enough for the assistant (Ollama names, marked "tools" in Ollama's
 * library on ADVICE_DATE). `memoryGb`: video memory (or, slower, system memory) the model needs with a 16 384-token
 * window, rounded up. Ollama publishes download sizes only, so this is an estimate: the download (qwen3.5:9b 6.6 GB,
 * gpt-oss:20b 14 GB, qwen3.6:27b 17 GB) plus the context cache and buffers. Not measured by the project; the guide
 * docs/wiki/assistant/Which-Model.md says so and lists more models by hardware.
 */
export const LOCAL_ADVICE: ReadonlyArray<{ model: string; memoryGb: number }> = [
  { model: 'qwen3.5:9b', memoryGb: 8 },
  { model: 'gpt-oss:20b', memoryGb: 16 },
  { model: 'qwen3.6:27b', memoryGb: 24 },
];

/** Where a person gets Ollama, the simplest way to a model on their own computer. */
export const LOCAL_INSTALL_PAGE = 'https://ollama.com/download';

/** The window a local model should be loaded with for the assistant, in tokens. */
export const LOCAL_WINDOW_ADVICE = 16_384;

/** Prices by model id prefix, longest prefix first when looked up. Input and output, dollars per million tokens. */
export const PRICES: ReadonlyArray<{ provider: AdviceProvider; prefix: string; input: number; output: number }> = [
  { provider: 'openai', prefix: 'gpt-6-astra', input: 10, output: 50 },
  { provider: 'openai', prefix: 'gpt-6.1-sol', input: 2, output: 10 },
  { provider: 'openai', prefix: 'gpt-6.1-terra', input: 1, output: 5 },
  { provider: 'openai', prefix: 'gpt-6-sol', input: 2, output: 10 },
  { provider: 'openai', prefix: 'gpt-6-luna', input: 0.1, output: 0.5 },
  { provider: 'openai', prefix: 'gpt-5.6-sol', input: 4, output: 20 },
  { provider: 'openai', prefix: 'gpt-5.6-terra', input: 2, output: 12 },
  { provider: 'openai', prefix: 'gpt-5.6-luna', input: 0.2, output: 1.2 },
  { provider: 'openai', prefix: 'gpt-5.5-pro', input: 30, output: 180 },
  { provider: 'openai', prefix: 'gpt-5.5', input: 5, output: 30 },
  { provider: 'openai', prefix: 'gpt-5.4-pro', input: 30, output: 180 },
  { provider: 'openai', prefix: 'gpt-5.4-mini', input: 0.75, output: 4.5 },
  { provider: 'openai', prefix: 'gpt-5.4-nano', input: 0.2, output: 1.25 },
  { provider: 'openai', prefix: 'gpt-5.4', input: 2.5, output: 15 },
  { provider: 'openai', prefix: 'gpt-5.2-pro', input: 21, output: 168 },
  { provider: 'openai', prefix: 'gpt-5.2', input: 1.75, output: 14 },
  { provider: 'openai', prefix: 'gpt-5.1', input: 1.25, output: 10 },
  { provider: 'openai', prefix: 'gpt-5-pro', input: 15, output: 120 },
  { provider: 'openai', prefix: 'gpt-5-mini', input: 0.25, output: 2 },
  { provider: 'openai', prefix: 'gpt-5-nano', input: 0.05, output: 0.4 },
  { provider: 'openai', prefix: 'gpt-5', input: 1.25, output: 10 },
  { provider: 'openai', prefix: 'gpt-4.1-mini', input: 0.4, output: 1.6 },
  { provider: 'openai', prefix: 'gpt-4.1', input: 2, output: 8 },
  { provider: 'openai', prefix: 'gpt-4o-mini', input: 0.15, output: 0.6 },
  { provider: 'openai', prefix: 'gpt-4o', input: 2.5, output: 10 },
  { provider: 'openai', prefix: 'o3-pro', input: 20, output: 80 },
  { provider: 'openai', prefix: 'o3', input: 2, output: 8 },
  { provider: 'anthropic', prefix: 'claude-fable-5-2', input: 8, output: 40 },
  { provider: 'anthropic', prefix: 'claude-fable-5', input: 10, output: 50 },
  { provider: 'anthropic', prefix: 'claude-opus-5-5', input: 4, output: 20 },
  { provider: 'anthropic', prefix: 'claude-opus-5', input: 5, output: 25 },
  { provider: 'anthropic', prefix: 'claude-opus-4', input: 5, output: 25 },
  // Claude Opus 4 and 4.1 (retired on the Claude API) kept their old price; 4.5 to 4.8 are the 'claude-opus-4' row.
  { provider: 'anthropic', prefix: 'claude-opus-4-1', input: 15, output: 75 },
  { provider: 'anthropic', prefix: 'claude-opus-4-0', input: 15, output: 75 },
  { provider: 'anthropic', prefix: 'claude-opus-4-2025', input: 15, output: 75 },
  { provider: 'anthropic', prefix: 'claude-sonnet-5', input: 2, output: 10 },
  { provider: 'anthropic', prefix: 'claude-sonnet-4', input: 3, output: 15 },
  // For prompts up to 100 000 tokens; a longer prompt costs $0.50 and $2.50.
  { provider: 'anthropic', prefix: 'claude-haiku-5-5', input: 0.1, output: 0.5 },
  { provider: 'anthropic', prefix: 'claude-haiku-4-5', input: 1, output: 5 },
  // Google announces $4 and $20 for gemini-4-carbon and gemini-4-argon from 1 December 2026, and twice today's price
  // for gemini-3.8-flash and gemini-3.6-flash from 1 January 2027; the rows hold today's prices.
  { provider: 'google', prefix: 'gemini-4-carbon', input: 2, output: 10 },
  { provider: 'google', prefix: 'gemini-4-argon', input: 2, output: 10 },
  { provider: 'google', prefix: 'gemini-4-hydrogen', input: 1.5, output: 7.5 },
  { provider: 'google', prefix: 'gemini-3.8-flash', input: 0.75, output: 3.75 },
  { provider: 'google', prefix: 'gemini-3.6-flash', input: 0.75, output: 3.75 },
  { provider: 'google', prefix: 'gemini-3.5-flash-lite', input: 0.3, output: 2.5 },
  { provider: 'google', prefix: 'gemini-3.1-pro', input: 2, output: 12 },
  { provider: 'google', prefix: 'gemini-3.1-flash-lite', input: 0.25, output: 1.5 },
  { provider: 'google', prefix: 'gemini-3-flash', input: 0.5, output: 3 },
  { provider: 'google', prefix: 'gemini-2.5-pro', input: 1.25, output: 10 },
  { provider: 'google', prefix: 'gemini-2.5-flash-lite', input: 0.1, output: 0.4 },
  { provider: 'google', prefix: 'gemini-2.5-flash', input: 0.3, output: 2.5 },
];

/** PRICES with the longest prefix first, so 'gpt-5-mini' finds its own row before 'gpt-5'. */
const SORTED = [...PRICES].sort((a, b) => b.prefix.length - a.prefix.length);

/** The price of a model id, or null when it is not in the table (a compatible service, a local model). */
export function priceOf(provider: string, model: string): { input: number; output: number } | null {
  const id = model.trim().toLowerCase().split('/').pop() ?? '';
  if (id === '') return null;
  const found = SORTED.find((row) => row.provider === provider && id.startsWith(row.prefix));
  return found ? { input: found.input, output: found.output } : null;
}

/** Dollars for a number of tokens in and out, or null when the price is not known. */
export function costOf(provider: string, model: string, inputTokens: number, outputTokens: number): number | null {
  const price = priceOf(provider, model);
  if (!price) return null;
  const tokensIn = Number.isFinite(inputTokens) && inputTokens > 0 ? inputTokens : 0;
  const tokensOut = Number.isFinite(outputTokens) && outputTokens > 0 ? outputTokens : 0;
  return (tokensIn * price.input + tokensOut * price.output) / 1_000_000;
}

/** The two suggestions shown under the Model field for a cloud provider: the cheap one first. */
export function suggestedModels(provider: AdviceProvider): readonly string[] {
  return [CLOUD_ADVICE[provider].cheap, CLOUD_ADVICE[provider].strong];
}
