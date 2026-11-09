import { describe, expect, it } from 'vitest';
import { carriesSecret, exactMatchRedactor, redactSecrets, textCarriesSecret } from '../../src/shared/config/draft';
import { redactDiagnostic } from '../../src/shared/i18n';

describe('secret detection', () => {
  it('does not flag words or file names that merely contain "sk-"', () => {
    for (const text of [
      'cat mask-like face', 'loras/mask-xl_v1.safetensors', 'risk-free', 'a task-oriented node', 'disk-cache', 'whisk-ey',
      'the bearer', 'tokenizer settings', 'Lora strength 0.8',
    ]) {
      expect(textCarriesSecret(text), text).toBe(false);
      expect(redactSecrets(text)).toBe(text);
      expect(carriesSecret({ text })).toBe(false);
    }
  });

  it('flags and redacts the common key formats', () => {
    const cases = [
      'sk-ant-api03-AbCdEfGhIjKlMnOpQrStUvWx',
      'sk-proj-AbC123_def-GHI456jklMNO789',
      'AIzaSyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q',
      'hf_AbCdEfGhIjKlMnOpQrStUvWxYz012345',
      'ghp_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789',
      'github_pat_11ABCDEFG0123456789_abcdefghijklmnopqrstuvwxyz',
      'gsk_AbCdEfGhIjKlMnOpQrStUvWxYz012345',
      'Authorization: Basic dXNlcjpwYXNzd29yZA==',
      '{"apiKey":"plain-value-123"}',
      '{"token": "abc.def.ghi"}',
      'https://example.com/hook?access_token=AbCdEfGhIjKlMnOpQrSt',
      'https://example.com/x?key=0123456789abcdef0123',
      'token: 3f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a',
      'secret=QmFzZTY0U2VjcmV0VmFsdWVUaGF0SXNMb25nRW5vdWdo',
      'Bearer abc.def',
      'api_key: 123',
    ];
    for (const text of cases) {
      expect(textCarriesSecret(text), text).toBe(true);
      expect(carriesSecret({ value: text }), text).toBe(true);
      const redacted = redactSecrets(`before ${text} after`);
      expect(redacted, text).toContain('[redacted]');
      expect(redacted.startsWith('before ')).toBe(true);
    }
    expect(redactSecrets('Error: key sk-proj-AbC123_def-GHI456 rejected')).toBe('Error: key [redacted] rejected');
    expect(redactSecrets('GET https://x.example/?access_token=AbCdEfGhIjKlMnOpQrSt failed')).not.toContain('AbCdEf');
  });

  it('keeps the diagnostic redactor on top of the shared patterns', () => {
    expect(redactDiagnostic('loras/mask-xl_v1.safetensors was not found')).toBe('loras/mask-xl_v1.safetensors was not found');
    expect(redactDiagnostic('hf_AbCdEfGhIjKlMnOpQrStUvWxYz012345 rejected')).toBe('[redacted] rejected');
  });

  it('redacts exact held values whatever their shape', () => {
    const redact = exactMatchRedactor(['plain-looking-token', '', null, 'abc']);
    expect(redact('header plain-looking-token and plain-looking-token')).toBe('header [redacted] and [redacted]');
    expect(redact('abc stays')).toBe('abc stays');
    expect(exactMatchRedactor([])('unchanged')).toBe('unchanged');
  });
});

import { isUnprotectedCipher } from '../../src/shared/config/secretPolicy';

describe('unprotected cipher check', () => {
  it('reads v10 as the hardcoded fallback on Linux only', () => {
    expect(isUnprotectedCipher(Buffer.from('v10abc'), 'linux')).toBe(true);
    expect(isUnprotectedCipher(Buffer.from('v11abc'), 'linux')).toBe(false);
    expect(isUnprotectedCipher(Buffer.from('v10abc'), 'darwin')).toBe(false);
    expect(isUnprotectedCipher(Buffer.from('v10abc'), 'win32')).toBe(false);
  });
});

import { createTranslator, translateKnownError } from '../../src/shared/i18n';

describe('sync and engine error translation', () => {
  it('maps the fixed English sentences in both languages', () => {
    const en = createTranslator('en');
    const ru = createTranslator('ru');
    for (const code of [
      'Model metadata could not be read.', 'MCP catalog page could not be read.', 'MCP server URL must use https unless it is on this machine.',
      'Connection slots must be numbers.', 'Source node was not found.', 'Target node was not found.', 'Source handle is not an output on that node.',
      'Target handle is not an input on that node.', 'Catalog widget order does not match widgets_values.', 'widgetIndex is outside widgets_values.',
      'widgetIndex does not match the catalog widget order.', 'widgetIndex is required when widgets_values is an array.',
      'Explanations cannot store a secret.', 'The project record does not match the schema.', 'The request did not come from the app window.',
    ]) {
      const english = translateKnownError(en, code);
      const russian = translateKnownError(ru, code);
      expect(english, code).toBeTruthy();
      expect(russian, code).toBeTruthy();
      expect(russian).not.toBe(english);
    }
    expect(translateKnownError(en, 'MCP tool call refused: download_model is not on the read-only list.')).toBe('The MCP tool download_model is not on the read-only list, so it was not called.');
    expect(translateKnownError(ru, 'MCP tool call refused: download_model is not on the read-only list.')).toContain('download_model');
    expect(translateKnownError(en, 'something else')).toBeNull();
  });
});

describe('redaction keeps structure', () => {
  it('keeps prefixes and JSON validity', () => {
    expect(redactSecrets('Authorization: Bearer xyz')).toBe('Authorization: Bearer [redacted]');
    expect(redactSecrets('api_key=abc123')).toBe('api_key=[redacted]');
    expect(JSON.parse(redactSecrets('{"apiKey":"plain-value-123","token":"sk-zzz999","name":"x"}'))).toEqual({ apiKey: '[redacted]', token: '[redacted]', name: 'x' });
  });
});
