#!/usr/bin/env node
/**
 * Files the app reads at run time that are not code, written into dist/ after the main and renderer builds:
 *
 * - dist/notices/LICENSE.txt: the app's own licence; COPYRIGHT.txt, NOTICE.md and NOTICE.ru.md beside it (the holder,
 *   authorship and the dated record).
 * - dist/notices/third-party.json and THIRD_PARTY_NOTICES.txt: every package that ships with the app (main's
 *   runtime dependencies, the packages the renderer bundle is built from, and Electron itself) with its version,
 *   licence and licence text. Settings ▸ About lists them; the deb's copyright file carries the text.
 * - dist/help: the wiki (docs/wiki) with its section tree and a search corpus, and the notes of the running
 *   version, for the help reader.
 *
 * Usage: node scripts/build-assets.js   (part of `npm run build`)
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

/** Bare package names imported by the renderer source (code and CSS); the bundle is built from these. */
function rendererImports() {
  const names = new Set();
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(tsx?|css)$/.test(entry.name)) {
        const text = fs.readFileSync(full, 'utf8');
        for (const match of text.matchAll(/(?:from\s+|import\s+|@import\s+)['"]([^'"./][^'"]*)['"]/g)) {
          const spec = match[1];
          const parts = spec.split('/');
          names.add(spec.startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0]);
        }
      }
    }
  };
  walk(path.join(root, 'src', 'renderer'));
  return [...names];
}

