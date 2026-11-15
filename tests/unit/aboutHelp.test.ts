/**
 * Protects the About window and the built-in Help reader: the system line, the Report a problem link that carries
 * versions only, context help ids that point at wiki pages in both languages, safe links between pages, the bundled
 * wiki tree and search, and release notes for the running version. A person pressing F1 or reporting a bug must
 * land on a real page and send nothing private.
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { helpPage, helpSearch, helpTree, issueDraft, projectLinkUrl, systemLine } from '../../src/main/ipc/aboutIpc';
import { HELP_IDS, pageForHelpId, resolveWikiLink, WHATS_NEW_PAGE } from '../../src/shared/help/contextHelp';
import { parseInline, parseMarkdownLite } from '../../src/renderer/components/chat/markdownParse';
import { readerText } from '../../src/renderer/components/shell/HelpReader';

/** The repository root: help pages and release notes are read from docs/ there. */
const root = path.join(__dirname, '..', '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { version: string };

describe('About: the system line', () => {
  it('names the distribution when /etc/os-release does', () => {
    const release = 'NAME="Ubuntu"\nPRETTY_NAME="Ubuntu 24.04.1 LTS"\nID=ubuntu\n';
    expect(systemLine(release, 'Linux', '6.8.0-45-generic', 'x64')).toBe('Ubuntu 24.04.1 LTS · Linux 6.8.0-45-generic x64');
  });

  it('falls back to the kernel line', () => {
    expect(systemLine(null, 'Linux', '6.8.0', 'x64')).toBe('Linux 6.8.0 x64');
    expect(systemLine('ID=debian\n', 'Linux', '6.1.0', 'x64')).toBe('Linux 6.1.0 x64');
  });
});

describe('Report a problem', () => {
  const info = { version: '1.2.3', electron: '45', chrome: '140', node: '22', system: 'Linux 6.8 x64' };

  it('carries versions only', () => {
    expect(issueDraft(info).details).toBe('NodeWise Studio 1.2.3\nElectron 45\nChromium 140\nNode 22\nLinux 6.8 x64');
  });

  it('opens the bug form with the details filled in, and nothing without a project address', () => {
    const links = { site: 'https://github.com/a/b', releases: 'https://github.com/a/b/releases', issues: 'https://github.com/a/b/issues', newIssue: 'https://github.com/a/b/issues/new' };
    const url = new URL(projectLinkUrl('issue', links, issueDraft(info)) ?? '');
    expect(url.origin + url.pathname).toBe('https://github.com/a/b/issues/new');
    expect(url.searchParams.get('template')).toBe('bug.yml');
    expect(url.searchParams.get('details')).toContain('NodeWise Studio 1.2.3');
    expect(projectLinkUrl('releases', links, issueDraft(info))).toBe('https://github.com/a/b/releases');
    expect(projectLinkUrl('site', null, issueDraft(info))).toBeNull();
  });
});

describe('context help ids', () => {
  it('point at pages that exist in both languages', () => {
    for (const [id, page] of Object.entries(HELP_IDS)) {
      for (const suffix of ['.md', '.ru.md']) {
        expect(fs.existsSync(path.join(root, 'docs', 'wiki', `${page}${suffix}`)), `${id} → ${page}${suffix}`).toBe(true);
      }
    }
    expect(pageForHelpId('glossary')).toBe('reference/Glossary');
    expect(pageForHelpId('no-such-id')).toBeNull();
  });

  it('resolve links between pages', () => {
    expect(resolveWikiLink('start/Quick-Start', '../graph/Subgraphs.ru.md')).toBe('graph/Subgraphs');
    expect(resolveWikiLink('start/Quick-Start', 'Installing.md#deb')).toBe('start/Installing');
    expect(resolveWikiLink('start/README', '../Home.md')).toBe('Home');
    expect(resolveWikiLink('Home', 'start/README.md')).toBe('start/README');
    // A link out of the wiki or to a non-page file resolves to nothing.
    expect(resolveWikiLink('Home', '../../src/main/index.ts')).toBeNull();
    expect(resolveWikiLink('Home', '../outside.md')).toBeNull();
  });
});

describe('the help reader', () => {
  it('turns relative links into page links; a web address stays a link that only copies its address', () => {
    expect(parseInline('See [Subgraphs](../graph/Subgraphs.md) and [ComfyUI](https://example.com).', { links: true })).toEqual([
      { type: 'text', text: 'See ' },
      { type: 'page', text: 'Subgraphs', target: '../graph/Subgraphs.md' },
      { type: 'text', text: ' and ' },
      { type: 'link', text: 'ComfyUI', address: 'https://example.com' },
      { type: 'text', text: '.' },
    ]);
    // Without the option (the chat), no relative link becomes a page link.
    expect(parseInline('[Subgraphs](../graph/Subgraphs.md)').some((token) => token.type === 'page')).toBe(false);
    expect(parseMarkdownLite('- [A](a.md)', { links: true })).toEqual([{ type: 'list', ordered: false, start: 1, items: [[{ type: 'page', text: 'A', target: 'a.md' }]] }]);
  });

  it('shows a page without its language link, its title and the comments for writers', () => {
    const page = '[Русский](Page.ru.md)\n[Home](../Home.md) › [Start](README.md)\n\n# Title\n\nText <!-- verify: x -->\n';
    expect(readerText(page)).toBe('[Home](../Home.md) › [Start](README.md)\n\nText');
  });

  it('reads the bundled wiki: tree, pages in the interface language, search, and the version notes', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'help-bundle-'));
    // The bundle npm run build writes, from this repository's docs.
    execFileSync(process.execPath, [path.join(root, 'scripts', 'build-assets.js')], { cwd: root, stdio: 'ignore' });
    fs.cpSync(path.join(root, 'dist', 'help'), dir, { recursive: true });
    const tree = helpTree('ru', dir);
    expect(tree.home.ref).toBe('Home');
    expect(tree.folders.map((folder) => folder.folder)).toEqual(expect.arrayContaining(['start', 'reference', 'trust', 'dev']));
    const start = tree.folders.find((folder) => folder.folder === 'start');
    expect(start?.pages.map((item) => item.ref)).toContain('start/Installing');
    const ru = helpPage('start/Installing', 'ru', dir);
    expect(ru.ok && ru.language).toBe('ru');
    const en = helpPage('start/Installing', 'en', dir);
    expect(en.ok && en.text.split('\n')[0]).toBe('[Русский](Installing.ru.md)');
    expect(helpPage('../../etc/passwd', 'en', dir)).toEqual({ ok: false, error: 'unknown' });
    expect(helpPage('start/No-Such-Page', 'en', dir)).toEqual({ ok: false, error: 'missing' });
    const notes = helpPage(WHATS_NEW_PAGE, 'en', dir);
    expect(notes.ok).toBe(true);
    const hits = helpSearch('glossary', 'en', dir);
    expect(hits.map((hit) => hit.ref)).toContain('reference/Glossary');
    expect(helpSearch('', 'en', dir)).toEqual([]);
  });

  it('has the notes of the running version in both languages', () => {
    for (const suffix of ['.md', '.ru.md']) {
      expect(fs.existsSync(path.join(root, 'docs', 'releases', `v${pkg.version}${suffix}`)), `v${pkg.version}${suffix}`).toBe(true);
    }
  });
});
