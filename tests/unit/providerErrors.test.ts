import { describe, expect, it } from 'vitest';
import { isToolsUnsupportedError, providerErrorKey } from '../../src/shared/agent/providerErrors';

describe('local model without tool support', () => {
  const unsupported = [
    'registry.ollama.ai/library/gemma2:latest does not support tools',
    'Bad Request: {"error":"\\"llama2\\" does not support tools"}',
    'model "phi3" does not support tools (status code: 400)',
    'tools are not supported by this model',
    'Tool calling is not supported for this model',
    'Function calling is not supported',
    'This model does not support function calling',
    '"auto" tool choice requires --enable-auto-tool-choice and --tool-call-parser to be set',
    'tools param requires --jinja flag',
    'HTTP 400: unknown field "tools"',
    'Request failed with status 400: tools',
  ];
  const other = [
    'Local model has no endpoint.',
    'connect ECONNREFUSED 127.0.0.1:11434',
    'model "llama3" not found, try pulling it first',
    'HTTP 500: internal server error',
    'Request failed with status 400: messages must not be empty',
    'Model tried to call unavailable tool \'addNode\'',
    '',
  ];

  it.each(unsupported)('recognises %s', (message) => {
    expect(isToolsUnsupportedError(message)).toBe(true);
  });

  it.each(other)('leaves %s alone', (message) => {
    expect(isToolsUnsupportedError(message)).toBe(false);
  });

  it('applies only to the local provider', () => {
    expect(providerErrorKey('local', 'gemma does not support tools')).toBe('diagnostics.localModelNoTools');
    expect(providerErrorKey('openai', 'gemma does not support tools')).toBeNull();
    expect(providerErrorKey('local', 'connect ECONNREFUSED')).toBeNull();
    expect(isToolsUnsupportedError(undefined)).toBe(false);
  });
});