/** The folder of package `name` as Node would find it from `fromDir`. */
function findPackage(name, fromDir) {
  let dir = fromDir;
  for (;;) {
    const candidate = path.join(dir, 'node_modules', name);
    if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** File names that hold a package's licence or notice text (LICENSE, LICENCE.md, COPYING, NOTICE, ...). */
const LICENCE_FILE = /^(licen[cs]e|copying|notice)(\.[a-z]+)?$/i;

/** The licence and notice files of a package folder, joined; empty when it ships none. */
function licenceText(dir) {
  const files = fs.readdirSync(dir).filter((file) => LICENCE_FILE.test(file)).sort();
  return files.map((file) => fs.readFileSync(path.join(dir, file), 'utf8').trim()).join('\n\n');
}

/** The licence a package.json declares, in its current or its old (`licenses` array) form. */
function licenceName(meta) {
  if (typeof meta.license === 'string') return meta.license;
  if (meta.license && typeof meta.license.type === 'string') return meta.license.type;
  if (Array.isArray(meta.licenses)) return meta.licenses.map((item) => item.type || item).join(' OR ');
  return 'UNKNOWN';
}

const LICENCE_URLS = {
  'Apache-2.0': 'https://www.apache.org/licenses/LICENSE-2.0',
  MIT: 'https://opensource.org/license/mit',
  ISC: 'https://opensource.org/license/isc-license-txt',
};

/** A package published without a licence file: its declared licence, author and source. */
function fallbackText(meta) {
  const licence = licenceName(meta);
  const author = typeof meta.author === 'string' ? meta.author : meta.author?.name;
  const repository = typeof meta.repository === 'string' ? meta.repository : meta.repository?.url;
  return [
    `Licensed under ${licence}${LICENCE_URLS[licence] ? ` (${LICENCE_URLS[licence]})` : ''}.`,
    author ? `Author: ${author}.` : '',
    repository ? `Source: ${repository}` : '',
  ].filter(Boolean).join('\n');
}

/**
 * Every package that ships, found breadth-first from main's dependencies, the renderer's imports and Electron,
 * each resolved the way Node would from the folder that asks for it. One entry per name and version.
 */
function collect() {
  const seen = new Map();
  const queue = [...Object.keys(pkg.dependencies || {}), ...rendererImports(), 'electron'].map((name) => ({ name, from: root }));
  while (queue.length > 0) {
    const { name, from } = queue.shift();
    if (name === pkg.name || name === 'electron/main') continue;
    const dir = findPackage(name, from);
    if (!dir) continue;
    const meta = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    const key = `${meta.name}@${meta.version}`;
    if (seen.has(key)) continue;
    // Electron ships its runtime, not its npm installer's dependencies.
    const deps = meta.name === 'electron' ? {} : { ...(meta.dependencies || {}), ...(meta.optionalDependencies || {}) };
    seen.set(key, {
      name: meta.name,
      version: meta.version,
      license: licenceName(meta),
      text: licenceText(dir) || fallbackText(meta),
    });
    for (const dep of Object.keys(deps)) queue.push({ name: dep, from: dir });
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
}

/** Writes dist/notices (see the header); returns how many third-party components were listed. */
function writeNotices() {
  const out = path.join(root, 'dist', 'notices');
  fs.mkdirSync(out, { recursive: true });
  fs.copyFileSync(path.join(root, 'LICENSE'), path.join(out, 'LICENSE.txt'));
  // Next to the licence: who holds the copyright, and the statement of authorship and the dated record.
  fs.copyFileSync(path.join(root, 'COPYRIGHT'), path.join(out, 'COPYRIGHT.txt'));
  fs.copyFileSync(path.join(root, 'NOTICE.md'), path.join(out, 'NOTICE.md'));
  fs.copyFileSync(path.join(root, 'NOTICE.ru.md'), path.join(out, 'NOTICE.ru.md'));
  const components = collect();
  fs.writeFileSync(path.join(out, 'third-party.json'), `${JSON.stringify(components)}\n`);
  const text = [
    `${pkg.productName} ${pkg.version} includes the following open-source components.`,
    'Electron also ships Chromium; the licences of Chromium and its parts are in LICENSES.chromium.html next to the',
    'executable.',
    '',
    ...components.map((item) => `==========\n${item.name} ${item.version} (${item.license})\n\n${item.text}\n`),
  ].join('\n');
  fs.writeFileSync(path.join(out, 'THIRD_PARTY_NOTICES.txt'), text);
  return components.length;
}

/** The page's `# ` title, or its file name. */
function titleOf(text, fallback) {
  const line = text.split('\n').find((row) => /^#\s+/.test(row));
  return line ? line.replace(/^#\s+/, '').trim() : fallback;
}

/** Page references a page links to, in order: `folder/README.md` from Home, `Page.md` from a folder index. */
function linkedPages(text, folder) {
  const prose = text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  const refs = [];
  for (const match of prose.matchAll(/\]\(([^)\s#]+?)(?:\.ru)?\.md(?:#[^)]*)?\)/g)) {
    const target = match[1];
    if (/^[a-z]+:/i.test(target) || target.startsWith('..')) continue;
    const ref = folder ? `${folder}/${target}` : target;
    if (!refs.includes(ref)) refs.push(ref);
  }
  return refs;
}

/** Markdown to plain words for search: no markup, no links' addresses, no comments. */
function plainText(text) {
  return text
    // The first two lines of a wiki page are the link to the other language and a blank line.
    .split('\n').slice(2).join('\n')
    .replace(/^#\s+.*$/m, '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_#>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The wiki for Help: docs/wiki copied to dist/help/wiki, an index (the section tree in the order Home and the folder
 * indexes list them, and every page's titles) and a search corpus per language. The notes of the running version
 * become dist/help/whatsnew.md and whatsnew.ru.md.
 */
function writeHelp() {
  const out = path.join(root, 'dist', 'help');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(path.join(out, 'wiki'), { recursive: true });
  const wiki = path.join(root, 'docs', 'wiki');
  const pages = {};
  const search = { en: [], ru: [] };
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.md')) {
        const rel = path.relative(wiki, full).split(path.sep).join('/');
        const lang = rel.endsWith('.ru.md') ? 'ru' : 'en';
        const ref = rel.replace(/(\.ru)?\.md$/, '');
        const text = fs.readFileSync(full, 'utf8');
        fs.mkdirSync(path.dirname(path.join(out, 'wiki', rel)), { recursive: true });
        fs.writeFileSync(path.join(out, 'wiki', rel), text);
        pages[ref] = pages[ref] || { title: {} };
        pages[ref].title[lang] = titleOf(text, ref);
        search[lang].push({ ref, title: pages[ref].title[lang], text: plainText(text) });
      }
    }
  };
  if (fs.existsSync(wiki)) walk(wiki);
  const home = fs.existsSync(path.join(wiki, 'Home.md')) ? fs.readFileSync(path.join(wiki, 'Home.md'), 'utf8') : '';
  const folders = linkedPages(home, '')
    .filter((ref) => /^[a-z]+\/README$/.test(ref))
    .map((indexRef) => {
      const folder = indexRef.split('/')[0];
      const index = fs.readFileSync(path.join(wiki, folder, 'README.md'), 'utf8');
      return { folder, index: indexRef, pages: linkedPages(index, folder).filter((ref) => pages[ref] && ref !== indexRef) };
    });
  fs.writeFileSync(path.join(out, 'wiki-index.json'), `${JSON.stringify({ folders, pages })}\n`);
  fs.writeFileSync(path.join(out, 'wiki-search.json'), `${JSON.stringify(search)}\n`);
  let count = Object.keys(pages).length;
  for (const [suffix, lang] of [['', 'en'], ['.ru', 'ru']]) {
    const notes = path.join(root, 'docs', 'releases', `v${pkg.version}${suffix}.md`);
    if (fs.existsSync(notes)) {
      fs.copyFileSync(notes, path.join(out, `whatsnew${lang === 'ru' ? '.ru' : ''}.md`));
      count += 1;
    }
  }
  return count;
}

const components = writeNotices();
const help = writeHelp();
console.log(`build-assets: ${components} third-party components, ${help} help pages`);
