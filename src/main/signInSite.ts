import type { MessageBoxOptions } from 'electron';
import type { Translator } from '../shared/i18n';
import { SIGN_IN_CANCELLED } from './mcp/oauth';

/**
 * The browser sign-in for an MCP server opens a page the server names. Usually it is on the server's own site; when
 * it is on another one, the person is asked first, with both names, so a server cannot send them to a page that
 * only looks like a sign-in they know.
 */
export function differentSite(signInUrl: string, mcpUrl: string): { site: string; server: string } | null {
  let site: string;
  let server: string;
  try {
    site = new URL(signInUrl).hostname.toLowerCase();
    server = new URL(mcpUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
  const base = (host: string) => host.split('.').slice(-2).join('.');
  if (site === server || base(site) === base(server)) return null;
  return { site, server };
}

/** Wraps the opener: asks before opening a sign-in page on another site; "Cancel" ends the sign-in. */
export function confirmingOpener(deps: {
  open: (url: string) => Promise<void>;
  mcpUrl: () => string;
  translate: () => Translator;
  ask: (options: MessageBoxOptions) => Promise<number>;
  log?: (line: string) => void;
}): (url: string) => Promise<void> {
  return async (url) => {
    const other = differentSite(url, deps.mcpUrl());
    if (other) {
      const t = deps.translate();
      deps.log?.(`[MCP] Sign-in page is on another site than the server (${other.site})`);
      const answer = await deps.ask({
        type: 'warning',
        title: t('signInSite.title'),
        message: t('signInSite.message', { site: other.site }),
        detail: t('signInSite.detail', { site: other.site, server: other.server }),
        buttons: [t('signInSite.open'), t('signInSite.cancel')],
        defaultId: 1,
        cancelId: 1,
        noLink: true,
      });
      if (answer !== 0) throw new Error(SIGN_IN_CANCELLED);
    }
    await deps.open(url);
  };
}
