/**
 * Text from a file or a server is shown as it is, except for characters that make it read as something else:
 * direction overrides and isolates (U+202A–U+202E, U+2066–U+2069, U+061C), which turn "…gnp.exe" into "…exe.png" on
 * screen, and invisible ones (zero-width space U+200B, word joiner U+2060, BOM U+FEFF). Each becomes a visible
 * replacement mark. Joiners that scripts and emoji need (U+200C, U+200D) and the plain direction marks (U+200E,
 * U+200F) stay.
 */
const HIDDEN = /[‪-‮⁦-⁩؜​⁠﻿]/g;

/** The mark shown in place of a hidden character. */
export const HIDDEN_MARK = '�';

export function hasHiddenCharacters(text: string): boolean {
  HIDDEN.lastIndex = 0;
  const found = HIDDEN.test(text);
  HIDDEN.lastIndex = 0;
  return found;
}

export function revealHidden(text: string): string {
  return typeof text === 'string' ? text.replace(HIDDEN, HIDDEN_MARK) : text;
}

const LATIN = /\p{Script=Latin}/u;
const LOOKALIKE_SCRIPTS = [/\p{Script=Cyrillic}/u, /\p{Script=Greek}/u, /\p{Script=Armenian}/u, /\p{Script=Cherokee}/u];

/**
 * True when one word of a name mixes Latin letters with Cyrillic, Greek or similar letters that look the same
 * ("sdxl_bаse" with a Cyrillic "а"): a name made to pass for another. Words are split at anything not a letter, so
 * "Портрет_v2" (a Russian word and a Latin "v") is not mixed.
 */
export function mixesAlphabets(name: string): boolean {
  if (typeof name !== 'string') return false;
  return name.split(/[^\p{L}]+/u).some((word) => LATIN.test(word) && LOOKALIKE_SCRIPTS.some((script) => script.test(word)));
}
