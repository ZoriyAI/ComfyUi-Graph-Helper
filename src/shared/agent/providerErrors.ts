/**
 * Recognises a local model server refusing tool (function) calling. Ollama answers a request with tools for a
 * model without tool support with `400 ... "<model>" does not support tools`; llama.cpp's server says tools need
 * `--jinja`; vLLM says `"auto" tool choice requires --enable-auto-tool-choice`; other OpenAI-compatible servers
 * mention "function calling" or "tools are not supported". The chat then explains what that means instead of
 * showing the raw error.
 */

const NO_TOOLS_PATTERNS: readonly RegExp[] = [
  /does not support tools/i,
  /doesn['’]?t support tools/i,
  /tools? (?:are|is) not supported/i,
  /not support(?:ed)? (?:for )?tool[s ]/i,
  /tool(?:s| calling| use)? (?:is |are )?(?:not |un)supported/i,
  /function[ _-]?call(?:ing|s)? (?:is |are )?(?:not |un)supported/i,
  /does not support function[ _-]?call/i,
  /(?:no|without) (?:support for )?function[ _-]?calling/i,
  /enable-auto-tool-choice/i,
  /tool[ _]choice.*(?:requires|not supported)/i,
  /tools? (?:param(?:eter)?s? )?requires? (?:the )?--jinja/i,
  /\bjinja\b.*\btools?\b/i,
];

/** Status 400 together with the word "tools" (or "function calling") counts too: the request's tools were refused. */
const BAD_REQUEST_TOOLS = /\b400\b[\s\S]*\b(?:tools?|function[ _-]?call(?:ing)?)\b|\b(?:tools?|function[ _-]?call(?:ing)?)\b[\s\S]*\b400\b/i;

export function isToolsUnsupportedError(message: unknown): boolean {
  if (typeof message !== 'string' || message.trim() === '') return false;
  const text = message.slice(0, 2000);
  if (NO_TOOLS_PATTERNS.some((pattern) => pattern.test(text))) return true;
  return BAD_REQUEST_TOOLS.test(text);
}

/** Local models known to call tools, named in the explanation. */
export const TOOL_CAPABLE_EXAMPLES = ['qwen3', 'qwen2.5', 'llama3.1', 'mistral-nemo'];

/** The provider-specific explanation key, or null when the raw error should be shown as before. */
export function providerErrorKey(provider: string | null | undefined, message: unknown): 'diagnostics.localModelNoTools' | null {
  if (provider !== 'local') return null;
  return isToolsUnsupportedError(message) ? 'diagnostics.localModelNoTools' : null;
}
