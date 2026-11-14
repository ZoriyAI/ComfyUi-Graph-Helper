import { describe, expect, it } from 'vitest';
import { parseSecretChoice, secretFieldsOf, withoutSecretValues } from '../../../src/main/exportSecrets';

const KEY = 'sk-proj-fake-key-for-tests-0000000000';
const OPAQUE = 'c2VjcmV0LW5vdC1yZWFs0000';

const SNAPSHOT = {
  nodes: [
    { id: '7', data: { comfyType: 'OpenAIChatNode', title: 'Ask GPT', parameters: { api_key: OPAQUE, prompt: 'a red fox', max_tokens: 400 } } },
    { id: '9', data: { comfyType: 'CLIPTextEncodeAdvanced', parameters: { token_normalization: 'mean', text: 'a cat' } } },
    { id: '11', data: { comfyType: 'Note', parameters: { text: `my key is ${KEY}` } } },
  ],
  edges: [],
  document: { raw: { nodes: [{ id: 7, type: 'OpenAIChatNode', widgets_values: [OPAQUE, 'a red fox', 400] }] } },
};

describe('key-like fields before a file is written', () => {
  it('reports the node and the field, never the value, and not ordinary fields named like tokens', () => {
    const fields = secretFieldsOf(SNAPSHOT);
    expect(fields).toEqual(expect.arrayContaining([
      { nodeId: '7', classType: 'OpenAIChatNode', title: 'Ask GPT', name: 'api_key' },
      { nodeId: '11', classType: 'Note', title: '', name: 'text' },
    ]));
    expect(fields.some((field) => field.name === 'token_normalization' || field.name === 'max_tokens')).toBe(false);
    expect(JSON.stringify(fields)).not.toContain(OPAQUE);
    expect(JSON.stringify(fields)).not.toContain(KEY);
    expect(secretFieldsOf({ nodes: [{ id: '1', data: { parameters: { text: 'a fox' } } }] })).toEqual([]);
  });

  it('blanks those values everywhere in the finished document and leaves the rest as it is', () => {
    const exported = {
      nodes: [
        { id: 7, type: 'OpenAIChatNode', widgets_values: [OPAQUE, 'a red fox', 400] },
        { id: 11, type: 'Note', widgets_values: [`my key is ${KEY}`] },
      ],
      extra: { note: `again ${OPAQUE}` },
      __proto__key: 'x',
    };
    const clean = withoutSecretValues(exported, SNAPSHOT);
    expect(JSON.stringify(clean)).not.toContain(OPAQUE);
    expect(JSON.stringify(clean)).not.toContain(KEY);
    expect(clean.nodes[0].widgets_values).toEqual(['', 'a red fox', 400]);
    // The note's whole value is the reported field: it is left empty, like any other.
    expect(clean.nodes[1].widgets_values).toEqual(['']);
    expect(clean.extra.note).toBe('again ');
    // Nothing found, nothing changed.
    expect(withoutSecretValues(exported, { nodes: [] })).toBe(exported);
  });

  it('reads the person\'s answer strictly', () => {
    expect(parseSecretChoice('omit')).toBe('omit');
    expect(parseSecretChoice('keep')).toBe('keep');
    expect(parseSecretChoice('yes')).toBe('ask');
    expect(parseSecretChoice(undefined)).toBe('ask');
  });
});
