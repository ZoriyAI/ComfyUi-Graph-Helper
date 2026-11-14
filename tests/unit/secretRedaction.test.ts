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
      'Connection slots must be numbers.', 'Connection was not found.', 'Source node was not found.', 'Target node was not found.', 'Source handle is not an output on that node.',
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

import { redactValue } from '../../src/shared/agent/redact';

describe('structured tool-result redaction', () => {
  it('uses existing key-aware JSON heuristics while retaining ordinary data types', () => {
    const credentials = ['api_key', 'apiKey', 'access_token', 'authToken', 'token', 'secret', 'password', 'passwd', 'credential', 'private_key', 'client_secret'];
    for (const key of credentials) {
      const raw = { nested: [{ [key]: 'ordinary-opaque-credential', text: 'readable description', count: 2, flag: false, empty: null }] };
      expect(redactValue(raw, redactSecrets), key).toEqual(JSON.parse(redactSecrets(JSON.stringify(raw))));
      expect(raw.nested[0][key]).toBe('ordinary-opaque-credential');
    }
    expect(redactValue({ token_count: 'ordinary text', api_keys: 'metadata', empty: '' }, redactSecrets))
      .toEqual({ token_count: 'ordinary text', api_keys: 'metadata', empty: '' });
  });

  it('traverses enumerable fields of serializable class instances', () => {
    class Reply { text = 'opaque-held-class-credential'; token = 'unheld-class-token'; count = 8; }
    const reply = new Reply();
    const redact = (text: string) => exactMatchRedactor([reply.text])(redactSecrets(text));
    expect(redactValue({ nested: [reply] }, redact)).toEqual({ nested: [
      { text: '[redacted]', token: '[redacted]', count: 8 },
    ] });
    expect(reply.text).toBe('opaque-held-class-credential');
  });

  it('keeps the standard JSON values of valid and invalid Date instances', () => {
    const date = new Date('2026-11-15T00:00:00.000Z');
    expect(redactValue({ date, invalid: new Date(Number.NaN) }, redactSecrets))
      .toEqual({ date: date.toJSON(), invalid: null });
  });

  it('redacts secrets carried in a URL while keeping a valid URL instance', () => {
    const source = new URL('https://files.example.test/image.png?token=opaque-unheld-credential-491827');
    const redacted = redactValue(source, redactSecrets) as URL;
    expect(redacted).toBeInstanceOf(URL);
    expect(redacted.href).not.toContain('opaque-unheld-credential-491827');
    expect(source.href).toContain('opaque-unheld-credential-491827');
    const whole = redactValue(source, exactMatchRedactor([source.href])) as URL;
    expect(whole).toBeInstanceOf(URL);
    expect(whole.href).toBe('about:blank#redacted');
  });

  it('preserves binary SDK data and URL instances instead of cloning their enumerable properties', () => {
    const bytes = new Uint8Array([137, 80, 78, 71]);
    const buffer = bytes.buffer;
    const nodeBuffer = Buffer.from(bytes);
    const url = new URL('https://files.example.test/image.png');
    const raw = { bytes, buffer, nodeBuffer, url };
    const redacted = redactValue(raw, redactSecrets) as typeof raw;
    expect(redacted.bytes).toBe(bytes);
    expect(redacted.buffer).toBe(buffer);
    expect(redacted.nodeBuffer).toBe(nodeBuffer);
    expect(redacted.url).toBe(url);
    expect(redacted.url).toBeInstanceOf(URL);
  });
});
