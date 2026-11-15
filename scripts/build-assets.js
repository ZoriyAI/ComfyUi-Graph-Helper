#!/usr/bin/env node
/**
 * Files the app reads at run time that are not code, written into dist/ after the main and renderer builds:
 *
 * - dist/notices/LICENSE.txt: the app's own licence.
 * - dist/notices/third-party.json and THIRD_PARTY_NOTICES.txt: every package that ships with the app (main's
 *   runtime dependencies, the packages the renderer bundle is built from, and Electron itself) with its version,
 *   licence and licence text. Settings ▸ About lists them; the deb's copyright file carries the text.
 * - dist/help/*.md: the user guide and troubleshooting in both languages, the notes of the current release, and
 *   the content rules (docs/CONTENT.md and docs/CONTENT.ru.md as content.en.md and content.ru.md), for
 *   Help ▸ «Руководство», «Решение проблем», «Что нового», «Правила содержимого».
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

const LICENCE_FILE = /^(licen[cs]e|copying|notice)(\.[a-z]+)?$/i;

function licenceText(dir) {
  const files = fs.readdirSync(dir).filter((file) => LICENCE_FILE.test(file)).sort();
  return files.map((file) => fs.readFileSync(path.join(dir, file), 'utf8').trim()).join('\n\n');
}

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

function writeNotices() {
  const out = path.join(root, 'dist', 'notices');
  fs.mkdirSync(out, { recursive: true });
  fs.copyFileSync(path.join(root, 'LICENSE'), path.join(out, 'LICENSE.txt'));
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

function writeHelp() {
  const out = path.join(root, 'dist', 'help');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const userDocs = path.join(root, 'docs', 'user');
  let count = 0;
  if (fs.existsSync(userDocs)) {
    for (const file of fs.readdirSync(userDocs).filter((name) => name.endsWith('.md'))) {
      fs.copyFileSync(path.join(userDocs, file), path.join(out, file));
      count += 1;
    }
  }
  for (const [source, target] of [['CONTENT.md', 'content.en.md'], ['CONTENT.ru.md', 'content.ru.md']]) {
    const file = path.join(root, 'docs', source);
    if (!fs.existsSync(file)) continue;
    fs.copyFileSync(file, path.join(out, target));
    count += 1;
  }
  const notes = path.join(root, 'docs', 'releases', `v${pkg.version}.md`);
  if (fs.existsSync(notes)) {
    fs.copyFileSync(notes, path.join(out, 'whatsnew.md'));
    count += 1;
  }
  return count;
}

const components = writeNotices();
const help = writeHelp();
console.log(`build-assets: ${components} third-party components, ${help} help files`);
