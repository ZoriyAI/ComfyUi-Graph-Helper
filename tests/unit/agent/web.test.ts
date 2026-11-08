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
  publicWebUrl,
  searchWebFallback,
  type FetchLike,
} from '../../../src/main/agent/web';

const FIXTURE = fs.readFileSync(path.join(__dirname, '../../fixtures/agent/ddg-results.html'), 'utf8');

interface Seen { url: string; init?: RequestInit }

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
    const page = await fetchPageText('https://a.example/', fetchImpl);
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
    await expect(fetchPageText('https://a.example/', loop)).rejects.toThrow('Too many redirects.');
    const inward = fakeFetch({
      'https://a.example/': () => new Response(null, { status: 302, headers: { location: 'http://127.0.0.1:28188/object_info' } }),
    });
    await expect(fetchPageText('https://a.example/', inward)).rejects.toThrow('Redirect leaves the public web.');
    await expect(fetchPageText('http://127.0.0.1:28188/', inward)).rejects.toThrow('Only public http(s) addresses can be read.');
  });

  it('caps the body at 2 MB and refuses binary pages', async () => {
    const big = 'a'.repeat(PAGE_BYTE_CAP + 1000);
    const fetchImpl = fakeFetch({
      'https://big.example/': () => new Response(big, { headers: { 'content-type': 'text/plain' } }),
      'https://img.example/': () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } }),
    });
    const page = await fetchPageText('https://big.example/', fetchImpl);
    expect(page.truncated).toBe(true);
    expect(page.text.length).toBe(PAGE_TEXT_CAP);
    await expect(fetchPageText('https://img.example/', fetchImpl)).rejects.toThrow('The page is not text.');
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
