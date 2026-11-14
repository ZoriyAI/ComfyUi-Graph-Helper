/**
 * Byte caps for answers the app does not control the size of (the MCP server, the ComfyUI address a server names).
 * The cap is checked while the bytes arrive, so an endless or huge answer is cut off instead of filling memory.
 */

export class ResponseTooLargeError extends Error {
  constructor(readonly limit: number) {
    super(`The answer is larger than ${limit} bytes.`);
    this.name = 'ResponseTooLargeError';
  }
}

/** The largest answer one MCP request may bring: far above a real object_info, below what a string can hold. */
export const MCP_RESPONSE_MAX_BYTES = 512 * 1024 * 1024;

/** A copy of `response` whose body errors with ResponseTooLargeError once more than `maxBytes` came through. */
export function capResponse(response: Response, maxBytes: number): Response {
  const declared = Number(response.headers.get('content-length') ?? '');
  if (Number.isFinite(declared) && declared > maxBytes) {
    void response.body?.cancel().catch(() => undefined);
    throw new ResponseTooLargeError(maxBytes);
  }
  if (!response.body) return response;
  let seen = 0;
  const limited = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      seen += chunk.byteLength;
      if (seen > maxBytes) {
        controller.error(new ResponseTooLargeError(maxBytes));
        return;
      }
      controller.enqueue(chunk);
    },
  }));
  return new Response(limited, { status: response.status, statusText: response.statusText, headers: response.headers });
}

/** A fetch whose every answer is capped at `maxBytes`. */
export function cappedFetch(maxBytes: number, base: typeof fetch = (...args) => globalThis.fetch(...args)): typeof fetch {
  return (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => capResponse(await base(input, init), maxBytes)) as typeof fetch;
}
