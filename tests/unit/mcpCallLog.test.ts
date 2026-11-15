/**
 * The call log of the read-only MCP session (src/main/mcp/readOnly): one note per tool call with the tool, its
 * arguments, item count, size and errors, but never the returned payload; refused calls are not noted and a broken
 * observer never breaks the call.
 * Why: the log helps a person (or support) see what the app asked the server without leaking their file lists.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { McpRefusedError, readOnlySession, setMcpCallObserver, type McpCallNote } from '../../src/main/mcp/readOnly';
import type { McpSession } from '../../src/shared/mcp/catalogSource';

afterEach(() => setMcpCallObserver(null));

/** A fake MCP session whose callTool answers with `answer`; an Error result is thrown as a transport failure. */
function session(answer: (name: string, args: Record<string, unknown>) => unknown): McpSession {
  return {
    async listTools() {
      return [{ name: 'models' }];
    },
    async callTool(name, args) {
      const result = answer(name, args);
      if (result instanceof Error) throw result;
      return result as never;
    },
    async close() {},
  };
}

describe('one log line per MCP tool call', () => {
  it('notes the tool, its arguments, the page size and the time, never the payload', async () => {
    const notes: McpCallNote[] = [];
    setMcpCallObserver((note) => notes.push(note));
    const guarded = readOnlySession(session(() => ({
      content: [{ type: 'text', text: JSON.stringify({ items: [{ category: 'loras', filename: 'a.safetensors' }, { category: 'loras', filename: 'b.safetensors' }] }) }],
    })));
    await guarded.callTool('models', { action: 'list', category: 'loras', limit: 1000 });
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ tool: 'models', args: '{"action":"list","category":"loras","limit":1000}', ok: true, items: 2, error: null });
    expect(notes[0].chars).toBeGreaterThan(10);
    expect(JSON.stringify(notes[0])).not.toContain('a.safetensors');
  });

  it('notes a tool error in the server\'s words and a thrown transport error', async () => {
    const notes: McpCallNote[] = [];
    setMcpCallObserver((note) => notes.push(note));
    const failing = readOnlySession(session((name) => (name === 'comfy_api'
      ? { isError: true, content: [{ type: 'text', text: 'COMFY_API_BODY_CAPACITY: response body exceeds capacity' }] }
      : new Error('socket hang up'))));
    await failing.callTool('comfy_api', { method: 'GET', route: '/object_info' });
    await expect(failing.callTool('studio_info', { action: 'describe' })).rejects.toThrow('socket hang up');
    expect(notes[0]).toMatchObject({ tool: 'comfy_api', ok: false, error: 'COMFY_API_BODY_CAPACITY: response body exceeds capacity' });
    expect(notes[1]).toMatchObject({ tool: 'studio_info', ok: false, error: 'socket hang up' });
  });

  it('does not note a refused call and survives an observer that throws', async () => {
    const notes: McpCallNote[] = [];
    setMcpCallObserver((note) => {
      notes.push(note);
      throw new Error('log is broken');
    });
    const guarded = readOnlySession(session(() => ({ structuredContent: { items: [] } })));
    await expect(guarded.callTool('models', { action: 'remove', filename: 'x' })).rejects.toBeInstanceOf(McpRefusedError);
    expect(notes).toHaveLength(0);
    await expect(guarded.callTool('models', { action: 'list' })).resolves.toBeDefined();
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ ok: true, items: 0 });
  });
});
