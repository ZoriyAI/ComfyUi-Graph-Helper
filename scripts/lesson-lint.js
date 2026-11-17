#!/usr/bin/env node
/**
 * Lints lessons against the rules of the app and the template of the new standard (standard 2), and prints what is
 * wrong or missing in plain words. It reads; it changes nothing.
 *
 * Usage: node scripts/lesson-lint.js                     (every built-in lesson of standard 2)
 *        node scripts/lesson-lint.js --all               (every built-in lesson; standard 1 lessons list what they
 *                                                        miss for standard 2 without failing)
 *        node scripts/lesson-lint.js one-factor          (built-in lessons by id)
 *        node scripts/lesson-lint.js my.lesson.json      (lesson files, one lesson or a pack)
 *        --strict                                        (also fail when a lesson misses a part of standard 2)
 *
 * Who uses it: the people who write lessons (docs/wiki/dev/Writing-A-Lesson.md). The lessons live in TypeScript, so
 * this runs scripts/lib/lesson-lint.ts through the explicitly installed vite-node runner.
 */
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
let cli;
try {
  cli = require.resolve('vite-node/cli', { paths: [root] });
} catch {
  console.error('vite-node is not installed: run npm ci first.');
  process.exit(2);
}
// The root is scripts/lib, where no Vite config lives: the app's own config is for the window, not for this.
const run = spawnSync(process.execPath, [cli, '--root', path.join(__dirname, 'lib'), path.join(__dirname, 'lib', 'lesson-lint.ts'), ...process.argv.slice(2)], { cwd: root, stdio: 'inherit' });
process.exit(run.status ?? 1);
