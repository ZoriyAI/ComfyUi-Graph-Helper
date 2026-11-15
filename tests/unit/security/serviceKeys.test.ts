import { describe, expect, it } from 'vitest';
import { isSecretField, safeParameter, summarizeGraph } from '../../../src/shared/agent/graph';
import { redactSecrets } from '../../../src/shared/config/draft';
import { randomLooking, secretFieldsOf } from '../../../src/main/exportSecrets';

// Made-up values in the shape of each service's keys; none of them is a real key.
const REPLICATE = 'r8_Fake0000000000000000000000000000000';
const FAL = '00000000-0000-4000-8000-000000000000:00000000000000000000000000000000';
const ELEVEN = 'sk_00000000000000000000000000000000fakefake';
const RUNWAY = 'key_00000000000000000000000000000000000000000000000000000000000000ff';
const CIVITAI = '0123456789abcdef0123456789abcdef';
const MIXED = 'Xq7bY2mN4pL9sT1vW3zA5cD8eF0gH2jK';

describe('keys of other services in node fields', () => {
  it('knows the shapes of their keys, wherever they are', () => {
    for (const key of [REPLICATE, FAL, ELEVEN, RUNWAY]) {
      expect(isSecretField('text', key)).toBe(true);
      expect(redactSecrets(`my key ${key} here`)).not.toContain(key);
    }
  });

  it('knows fields named like a key: key, FAL_KEY, openai_key, civitaikey, auth; not keyframe or monkey', () => {
    for (const name of ['key', 'FAL_KEY', 'openai_key', 'civitaikey', 'auth', 'replicate_api_token']) expect(isSecretField(name, CIVITAI)).toBe(true);
    for (const name of ['keyframe', 'monkey', 'key_frames', 'author', 'seed']) expect(isSecretField(name, 'hello')).toBe(false);
  });

  it('keeps them out of what the model sees', () => {
    expect(safeParameter('key', CIVITAI)).toBe('[redacted]');
    const graph = summarizeGraph({ nodes: [{ id: '1', data: { comfyType: 'FalNode', title: 'Fal', parameters: { FAL_KEY: FAL, prompt: 'a red fox' } } }], edges: [] });
    const text = JSON.stringify(graph);
    expect(text).not.toContain(FAL);
    expect(text).toContain('a red fox');
  });

  it('asks before a file is written, also for a long random string in any field', () => {
    const snapshot = { nodes: [
      { id: '1', data: { comfyType: 'ReplicateNode', parameters: { text: REPLICATE } } },
      { id: '2', data: { comfyType: 'CivitaiDownloader', parameters: { civitaikey: CIVITAI } } },
      { id: '3', data: { comfyType: 'SomeApiNode', parameters: { value: MIXED } } },
      { id: '4', data: { comfyType: 'CheckpointLoaderSimple', parameters: { ckpt_name: 'sdxl_lightning_4step_lora_V2.safetensors', seed: '123456789012345678901234' } } },
    ], edges: [] };
    const names = secretFieldsOf(snapshot).map((field) => `${field.nodeId}:${field.name}`);
    expect(names).toEqual(expect.arrayContaining(['1:text', '2:civitaikey', '3:value']));
    expect(names.some((name) => name.startsWith('4:'))).toBe(false);
  });

  it('a random-looking word: hex runs and mixed-case runs, not file names, words or numbers', () => {
    expect(randomLooking(CIVITAI)).toBe(true);
    expect(randomLooking(MIXED)).toBe(true);
    expect(randomLooking('sdxl_lightning_4step_lora_V2')).toBe(false);
    expect(randomLooking('models/loras/Xq7bY2mN4pL9sT1vW3zA5cD8eF0gH2jK')).toBe(false);
    expect(randomLooking('123456789012345678901234567890')).toBe(false);
    expect(randomLooking('a photo of a red fox in the snow at night')).toBe(false);
  });
});
