/**
 * Internet requests that follow the system proxy (or the one typed in Settings ▸ Assistant). Node's own fetch knows
 * nothing about proxies, so behind a company proxy every cloud request would fail; Chromium's network stack (Electron
 * net.fetch) reads the system settings. A request goes through net.fetch only when Chromium would use a proxy for it;
 * a direct connection stays on Node's fetch, and the person's own computer and home network are always direct.
 * Wired at start by main/index.ts (the LLM transport) and main/llm/network.ts (proxy choice and web search).
 */
import { net, session } from 'electron';
import { isPrivateHost, PROXY_BYPASS, proxyRuleFor } from '../../shared/config/proxy';

/** Applies the proxy choice: a typed address, or the system's settings when empty. Never throws. */
export async function applyProxy(typed: string): Promise<'system' | 'custom' | 'invalid'> {
  const rule = proxyRuleFor(typed);
  try {
    // A typed address that cannot be read falls back to the system settings, and the caller learns it was invalid.
    if (typed.trim() !== '' && !rule) {
      await session.defaultSession.setProxy({ mode: 'system' });
      return 'invalid';
    }
    if (rule) {
      await session.defaultSession.setProxy({ mode: 'fixed_servers', proxyRules: rule, proxyBypassRules: PROXY_BYPASS });
      return 'custom';
    }
    await session.defaultSession.setProxy({ mode: 'system' });
    return 'system';
  } catch {
    return 'system';
  }
}

/** The address of a fetch input, whichever of its three shapes it has. */
function urlOf(input: Parameters<typeof fetch>[0]): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
}

/** "DIRECT", "PROXY host:port", … as Chromium resolves it for this address; "DIRECT" when it cannot say. */
export async function proxyFor(url: string): Promise<string> {
  try {
    const parsed = new URL(url);
    // The person's own computer and home network never go through a proxy, whatever the system says.
    if (isPrivateHost(parsed.hostname)) return 'DIRECT';
    return (await session.defaultSession.resolveProxy(url)) || 'DIRECT';
  } catch {
    return 'DIRECT';
  }
}

/** The proxy-aware fetch when a proxy applies to `url`, else undefined (the caller connects directly). */
export async function fetchIfProxied(url: string): Promise<typeof fetch | undefined> {
  return /^DIRECT/i.test((await proxyFor(url)).trim()) ? undefined : internetFetch;
}

/**
 * fetch for the internet: through Chromium (and so the proxy) when a proxy applies to the address, else Node's
 * fetch. Streaming answers stream either way.
 */
export const internetFetch: typeof fetch = async (input, init) => {
  const url = urlOf(input);
  const rule = await proxyFor(url);
  if (/^DIRECT/i.test(rule.trim())) return globalThis.fetch(input, init);
  // net.fetch takes a URL string, so a Request object is reduced to its address; its own options must come in `init`.
  return net.fetch(url, init as Parameters<typeof net.fetch>[1]) as unknown as Response;
};
