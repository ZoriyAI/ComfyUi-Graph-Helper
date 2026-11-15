/**
 * Context help: a message, a hint or a button in the app opens a wiki page by a stable id, never by a file name.
 * The wiki may move a page; then only this map changes. Each id names a page as `folder/Page-Name` (no language,
 * no extension); the reader opens `docs/wiki/<page>.md` or `<page>.ru.md` in the interface language.
 *
 * To link a new place of the app to the wiki: add an id here (lower-case words joined by hyphens), point it at a
 * page, and call `openHelp('<id>')` from the renderer (services/help.ts). tests/unit/aboutHelp.test.ts fails when
 * an id points at a page that does not exist in both languages. See docs/wiki/dev/Context-Help.md.
 * Read by the renderer's help service and reader (services/help.ts, shell/HelpReader.tsx) and by main, which serves
 * the pages (main/ipc/aboutIpc.ts).
 */
export const HELP_IDS = {
  home: 'Home',
  'quick-start': 'start/Quick-Start',
  installing: 'start/Installing',
  faq: 'start/FAQ',
  connecting: 'connect/Connecting',
  'connection-problems': 'connect/Connection-Problems',
  'running-in-comfyui': 'graph/Running-In-ComfyUI',
  'comfyui-errors': 'graph/ComfyUI-Errors',
  'history-and-undo': 'graph/History-And-Undo',
  'checking-a-graph': 'graph/Checking-A-Graph',
  'choosing-who-answers': 'assistant/Choosing-Who-Answers',
  'context-window': 'assistant/Context-Window',
  'what-is-sent': 'assistant/What-Is-Sent',
  lessons: 'lessons/README',
  glossary: 'reference/Glossary',
  troubleshooting: 'reference/Troubleshooting',
  messages: 'reference/Messages',
  shortcuts: 'reference/Shortcuts',
  'data-folder': 'reference/Data-Folder',
  'known-limits': 'reference/Known-Limits',
  privacy: 'trust/Privacy',
  security: 'trust/Security',
  licence: 'trust/Licence',
  'content-rules': 'trust/Content-Rules',
} as const;

/** A help id the app may open. */
export type HelpId = keyof typeof HELP_IDS;

/** The reader's own page for the notes of the running version (docs/releases), not a wiki page. */
export const WHATS_NEW_PAGE = '@whats-new';

/** A wiki page reference: `folder/Page-Name` or `Home`, letters, digits and hyphens only. */
export function isPageRef(value: unknown): value is string {
  return typeof value === 'string' && (value === WHATS_NEW_PAGE || /^(?:[a-z]+\/)?[A-Za-z0-9-]+$/.test(value));
}

/** The page a help id opens, or null for an unknown id. */
export function pageForHelpId(id: string): string | null {
  return Object.prototype.hasOwnProperty.call(HELP_IDS, id) ? HELP_IDS[id as HelpId] : null;
}

/**
 * Where a relative link inside a page leads: `../graph/Subgraphs.ru.md` from `start/Quick-Start` is
 * `graph/Subgraphs`. Null for anything that leaves the wiki or is not a page.
 */
export function resolveWikiLink(fromPage: string, target: string): string | null {
  const clean = target.split('#')[0];
  if (!clean.endsWith('.md')) return null;
  const parts = fromPage.includes('/') ? fromPage.split('/').slice(0, -1) : [];
  for (const piece of clean.split('/')) {
    if (piece === '..') {
      if (parts.length === 0) return null;
      parts.pop();
    } else if (piece !== '.' && piece !== '') parts.push(piece);
  }
  const ref = parts.join('/').replace(/(\.ru)?\.md$/, '');
  return isPageRef(ref) && ref !== WHATS_NEW_PAGE ? ref : null;
}
