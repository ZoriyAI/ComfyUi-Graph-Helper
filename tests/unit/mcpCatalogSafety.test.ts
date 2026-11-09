import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/main/settings/migrate';
import { ensureCatalog } from '../../src/main/catalog/repository';
import { mcpUrlError, MCP_HTTPS_ERROR, openReadOnlySession, readCatalogWithSession } from '../../src/main/mcp/client';
import { acceptedComfyUrl } from '../../src/main/comfy/read';
import { McpPageError, readAllPages, type McpSession, type McpToolCallResult } from '../../src/shared/mcp/catalogSource';
import { mcpToken, mcpTokenFor, releaseMcpTokenIfOriginChanged, setMcpToken } from '../../src/main/mcp/token';

function json(value: unknown): McpToolCallResult {
  return { content: [{ type: 'text', text: JSON.stringify(value) }] };
}

interface Server {
  classes: string[];
  packs: string[];
  models: string[];
  failClassPage2?: boolean;
  failPacks?: boolean;
  echoModels?: boolean;
}

/** Labelled test fixture: a two-page class listing, one pack page, one model page. */
function session(server: Server, calls: string[] = []): McpSession {
  return {
    async listTools() {
      return ['studio_capabilities', 'models'].map((name) => ({ name }));
    },
    async callTool(name, args) {
      calls.push(`${name}:${JSON.stringify(args)}`);
      if (name === 'studio_capabilities' && args.kind === 'packs') {
        if (server.failPacks) return { isError: true, content: [{ type: 'text', text: 'boom' }] };
        return json({ items: server.packs.map((pack) => ({ name: pack })) });
      }
      if (name === 'studio_capabilities') {
        const second = args.cursor === 'p2';
        if (second && server.failClassPage2) return { isError: true, content: [{ type: 'text', text: 'boom' }] };
        const half = Math.ceil(server.classes.length / 2);
        const items = (second ? server.classes.slice(half) : server.classes.slice(0, half)).map((classType) => ({ class_type: classType, module: 'nodes' }));
        return json({ items, next_cursor: second ? null : 'p2' });
      }
      if (name === 'models') {
        return json({
          items: server.models.map((file) => ({ category: 'loras', filename: file })),
          next_cursor: server.echoModels ? (args.cursor ?? 'c1') : null,
        });
      }
      throw new Error(`unexpected ${name}`);
    },
    async close() {},
  };
}

function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureCatalog(db);
  return db;
}

const noFetch = (async () => { throw new Error('no network'); }) as unknown as typeof fetch;
const classesOf = (db: Database.Database) => (db.prepare('SELECT class_type FROM node_catalog ORDER BY class_type').all() as Array<{ class_type: string }>).map((row) => row.class_type);
const modelsOf = (db: Database.Database) => (db.prepare('SELECT name FROM model_catalog ORDER BY name').all() as Array<{ name: string }>).map((row) => row.name);
const packsOf = (db: Database.Database) => (db.prepare('SELECT name FROM node_packs ORDER BY name').all() as Array<{ name: string }>).map((row) => row.name);

