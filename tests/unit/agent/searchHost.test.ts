/**
 * Checks how the assistant's fallback web search recognises its own search host: only the host itself or a real
 * subdomain counts. A lookalike such as evilduckduckgo.com must not be followed as a redirect, and its links must
 * not be dropped as "the search host's own" links.
 */
import { describe, expect, it } from 'vitest';
import { SearchUnavailableError, decodeResultLink, isSearchSite, searchWebFallback } from '../../../src/main/agent/web';

describe('search host check', () => {
  it('accepts the host and its subdomains only', () => {
    expect(isSearchSite('duckduckgo.com')).toBe(true);
    expect(isSearchSite('html.duckduckgo.com')).toBe(true);
    expect(isSearchSite('LITE.DuckDuckGo.com.')).toBe(true);
    expect(isSearchSite('evilduckduckgo.com')).toBe(false);
    expect(isSearchSite('duckduckgo.com.evil.example')).toBe(false);
  });

  it('keeps a lookalike host as a result link', () => {
    expect(decodeResultLink('https://evilduckduckgo.com/page')).toBe('https://evilduckduckgo.com/page');
    expect(decodeResultLink('//duckduckgo.com/l/?uddg=https%3A%2F%2Fevilduckduckgo.com%2Fx')).toBe('https://evilduckduckgo.com/x');
    expect(decodeResultLink('https://duckduckgo.com/y.js?ad=1')).toBeNull();
  });

  it('refuses a redirect to a lookalike host', async () => {
    const seen: string[] = [];
    const fetchImpl = async (input: string): Promise<Response> => {
      seen.push(input);
      return new Response(null, { status: 302, headers: { location: 'https://evilduckduckgo.com/html/?q=x' } });
    };
    const failure = await searchWebFallback('x', fetchImpl).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(SearchUnavailableError);
    expect((failure as SearchUnavailableError).reasons.every((reason) => reason.includes('off the search host'))).toBe(true);
    expect(seen.some((url) => url.includes('evilduckduckgo'))).toBe(false);
  });
});
