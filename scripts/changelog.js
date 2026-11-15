#!/usr/bin/env node
/**
 * Writes CHANGELOG.md (English) and CHANGELOG.ru.md (Russian) from docs/releases: newest first, each release with
 * the first paragraph of its notes and a link to them (0.9.0, the first public release, and later), then the private
 * 0.x line (docs/releases/0.x.md). The notes
 * stay the source; these files are an index of them.
 *
 * A release has two notes files: docs/releases/vX.Y.Z.md (English) and vX.Y.Z.ru.md (Russian). The first line of
 * each links to the other; the second non-empty line is the `#` title; the paragraph after it is the summary.
 *
 * Usage: node scripts/changelog.js          (write both files)
 *        node scripts/changelog.js --check  (exit 1 when either file is out of date; used in CI)
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const releases = path.join(root, 'docs', 'releases');

// The fixed words of each language's changelog file.
const TEXT = {
  en: {
    other: 'Русский',
    otherFile: 'CHANGELOG.ru.md',
    title: 'Changes',
    lead: [
      'Releases, newest first. Each release has full notes in `docs/releases/`.',
      'This file is written by `node scripts/changelog.js`: change the notes, not this file.',
    ],
    notes: 'Notes',
    earlier: 'Earlier versions',
    earlierText: 'Versions 0.2.0 to 0.8.0 were private releases, made before the project was published.',
    earlierLink: 'A short list of what each brought',
  },
  ru: {
    other: 'English',
    otherFile: 'CHANGELOG.md',
    title: 'Изменения',
    lead: [
      'Выпуски, новые сверху. Полные заметки к каждому выпуску лежат в `docs/releases/`.',
      'Этот файл собирает `node scripts/changelog.js`: править нужно заметки, а не его.',
    ],
    notes: 'Заметки',
    earlier: 'Ранние версии',
    earlierText: 'Версии с 0.2.0 по 0.8.0 выходили закрыто, до того как проект стал публичным.',
    earlierLink: 'Коротко о том, что принесла каждая',
  },
};

/** [major, minor, patch] of a notes file name in `lang`, or null when the name is not one. */
function parseVersion(file, lang) {
  const match = (lang === 'ru' ? /^v(\d+)\.(\d+)\.(\d+)\.ru\.md$/ : /^v(\d+)\.(\d+)\.(\d+)\.md$/).exec(file);
  return match ? match.slice(1).map(Number) : null;
}

/** The first paragraph after the `#` title: the lines up to the first blank line or heading. */
function summary(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const title = lines.findIndex((line) => /^#\s/.test(line));
  const rest = lines.slice(title + 1);
  const start = rest.findIndex((line) => line.trim() !== '');
  if (start === -1) return '';
  const out = [];
  for (const line of rest.slice(start)) {
    if (line.trim() === '' || line.startsWith('#')) break;
    out.push(line.trim());
  }
  return out.join(' ');
}

/** The whole changelog text in `lang`. */
function build(lang) {
  const t = TEXT[lang];
  const files = fs.readdirSync(releases)
    .map((file) => ({ file, version: parseVersion(file, lang) }))
    .filter((item) => item.version)
    // 0.x versions are listed together under "Earlier versions".
    .filter((item) => item.version[0] >= 1 || (item.version[0] === 0 && item.version[1] >= 9))
    .sort((a, b) => b.version[0] - a.version[0] || b.version[1] - a.version[1] || b.version[2] - a.version[2]);
  const parts = [`[${t.other}](${t.otherFile})`, '', `# ${t.title}`, '', ...t.lead, ''];
  for (const { file, version } of files) {
    const text = fs.readFileSync(path.join(releases, file), 'utf8');
    parts.push(`## ${version.join('.')}`, '');
    const first = summary(text);
    if (first) parts.push(first, '');
    parts.push(`${t.notes}: [docs/releases/${file}](docs/releases/${file})`, '');
  }
  const history = lang === 'ru' ? '0.x.ru.md' : '0.x.md';
  parts.push(`## ${t.earlier}`, '', t.earlierText, `${t.earlierLink}: [docs/releases/${history}](docs/releases/${history}).`, '');
  return parts.join('\n');
}

const outputs = { en: path.join(root, 'CHANGELOG.md'), ru: path.join(root, 'CHANGELOG.ru.md') };
if (process.argv.includes('--check')) {
  let stale = false;
  for (const [lang, target] of Object.entries(outputs)) {
    const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
    if (current !== build(lang)) {
      console.error(`${path.basename(target)} is not up to date: run node scripts/changelog.js`);
      stale = true;
    }
  }
  if (stale) process.exit(1);
  console.log('CHANGELOG.md and CHANGELOG.ru.md are up to date');
} else {
  for (const [lang, target] of Object.entries(outputs)) fs.writeFileSync(target, build(lang));
  console.log('CHANGELOG.md and CHANGELOG.ru.md written');
}
