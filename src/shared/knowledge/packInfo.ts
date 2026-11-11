/**
 * What a node pack says about itself, read from the two files at the top of its folder: `pyproject.toml` (the
 * short description, the repository link and the name the pack gives itself in ComfyUI's registry) and the
 * README (the first paragraphs, as plain text). Both readers are pure and forgiving: a file they do not
 * understand gives nothing rather than an error, because a pack that says nothing is an ordinary pack.
 */

/** The parts of a pyproject.toml the app shows. Empty strings and nulls where the file says nothing. */
export interface PyprojectFacts {
  /** `[project] description`. */
  description: string;
  /** `[project.urls]` Repository, else Source, else Homepage, else any other http(s) link in that table. */
  repositoryUrl: string | null;
  /** `[tool.comfy] DisplayName`: the name the pack goes by in ComfyUI's registry. */
  displayName: string;
}

/** What the card shows of a pack. Stored on node_packs (migration v13) and sent to the renderer as it is. */
export interface PackInfo {
  description: string;
  repositoryUrl: string | null;
  readmeSummary: string;
}

/** A description longer than this is not a short description any more; it is cut at a word. */
export const PACK_DESCRIPTION_MAX_CHARS = 400;
/** About how much of a README the card shows: one to three paragraphs. */
export const README_SUMMARY_MAX_CHARS = 700;
const README_MAX_PARAGRAPHS = 3;

// ---------------------------------------------------------------- pyproject.toml

/**
 * A string value as TOML writes it: "basic" with escapes, 'literal' as is, and either of them tripled to span
 * lines. `rest` is the line after the opening quote; `more` gives the following lines for a tripled string.
 * Null when the value is not a string (a number, an array, an inline table) or never closes.
 */
function readString(rest: string, more: () => string | null): string | null {
  const triple = rest.startsWith('"""') ? '"""' : rest.startsWith("'''") ? "'''" : null;
  if (triple) {
    let body = rest.slice(3);
    // A newline right after the opening quotes is not part of the string.
    let collected = '';
    let first = true;
    for (;;) {
      const end = body.indexOf(triple);
      if (end >= 0) {
        collected += (first ? '' : '\n') + body.slice(0, end);
        break;
      }
      collected += (first ? '' : '\n') + body;
      first = false;
      const next = more();
      if (next === null) return null;
      body = next;
    }
    collected = collected.replace(/^\n/, '');
    if (triple === '"""') collected = unescapeBasic(collected.replace(/\\\s*\n\s*/g, ''));
    return collected;
  }
  const quote = rest[0];
  if (quote === "'") {
    const end = rest.indexOf("'", 1);
    return end > 0 ? rest.slice(1, end) : null;
  }
  if (quote === '"') {
    for (let index = 1; index < rest.length; index += 1) {
      if (rest[index] === '\\') {
        index += 1;
        continue;
      }
      if (rest[index] === '"') return unescapeBasic(rest.slice(1, index));
    }
  }
  return null;
}

function unescapeBasic(value: string): string {
  return value.replace(/\\(u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|.)/g, (_, code: string) => {
    if (code[0] === 'u' || code[0] === 'U') {
      const point = Number.parseInt(code.slice(1), 16);
      try {
        return String.fromCodePoint(point);
      } catch {
        return '';
      }
    }
    return ({ n: '\n', t: '\t', r: '', b: '', f: '', '"': '"', '\\': '\\' } as Record<string, string>)[code] ?? code;
  });
}

/** A key as written before `=`: bare, or in quotes. Lower-cased, since the app looks keys up loosely. */
function keyOf(raw: string): string {
  const key = raw.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) return key.slice(1, -1).trim().toLowerCase();
  return key.toLowerCase();
}

