import { describe, expect, it } from 'vitest';
import type { McpSession, McpToolCallResult } from '../../../src/shared/mcp/catalogSource';
import {
  detectToolPrefix, isModelFilePath, isPackFilePath, isReadOnlyCall, isSideFilePath, McpRefusedError, McpRootRefusedError,
  readOnlySession, rootsNamedIn, setKnownRootsSource,
} from '../../../src/main/mcp/readOnly';

function json(value: unknown): McpToolCallResult {
  return { content: [{ type: 'text', text: JSON.stringify(value) }] };
}

function fake(names: string[], answer: (name: string, args: Record<string, unknown>) => McpToolCallResult = () => json({ ok: true })) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const session: McpSession = {
    async listTools() { return names.map((name) => ({ name })); },
    async callTool(name, args) { calls.push({ name, args }); return answer(name, args); },
    async close() {},
  };
  return { session, calls };
}

describe('the gateway prefix', () => {
  it('is one common prefix shared by at least two known tools', () => {
    expect(detectToolPrefix(['gateway_comfy-studio_capabilities', 'gateway_comfy-models', 'gateway_comfy-install_custom_node'])).toBe('gateway_comfy-');
    for (const sep of ['_', '.', ':', '/']) expect(detectToolPrefix([`gw${sep}models`, `gw${sep}studio_info`])).toBe(`gw${sep}`);
  });

  it('is not guessed from one tool, a mixed listing, two prefixes, or a prefix without a separator', () => {
    expect(detectToolPrefix(['gateway_comfy-models', 'other'])).toBeNull();
    // Bare names win when any known tool is listed under its own name.
    expect(detectToolPrefix(['models', 'gateway_comfy-studio_info', 'gateway_comfy-comfy_api'])).toBeNull();
    // Two installations behind one gateway: ambiguous, nothing is mapped.
    expect(detectToolPrefix(['a-models', 'a-studio_info', 'b-models', 'b-studio_info'])).toBeNull();
    expect(detectToolPrefix(['xmodels', 'xstudio_info'])).toBeNull();
  });

  it('shows bare names, calls the listed name, and keeps the allowlist on the bare name in both spellings', async () => {
    const { session, calls } = fake(['gw-models', 'gw-studio_info', 'gw-install_custom_node', 'gw-workspace_exec']);
    const guarded = readOnlySession(session);
    expect((await guarded.listTools()).map((tool) => tool.name)).toEqual(['models', 'studio_info', 'install_custom_node', 'workspace_exec']);
    await guarded.callTool('models', { action: 'list' });
    expect(calls).toEqual([{ name: 'gw-models', args: { action: 'list' } }]);
    await expect(guarded.callTool('install_custom_node', {})).rejects.toBeInstanceOf(McpRefusedError);
    await expect(guarded.callTool('gw-install_custom_node', {})).rejects.toBeInstanceOf(McpRefusedError);
    await expect(guarded.callTool('gw-models', { action: 'list' })).rejects.toBeInstanceOf(McpRefusedError);
    await expect(guarded.callTool('workspace_exec', { command: 'id' })).rejects.toBeInstanceOf(McpRefusedError);
    expect(calls).toHaveLength(1);
  });

  it('learns the prefix before the first call even when the app did not list the tools', async () => {
    const { session, calls } = fake(['gw-models', 'gw-studio_info']);
    await readOnlySession(session).callTool('studio_info', { action: 'describe' });
    expect(calls.map((call) => call.name)).toEqual(['gw-studio_info']);
  });
});

