/**
 * Opens a read-only session with the saved MCP server, outside a sync: for model previews and the card's
 * "Find on the internet" fingerprint. Used by ipc/knowledgeIpc.ts (PreviewReader and ModelLookupService).
 */
import type { McpSession } from '../../shared/mcp/catalogSource';
import { getDatabase } from '../database';
import { readSettings } from '../settings/repository';
import { connectStreamableHttp, openReadOnlySession } from './client';
import { mcpOAuth } from './oauth';
import { mcpTokenFor } from './token';

/**
 * A read-only session with the MCP server saved in Settings ▸ Connection, offered the way a sync offers itself:
 * what the person chose there (no sign-in, a token, a browser sign-in), else whatever is held. Null when no
 * server is saved or it did not let the app in. The caller closes the session.
 */
export async function openSavedMcpSession(): Promise<McpSession | null> {
  let url = '';
  let mode = '';
  try {
    const read = readSettings(getDatabase());
    if (read.source !== 'corrupt') {
      url = read.values.mcpUrl;
      mode = read.values.mcpAuth;
    }
  } catch {
    return null;
  }
  if (!url) return null;
  // mcpAuth: 'none' sends nothing, 'token' only the token, 'oauth' only the sign-in; '' (not chosen) tries what is held.
  const token = mode === 'none' || mode === 'oauth' ? null : mcpTokenFor(url);
  let authProvider = null;
  if (!token && mode !== 'none' && mode !== 'token') {
    try {
      authProvider = (await mcpOAuth()?.backgroundProvider(url)) ?? null;
    } catch {
      authProvider = null;
    }
  }
  const opened = await openReadOnlySession({ url, token, authProvider }, connectStreamableHttp);
  return opened.ok ? opened.session : null;
}