/** Only a web link is a link the card shows; anything else (a file path, javascript:) is dropped. */
export function webUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function clipAtWord(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:–-]+$/, '')}…`;
}

/** Spaces and line breaks of a one-line text folded into single spaces. */
function oneLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

const URL_KEYS = ['repository', 'source', 'source code', 'sourcecode', 'code', 'github', 'homepage', 'home', 'documentation'];

/**
 * The few facts the card needs from a pyproject.toml. This is a small reader of the TOML subset such files use
 * for these keys (tables, `key = "string"`), not a TOML parser: everything else in the file is skipped.
 */
export function parsePyproject(source: string): PyprojectFacts {
  const lines = source.replace(/^﻿/, '').split(/\r?\n/);
  let table = '';
  let description = '';
  let displayName = '';
  const urls = new Map<string, string>();
  let index = 0;
  const more = () => (index + 1 < lines.length ? lines[++index] : null);
  for (; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line === '' || line.startsWith('#')) continue;
    const header = /^\[\s*([^\][]+?)\s*\]\s*(#.*)?$/.exec(line);
    if (header) {
      table = header[1].split('.').map((part) => keyOf(part)).join('.');
      continue;
    }
    if (line.startsWith('[[')) {
      table = '';
      continue;
    }
    const equals = line.indexOf('=');
    if (equals <= 0) continue;
    const key = keyOf(line.slice(0, equals));
    const rest = line.slice(equals + 1).trim();
    // `urls = { Repository = "…" }` written inline under [project].
    if (table === 'project' && key === 'urls' && rest.startsWith('{')) {
      for (const match of rest.matchAll(/([A-Za-z][\w -]*|"[^"]*"|'[^']*')\s*=\s*("(?:[^"\\]|\\.)*"|'[^']*')/g)) {
        const value = readString(match[2], () => null);
        if (value !== null) urls.set(keyOf(match[1]), value);
      }
      continue;
    }
    const value = readString(rest, more);
    if (value === null) continue;
    if (table === 'project' && key === 'description') description = value;
    else if (table === 'project' && key.startsWith('urls.')) urls.set(key.slice(5), value);
    else if (table === 'project.urls') urls.set(key, value);
    else if (table === 'tool.comfy' && key === 'displayname') displayName = value;
  }
  let repositoryUrl: string | null = null;
  for (const key of URL_KEYS) {
    repositoryUrl = webUrl(urls.get(key));
    if (repositoryUrl) break;
  }
  if (!repositoryUrl) for (const value of urls.values()) if ((repositoryUrl = webUrl(value))) break;
  return { description: clipAtWord(oneLine(description), PACK_DESCRIPTION_MAX_CHARS), repositoryUrl, displayName: oneLine(displayName) };
}

// ---------------------------------------------------------------- README

/** A heading after which a README tells how to install or run the pack, not what it is: the summary ends there. */
const STOP_HEADING = /install|setup|set up|usage|how to use|requirement|dependenc|changelog|change log|update|news|license|credit|acknowledg|citation|troubleshoot|faq|установк|использован|требован|лиценз/i;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", mdash: '—', ndash: '–', hellip: '…', copy: '©' };

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+|#39);/gi, (whole, name: string) => {
    if (name[0] === '#' && name !== '#39') {
      const point = name[1] === 'x' || name[1] === 'X' ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10);
      try {
        return Number.isFinite(point) && point > 0 ? String.fromCodePoint(point) : '';
      } catch {
        return '';
      }
    }
    return ENTITIES[name.toLowerCase()] ?? whole;
  });
}

/** One paragraph of markdown as plain text: images and badges gone, links as their words, no markup left. */
function plainParagraph(block: string): string {
  let text = block
    .split('\n')
    .map((line) => line.replace(/^\s{0,3}>\s?/, '').replace(/^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/i, ''))
    .join(' ');
  text = text
    // Badges are an image inside a link; an image alone is a picture. Neither is text.
    .replace(/\[\s*!\[[^\]]*\]\([^)]*\)\s*\]\([^)]*\)/g, ' ')
    .replace(/\[\s*!\[[^\]]*\]\[[^\]]*\]\s*\]\[[^\]]*\]/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/!\[[^\]]*\]\[[^\]]*\]/g, ' ')
    // A link reads as its words.
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')
    .replace(/<(https?:\/\/[^>\s]+)>/g, '$1')
    // What HTML is left: tags go, their words stay.
    .replace(/<[^>]*>/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, '$2')
    .replace(/(^|[\s(])\*(?=\S)([^*]*?\S)\*(?=[\s).,;:!?]|$)/g, '$1$2')
    .replace(/(^|[\s(])_(?=\S)([^_]*?\S)_(?=[\s).,;:!?]|$)/g, '$1$2')
    .replace(/~~(.*?)~~/g, '$1');
  return oneLine(decodeEntities(text));
}

/** Whether a cleaned block is prose worth showing: a sentence or two, not a stray word, link or table rule. */
function isProse(text: string): boolean {
  if (text.length < 25) return false;
  const letters = (text.match(/\p{L}/gu) ?? []).length;
  if (letters < text.length * 0.5) return false;
  // A block that is only links is a list of links.
  return text.replace(/https?:\/\/\S+/g, '').trim().length >= 20;
}

/**
 * The opening of a README as plain text: its first paragraphs of prose (up to three and about
 * README_SUMMARY_MAX_CHARS), joined by a blank line. Headings, badges, images, HTML, code blocks, tables and
 * lists are not prose and are passed over; the summary ends at a heading such as "Installation".
 */
export function summarizeReadme(source: string): string {
  const text = source
    .replace(/^﻿/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/<!--[\s\S]*?-->/g, '\n')
    .replace(/<\s*(script|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '\n')
    // A block-level tag on its own line ends a paragraph.
    .replace(/<\s*\/?\s*(p|div|h[1-6]|br|hr|table|tr|td|th|ul|ol|li|details|summary|picture|center)\b[^>]*>/gi, '\n\n');
  const lines = text.split('\n');
  const blocks: string[][] = [];
  let current: string[] = [];
  let fence: string | null = null;
  const close = () => {
    if (current.length > 0) blocks.push(current);
    current = [];
  };
  for (const raw of lines) {
    const line = raw.replace(/\t/g, '    ');
    const fenceMark = /^\s{0,3}(```+|~~~+)/.exec(line);
    if (fence) {
      if (fenceMark && fenceMark[1][0] === fence[0] && fenceMark[1].length >= fence.length) fence = null;
      continue;
    }
    if (fenceMark) {
      close();
      fence = fenceMark[1];
      continue;
    }
    if (line.trim() === '') {
      close();
      continue;
    }
    // A heading is a block of its own, and so is the underline of a setext heading.
    if (/^\s{0,3}#{1,6}(\s|$)/.test(line)) {
      close();
      blocks.push([line]);
      continue;
    }
    if (/^\s{0,3}(=+|-+)\s*$/.test(line) && current.length > 0) {
      const title = current.pop()!;
      close();
      blocks.push([`# ${title}`]);
      continue;
    }
    current.push(line);
  }
  close();

  const paragraphs: string[] = [];
  let length = 0;
  for (const block of blocks) {
    const first = block[0];
    if (/^\s{0,3}#/.test(first)) {
      if (STOP_HEADING.test(first.replace(/^\s*#+/, ''))) break;
      continue;
    }
    // Code indented by four spaces, a table, a list, a link definition, a rule: none of these is prose.
    if (block.every((line) => /^ {4,}/.test(line))) continue;
    if (block.some((line) => /^\s*\|/.test(line))) continue;
    if (/^\s*([-*+]|\d+[.)])\s+/.test(first)) continue;
    if (block.every((line) => /^\s*\[[^\]]+\]:\s*\S+/.test(line))) continue;
    if (/^\s*([-*_]\s*){3,}$/.test(first)) continue;
    const paragraph = plainParagraph(block.join('\n'));
    if (!isProse(paragraph)) continue;
    if (paragraphs.length > 0 && length + paragraph.length > README_SUMMARY_MAX_CHARS) break;
    paragraphs.push(clipAtWord(paragraph, README_SUMMARY_MAX_CHARS));
    length += paragraph.length;
    if (paragraphs.length >= README_MAX_PARAGRAPHS || length >= README_SUMMARY_MAX_CHARS) break;
  }
  return paragraphs.join('\n\n');
}

/** Letters and digits only, lower-cased: two texts that say the same thing compare equal. */
function gist(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

/**
 * What the card shows of a pack, from what its two files gave (either may be missing). A README whose opening
 * only repeats the short description adds nothing and is left out; one that starts with it keeps the rest.
 */
export function packInfoOf(pyproject: PyprojectFacts | null, readmeSummary: string): PackInfo {
  const description = pyproject?.description ?? '';
  let summary = readmeSummary;
  if (description && summary) {
    const paragraphs = summary.split('\n\n').filter((paragraph) => gist(paragraph) !== gist(description));
    summary = paragraphs.join('\n\n');
  }
  return { description, repositoryUrl: pyproject?.repositoryUrl ?? null, readmeSummary: summary };
}
