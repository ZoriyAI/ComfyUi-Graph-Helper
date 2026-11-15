import { app, shell, type IpcMain } from 'electron';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import {
  PROJECT_LINK_KINDS,
  type AboutInfo,
  type HelpLanguage,
  type HelpPage,
  type HelpSearchHit,
  type HelpTree,
  type IssueDraft,
  type ProjectLinkKind,
  type ThirdPartyComponent,
} from '../../shared/contracts/about';
import { isPageRef, WHATS_NEW_PAGE } from '../../shared/help/contextHelp';
import { appVersion, DISPLAY_NAME, projectLinks } from '../identity';

/** dist/ (this file is dist/main/ipc/aboutIpc.js, packaged or not): notices and help are written there at build. */
const DIST = path.join(__dirname, '..', '..');
const HELP = path.join(DIST, 'help');

function chromiumLicencesPath(): string {
  return path.join(path.dirname(process.execPath), 'LICENSES.chromium.html');
}

/** "Ubuntu 24.04.1 LTS · Linux 6.8.0 x64", or just the kernel line when the distribution does not say. */
export function systemLine(osRelease: string | null, type = os.type(), release = os.release(), arch = os.arch()): string {
  const pretty = osRelease ? /^PRETTY_NAME="?([^"\n]+)"?/m.exec(osRelease)?.[1] : undefined;
  const kernel = `${type} ${release} ${arch}`;
  return pretty ? `${pretty} · ${kernel}` : kernel;
}

