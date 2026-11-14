import type { ToolSet } from 'ai';
import type { ToolResultOutput } from '@ai-sdk/provider-utils';
import { redactValue } from '../../shared/agent/redact';

/** Keep local tool outputs private before the SDK forwards them to the next model step or the renderer. */
export function privateToolResults(tools: ToolSet, redact: (text: string) => string): ToolSet {
  const safeError = (error: unknown): Error => new Error(redact(error instanceof Error ? error.message : String(error)));
  return Object.fromEntries(Object.entries(tools).map(([name, definition]) => {
    const execute = definition.execute;
    // Provider-executed tools have no local executor (and must retain their provider metadata).
    if (!execute) return [name, definition];
    const safe: typeof definition = {
      ...definition,
      execute: (input, options) => {
        try {
          const output = execute(input, options);
          // The SDK supports streamed preliminary outputs as well as ordinary promise results.
          if (output && typeof output === 'object' && Symbol.asyncIterator in output) {
            return (async function* () {
              try {
                for await (const value of output) yield redactValue(value, redact);
              } catch (error) {
                throw safeError(error);
              }
            })();
          }
          return Promise.resolve(output).then(
            (value) => redactValue(value, redact),
            (error) => { throw safeError(error); },
          );
        } catch (error) {
          throw safeError(error);
        }
      },
      ...(definition.toModelOutput ? {
        toModelOutput: async (options: Parameters<NonNullable<typeof definition.toModelOutput>>[0]) => redactValue(await definition.toModelOutput!(options), redact) as ToolResultOutput,
      } : {}),
    };
    return [name, safe];
  }));
}
