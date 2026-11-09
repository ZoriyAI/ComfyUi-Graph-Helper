import { describe, expect, it } from 'vitest';
import type { SyncStatus } from '../../src/shared/contracts';
import { syncView } from '../../src/renderer/components/sync/syncView';

const NEEDS_SIGN_IN = 'MCP server requires sign-in.';
const SIGN_IN_AGAIN = 'MCP sign-in has expired. Sign in through the browser again.';

function status(over: Partial<SyncStatus>): SyncStatus {
  return {
    state: 'never', lastSyncAt: null, lastError: null, mcpUrl: 'http://127.0.0.1:29100/mcp', tokenHeld: false, signedIn: false,
    auto: { enabled: false, intervalMinutes: 30 },
    counts: { nodeClasses: 0, detailedClasses: 0, packs: 0, models: 0, enrichedModels: 0 },
    progress: null,
    ...over,
  };
}

describe('sync view: credentials are the server\'s call', () => {
  it('blocks only without an address, or once the server has asked for a sign-in nobody holds', () => {
    expect(syncView(null).blocked).toBe('noUrl');
    expect(syncView(status({ mcpUrl: ' ' })).blocked).toBe('noUrl');
    // No token, no sign-in, nothing tried yet: "Sync now" goes ahead.
    expect(syncView(status({})).blocked).toBeNull();
    expect(syncView(status({})).needsSignIn).toBe(false);
    // The server answered 401 to the anonymous connection.
    const asked = syncView(status({ state: 'error', lastError: NEEDS_SIGN_IN }));
    expect(asked.blocked).toBe('noToken');
    expect(asked.needsSignIn).toBe(true);
    // A token appeared since: not blocked any more, the next run decides.
    expect(syncView(status({ state: 'error', lastError: NEEDS_SIGN_IN, tokenHeld: true })).blocked).toBeNull();
    expect(syncView(status({ state: 'error', lastError: NEEDS_SIGN_IN, signedIn: true })).blocked).toBeNull();
  });

  it('never blocks a server that accepted an anonymous connection', () => {
    const anonymous = syncView(status({ state: 'idle', lastSyncAt: 1, authMode: 'anonymous' }));
    expect(anonymous.blocked).toBeNull();
    expect(anonymous.needsSignIn).toBe(false);
    // Even a stale "requires sign-in" row cannot block once the server took an anonymous connection.
    expect(syncView(status({ state: 'error', lastError: NEEDS_SIGN_IN, authMode: 'anonymous' })).blocked).toBeNull();
  });

  it('asks for a sign-in when a browser sign-in expired', () => {
    const expired = syncView(status({ state: 'error', lastError: SIGN_IN_AGAIN, signedIn: false }));
    expect(expired.blocked).toBeNull();
    expect(expired.needsSignIn).toBe(true);
    expect(syncView(status({ state: 'error', lastError: 'MCP server was not read.' })).needsSignIn).toBe(false);
  });
});
