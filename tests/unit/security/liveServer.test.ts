/**
 * Protects the model list read from a live ComfyUI server over MCP: the .yaml files of the checkpoint
 * configs folder are not models. Without this filter a person would see inference configs offered as
 * models to load, and the assistant could pick one for a loader node.
 */
import { describe, expect, it } from 'vitest';
import type { McpSession, McpToolCallResult } from '../../../src/shared/mcp/catalogSource';
import { isModelFileIn, parseLocalModelsMarkdown } from '../../../src/shared/mcp/catalogSource';
import { readModelFilesWithRoots } from '../../../src/main/mcp/inventory';

function json(value: unknown): McpToolCallResult {
  return { content: [{ type: 'text', text: JSON.stringify(value) }] };
}

describe('checkpoint configs are not models', () => {
  it('leaves .yaml in the configs folder out, and keeps .yaml elsewhere', () => {
    expect(isModelFileIn('configs', 'v1-inference.yaml')).toBe(false);
    expect(isModelFileIn('configs', 'anything.YML')).toBe(false);
    expect(isModelFileIn('checkpoints', 'model.yaml')).toBe(true);
    expect(isModelFileIn('configs', 'odd.safetensors')).toBe(true);
    expect(parseLocalModelsMarkdown('## configs (2)\n- v1-inference.yaml\n- v2-inference.yaml\n## loras (1)\n- a.safetensors\n'))
      .toEqual([{ directory: 'loras', name: 'a.safetensors', sizeBytes: null }]);
  });

  it('a models listing with a configs category lists no config as a model', async () => {
    // A fake server: the call without a category lists the categories, a call with one lists its files.
    const session: McpSession = {
      async listTools() { return [{ name: 'models' }]; },
      async callTool(_name, args) {
        if (args.category === 'configs') return json({ items: [{ category: 'configs', filename: 'v1-inference.yaml', root_path: '/srv/m/configs' }], complete: true });
        if (args.category === 'loras') return json({ items: [{ category: 'loras', filename: 'a.safetensors', root_path: '/srv/m/loras' }], complete: true });
        return json({ items: [{ category: 'configs' }, { category: 'loras' }], complete: true });
      },
      async close() {},
    };
    const listed = await readModelFilesWithRoots(session);
    expect(listed.items.map((item) => `${item.directory}/${item.name}`)).toEqual(['loras/a.safetensors']);
  });
});
