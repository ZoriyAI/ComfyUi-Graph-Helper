/**
 * A small markdown subset for chat text: paragraphs, line breaks, headings, bullet and numbered lists, quotes,
 * rules, simple tables, fenced code, inline code, bold and emphasis. Models write these whether asked to or not,
 * and shown raw they are "##", "|" and "*" in the middle of an answer. Parsed to plain data and rendered as
 * React elements, never as HTML. A link keeps its words and its address as text: the chat opens nothing.
 */

export type InlineToken =
  | { type: 'text'; text: string }
  | { type: 'code'; text: string }
  | { type: 'strong'; text: string }
  | { type: 'em'; text: string }
  /** A link: its words are shown, its address is copied on a click. The chat opens nothing. */
  | { type: 'link'; text: string; address: string }
  /** Only with `links: true` (the help reader): a relative link to another wiki page, opened inside the reader. */
  | { type: 'page'; text: string; target: string };

export interface ParseOptions {
  /** Relative links `[words](page.md)` become page tokens; web addresses stay link tokens. */
  links?: boolean;
}

export type Block =
  | { type: 'paragraph'; lines: InlineToken[][] }
  | { type: 'heading'; level: 1 | 2 | 3; tokens: InlineToken[] }
  | { type: 'list'; ordered: boolean; start: number; items: InlineToken[][] }
  | { type: 'quote'; lines: InlineToken[][] }
  | { type: 'rule' }
  | { type: 'table'; header: InlineToken[][]; rows: InlineToken[][][] }
  | { type: 'code'; text: string };

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*(\d{1,4})[.)]\s+(.*)$/;
const FENCE = /^\s*```/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const RULE = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_RULE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

const LINK = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g;

/**
 * [words](address) becomes a link token: the words in the text, the address behind them (shown as a tooltip and
 * copied on a click). The words are still parsed for code, bold and emphasis.
 */
function parseWebLinks(source: string): InlineToken[] {
  // Each link is held by a private mark while bold, emphasis and code are read around it, then put back.
  const links: Array<{ text: string; address: string }> = [];
  const marked = source.replace(LINK, (_match, words: string, address: string) => {
    links.push({ text: words.trim().replace(/[`*_]/g, '') || address, address });
    return `${links.length - 1}`;
  });
  if (links.length === 0) return parsePlain(source);
  const tokens: InlineToken[] = [];
  for (const token of parsePlain(marked)) {
    if (token.type === 'code') {
      // Inside code nothing is markup: the link is given back as it was written.
      tokens.push({ type: 'code', text: token.text.replace(/(\d+)/g, (_m, i: string) => `[${links[Number(i)].text}](${links[Number(i)].address})`) });
      continue;
    }
    if (token.type === 'link' || token.type === 'page' || !token.text.includes('')) {
      tokens.push(token);
      continue;
    }
    for (const [index, part] of token.text.split(/(\d+)/).entries()) {
      if (index % 2 === 1) tokens.push({ type: 'link', ...links[Number(part)] });
      else if (part) tokens.push({ type: token.type, text: part });
    }
  }
  return tokens;
}

/** Inline tokens of one line. With `links: true`, relative links `[words](page.md)` become page tokens first. */
export function parseInline(source: string, options: ParseOptions = {}): InlineToken[] {
  if (!options.links) return parseWebLinks(source);
  // Split around relative links (no scheme); everything between them is parsed as in the chat.
  const out: InlineToken[] = [];
  const page = /\[([^\]\n]+)\]\((?![a-z][a-z0-9+.-]*:)([^\s)]+)\)/gi;
  let at = 0;
  let found: RegExpExecArray | null;
  while ((found = page.exec(source)) !== null) {
    if (found.index > at) out.push(...parseWebLinks(source.slice(at, found.index)));
    out.push({ type: 'page', text: found[1], target: found[2] });
    at = found.index + found[0].length;
  }
  if (at < source.length) out.push(...parseWebLinks(source.slice(at)));
  return out;
}

