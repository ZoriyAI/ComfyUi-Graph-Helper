import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  decodeResultLink,
  fetchPageText,
  htmlToText,
  MAX_RESULTS,
  PAGE_BYTE_CAP,
  PAGE_TEXT_CAP,
  parseDuckDuckGoHtml,
  isBlockedAddress,
  pinnedRequest,
  publicWebUrl,
  SEARCH_CHALLENGE_ERROR,
  searchWebFallback,
  setBlockedWebOrigins,
  vetWebTarget,
  type FetchLike,
  type LookupAll,
} from '../../../src/main/agent/web';
import http from 'http';
import type { AddressInfo } from 'net';

const FIXTURE = fs.readFileSync(path.join(__dirname, '../../fixtures/agent/ddg-results.html'), 'utf8');

interface Seen { url: string; init?: RequestInit }

/** Every test host resolves to one public address unless the table says otherwise. */
function stubLookup(table: Record<string, string[]> = {}): LookupAll {
  return async (hostname) => (table[hostname] ?? ['93.184.215.14']).map((address) => ({ address, family: address.includes(':') ? 6 : 4 }));
}
const PUBLIC = { lookup: stubLookup() };

function fakeFetch(routes: Record<string, () => Response>, seen: Seen[] = []): FetchLike {
  return async (url, init) => {
    seen.push({ url, init });
    const route = routes[url];
    if (!route) return new Response('not found', { status: 404 });
    return route();
  };
}

describe('DuckDuckGo HTML parser', () => {
  it('decodes uddg redirect links, skips ads and bad links, and keeps snippets', () => {
    const results = parseDuckDuckGoHtml(FIXTURE);
    expect(results).toEqual([
      {
        title: 'KSampler - ComfyUI Docs',
        url: 'https://docs.comfy.org/built-in-nodes/sampling/ksampler',
        snippet: 'The KSampler uses the model & conditioning to denoise a latent. CFG controls how closely…',
      },
      { title: 'What is CFG scale?', url: 'https://example.org/cfg?a=1&b=2', snippet: 'Classifier-free guidance explained.' },
      { title: 'No snippet result', url: 'https://nosnippet.example/', snippet: '' },
    ]);
  });

  it('caps the number of results', () => {
    const block = (index: number) => `<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fsite${index}.example%2F">Result ${index}</a>`;
    const html = Array.from({ length: 20 }, (_, index) => block(index)).join('\n');
    expect(parseDuckDuckGoHtml(html)).toHaveLength(MAX_RESULTS);
  });

  it('decodes direct and wrapped links', () => {
    expect(decodeResultLink('https://example.com/a')).toBe('https://example.com/a');
    expect(decodeResultLink('//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fb')).toBe('https://example.com/b');
    expect(decodeResultLink('//duckduckgo.com/l/?uddg=file%3A%2F%2F%2Fetc%2Fpasswd')).toBeNull();
    expect(decodeResultLink('/settings')).toBeNull();
  });
});

