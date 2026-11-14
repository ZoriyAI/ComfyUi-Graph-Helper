import { describe, expect, it } from 'vitest';
import { en, ru } from '../../src/shared/i18n/catalog';
import { CORE_FAMILY_DOCS, CORE_KNOWLEDGE } from '../../src/shared/knowledge/coreKnowledge';
import { familyFromText } from '../../src/shared/knowledge/baseModel';

/**
 * A family has one meaning in the three places that speak of it: the label a model card shows, the built-in text
 * about it, and the rule that sorts a file into it by name. "krea" is Krea 2, its own architecture; FLUX.1 Krea
 * [dev] is a Flux.1 model.
 */
describe('a family means the same thing everywhere', () => {
  it('krea is Krea 2, and FLUX.1 Krea is Flux.1', () => {
    expect(familyFromText('krea2_turbo_fp8_scaled.safetensors')).toBe('krea');
    expect(familyFromText('flux1-krea-dev_fp8_scaled.safetensors')).toBe('flux1');
    expect((en.knowledge.family as Record<string, string>).krea).toBe('Krea 2');
    expect((ru.knowledge.family as Record<string, string>).krea).toBe('Krea 2');
    for (const language of ['en', 'ru'] as const) {
      const pack = CORE_KNOWLEDGE[language].families;
      expect(pack.krea.what, language).toMatch(/^Krea 2/);
      expect(pack.krea.risk, language).toContain('FLUX.1 Krea [dev]');
      expect(pack.flux1.what, language).toContain('FLUX.1 Krea [dev]');
    }
    expect(CORE_FAMILY_DOCS.krea).toContain('/krea-2');
  });

  it('Flux.2 names the text encoder of dev and of Klein', () => {
    for (const language of ['en', 'ru'] as const) {
      const text = CORE_KNOWLEDGE[language].families.flux2.what;
      expect(text).toContain('Mistral');
      expect(text).toContain('qwen_3_4b');
      expect(text).toContain('qwen_3_8b');
    }
  });
});