describe('workspace_files reads only inside a folder the server named', () => {
  const read = (absolute_path: string) => ({ action: 'read', absolute_path, encoding: 'base64' });

  it('refuses every read before any folder is known, and reads inside one once a listing named it', async () => {
    const { session, calls } = fake(['models', 'workspace_files'], (name) => (name === 'models'
      ? json({ items: [{ category: 'loras', filename: 'a.safetensors', root_path: '/srv/comfyui/models/loras' }], complete: true })
      : json({ data_base64: '', complete: true })));
    const guarded = readOnlySession(session);
    await expect(guarded.callTool('workspace_files', read('/srv/comfyui/models/loras/a.webp'))).rejects.toBeInstanceOf(McpRootRefusedError);
    await guarded.callTool('models', { action: 'list', category: 'loras' });
    await guarded.callTool('workspace_files', read('/srv/comfyui/models/loras/a.webp'));
    // Shaped like a preview, but outside every named folder.
    await expect(guarded.callTool('workspace_files', read('/home/someone/.ssh/id_rsa.png'))).rejects.toBeInstanceOf(McpRootRefusedError);
    await expect(guarded.callTool('workspace_files', read('/srv/comfyui/models/lorasX/a.webp'))).rejects.toBeInstanceOf(McpRootRefusedError);
    expect(calls.filter((call) => call.name === 'workspace_files')).toHaveLength(1);
  });

  it('takes node-pack folders from the roots answer, and folders known from the catalog', async () => {
    const { session, calls } = fake(['studio_capabilities', 'workspace_files'], (name) => (name === 'studio_capabilities'
      ? json({ roots: { custom_node_roots: ['/srv/comfyui/custom_nodes'], model_categories: { loras: { roots: ['/srv/m/loras'] } } } })
      : json({ data_base64: '', complete: true })));
    const guarded = readOnlySession(session);
    await guarded.callTool('studio_capabilities', { section: 'roots' });
    await guarded.callTool('workspace_files', read('/srv/comfyui/custom_nodes/pack/README.md'));
    setKnownRootsSource(() => ['/data/models/checkpoints']);
    try {
      await guarded.callTool('workspace_files', { action: 'hash', absolute_path: '/data/models/checkpoints/x.safetensors' });
    } finally {
      setKnownRootsSource(null);
    }
    expect(calls.filter((call) => call.name === 'workspace_files')).toHaveLength(2);
  });

  it('collects folders from the shapes the server answers with, and ignores relative or climbing ones', () => {
    const found = rootsNamedIn({ items: [{ root_path: '/a/b/' }, { root_path: 'rel/x' }, { root_path: '/a/../etc' }], roots: { custom_node_roots: ['/c/custom_nodes', '/'] } });
    expect([...found].sort()).toEqual(['/a/b', '/c/custom_nodes']);
  });
});

describe('the path shapes', () => {
  it('refuse control characters and very long paths, and keep refusing climbing ones', () => {
    expect(isSideFilePath('/srv/models/a\n.png')).toBe(false);
    expect(isSideFilePath('/srv/models/a\u007f.png')).toBe(false);
    expect(isSideFilePath(`/srv/${'a/'.repeat(600)}x.png`)).toBe(false);
    expect(isSideFilePath('/srv/models/../x.png')).toBe(false);
    expect(isPackFilePath('/srv/custom_nodes/p\r/README.md')).toBe(false);
    expect(isModelFilePath('/srv/models/a\t.safetensors')).toBe(false);
    expect(isSideFilePath('/srv/models/loras/a.webp')).toBe(true);
  });

  it('refuse listed names that are absolute or climb, and Ollama targets with a slash', () => {
    expect(isReadOnlyCall('model_metadata', { action: 'read', category: 'loras', name: 'sub/a.safetensors' })).toBe(true);
    expect(isReadOnlyCall('model_metadata', { action: 'read', category: '../..', name: 'a.safetensors' })).toBe(false);
    expect(isReadOnlyCall('model_metadata', { action: 'read', category: 'loras', name: '../../etc/passwd' })).toBe(false);
    expect(isReadOnlyCall('models', { action: 'list', category: '/etc' })).toBe(false);
    expect(isReadOnlyCall('ollama_models', { target: 'heavy5090' })).toBe(true);
    expect(isReadOnlyCall('ollama_models', { target: '../x' })).toBe(false);
  });
});
