/**
 * The browser sign-in for an MCP server opens a page the server names. Usually it is on the server's own site; when
 * it is on another one, the person is asked first, with both names, so a server cannot send them to a page that
 * only looks like a sign-in they know. main/ipc.ts wraps the MCP sign-in's browser opener with confirmingOpener.
 */
import type { MessageBoxOptions } from 'electron';
import type { Translator } from '../shared/i18n';
import { SIGN_IN_CANCELLED } from './mcp/oauth';

/** The two host names when the sign-in page is on another site than the MCP server, else null. */
export function differentSite(signInUrl: string, mcpUrl: string): { site: string; server: string } | null {
  let site: string;
  let server: string;
  try {
    site = new URL(signInUrl).hostname.toLowerCase();
    server = new URL(mcpUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (site === server || siteOf(site) === siteOf(server)) return null;
  return { site, server };
}

/**
 * Common two-label public suffixes: under these, anyone can register a name, so a.co.uk and b.co.uk belong to
 * different owners. This is a SHORT list of the most used ones (country second levels and shared hosting), not the
 * full public suffix list, which the app does not ship; a suffix missing here still makes two sites under it look
 * like one, so the warning is then not shown.
 */
const TWO_LABEL_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'me.uk',
  'com.au', 'net.au', 'org.au', 'edu.au',
  'co.jp', 'ne.jp', 'or.jp',
  'com.br', 'com.cn', 'com.tw', 'com.hk', 'com.sg', 'com.mx', 'com.ar', 'com.tr', 'com.ua',
  'co.nz', 'co.za', 'co.in', 'co.kr', 'co.il', 'co.id',
  'github.io', 'gitlab.io', 'pages.dev', 'workers.dev', 'vercel.app', 'netlify.app', 'herokuapp.com', 'web.app',
  'firebaseapp.com', 'azurewebsites.net', 'cloudfront.net', 'ngrok.io', 'ngrok-free.app', 'hf.space',
]);

/**
 * The registrable "site" of a host: its last two labels (auth.example.org and mcp.example.org are one site), or its
 * last three under a suffix from TWO_LABEL_SUFFIXES (a.co.uk and b.co.uk are two sites).
 */
export function siteOf(host: string): string {
  const labels = host.replace(/\.+$/, '').split('.');
  const lastTwo = labels.slice(-2).join('.');
  return labels.slice(TWO_LABEL_SUFFIXES.has(lastTwo) ? -3 : -2).join('.');
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
        // Cancel is the default and the Escape answer: opening the other site takes a deliberate click.
        defaultId: 1,
        cancelId: 1,
        noLink: true,
      });
      if (answer !== 0) throw new Error(SIGN_IN_CANCELLED);
    }
    await deps.open(url);
  };
}
