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
  | { type: 'em'; text: string };

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

/** [words](address) becomes "words (address)", or just the address when the words are the address. */
function unlink(text: string): string {
  return text.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (_match, words: string, address: string) => (
    words.trim() === address ? address : `${words} (${address})`
  ));
}

export function parseInline(source: string): InlineToken[] {
  const text = unlink(source);
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

export function parseMarkdownLite(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let quote: string[] = [];
  let list: { ordered: boolean; start: number; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length > 0) blocks.push({ type: 'paragraph', lines: paragraph.map(parseInline) });
    paragraph = [];
  };
  const flushQuote = () => {
    if (quote.length > 0) blocks.push({ type: 'quote', lines: quote.map(parseInline) });
    quote = [];
  };
  const flushList = () => {
    if (list) blocks.push({ type: 'list', ordered: list.ordered, start: list.start, items: list.items.map(parseInline) });
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
      blocks.push({ type: 'heading', level: Math.min(3, heading[1].length) as 1 | 2 | 3, tokens: parseInline(heading[2]) });
      continue;
    }
    // A table: a row of cells, then the row of dashes. Without the dashes a line with bars is just a line.
    if (TABLE_ROW.test(line) && index + 1 < lines.length && TABLE_RULE.test(lines[index + 1]) && lines[index + 1].includes('-')) {
      flushAll();
      const header = tableCells(line).map(parseInline);
      const rows: InlineToken[][][] = [];
      index += 2;
      while (index < lines.length && TABLE_ROW.test(lines[index])) {
        const cells = tableCells(lines[index]);
        // Every row has as many cells as the header: a short row is padded, a long one keeps its tail in the last cell.
        const fitted = cells.length > header.length
          ? [...cells.slice(0, header.length - 1), cells.slice(header.length - 1).join(' | ')]
          : [...cells, ...Array.from({ length: header.length - cells.length }, () => '')];
        rows.push(fitted.map(parseInline));
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
