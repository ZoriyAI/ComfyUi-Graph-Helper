/**
 * The in-memory MCP token holder (src/main/mcp/token): it reports where the token came from (pasted, OS password
 * store) and forgets the token when the MCP address moves to another origin.
 * Why: the Settings status line must tell the truth, and a token must never follow the person to another server.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { mcpOriginOf, mcpTokenFor, mcpTokenStatus, releaseMcpTokenIfOriginChanged, setMcpToken } from '../../src/main/mcp/token';

describe('manual MCP token holder', () => {
  beforeEach(() => {
    setMcpToken('');
  });

  it('reports where the held token came from', () => {
    expect(mcpTokenStatus()).toEqual({ held: false, source: 'none' });
    expect(setMcpToken('session-token', 'http://127.0.0.1:9000/mcp')).toEqual({ held: true, source: 'session' });
    expect(mcpTokenStatus()).toEqual({ held: true, source: 'session' });
    expect(setMcpToken('stored-token', 'http://127.0.0.1:9000/mcp', 'os')).toEqual({ held: true, source: 'os' });
    expect(mcpTokenStatus()).toEqual({ held: true, source: 'os' });
    expect(setMcpToken('')).toEqual({ held: false, source: 'none' });
  });

  it('forgets a token when the MCP origin changes and resets its source', () => {
    setMcpToken('stored-token', 'https://a.example/mcp', 'os');
    expect(mcpTokenFor('https://a.example/mcp')).toBe('stored-token');
    releaseMcpTokenIfOriginChanged('https://b.example/mcp');
    expect(mcpTokenStatus()).toEqual({ held: false, source: 'none' });
  });

  it('derives the record origin from a URL', () => {
    expect(mcpOriginOf('http://127.0.0.1:9000/mcp?x=1')).toBe('http://127.0.0.1:9000');
    expect(mcpOriginOf('not a url')).toBeNull();
    expect(mcpOriginOf('')).toBeNull();
  });
});
