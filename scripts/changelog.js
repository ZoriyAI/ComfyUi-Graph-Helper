#!/usr/bin/env node
/**
 * Writes CHANGELOG.md from docs/releases/vX.Y.Z.md: newest first, each release with the first paragraph of its
 * notes and a link to the whole file. The notes stay the source; this file is an index of them.
 *
 * Usage: node scripts/changelog.js          (write CHANGELOG.md)
 *        node scripts/changelog.js --check  (exit 1 when CHANGELOG.md is not up to date; used in CI)
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const releases = path.join(root, 'docs', 'releases');

function parseVersion(file) {
  const match = /^v(\d+)\.(\d+)\.(\d+)\.md$/.exec(file);
  return match ? match.slice(1).map(Number) : null;
}

/** The first paragraph after the title: the lines up to the first blank line or heading. */
function summary(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n').slice(1);
  const start = lines.findIndex((line) => line.trim() !== '');
  if (start === -1) return '';
  const out = [];
  for (const line of lines.slice(start)) {
    if (line.trim() === '' || line.startsWith('#')) break;
    out.push(line.trim());
  }
  return out.join(' ');
}

function build() {
  const files = fs.readdirSync(releases)
    .map((file) => ({ file, version: parseVersion(file) }))
    .filter((item) => item.version)
    .sort((a, b) => b.version[0] - a.version[0] || b.version[1] - a.version[1] || b.version[2] - a.version[2]);
  const parts = [
    '# Изменения',
    '',
    'Список выпусков, новые сверху. Полные заметки к каждому выпуску лежат в `docs/releases/`.',
    'Этот файл собирает `node scripts/changelog.js`; править нужно заметки, а не его.',
    '',
  ];
  for (const { file, version } of files) {
    const text = fs.readFileSync(path.join(releases, file), 'utf8');
    parts.push(`## ${version.join('.')}`, '');
    const first = summary(text);
    if (first) parts.push(first, '');
    parts.push(`Заметки: [docs/releases/${file}](docs/releases/${file})`, '');
  }
  return parts.join('\n');
}

const text = build();
const target = path.join(root, 'CHANGELOG.md');
if (process.argv.includes('--check')) {
  const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
  if (current !== text) {
    console.error('CHANGELOG.md is not up to date: run node scripts/changelog.js');
    process.exit(1);
  }
  console.log('CHANGELOG.md is up to date');
} else {
  fs.writeFileSync(target, text);
  console.log(`CHANGELOG.md: ${text.split('\n## ').length - 1} releases`);
}
