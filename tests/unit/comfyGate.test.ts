import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMFY_ROUTES, comfyGet, ComfyGateError, comfyOriginOf, comfyPathAllowed, type ComfyRoute } from '../../src/main/comfy/gate';
import { comfyAddress, systemOf } from '../../src/main/comfy/direct';

/** A fetch that records what it was asked and answers with `respond`. */
function recorder(respond: (url: string, init: RequestInit) => Response | Promise<Response> = () => new Response('{}', { status: 200 })) {
  const seen: Array<{ url: string; method: string; redirect: string | undefined; body: unknown }> = [];
  const fetchImpl = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    seen.push({ url: String(input), method: String(init.method ?? 'GET'), redirect: init.redirect, body: init.body });
    return respond(String(input), init);
  }) as typeof fetch;
  return { seen, fetchImpl };
}

const origin = new URL('http://127.0.0.1:8188');

describe('the read-only gate for ComfyUI', () => {
  it('lets out exactly the read routes', () => {
    const allowed = [
      COMFY_ROUTES.systemStats(), COMFY_ROUTES.objectInfo(), COMFY_ROUTES.modelFolders(), COMFY_ROUTES.modelFoldersLegacy(),
      COMFY_ROUTES.modelFiles('loras'), COMFY_ROUTES.modelFilesLegacy('text_encoders'),
      COMFY_ROUTES.viewMetadata('loras', 'sdxl\\style.safetensors'), COMFY_ROUTES.modelPreview('loras', 1, 'sdxl/style.safetensors'),
      COMFY_ROUTES.installedPacks(), COMFY_ROUTES.translations(),
    ];
    for (const route of allowed) expect(comfyPathAllowed(route.path), route.path).toBe(true);
  });

  it('refuses every route that queues, uploads, frees, interrupts, deletes, writes or installs, and any climb', () => {
    for (const route of [
      '/prompt', '/api/prompt', '/queue', '/interrupt', '/free', '/history', '/history/abc', '/upload/image', '/upload/mask',
      '/userdata/workflows%2Fa.json', '/v2/userdata', '/settings', '/settings/Comfy.Locale', '/users', '/internal/logs',
      '/manager/reboot', '/customnode/install', '/customnode/getlist', '/customnode/getmappings', '/manager/queue/start',
      '/model/install', '/view?filename=a.png', '/extensions', '/', '/object_info/KSampler', '/system_stats?x=1',
      '/view_metadata/../prompt?filename=a.safetensors', '/experiment/models/../../prompt', '/experiment/models/%2e%2e',
      '/models/loras/../../prompt', '/view_metadata/loras?filename=a.safetensors&x=1', '/experiment/models/preview/loras/1000/a',
    ]) expect(comfyPathAllowed(route), route).toBe(false);
  });

  it('cannot build a route from a hostile folder or file name', () => {
    for (const folder of ['../prompt', 'loras/../../x', 'a/b', '', '.', '..', 'x'.repeat(81), 'loras?x=1', 'loras#x']) {
      expect(() => COMFY_ROUTES.modelFiles(folder), folder).toThrow(ComfyGateError);
      expect(() => COMFY_ROUTES.modelFilesLegacy(folder), folder).toThrow(ComfyGateError);
      expect(() => COMFY_ROUTES.viewMetadata(folder, 'a.safetensors'), folder).toThrow(ComfyGateError);
    }
    for (const file of ['../a.safetensors', '..\\..\\a.safetensors', 'sub/../../a.safetensors', './a.safetensors', 'a\0.safetensors', '', 'a.ckpt']) {
      expect(() => COMFY_ROUTES.viewMetadata('loras', file), JSON.stringify(file)).toThrow(ComfyGateError);
    }
    for (const index of [-1, 1.5, 1000, Number.NaN]) expect(() => COMFY_ROUTES.modelPreview('loras', index, 'a.safetensors')).toThrow(ComfyGateError);
    // Encoded: a name cannot add a query or a fragment to the route.
    expect(COMFY_ROUTES.viewMetadata('loras', 'a&b=c#d.safetensors').path).toBe('/view_metadata/loras?filename=a%26b%3Dc%23d.safetensors');
  });

  it('sends GET only, with no body and no redirect followed, to the address itself', async () => {
    const { seen, fetchImpl } = recorder();
    await comfyGet(origin, COMFY_ROUTES.systemStats(), fetchImpl);
    await comfyGet(origin, COMFY_ROUTES.modelFiles('loras'), fetchImpl);
    expect(seen.map((call) => [call.method, call.redirect, call.body])).toEqual([['GET', 'manual', undefined], ['GET', 'manual', undefined]]);
    expect(seen.map((call) => call.url)).toEqual(['http://127.0.0.1:8188/system_stats', 'http://127.0.0.1:8188/experiment/models/loras']);
  });

  it('never sends a route that is not on the list, whatever is handed to it', async () => {
    const { seen, fetchImpl } = recorder();
    const forged: ComfyRoute = { path: '/prompt', maxBytes: 100, timeoutMs: 100, kind: 'json' };
    await expect(comfyGet(origin, forged, fetchImpl)).rejects.toThrow(ComfyGateError);
    await expect(comfyGet(origin, { ...forged, path: '//evil.test/system_stats' }, fetchImpl)).rejects.toThrow(ComfyGateError);
    expect(seen).toEqual([]);
  });

  it('says what went wrong without throwing: slow, gone, missing, redirected, too large, not JSON', async () => {
    const route = { ...COMFY_ROUTES.systemStats(), timeoutMs: 50, maxBytes: 10 };
    const slow = recorder((_url, init) => new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new Error('aborted')))));
    expect(await comfyGet(origin, route, slow.fetchImpl)).toMatchObject({ ok: false, error: 'timeout' });
    const refused = recorder(() => {
      throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } });
    });
    expect(await comfyGet(origin, route, refused.fetchImpl)).toMatchObject({ ok: false, error: 'unreachable' });
    const noHost = recorder(() => {
      throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } });
    });
    expect(await comfyGet(origin, route, noHost.fetchImpl)).toMatchObject({ ok: false, error: 'hostNotFound' });
    expect(await comfyGet(origin, route, recorder(() => new Response('', { status: 404 })).fetchImpl)).toMatchObject({ ok: false, error: 'notFound' });
    expect(await comfyGet(origin, route, recorder(() => new Response('', { status: 302, headers: { location: 'http://elsewhere.test/' } })).fetchImpl)).toMatchObject({ ok: false, error: 'redirect' });
    expect(await comfyGet(origin, route, recorder(() => new Response('{"a":"0123456789"}')).fetchImpl)).toMatchObject({ ok: false, error: 'large' });
    expect(await comfyGet(origin, { ...route, maxBytes: 1000 }, recorder(() => new Response('<html>')).fetchImpl)).toMatchObject({ ok: false, error: 'shape' });
  });

  it('is the only way the ComfyUI reader reaches the network', () => {
    // Every module that talks to a ComfyUI address calls comfyGet; none calls fetch itself.
    const folder = path.resolve(__dirname, '../../src/main/comfy');
    for (const file of fs.readdirSync(folder).filter((name) => name.endsWith('.ts') && name !== 'gate.ts')) {
      const source = fs.readFileSync(path.join(folder, file), 'utf8');
      expect(/\bfetchImpl\s*\(|\bfetch\s*\(/.test(source), file).toBe(false);
    }
  });
});

