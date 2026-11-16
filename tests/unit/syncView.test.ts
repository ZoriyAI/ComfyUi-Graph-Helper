/**
 * Protects the derived sync state that the Sync panel and the Settings MCP section show: when "Sync now" is
 * blocked, which hint names the fix, and when the browser sign-in is offered. Only the server decides whether
 * credentials are needed, so a person with an open server is never blocked, and the hint follows the access
 * method they chose (token, browser sign-in or none).
 */
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

describe('sync view: the hint follows the access the person chose', () => {
  const asked = { state: 'error' as const, lastError: NEEDS_SIGN_IN };

  it('names the fix for the chosen access', () => {
    expect(syncView(status({ ...asked, authChoice: 'token' })).hintKey).toBe('sync.needsToken');
    expect(syncView(status({ ...asked, authChoice: 'oauth' })).hintKey).toBe('sync.needsBrowser');
    expect(syncView(status({ ...asked, authChoice: '' })).hintKey).toBe('sync.needsChoice');
    expect(syncView(status({ ...asked, authChoice: 'none' })).hintKey).toBe('sync.needsChoice');
    // An older main without the field: nothing chosen.
    expect(syncView(status(asked)).hintKey).toBe('sync.needsChoice');
    expect(syncView(status({ mcpUrl: '' })).hintKey).toBe('sync.noUrl');
    expect(syncView(status({})).hintKey).toBeNull();
  });

  it('counts only the credentials the chosen access sends', () => {
    // "No sign-in" sends nothing, so a held token or sign-in does not unblock it.
    expect(syncView(status({ ...asked, authChoice: 'none', tokenHeld: true, signedIn: true })).blocked).toBe('noToken');
    // "Token" ignores a browser sign-in; "Sign in through the browser" ignores a token.
    expect(syncView(status({ ...asked, authChoice: 'token', signedIn: true })).blocked).toBe('noToken');
    expect(syncView(status({ ...asked, authChoice: 'token', tokenHeld: true })).blocked).toBeNull();
    expect(syncView(status({ ...asked, authChoice: 'oauth', tokenHeld: true })).blocked).toBe('noToken');
    expect(syncView(status({ ...asked, authChoice: 'oauth', signedIn: true })).blocked).toBeNull();
  });

  it('offers the browser sign-in only where it would be used', () => {
    expect(syncView(status({ ...asked, authChoice: 'oauth' })).needsSignIn).toBe(true);
    expect(syncView(status({ ...asked, authChoice: '' })).needsSignIn).toBe(true);
    expect(syncView(status({ ...asked, authChoice: 'token' })).needsSignIn).toBe(false);
    expect(syncView(status({ ...asked, authChoice: 'none' })).needsSignIn).toBe(false);
    expect(syncView(status({ state: 'error', lastError: SIGN_IN_AGAIN, authChoice: 'token' })).needsSignIn).toBe(false);
  });
});


it('accounts for every model while stopped without blaming untouched files', async () => {
  const { metadataReport } = await import('../../src/renderer/components/sync/syncView');
  const status = { metadata: { done: 550, total: 694 }, unreadable: [{ kind: 'model', skipped: true }, { kind: 'model', skipped: true }] } as import('../../src/shared/contracts').SyncStatus;
  expect(metadataReport(status)).toEqual({ done: 550, total: 694, pending: 142, failed: 0, skipped: 2 });
});
