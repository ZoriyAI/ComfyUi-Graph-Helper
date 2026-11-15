/**
 * Pseudo-translation for layout tests: a text made about 40 % longer, with accented letters and without spaces
 * inside its longest padding word, the way German or Finnish words run long. Placeholders are already filled in
 * when this runs (i18next post-processing), so names of nodes and files are stretched too, as a long name would be.
 * Turned on by renderer/i18n.ts for the layout walk (tests/e2e/layout-walk.test.ts), never for a person.
 */

/** Letters swapped for an accented look-alike, in both alphabets of the catalog. */
const ACCENTS: Record<string, string> = {
  // Lowercase only: capitals keep names such as TEST or ComfyUI findable by the layout tests' own patterns.
  a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú', y: 'ý',
  а: 'ӓ', е: 'ё', о: 'ӧ', у: 'ӱ', и: 'ӣ',
};
/** The filler letters of the padding words. */
const PAD = 'ẋẍẋẍẋẍẋẍẋẍẋẍ';

/** `text` with accents and about 40 % more length. */
export function pseudoText(text: string): string {
  if (text.trim() === '') return text;
  const accented = [...text].map((char) => ACCENTS[char] ?? char).join('');
  const extra = Math.max(2, Math.ceil([...text].length * 0.4));
  // The padding: words of up to twelve letters, so it wraps like real text and still stretches a single word.
  const words: string[] = [];
  let left = extra;
  while (left > 0) {
    const size = Math.min(left, PAD.length);
    words.push(PAD.slice(0, size));
    left -= size + 1;
  }
  return `${accented} ${words.join(' ')}`;
}