describe('page text', () => {
  it('drops scripts, styles, comments, and tags', () => {
    const page = htmlToText('<html><head><title>A &amp; B</title><style>p{}</style></head><body><!-- hidden --><script>alert(1)</script><h1>Title</h1><p>One&nbsp;<b>two</b></p><noscript>x</noscript></body></html>');
    expect(page.title).toBe('A & B');
    expect(page.text).toBe('Title\nOne two');
  });

  it('refuses local, private, non-http, and userinfo addresses', () => {
    for (const url of [
      'http://127.0.0.1:28188/object_info', 'http://localhost:8188/', 'http://192.168.1.4/', 'http://10.0.0.1/',
      'http://172.20.0.1/', 'http://169.254.169.254/latest/meta-data', 'http://[::1]/', 'http://comfy/', 'http://nas.local/',
      'file:///etc/passwd', 'ftp://example.com/', 'https://user:pw@example.com/',
    ]) {
      expect(publicWebUrl(url), url).toBeNull();
    }
    expect(publicWebUrl('https://docs.comfy.org/')?.hostname).toBe('docs.comfy.org');
  });

  it('follows up to three public redirects and returns clipped text without credentials', async () => {
    const seen: Seen[] = [];
    const long = `<html><title>Doc</title><body><p>${'word '.repeat(5000)}</p></body></html>`;
    const fetchImpl = fakeFetch({
      'https://a.example/': () => new Response(null, { status: 301, headers: { location: 'https://b.example/' } }),
      'https://b.example/': () => new Response(null, { status: 302, headers: { location: '/page' } }),
      'https://b.example/page': () => new Response(long, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }),
    }, seen);
    const page = await fetchPageText('https://a.example/', fetchImpl, PUBLIC);
    expect(page.url).toBe('https://b.example/page');
    expect(page.title).toBe('Doc');
    expect(page.text.length).toBe(PAGE_TEXT_CAP);
    expect(page.truncated).toBe(true);
    expect(seen.map((item) => item.url)).toEqual(['https://a.example/', 'https://b.example/', 'https://b.example/page']);
    for (const item of seen) {
      const headers = new Headers(item.init?.headers);
      expect(headers.get('authorization')).toBeNull();
      expect(headers.get('cookie')).toBeNull();
      expect(item.init?.method).toBe('GET');
      expect(item.init?.redirect).toBe('manual');
    }
  });

  it('stops after three redirects and on a redirect into the local network', async () => {
    const loop = fakeFetch({
      'https://a.example/': () => new Response(null, { status: 302, headers: { location: 'https://b.example/' } }),
      'https://b.example/': () => new Response(null, { status: 302, headers: { location: 'https://c.example/' } }),
      'https://c.example/': () => new Response(null, { status: 302, headers: { location: 'https://d.example/' } }),
      'https://d.example/': () => new Response(null, { status: 302, headers: { location: 'https://e.example/' } }),
    });
    await expect(fetchPageText('https://a.example/', loop, PUBLIC)).rejects.toThrow('Too many redirects.');
    const inward = fakeFetch({
      'https://a.example/': () => new Response(null, { status: 302, headers: { location: 'http://127.0.0.1:28188/object_info' } }),
    });
    await expect(fetchPageText('https://a.example/', inward, PUBLIC)).rejects.toThrow('Redirect leaves the public web.');
    await expect(fetchPageText('http://127.0.0.1:28188/', inward, PUBLIC)).rejects.toThrow('Only public http(s) addresses can be read.');
  });

  it('caps the body at 2 MB and refuses binary pages', async () => {
    const big = 'a'.repeat(PAGE_BYTE_CAP + 1000);
    const fetchImpl = fakeFetch({
      'https://big.example/': () => new Response(big, { headers: { 'content-type': 'text/plain' } }),
      'https://img.example/': () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } }),
    });
    const page = await fetchPageText('https://big.example/', fetchImpl, PUBLIC);
    expect(page.truncated).toBe(true);
    expect(page.text.length).toBe(PAGE_TEXT_CAP);
    await expect(fetchPageText('https://img.example/', fetchImpl, PUBLIC)).rejects.toThrow('The page is not text.');
  });
});

describe('fallback search', () => {
  it('GETs the html endpoint with the encoded query and parses results', async () => {
    const seen: Seen[] = [];
    const url = 'https://html.duckduckgo.com/html/?q=ksampler%20cfg%20%26%20steps';
    const results = await searchWebFallback('ksampler cfg & steps', fakeFetch({ [url]: () => new Response(FIXTURE) }, seen));
    expect(seen.map((item) => item.url)).toEqual([url]);
    expect(new Headers(seen[0].init?.headers).get('authorization')).toBeNull();
    expect(results[0].url).toBe('https://docs.comfy.org/built-in-nodes/sampling/ksampler');
  });

  it('sends nothing for an empty query', async () => {
    const seen: Seen[] = [];
    expect(await searchWebFallback('   ', fakeFetch({}, seen))).toEqual([]);
    expect(seen).toEqual([]);
  });
});

