/** Public product catalogue built from the exact application data. No profile, settings, models or chat access. */
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function productManifest(root) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const { LESSONS } = require(path.join(root, 'dist/shared/lessons/lessons.js'));
  const { builtinLessonDoc } = require(path.join(root, 'dist/shared/lessons/share/builtin.js'));
  const { BLUEPRINTS } = require(path.join(root, 'dist/shared/templates/catalog.js'));
  const { GUIDE_PROBLEMS } = require(path.join(root, 'dist/shared/guidance/catalog.js'));
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  let source = { revision: null, committedAt: null, modified: true };
  try {
    source = { revision: git(['rev-parse', 'HEAD']), committedAt: git(['show', '-s', '--format=%cI', 'HEAD']),
      modified: Boolean(git(['status', '--porcelain', '--untracked-files=no'])) };
  } catch { /* A source archive has no .git: do not invent an exact revision or clean state. */ }
  return createProductManifest({ pkg, source,
    distribution: JSON.parse(fs.readFileSync(path.join(root, 'src/shared/product/distribution.json'), 'utf8')),
    lessons: LESSONS.map(lesson => builtinLessonDoc(lesson.id)), guides: GUIDE_PROBLEMS, blueprints: BLUEPRINTS });
}

function createProductManifest({ pkg, source, distribution, lessons, guides, blueprints }) {
  const payload = {
    schema: 'nodewise-product/v1', product: pkg.productName, version: pkg.version, repository: pkg.homepage, source,
    distribution,
    lessons: lessons.map(document => ({ id: document.id, sha256: digest(document), document })),
    guides: guides.map(document => ({ id: document.id, sha256: digest(document), document })),
    blueprints: blueprints.map(b => ({ id: b.id, family: b.family, title: b.title, description: b.description, workflowSha256: digest(b.workflow) })),
  };
  return { schema: 'nodewise-product-envelope/v1', algorithm: 'sha256-json-utf8', sha256: digest(payload), payload };
}

module.exports = { productManifest, createProductManifest };
