/**
 * Protects how text from a workflow file or a server is shown: invisible characters and direction overrides
 * become a visible mark, file names that mix Latin with look-alike letters are flagged, and model formats
 * that can run code on load are known. A person must not be fooled by a name that looks like something else.
 * The last block checks that the missing-node advice names ComfyUI Manager as the safe source of node packs.
 */
import { describe, expect, it } from 'vitest';
import { HIDDEN_MARK, hasHiddenCharacters, mixesAlphabets, revealHidden } from '../../../src/shared/text/reveal';
import { formatCanRunCode } from '../../../src/shared/security/modelFormat';
import { titleParts } from '../../../src/renderer/components/graph/nodes/titleBreaks';

describe('text from a file never reads as something else', () => {
  it('shows direction overrides and invisible characters as a mark', () => {
    // A right-to-left override (U+202E) makes "gnp.exe" display as "exe.png".
    const title = 'Loader ‮gnp.exe';
    expect(hasHiddenCharacters(title)).toBe(true);
    expect(revealHidden(title)).toBe(`Loader ${HIDDEN_MARK}gnp.exe`);
    expect(titleParts(title).join('')).toBe(`Loader ${HIDDEN_MARK}gnp.exe`);
    for (const char of ['‪', '‫', '‬', '‭', '⁦', '⁧', '⁨', '⁩', '​', '⁠', '﻿', '؜']) {
      expect(revealHidden(`a${char}b`)).toBe(`a${HIDDEN_MARK}b`);
    }
  });

  it('keeps what scripts and emoji need', () => {
    // Arabic, the zero-width joiners used by emoji and scripts, the plain direction marks, a Russian word.
    for (const text of ['مرحبا','a‍b', 'a‌b', 'a‎b', 'a‏b', 'Портрет']) {
      expect(revealHidden(text)).toBe(text);
      expect(hasHiddenCharacters(text)).toBe(false);
    }
  });

  it('marks a word that mixes Latin with look-alike letters, not a Russian word next to a Latin one', () => {
    // The first two names each hide one Cyrillic letter that looks Latin; the third is all Cyrillic plus "_v2".
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

import { en, ru } from '../../../src/shared/i18n/catalog';

describe('a missing node says where packs are safe to come from', () => {
  it('in both languages, in the check and in the lessons', () => {
    for (const catalog of [en, ru] as Array<Record<string, any>>) {
      expect(JSON.stringify(catalog)).toMatch(/ComfyUI Manager/);
    }
    expect((en as any).check?.missingNodesItem ?? JSON.stringify(en)).toMatch(/never from a link in a workflow/);
    expect(JSON.stringify(ru)).toMatch(/не по ссылке из workflow или заметки/);
  });
});
