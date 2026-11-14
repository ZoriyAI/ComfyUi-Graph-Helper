import { describe, expect, it } from 'vitest';
import { HIDDEN_MARK, hasHiddenCharacters, mixesAlphabets, revealHidden } from '../../../src/shared/text/reveal';
import { formatCanRunCode } from '../../../src/shared/security/modelFormat';
import { titleParts } from '../../../src/renderer/components/graph/nodes/titleBreaks';

describe('text from a file never reads as something else', () => {
  it('shows direction overrides and invisible characters as a mark', () => {
    const title = 'Loader ‮gnp.exe';
    expect(hasHiddenCharacters(title)).toBe(true);
    expect(revealHidden(title)).toBe(`Loader ${HIDDEN_MARK}gnp.exe`);
    expect(titleParts(title).join('')).toBe(`Loader ${HIDDEN_MARK}gnp.exe`);
    for (const char of ['‪', '‫', '‬', '‭', '⁦', '⁧', '⁨', '⁩', '​', '⁠', '﻿', '؜']) {
      expect(revealHidden(`a${char}b`)).toBe(`a${HIDDEN_MARK}b`);
    }
  });

  it('keeps what scripts and emoji need', () => {
    for (const text of ['مرحبا', 'a‍b', 'a‌b', 'a‎b', 'a‏b', 'Портрет']) {
      expect(revealHidden(text)).toBe(text);
      expect(hasHiddenCharacters(text)).toBe(false);
    }
  });

  it('marks a word that mixes Latin with look-alike letters, not a Russian word next to a Latin one', () => {
    expect(mixesAlphabets('sdxl_bаse_1.0.safetensors')).toBe(true);
    expect(mixesAlphabets('рony_v1.safetensors')).toBe(true);
    expect(mixesAlphabets('Портрет_v2.safetensors')).toBe(false);
    expect(mixesAlphabets('sdxl_base_1.0.safetensors')).toBe(false);
  });

  it('knows the model formats that can run code when loaded', () => {
    for (const name of ['old.ckpt', 'x.pt', 'x.PTH', 'pytorch_model.bin']) expect(formatCanRunCode(name)).toBe(true);
    for (const name of ['x.safetensors', 'x.gguf', 'x.sft']) expect(formatCanRunCode(name)).toBe(false);
  });
});