describe('address checks', () => {
  const rebinding = stubLookup({
    '127.0.0.1.nip.io': ['127.0.0.1'],
    'localtest.me': ['127.0.0.1', '::1'],
    'mixed.example': ['93.184.215.14', '10.0.0.7'],
    'nat64.example': ['64:ff9b::7f00:1'],
    'bench.example': ['198.18.0.1'],
  });

  it('refuses hosts by the address they resolve to', async () => {
    for (const url of [
      'https://127.0.0.1.nip.io/', 'https://localtest.me/', 'https://mixed.example/', 'https://nat64.example/', 'https://bench.example/',
    ]) {
      expect(await vetWebTarget(new URL(url), { lookup: rebinding }), url).toBeNull();
      await expect(fetchPageText(url, async () => new Response('x'), { lookup: rebinding }), url).rejects.toThrow('Only public http(s) addresses can be read.');
    }
  });

  it('refuses literal and tunnelled local addresses and odd ports', () => {
    for (const url of [
      'http://localhost./', 'http://[::7f00:1]/', 'http://[64:ff9b::7f00:1]/', 'http://198.18.0.1/', 'http://[::ffff:127.0.0.1]/',
      'http://[fec0::1]/', 'http://[fd00::1]/', 'http://[fe80::1]/', 'http://[ff02::1]/', 'http://224.0.0.1/', 'http://100.64.0.1/',
      'http://0x7f.1/', 'http://2130706433/', 'https://example.com:8443/', 'http://example.com:28188/',
    ]) {
      expect(publicWebUrl(url), url).toBeNull();
    }
    expect(isBlockedAddress('2002:7f00:1::')).toBe(true);
    expect(isBlockedAddress('2606:4700::1111')).toBe(false);
    expect(isBlockedAddress('1.1.1.1')).toBe(false);
  });

  it('lets a public address through and pins it', async () => {
    const vetted = await vetWebTarget(new URL('https://docs.example./page'), { lookup: stubLookup({ 'docs.example': ['1.1.1.1'] }) });
    expect(vetted).toMatchObject({ address: '1.1.1.1', family: 4 });
    expect(vetted?.url.hostname).toBe('docs.example');
    expect(publicWebUrl('http://1.1.1.1/')?.hostname).toBe('1.1.1.1');
  });

  it('refuses the saved ComfyUI origin even when it is public', async () => {
    setBlockedWebOrigins(['https://comfy.example.net']);
    try {
      expect(publicWebUrl('https://comfy.example.net/object_info')).toBeNull();
      expect(publicWebUrl('https://comfy.example.net:443/')).toBeNull();
      expect(publicWebUrl('http://comfy.example.net/')).not.toBeNull();
    } finally {
      setBlockedWebOrigins([]);
    }
    expect(publicWebUrl('https://other.example/', { blockedOrigins: ['https://other.example'] })).toBeNull();
  });

  it('connects to the pinned address whatever the host name says', async () => {
    const server = http.createServer((request, response) => {
      response.writeHead(200, { 'content-type': 'text/plain', 'x-host': String(request.headers.host) });
      response.end('pinned body');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const port = (server.address() as AddressInfo).port;
      // The name does not resolve anywhere; only the pin makes this connect.
      const response = await pinnedRequest({ url: new URL(`http://unresolvable.invalid:${port}/x`), address: '127.0.0.1', family: 4 }, { headers: { a: 'b' } });
      expect(response.status).toBe(200);
      expect(response.headers.get('x-host')).toBe(`unresolvable.invalid:${port}`);
      expect(await response.text()).toBe('pinned body');
    } finally {
      server.close();
    }
  });
});

describe('search page variants', () => {
  it('accepts single-quoted attributes', () => {
    const html = "<a class='result__a' href='//duckduckgo.com/l/?uddg=https%3A%2F%2Fsingle.example%2F'>Single</a><a class='result__snippet'>Quoted</a>";
    expect(parseDuckDuckGoHtml(html)).toEqual([{ title: 'Single', url: 'https://single.example/', snippet: 'Quoted' }]);
  });

  it('reports a challenge page as a failure, not an empty result', async () => {
    const challenge = '<html><body><div class="anomaly-modal__title">Unfortunately, bots use DuckDuckGo too.</div><form id="challenge-form"></form></body></html>';
    await expect(searchWebFallback('ksampler', async () => new Response(challenge))).rejects.toThrow(SEARCH_CHALLENGE_ERROR);
    expect(await searchWebFallback('ksampler', async () => new Response('<html><body>No results.</body></html>'))).toEqual([]);
  });
});
