// Makes the screenshots of the public README and its gallery: docs/screenshots/en|ru/NN-name.png.
// Who runs it: a maintainer, after `npm run build`, through `npm run shots:public` (which wraps it in xvfb-run).
// Why a wrapper: the capture itself is a Playwright spec (tests/e2e/public-shots/public.test.ts) because it starts
// the TypeScript fake servers of the tests the same way the e2e tests do; the spec is skipped in ordinary e2e runs
// and only this script turns it on. It builds nothing and talks to no real server. Then hero.js composes the
// README's wide picture and the social preview from those screenshots.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
if (!fs.existsSync(path.join(root, 'dist/main/index.js'))) {
  console.error('public screenshots: run `npm run build` first (dist/main/index.js is missing)');
  process.exit(1);
}
const result = spawnSync('npx', ['playwright', 'test', 'tests/e2e/public-shots/public.test.ts', '--workers=1', '--trace', 'off', '--retries=0'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, PUBLIC_SHOTS: '1' },
});
if (result.status !== 0) process.exit(result.status === null ? 1 : result.status);
// The wide pictures for the README top and the social preview are composed from the fresh screenshots.
const hero = spawnSync('npx', ['electron', '--no-sandbox', '--disable-gpu', 'scripts/capture-screens/hero.js'], { cwd: root, stdio: 'inherit' });
process.exit(hero.status === null ? 1 : hero.status);