function parsePlain(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  // Code first (nothing inside it is markup), then bold, then emphasis. Emphasis needs a letter right inside each
  // mark, so "512 * 768 * 2" stays arithmetic, and an underscore inside a name (lora_name) is a letter of it.
  const pattern = /`([^`\n]+)`|\*\*(?=\S)([^*\n]+?)(?<=\S)\*\*|__(?=\S)([^_\n]+?)(?<=\S)__|(?<![\w*])\*(?=[^\s*])([^*\n]+?)(?<=[^\s*])\*(?![\w*])|(?<![\w_])_(?=[^\s_])([^_\n]+?)(?<=[^\s_])_(?![\w_])/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) tokens.push({ type: 'text', text: text.slice(last, match.index) });
    if (match[1] !== undefined) tokens.push({ type: 'code', text: match[1] });
    else if (match[2] !== undefined || match[3] !== undefined) tokens.push({ type: 'strong', text: match[2] ?? match[3] });
    else tokens.push({ type: 'em', text: match[4] ?? match[5] });
    last = match.index + match[0].length;
  }
  if (last < text.length) tokens.push({ type: 'text', text: text.slice(last) });
  return tokens;
}

function tableCells(line: string): string[] {
  const inner = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return inner.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'));
}

export function parseMarkdownLite(source: string, options: ParseOptions = {}): Block[] {
  const inline = (line: string) => parseInline(line, options);
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let quote: string[] = [];
  let list: { ordered: boolean; start: number; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length > 0) blocks.push({ type: 'paragraph', lines: paragraph.map(inline) });
    paragraph = [];
  };
  const flushQuote = () => {
    if (quote.length > 0) blocks.push({ type: 'quote', lines: quote.map(inline) });
    quote = [];
  };
  const flushList = () => {
    if (list) blocks.push({ type: 'list', ordered: list.ordered, start: list.start, items: list.items.map(inline) });
    list = null;
  };
  const flushAll = () => {
    flushParagraph();
    flushQuote();
    flushList();
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (FENCE.test(line)) {
      flushAll();
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !FENCE.test(lines[index])) {
        body.push(lines[index]);
        index += 1;
      }
      blocks.push({ type: 'code', text: body.join('\n') });
      continue;
    }
    if (line.trim() === '') {
      flushAll();
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      flushAll();
      blocks.push({ type: 'heading', level: Math.min(3, heading[1].length) as 1 | 2 | 3, tokens: inline(heading[2]) });
      continue;
    }
    // A table: a row of cells, then the row of dashes. Without the dashes a line with bars is just a line.
    if (TABLE_ROW.test(line) && index + 1 < lines.length && TABLE_RULE.test(lines[index + 1]) && lines[index + 1].includes('-')) {
      flushAll();
      const header = tableCells(line).map(inline);
      const rows: InlineToken[][][] = [];
      index += 2;
      while (index < lines.length && TABLE_ROW.test(lines[index])) {
        const cells = tableCells(lines[index]);
        // Every row has as many cells as the header: a short row is padded, a long one keeps its tail in the last cell.
        const fitted = cells.length > header.length
          ? [...cells.slice(0, header.length - 1), cells.slice(header.length - 1).join(' | ')]
          : [...cells, ...Array.from({ length: header.length - cells.length }, () => '')];
        rows.push(fitted.map(inline));
        index += 1;
      }
      index -= 1;
      blocks.push({ type: 'table', header, rows });
      continue;
    }
    if (RULE.test(line) && !BULLET.test(line)) {
      flushAll();
      blocks.push({ type: 'rule' });
      continue;
    }
    const quoted = QUOTE.exec(line);
    if (quoted) {
      flushParagraph();
      flushList();
      quote.push(quoted[1]);
      continue;
    }
    flushQuote();
    const bullet = BULLET.exec(line);
    const numbered = bullet ? null : NUMBERED.exec(line);
    if (bullet || numbered) {
      flushParagraph();
      const ordered = Boolean(numbered);
      if (list && list.ordered !== ordered) flushList();
      if (!list) list = { ordered, start: numbered ? Number(numbered[1]) : 1, items: [] };
      list.items.push(bullet ? bullet[1] : (numbered as RegExpExecArray)[2]);
      continue;
    }
    if (list && /^\s{2,}\S/.test(line)) {
      // An indented line continues the last list item.
      list.items[list.items.length - 1] += ` ${line.trim()}`;
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flushAll();
  return blocks;
}