function readText(file: string): string | null {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

const languageOf = (value: unknown): HelpLanguage => (value === 'en' ? 'en' : 'ru');

interface WikiIndex {
  folders: Array<{ folder: string; index: string; pages: string[] }>;
  pages: Record<string, { title: { en?: string; ru?: string } }>;
}
type SearchCorpus = Record<HelpLanguage, Array<{ ref: string; title: string; text: string }>>;

let indexCache: WikiIndex | null = null;
let corpusCache: SearchCorpus | null = null;

function wikiIndex(dir: string = HELP): WikiIndex {
  if (indexCache && dir === HELP) return indexCache;
  let parsed: WikiIndex = { folders: [], pages: {} };
  try {
    parsed = JSON.parse(readText(path.join(dir, 'wiki-index.json')) ?? '') as WikiIndex;
  } catch {
    // No bundled wiki (an old build): the reader says the page is missing.
  }
  if (dir === HELP) indexCache = parsed;
  return parsed;
}

function corpus(dir: string = HELP): SearchCorpus {
  if (corpusCache && dir === HELP) return corpusCache;
  let parsed: SearchCorpus = { en: [], ru: [] };
  try {
    parsed = JSON.parse(readText(path.join(dir, 'wiki-search.json')) ?? '') as SearchCorpus;
  } catch {
    // Nothing to search.
  }
  if (dir === HELP) corpusCache = parsed;
  return parsed;
}

const titleIn = (index: WikiIndex, ref: string, language: HelpLanguage): string => {
  const title = index.pages[ref]?.title;
  return title?.[language] ?? title?.en ?? ref;
};

/** The section tree in the interface language. */
export function helpTree(language: HelpLanguage, dir: string = HELP): HelpTree {
  const index = wikiIndex(dir);
  return {
    home: { ref: 'Home', title: titleIn(index, 'Home', language) },
    folders: index.folders.map((folder) => ({
      folder: folder.folder,
      ref: folder.index,
      title: titleIn(index, folder.index, language),
      pages: folder.pages.map((ref) => ({ ref, title: titleIn(index, ref, language) })),
    })),
  };
}

/** One page: the wiki page `ref` in the language, else in English; `@whats-new` is the running version's notes. */
export function helpPage(ref: unknown, language: HelpLanguage, dir: string = HELP): HelpPage {
  if (!isPageRef(ref)) return { ok: false, error: 'unknown' };
  if (ref === WHATS_NEW_PAGE) {
    for (const lang of [language, 'en'] as HelpLanguage[]) {
      const text = readText(path.join(dir, lang === 'ru' ? 'whatsnew.ru.md' : 'whatsnew.md'));
      if (text) return { ok: true, ref, language: lang, title: /^#\s+(.+)$/m.exec(text)?.[1] ?? ref, text };
    }
    return { ok: false, error: 'missing' };
  }
  const index = wikiIndex(dir);
  if (!index.pages[ref]) return { ok: false, error: 'missing' };
  for (const lang of [language, 'en'] as HelpLanguage[]) {
    const text = readText(path.join(dir, 'wiki', `${ref}${lang === 'ru' ? '.ru' : ''}.md`));
    if (text) return { ok: true, ref, language: lang, title: titleIn(index, ref, lang), text };
  }
  return { ok: false, error: 'missing' };
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Pages where every word of the query starts a word of the title or the text ("ключ" finds «ключ» and «ключи», not
 * «подключение»), best first: title matches, then how often.
 */
export function helpSearch(query: unknown, language: HelpLanguage, dir: string = HELP, limit = 20): HelpSearchHit[] {
  const words = typeof query === 'string' ? query.toLowerCase().split(/\s+/).filter((word) => word.length > 1).slice(0, 8) : [];
  if (words.length === 0) return [];
  const patterns = words.map((word) => new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapeRegExp(word)}`, 'gu'));
  const scored: Array<HelpSearchHit & { score: number }> = [];
  for (const page of corpus(dir)[language] ?? []) {
    const title = page.title.toLowerCase();
    const text = page.text.toLowerCase();
    let score = 0;
    let first = -1;
    let all = true;
    for (const pattern of patterns) {
      const inTitle = new RegExp(pattern.source, 'u').test(title);
      const found = [...text.matchAll(pattern)];
      if (!inTitle && found.length === 0) {
        all = false;
        break;
      }
      score += (inTitle ? 20 : 0) + Math.min(10, found.length);
      if (found.length > 0 && (first < 0 || (found[0].index ?? 0) < first)) first = found[0].index ?? 0;
    }
    if (!all) continue;
    const start = Math.max(0, first - 50);
    const snippet = first < 0 ? page.text.slice(0, 120) : `${start > 0 ? '…' : ''}${page.text.slice(start, first + 90).trim()}…`;
    scored.push({ ref: page.ref, title: page.title, snippet, score });
  }
  return scored.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, limit).map(({ score: _score, ...hit }) => hit);
}

function aboutInfo(): AboutInfo {
  return {
    version: app.isPackaged ? app.getVersion() : appVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    system: systemLine(readText('/etc/os-release')),
    dataFolder: app.getPath('userData'),
    chromiumLicences: fs.existsSync(chromiumLicencesPath()),
    projectLinks: projectLinks() !== null,
  };
}

/** What a new issue starts with: versions only, no paths, no settings, no keys. */
export function issueDraft(info: Pick<AboutInfo, 'version' | 'electron' | 'chrome' | 'node' | 'system'>): IssueDraft {
  return {
    title: '',
    details: [
      `${DISPLAY_NAME} ${info.version}`,
      `Electron ${info.electron}`,
      `Chromium ${info.chrome}`,
      `Node ${info.node}`,
      info.system,
    ].join('\n'),
  };
}

/** The address a project link opens; the new issue uses the bug form with the details filled in. */
export function projectLinkUrl(kind: ProjectLinkKind, links: ReturnType<typeof projectLinks>, draft: IssueDraft): string | null {
  if (!links) return null;
  if (kind === 'site') return links.site;
  if (kind === 'releases') return links.releases;
  const url = new URL(links.newIssue);
  url.searchParams.set('template', 'bug.yml');
  url.searchParams.set('details', draft.details);
  return url.toString();
}

export function registerAboutIpc(ipcMain: IpcMain): void {
  ipcMain.handle(IPC_CHANNELS.ABOUT_INFO, (): AboutInfo => aboutInfo());

  ipcMain.handle(IPC_CHANNELS.ABOUT_LICENCE, (): string => readText(path.join(DIST, 'notices', 'LICENSE.txt')) ?? '');

  ipcMain.handle(IPC_CHANNELS.ABOUT_NOTICES, (): ThirdPartyComponent[] => {
    const text = readText(path.join(DIST, 'notices', 'third-party.json'));
    if (!text) return [];
    try {
      const parsed = JSON.parse(text) as unknown;
      return Array.isArray(parsed) ? parsed.filter((item): item is ThirdPartyComponent => Boolean(item) && typeof item.name === 'string') : [];
    } catch {
      return [];
    }
  });

  ipcMain.handle(IPC_CHANNELS.ABOUT_OPEN_DATA_FOLDER, async () => {
    const error = await shell.openPath(app.getPath('userData'));
    return error ? { ok: false as const, error } : { ok: true as const };
  });

  ipcMain.handle(IPC_CHANNELS.ABOUT_OPEN_CHROMIUM_LICENCES, async () => {
    const file = chromiumLicencesPath();
    if (!fs.existsSync(file)) return { ok: false as const, error: 'missing' };
    const error = await shell.openPath(file);
    return error ? { ok: false as const, error } : { ok: true as const };
  });

  ipcMain.handle(IPC_CHANNELS.ABOUT_ISSUE_DRAFT, (): IssueDraft => issueDraft(aboutInfo()));

  // Only these three pages, built here from PROJECT_URL: the window never names an address to open.
  ipcMain.handle(IPC_CHANNELS.ABOUT_OPEN_PROJECT_LINK, async (_event, kind: unknown) => {
    if (typeof kind !== 'string' || !(PROJECT_LINK_KINDS as readonly string[]).includes(kind)) return { ok: false as const, error: 'unknown' };
    const url = projectLinkUrl(kind as ProjectLinkKind, projectLinks(), issueDraft(aboutInfo()));
    if (!url) return { ok: false as const, error: 'no-project-address' };
    await shell.openExternal(url);
    return { ok: true as const };
  });

  ipcMain.handle(IPC_CHANNELS.HELP_TREE, (_event, language: unknown): HelpTree => helpTree(languageOf(language)));
  ipcMain.handle(IPC_CHANNELS.HELP_PAGE, (_event, ref: unknown, language: unknown): HelpPage => helpPage(ref, languageOf(language)));
  ipcMain.handle(IPC_CHANNELS.HELP_SEARCH, (_event, query: unknown, language: unknown): HelpSearchHit[] => helpSearch(query, languageOf(language)));
}
