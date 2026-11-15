/**
 * Glossary terms found in a text (shared/journey/terms.ts, used by TermText to mark a term and give its
 * explanation). A term is found in its other word forms and as a whole word only, and explained once per text, so a
 * newcomer gets help on "node" without every repeat or a word that merely contains it being marked.
 */
import { describe, expect, it } from 'vitest';
import { findTerms } from '../../../src/shared/journey/terms';

describe('glossary terms in a text', () => {
  it('finds a Russian term in another form, once, as a whole word', () => {
    const seen = new Set<string>();
    const found = findTerms('Добавьте ноду и протяните связь. Ещё одна нода.', 'ru', seen);
    const words = found.map((item) => 'Добавьте ноду и протяните связь. Ещё одна нода.'.slice(item.start, item.end));
    expect(words).toContain('ноду');
    expect(words).toContain('связь');
    expect(words.filter((word) => word.startsWith('нод'))).toHaveLength(1);
    // A later block of the same text does not explain it again.
    expect(findTerms('Ещё нода', 'ru', seen).map((item) => item.entry.id)).not.toContain('node');
  });

  it('finds English plurals, never inside another word, and not the everyday "run"', () => {
    const text = 'Connect the nodes, then run it in ComfyUI. Nodelike words stay plain.';
    const found = findTerms(text, 'en');
    const words = found.map((item) => text.slice(item.start, item.end));
    expect(words).toContain('nodes');
    expect(words).toContain('ComfyUI');
    expect(words).not.toContain('run');
    expect(words.some((word) => word.toLowerCase().startsWith('nodelike'))).toBe(false);
    for (const item of found) expect(item.entry.text.length).toBeGreaterThan(10);
  });
});
