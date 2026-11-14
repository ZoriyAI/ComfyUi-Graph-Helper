import { describe, expect, it } from 'vitest';
import { capResponse, cappedFetch, ResponseTooLargeError } from '../../../src/main/net/capped';
import { readBody } from '../../../src/main/comfy/read';
import { ObjectInfoError } from '../../../src/shared/catalog/objectInfo';
import { readSideFile, SIDE_FILE_CHUNK_BASE64_MAX } from '../../../src/main/mcp/sideFiles';
import { readOnlySession } from '../../../src/main/mcp/readOnly';

/** A body that would go on for ever: chunks of `size` bytes until the reader stops. */
function endless(size = 1024): Response {
  let sent = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      sent += size;
      controller.enqueue(new Uint8Array(size));
    },
  });
  return Object.assign(new Response(body), { sentBytes: () => sent });
}

describe('answers of unknown size are cut off as they arrive', () => {
  it('stops an endless MCP answer at the cap', async () => {
    const fetchImpl = cappedFetch(64 * 1024, async () => endless());
    const response = await fetchImpl('http://127.0.0.1/mcp');
    await expect(response.arrayBuffer()).rejects.toBeInstanceOf(ResponseTooLargeError);
  });

  it('refuses at once an answer that says it is too large, and lets a small one through whole', async () => {
    expect(() => capResponse(new Response('x'.repeat(10), { headers: { 'content-length': '999999' } }), 100)).toThrow(ResponseTooLargeError);
    expect(await capResponse(new Response('hello'), 100).text()).toBe('hello');
  });

  it('stops an endless object_info from a ComfyUI address without keeping it all', async () => {
    const response = endless(4096);
    await expect(readBody(response, undefined, 100_000)).rejects.toBeInstanceOf(ObjectInfoError);
    expect((response as unknown as { sentBytes: () => number }).sentBytes()).toBeLessThan(200_000);
    await expect(readBody(new Response('{}', { headers: { 'content-length': '5000000' } }), undefined, 1000)).rejects.toBeInstanceOf(ObjectInfoError);
  });

  it('does not decode a file chunk longer than the one asked for', async () => {
    const huge = 'A'.repeat(SIDE_FILE_CHUNK_BASE64_MAX + 4);
    const session = readOnlySession({
      async listTools() { return []; },
      async callTool() { return { content: [{ type: 'text', text: JSON.stringify({ data_base64: huge, complete: true }) }] }; },
      async close() {},
    }, { roots: ['/srv/models'] });
    expect(await readSideFile(session, '/srv/models/loras/a.webp', 16 * 1024 * 1024)).toBeNull();
  });
});