describe('catalog listings that remove what the server dropped', () => {
  it('removes synced rows the server no longer lists after a complete read; seeded rows stay', async () => {
    const db = openDb();
    await readCatalogWithSession(db, session({ classes: ['OldNode', 'KSampler', 'Keep'], packs: ['a', 'b'], models: ['old.safetensors', 'keep.safetensors'] }), noFetch, 1000);
    expect(classesOf(db)).toContain('OldNode');
    await readCatalogWithSession(db, session({ classes: ['KSampler', 'Keep'], packs: ['b'], models: ['keep.safetensors'] }), noFetch, 2000);
    expect(classesOf(db)).not.toContain('OldNode');
    expect(classesOf(db)).toEqual(expect.arrayContaining(['Keep', 'KSampler', 'CLIPTextEncode', 'SaveImage']));
    expect(modelsOf(db)).toEqual(['keep.safetensors']);
    expect(packsOf(db)).toEqual(['b']);
    db.close();
  });

  it('keeps everything when a page fails, and never replaces packs from a failed listing', async () => {
    const db = openDb();
    await readCatalogWithSession(db, session({ classes: ['A1', 'A2', 'A3', 'A4'], packs: ['a', 'b'], models: ['m.safetensors'] }), noFetch, 1000);
    const read = await readCatalogWithSession(db, session({ classes: ['A1', 'A2'], packs: [], models: ['m.safetensors'], failClassPage2: true, failPacks: true }), noFetch, 2000);
    expect('result' in read && read.result.skipped).toEqual(['node classes', 'node packs']);
    expect(classesOf(db)).toEqual(expect.arrayContaining(['A1', 'A2', 'A3', 'A4']));
    expect(packsOf(db)).toEqual(['a', 'b']);
    db.close();
  });

  it('stops on an echoed cursor and treats that listing as incomplete', async () => {
    const db = openDb();
    await readCatalogWithSession(db, session({ classes: ['A'], packs: [], models: ['old.safetensors'] }), noFetch, 1000);
    const calls: string[] = [];
    await readCatalogWithSession(db, session({ classes: ['A'], packs: [], models: ['new.safetensors'], echoModels: true }, calls), noFetch, 2000);
    expect(calls.filter((call) => call.startsWith('models:'))).toHaveLength(2);
    expect(modelsOf(db)).toEqual(['new.safetensors', 'old.safetensors']);
    db.close();
  });

  it('pages until the end and fails the whole read on an error page', async () => {
    const pages: McpSession = {
      async listTools() { return []; },
      async callTool(_name, args) {
        if (args.cursor === 'bad') return { isError: true };
        return json({ items: [{ n: args.cursor ?? 'first' }], next_cursor: args.cursor ? null : 'bad' });
      },
      async close() {},
    };
    await expect(readAllPages(pages, 'models', {}, 10)).rejects.toBeInstanceOf(McpPageError);
    const notItems: McpSession = { ...pages, async callTool() { return json({ error: 'nope' }); } };
    await expect(readAllPages(notItems, 'models', {}, 10)).rejects.toBeInstanceOf(McpPageError);
  });
});

describe('MCP URL and ComfyUI URL checks', () => {
  it('requires https unless the MCP server is on this machine', async () => {
    expect(mcpUrlError('http://mcp.example.test/mcp')).toBe(MCP_HTTPS_ERROR);
    expect(mcpUrlError('http://192.168.1.20:28188/mcp')).toBe(MCP_HTTPS_ERROR);
    expect(mcpUrlError('https://mcp.example.test/mcp')).toBeNull();
    expect(mcpUrlError('http://127.0.0.1:28188/mcp')).toBeNull();
    expect(mcpUrlError('http://localhost:28188/mcp')).toBeNull();
    expect(mcpUrlError('http://[::1]:28188/mcp')).toBeNull();
    let connected = false;
    const opened = await openReadOnlySession({ url: 'http://mcp.example.test/mcp', token: 'tok' }, async () => {
      connected = true;
      throw new Error('should not connect');
    });
    expect(opened).toEqual({ ok: false, error: MCP_HTTPS_ERROR });
    expect(connected).toBe(false);
  });

  it('reads a server-reported ComfyUI URL only on loopback or the saved origin', () => {
    expect(acceptedComfyUrl('http://127.0.0.1:8188/', '')).toBe('http://127.0.0.1:8188');
    expect(acceptedComfyUrl('http://localhost:8188', null)).toBe('http://localhost:8188');
    expect(acceptedComfyUrl('http://192.168.1.5:8188', '')).toBeNull();
    expect(acceptedComfyUrl('http://192.168.1.5:8188', 'http://192.168.1.5:8188')).toBe('http://192.168.1.5:8188');
    expect(acceptedComfyUrl('http://169.254.169.254', 'http://192.168.1.5:8188')).toBeNull();
    expect(acceptedComfyUrl(null, 'http://x')).toBeNull();
  });

  it('forgets the token when the MCP origin changes', () => {
    setMcpToken('tok-1', 'https://a.example/mcp');
    expect(mcpTokenFor('https://a.example/other')).toBe('tok-1');
    releaseMcpTokenIfOriginChanged('https://b.example/mcp');
    expect(mcpToken()).toBeNull();
    setMcpToken('tok-2');
    expect(mcpTokenFor('https://c.example/mcp')).toBe('tok-2');
    expect(mcpTokenFor('https://d.example/mcp')).toBeNull();
  });
});
