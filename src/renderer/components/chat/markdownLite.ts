/**
 * A small markdown subset for chat text: paragraphs, line breaks, bullet and numbered lists, fenced code,
 * inline code and bold. Parsed to plain data and rendered as React elements, never as HTML.
 */

export type InlineToken =
  | { type: 'text'; text: string }
  | { type: 'code'; text: string }
  | { type: 'strong'; text: string };

export type Block =
  | { type: 'paragraph'; lines: InlineToken[][] }
  | { type: 'list'; ordered: boolean; start: number; items: InlineToken[][] }
  | { type: 'code'; text: string };

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*(\d{1,4})[.)]\s+(.*)$/;
const FENCE = /^\s*```/;

export function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const pattern = /`([^`\n]+)`|\*\*([^*\n]+)\*\*/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) tokens.push({ type: 'text', text: text.slice(last, match.index) });
    if (match[1] !== undefined) tokens.push({ type: 'code', text: match[1] });
    else tokens.push({ type: 'strong', text: match[2] });
    last = match.index + match[0].length;
  }
  if (last < text.length) tokens.push({ type: 'text', text: text.slice(last) });
  return tokens;
}

export function parseMarkdownLite(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; start: number; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length > 0) blocks.push({ type: 'paragraph', lines: paragraph.map(parseInline) });
    paragraph = [];
  };
  const flushList = () => {
    if (list) blocks.push({ type: 'list', ordered: list.ordered, start: list.start, items: list.items.map(parseInline) });
    list = null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (FENCE.test(line)) {
      flushParagraph();
      flushList();
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
      flushParagraph();
      flushList();
      continue;
    }
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
  flushParagraph();
  flushList();
  return blocks;
}