describe('a ComfyUI address', () => {
  it('is an origin; the path only says whether it looks like an MCP server', () => {
    expect(comfyOriginOf('http://127.0.0.1:8188/some/page')?.origin).toBe('http://127.0.0.1:8188');
    expect(comfyOriginOf('http://user:pw@127.0.0.1:8188')).toBeNull();
    const local = comfyAddress('127.0.0.1:8188');
    expect(local.ok && local.origin.origin).toBe('http://127.0.0.1:8188');
    const mcp = comfyAddress('http://127.0.0.1:9000/mcp');
    expect(mcp.ok && mcp.looksLikeMcp).toBe(true);
    expect(comfyAddress('192.168.1.5:8188')).toEqual({ ok: false, error: 'ComfyUI address has no http:// or https:// in front.' });
    expect(comfyAddress('ftp://x.test')).toEqual({ ok: false, error: 'ComfyUI address must start with http:// or https://.' });
    expect(comfyAddress('http://127.0.0.l:8188')).toEqual({ ok: false, error: 'ComfyUI address host is not a valid address: 127.0.0.l.' });
    expect(comfyAddress('')).toEqual({ ok: false, error: 'ComfyUI address is empty.' });
  });

  it('answers /system_stats with its version, never keeping the command line', () => {
    const system = systemOf({ system: { comfyui_version: '0.45.0', os: 'nt', argv: ['main.py', '--listen'] }, devices: [{ name: 'cuda:0 X' }] });
    expect(system).toEqual({ version: '0.45.0', os: 'nt', devices: 1, device: 'cuda:0 X' });
    expect(JSON.stringify(system)).not.toContain('--listen');
    expect(systemOf({ jsonrpc: '2.0' })).toBeNull();
  });
});
